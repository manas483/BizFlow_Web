export const dynamic = 'force-dynamic';
/**
 * GET  /api/v1/customers        — paginated customer list
 * POST /api/v1/customers        — create customer
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { customerSchema }         from '@/shared/lib/validations';
import { ok, created, validationError, internalError, parsePagination, buildPagination } from '@/shared/lib/response';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const sp      = new URL(req.url).searchParams;
    const { page, limit, skip, sortBy, sortDir } = parsePagination(sp);
    const search = sp.get('search') ?? '';
    const status = sp.get('status') ?? '';

    const where: any = {
      businessId: session.user.businessId,
      deletedAt: null,
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { phone: { contains: search } }] } : {}),
      ...(status ? { status } : {}),
    };

    const allowedSort = ['name', 'dues', 'totalPurchases', 'createdAt'];
    const orderField  = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      prisma.customer.findMany({ where, orderBy: { [orderField]: sortDir }, skip, take: limit }),
      prisma.customer.count({ where }),
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
    const parsed  = customerSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);

    const customer = await prisma.customer.create({
      data: { ...parsed.data, phone: parsed.data.phone || '', status: 'active', businessId: session.user.businessId },
    });

    await prisma.userActivity.create({
      data: { businessId: session.user.businessId, userId: session.user.id, eventType: 'customer_added', metadata: { customerId: customer.id } },
    });

    return created(customer);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

