export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { billOfSupplySchema } from '@/shared/lib/validations';
import { z } from 'zod';
import { buildProductSnapshot } from '@/shared/lib/product-snapshot';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const bills = await prisma.billOfSupply.findMany({
      where: { businessId: session.user.businessId },
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(bills);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const validatedData = billOfSupplySchema.parse(body);
    const { customerId, items, paid, supplyType, notes } = validatedData;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: session.user.businessId },
      select: { id: true }
    });
    if (!customer) return NextResponse.json({ error: 'Customer not found or access denied' }, { status: 403 });

    const count = await prisma.billOfSupply.count({ where: { businessId: session.user.businessId } });
    const billNo = `BOS-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    // Fetch products to snapshot purchasePrice and metadata, checking businessId and active status
    const productIds = items.map((i: any) => i.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        businessId: session.user.businessId
      }
    });
    const productMap = Object.fromEntries(products.map((p: any) => [p.id, p]));

    // Check if any product is not found or is archived/inactive
    for (const item of items) {
      const prod = productMap[item.productId];
      if (!prod) {
        return NextResponse.json({ error: `Product ${item.productId} not found or access denied` }, { status: 400 });
      }
      if (!prod.active) {
        return NextResponse.json({ error: `Product "${prod.name}" is archived and cannot be used in new transactions.` }, { status: 400 });
      }
    }

    // Calculate total (no GST for bill of supply)
    let total = 0;
    for (const item of items) {
      total += item.qty * item.price;
    }
    const paidAmt = typeof paid === 'number' ? paid : parseFloat(String(paid)) || 0;
    const status = paidAmt >= total ? 'paid' : paidAmt > 0 ? 'partial' : 'unpaid';

    const bill = await prisma.billOfSupply.create({
      data: {
        billNo, customerId,
        total, paid: paidAmt, status,
        supplyType: supplyType || 'exempt',
        notes, businessId: session.user.businessId,
        items: {
          create: items.map((i: any) => {
            const product = productMap[i.productId];
            return {
              productId: i.productId,
              qty: i.qty,
              price: i.price,
              purchasePrice: product.purchasePrice || 0,
              hsnCode: i.hsnCode || null,
              ...buildProductSnapshot(product),
            };
          }),
        },
      },
    });
    return NextResponse.json(bill, { status: 201 });
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: e.issues }, { status: 400 });
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
