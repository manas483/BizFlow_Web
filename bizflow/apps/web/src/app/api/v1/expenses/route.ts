export const dynamic = 'force-dynamic';
/**
 * GET  /api/v1/expenses   — paginated expense list
 * POST /api/v1/expenses   — create expense
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { expenseSchema }          from '@/shared/lib/validations';
import { ok, created, validationError, internalError, parsePagination, buildPagination } from '@/shared/lib/response';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const sp      = new URL(req.url).searchParams;
    const { page, limit, skip, sortBy, sortDir } = parsePagination(sp);
    const category  = sp.get('category') ?? '';
    const recurring = sp.get('recurring');
    const from      = sp.get('from');
    const to        = sp.get('to');

    const where: any = {
      businessId: session.user.businessId,
      ...(category && category !== 'All' ? { category } : {}),
      ...(recurring !== null ? { recurring: recurring === 'true' } : {}),
      ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + 'T23:59:59') } : {}) } } : {}),
    };

    const allowedSort = ['date', 'amount', 'category', 'createdAt'];
    const orderField  = allowedSort.includes(sortBy) ? sortBy : 'date';

    const [data, total] = await Promise.all([
      prisma.expense.findMany({ where, orderBy: { [orderField]: sortDir }, skip, take: limit }),
      prisma.expense.count({ where }),
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
    const parsed  = expenseSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);

    const expense = await prisma.expense.create({
      data: { ...parsed.data, date: new Date(parsed.data.date), businessId: session.user.businessId },
    });

    await prisma.userActivity.create({
      data: { businessId: session.user.businessId, userId: session.user.id, eventType: 'expense_added', metadata: { expenseId: expense.id, amount: expense.amount, category: expense.category } },
    });

    return created(expense);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

