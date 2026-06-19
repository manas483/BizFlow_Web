/**
 * GET /api/v1/reports/expenses
 *
 * Expense breakdown by category for the period.
 * Returns: expensesByCategory[], totalExpenses
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { ok, err, internalError } from '@/shared/lib/response';
import { parseDateRange }         from '../_dateRange';

export async function GET(req: NextRequest) {
  try {
    const session   = await requireAuth();
    const biz       = session.user.businessId;
    const sp        = new URL(req.url).searchParams;
    let   dateRange = { from: new Date(), to: new Date(), period: 'monthly' };

    try { dateRange = parseDateRange(sp); }
    catch (e: any) { return err('VALIDATION_ERROR', e.message, 422); }

    const { from, to } = dateRange;

    const [byCategory, agg] = await Promise.all([
      prisma.expense.groupBy({
        by:      ['category'],
        where:   { businessId: biz, date: { gte: from, lte: to } },
        _sum:    { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),
      prisma.expense.aggregate({
        where: { businessId: biz, date: { gte: from, lte: to } },
        _sum:  { amount: true },
      }),
    ]);

    return ok({
      period:             { from, to },
      totalExpenses:      agg._sum.amount ?? 0,
      expensesByCategory: byCategory.map((e) => ({
        category: e.category,
        amount:   e._sum.amount ?? 0,
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error('[reports/expenses]', e);
    return internalError();
  }
}
