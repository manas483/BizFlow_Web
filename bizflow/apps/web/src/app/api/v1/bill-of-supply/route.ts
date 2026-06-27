export const dynamic = 'force-dynamic';
/**
 * GET  /api/v1/bill-of-supply  — paginated bill of supply list
 * POST /api/v1/bill-of-supply  — create bill of supply (collision-proof)
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { billOfSupplySchema }     from '@/shared/lib/validations';
import { ok, created, validationError, internalError, parsePagination, buildPagination } from '@/shared/lib/response';
import { z } from 'zod';
import { buildProductSnapshot } from '@/shared/lib/product-snapshot';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const sp      = new URL(req.url).searchParams;
    const { page, limit, skip, sortBy, sortDir } = parsePagination(sp);
    const search = sp.get('search') ?? '';

    const where: any = {
      businessId: session.user.businessId,
      ...(search ? {
        OR: [
          { billNo:   { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      } : {}),
    };

    const allowedSort = ['billNo', 'total', 'createdAt'];
    const orderField  = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      prisma.billOfSupply.findMany({
        where,
        include:  { customer: true, items: { include: { product: true } } },
        orderBy:  { [orderField]: sortDir },
        skip,
        take: limit,
      }),
      prisma.billOfSupply.count({ where }),
    ]);

    return ok(data, { pagination: buildPagination(total, page, limit) });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const parsed  = billOfSupplySchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);
    const { customerId, items, paid, supplyType, notes } = parsed.data;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: session.user.businessId },
      select: { id: true }
    });
    if (!customer) throw new Error('Customer not found or access denied');

    // Collision-safe numbering
    const year   = new Date().getFullYear();
    const prefix = `BOS-${year}-`;
    const last   = await prisma.billOfSupply.findFirst({
      where:   { businessId: session.user.businessId, billNo: { startsWith: prefix } },
      orderBy: { billNo: 'desc' },
      select:  { billNo: true },
    });
    const nextNum = last ? (parseInt(last.billNo.split('-').at(-1)!, 10) || 0) + 1 : 1;
    const billNo  = `${prefix}${String(nextNum).padStart(3, '0')}`;

    const productIds = items.map((i: any) => i.productId);
    const products   = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        businessId: session.user.businessId
      }
    });
    const productMap: Record<string, any> = Object.fromEntries(products.map((p) => [p.id, p]));

    // Check if any product is not found or is archived/inactive
    for (const item of items) {
      const prod = productMap[item.productId];
      if (!prod) {
        throw new Error(`Product ${item.productId} not found or access denied`);
      }
      if (!prod.active) {
        throw new Error(`Product "${prod.name}" is archived and cannot be used in new transactions.`);
      }
    }

    let total = 0;
    for (const item of items) total += item.qty * item.price;
    const paidAmt = typeof paid === 'number' ? paid : parseFloat(String(paid)) || 0;
    const status  = paidAmt >= total ? 'paid' : paidAmt > 0 ? 'partial' : 'unpaid';

    const bill = await prisma.billOfSupply.create({
      data: {
        billNo, customerId, total, paid: paidAmt, status,
        supplyType: supplyType || 'exempt', notes, businessId: session.user.businessId,
        items: {
          create: items.map((i: any) => {
            const product = productMap[i.productId];
            return {
              productId: i.productId, qty: i.qty, price: i.price,
              purchasePrice: product?.purchasePrice || 0,
              hsnCode: i.hsnCode || null,
              ...buildProductSnapshot(product),
            };
          }),
        },
      },
    });

    return created(bill);
  } catch (e: any) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError(e.message || 'Internal Server Error');
  }
}
