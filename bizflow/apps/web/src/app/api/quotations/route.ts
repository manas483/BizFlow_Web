import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { quotationSchema } from '@/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    const quotations = await prisma.quotation.findMany({
      where: {
        businessId: session.user.businessId,
        ...(search ? { 
          OR: [
            { quotationNo: { contains: search, mode: 'insensitive' } },
            { customer: { name: { contains: search, mode: 'insensitive' } } }
          ]
        } : {}),
      },
      include: {
        customer: true,
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(quotations);
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
    const validatedData = quotationSchema.parse(body);
    const { customerId, items, notes, placeOfSupply, reverseCharge, validUntil } = validatedData;

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
        const amount = (product.sellingPrice * item.qty) - (item.discount || 0);
        const rate = item.gstRate || product.gstRate || 0;
        
        if (gstInclusive && rate > 0) {
          total += amount;
        } else {
          const itemGst = amount * (rate / 100);
          total += amount + itemGst;
        }
      }

      // 2. Auto-generate quotation number (collision-proof)
      const year = new Date().getFullYear();
      const prefix = `QTN-${year}-`;
      const lastQuotation = await tx.quotation.findFirst({
        where: { businessId: session.user.businessId, quotationNo: { startsWith: prefix } },
        orderBy: { quotationNo: 'desc' },
        select: { quotationNo: true }
      });
      let nextNum = 1;
      if (lastQuotation) {
        const parts = lastQuotation.quotationNo.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      const quotationNo = `${prefix}${String(nextNum).padStart(3, "0")}`;

      // 3. Create quotation
      const quotation = await tx.quotation.create({
        data: {
          quotationNo,
          customerId,
          total,
          notes,
          placeOfSupply: placeOfSupply || null,
          reverseCharge: reverseCharge === true,
          validUntil: validUntil ? new Date(validUntil) : null,
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

      await tx.userActivity.create({
        data: {
          businessId: session.user.businessId,
          userId: session.user.id ?? "unknown",
          eventType: "quotation_created",
          metadata: { quotationId: quotation.id, total },
        }
      });

      return quotation;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

