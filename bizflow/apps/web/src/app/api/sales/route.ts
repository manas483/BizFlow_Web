import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { saleSchema } from '@/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10));
    const skip  = (page - 1) * limit;

    const where = {
      businessId: session.user.businessId,
      ...(search ? {
        OR: [
          { invoiceNo: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } }
        ]
      } : {}),
      ...(status && status.toLowerCase() !== 'all' ? { status: status.toLowerCase() } : {}),
    };

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: { customer: true, items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    return NextResponse.json({ data: sales, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const validatedData = saleSchema.parse(body);
    const { customerId, items, paid, status, notes, placeOfSupply, reverseCharge, isAggregate, aggregateDate } = validatedData;

    const result = await prisma.$transaction(async (tx: any) => {
      // 0. Get business settings
      const business = await tx.business.findUnique({
        where: { id: session.user.businessId },
        select: { gstInclusive: true }
      });
      const gstInclusive = business?.gstInclusive ?? false;

      // 1. Calculate total
      let total = 0;
      const productMap: Record<string, any> = {};
      for (const item of items) {
        const product = await tx.product.findFirst({ where: { id: item.productId, businessId: session.user.businessId } });
        if (!product) throw new Error(`Product ${item.productId} not found`);
        productMap[item.productId] = product;
        if (product.stock < item.qty) throw new Error(`Insufficient stock for ${product.name}`);
        const amount = (product.sellingPrice * item.qty) - (item.discount || 0);
        const rate = item.gstRate || product.gstRate || 0;
        
        if (gstInclusive && rate > 0) {
          total += amount;
        } else {
          const itemGst = amount * (rate / 100);
          total += amount + itemGst;
        }
      }

      // 2. Auto-generate invoice number (collision-proof)
      const year = new Date().getFullYear();
      const prefix = `INV-${year}-`;
      const lastSale = await tx.sale.findFirst({
        where: { businessId: session.user.businessId, invoiceNo: { startsWith: prefix } },
        orderBy: { invoiceNo: 'desc' },
        select: { invoiceNo: true }
      });
      let nextNum = 1;
      if (lastSale) {
        const parts = lastSale.invoiceNo.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      const invoiceNo = `${prefix}${String(nextNum).padStart(3, "0")}`;

      // 3. Create sale
      const sale = await tx.sale.create({
        data: {
          invoiceNo,
          customerId,
          total,
          paid: paid || 0,
          status: status || (paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid"),
          notes,
          placeOfSupply: placeOfSupply || null,
          reverseCharge: reverseCharge === true,
          isAggregate: isAggregate === true,
          aggregateDate: aggregateDate || null,
          businessId: session.user.businessId,
          items: {
              create: items.map((item: any) => ({
                productId: item.productId,
                qty: item.qty,
                price: item.price,
                purchasePrice: productMap[item.productId]?.purchasePrice || 0,
                discount: parseFloat(item.discount) || 0,
              hsnCode: item.hsnCode,
              gstRate: parseFloat(item.gstRate) || 0
            }))
          }
        }
      });

      // 4. Stock auto-deduction and low stock check
      for (const item of items) {
        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.qty } }
        });

        if (updatedProduct.stock <= updatedProduct.minStock) {
          // Check if a recent low stock notification already exists for this product to avoid spam
          const recentNotif = await tx.notification.findFirst({
            where: {
              businessId: session.user.businessId,
              type: 'alert',
              message: { contains: updatedProduct.name },
              read: false,
            }
          });

          if (!recentNotif) {
            await tx.notification.create({
              data: {
                type: 'alert',
                title: 'Low Stock Alert',
                message: `Product "${updatedProduct.name}" is running low on stock (${updatedProduct.stock} left).`,
                businessId: session.user.businessId,
              }
            });

            // Send Email Alert
            // Get business owner or super admin email
            const admin = await tx.user.findFirst({
              where: { businessId: session.user.businessId, role: { in: ['SUPER_ADMIN', 'MANAGER'] } },
              orderBy: { role: 'asc' } // SUPER_ADMIN first
            });
            if (admin) {
              const { sendLowStockAlert } = await import('@/lib/email');
              await sendLowStockAlert(admin.email, updatedProduct.name, updatedProduct.stock);
            }
          }
        }
      }

      // 5. Update customer dues and totalPurchases
      await tx.customer.update({
        where: { id: customerId },
        data: {
          totalPurchases: { increment: total },
          dues: { increment: total - (paid || 0) }
        }
      });

      // 6. Track user activity for ML Engine
      await tx.userActivity.create({
        data: {
          businessId: session.user.businessId,
          userId: session.user.id ?? "unknown",
          eventType: "sale_created",
          metadata: { saleId: sale.id, total, itemsCount: items.length },
        }
      });

      return sale;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error("Sale Creation Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 400 });
  }
}

