import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

// POST /api/quotations/[id]/convert — convert a quotation into a Tax Invoice
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const quotation = await prisma.quotation.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { items: true },
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const invoice = await prisma.$transaction(async (tx: any) => {
      // Auto-generate invoice number
      const year = new Date().getFullYear();
      const prefix = `INV-${year}-`;
      const last = await tx.sale.findFirst({
        where: { businessId: session.user.businessId, invoiceNo: { startsWith: prefix } },
        orderBy: { invoiceNo: 'desc' },
        select: { invoiceNo: true },
      });
      let nextNum = 1;
      if (last) {
        const parts = last.invoiceNo.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      const invoiceNo = `${prefix}${String(nextNum).padStart(3, '0')}`;

      // Create the sale from quotation data
      const sale = await tx.sale.create({
        data: {
          invoiceNo,
          customerId: quotation.customerId,
          total: quotation.total,
          paid: 0,
          status: 'unpaid',
          placeOfSupply: quotation.placeOfSupply,
          reverseCharge: quotation.reverseCharge,
          notes: quotation.notes
            ? `Converted from ${quotation.quotationNo}. ${quotation.notes}`
            : `Converted from ${quotation.quotationNo}`,
          businessId: session.user.businessId,
          items: {
            create: quotation.items.map((item: any) => ({
              productId: item.productId,
              qty: item.qty,
              price: item.price,
              discount: item.discount ?? 0,
              hsnCode: item.hsnCode ?? null,
              gstRate: item.gstRate ?? 0,
            })),
          },
        },
      });

      // Stock auto-deduction & low stock check
      for (const item of quotation.items) {
        await tx.$executeRaw`UPDATE "Product" SET "stock" = "stock" - ${Math.round(Number(item.qty))}, "baseStock" = COALESCE("baseStock", 0) - ${Number(item.qty)} WHERE id = ${item.productId}`;
        const updatedProduct = await tx.product.findUnique({ where: { id: item.productId } });

        if (updatedProduct && updatedProduct.stock <= updatedProduct.minStock) {
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
            const admin = await tx.user.findFirst({
              where: { businessId: session.user.businessId, role: { in: ['SUPER_ADMIN', 'MANAGER'] } },
              orderBy: { role: 'asc' }
            });
            if (admin) {
              const { sendLowStockAlert } = await import('@/shared/lib/email');
              await sendLowStockAlert(admin.email, updatedProduct.name, updatedProduct.stock);
            }
          }
        }
      }

      // Update customer ledger
      if (quotation.customerId) {
        await tx.customer.update({
          where: { id: quotation.customerId },
          data: {
            totalPurchases: { increment: quotation.total },
            dues: { increment: quotation.total } // Paid is initialized to 0
          }
        });
      }

      // Log activity
      await tx.userActivity.create({
        data: {
          businessId: session.user.businessId,
          userId: session.user.id ?? 'unknown',
          eventType: 'quotation_converted',
          metadata: { quotationId: id, saleId: sale.id, invoiceNo },
        },
      });

      return sale;
    });

    return NextResponse.json({ success: true, invoiceNo: invoice.invoiceNo, saleId: invoice.id });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('Convert quotation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
