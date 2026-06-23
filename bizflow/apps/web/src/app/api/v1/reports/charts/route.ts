export const dynamic = 'force-dynamic';
/**
 * GET /api/v1/reports/charts
 *
 * Returns time-series data for chart rendering:
 *   salesByMonth  — array of { createdAt, _sum: { total, paid } }
 *   expensesByDate — array of { date, _sum: { amount } }
 *
 * Lightweight — suitable for mobile chart widgets that render progressively.
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

    const [salesByMonth, expensesByDate] = await Promise.all([
      prisma.sale.groupBy({
        by:      ['createdAt'],
        where:   { businessId: biz, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
        _sum:    { total: true, paid: true },
      }),
      prisma.expense.groupBy({
        by:    ['date'],
        where: { businessId: biz, date: { gte: from, lte: to } },
        _sum:  { amount: true },
      }),
    ]);

    return ok({ salesByMonth, expensesByDate, period: { from, to } });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error('[reports/charts]', e);
    return internalError();
  }
}

