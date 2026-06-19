/**
 * GET  /api/v1/bill-of-supply   — paginated bill of supply list
 * POST /api/v1/bill-of-supply   — create bill of supply
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { billOfSupplySchema }     from '@/shared/lib/validations';
import { ok, created, validationError, internalError, parsePagination, buildPagination } from '@/shared/lib/response';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const sp      = new URL(req.url).searchParams;
    const { page, limit, skip, sortBy, sortDir } = parsePagination(sp);
    const search = sp.get('search') ?? '';
    const status = sp.get('status') ?? '';
    const from   = sp.get('from');
    const to     = sp.get('to');

    const where: any = {
      businessId: session.user.businessId,
      ...(search ? { OR: [{ billNo: { contains: search, mode: 'insensitive' as const } }, { customer: { name: { contains: search, mode: 'insensitive' as const } } }] } : {}),
      ...(status ? { status } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + 'T23:59:59') } : {}) } } : {}),
    };

    const allowedSort = ['billNo', 'total', 'status', 'createdAt'];
    const orderField  = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      prisma.billOfSupply.findMany({
        where,
        include: { customer: true, items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
        orderBy: { [orderField]: sortDir },
        skip, take: limit,
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
    const products   = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    let total = 0;
    for (const item of items) total += item.qty * item.price;
    const paidAmt = typeof paid === 'number' ? paid : parseFloat(String(paid)) || 0;
    const status  = paidAmt >= total ? 'paid' : paidAmt > 0 ? 'partial' : 'unpaid';

    const bill = await prisma.billOfSupply.create({
      data: {
        billNo, customerId, total, paid: paidAmt, status,
        supplyType: supplyType || 'exempt', notes, businessId: session.user.businessId,
        items: {
          create: items.map((i: any) => ({
            productId: i.productId, qty: i.qty, price: i.price,
            purchasePrice: (productMap as any)[i.productId]?.purchasePrice || 0,
            hsnCode: i.hsnCode || null,
          })),
        },
      },
    });

    return created(bill);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}
