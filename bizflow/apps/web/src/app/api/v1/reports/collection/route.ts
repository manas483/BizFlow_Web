export const dynamic = 'force-dynamic';
/**
 * GET /api/v1/reports/collection
 *
 * Receivables / collection health for the period:
 *   collectedAmount, outstandingDues, pendingCollection (all-time dues),
 *   collectionEfficiency, topDebtors (top 5 by dues)
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

    const [salesAgg, customersAgg, topDebtors] = await Promise.all([
      prisma.sale.aggregate({
        where: { businessId: biz, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
        _sum:  { total: true, paid: true },
      }),
      prisma.customer.aggregate({ where: { businessId: biz }, _sum: { dues: true } }),
      prisma.customer.findMany({
        where:   { businessId: biz, dues: { gt: 0 } },
        orderBy: { dues: 'desc' },
        take:    5,
        select:  { id: true, name: true, phone: true, dues: true },
      }),
    ]);

    const totalSales       = salesAgg._sum.total   ?? 0;
    const collectedAmount  = salesAgg._sum.paid    ?? 0;
    const outstandingDues  = Math.max(0, totalSales - collectedAmount);
    const pendingCollection = customersAgg._sum.dues ?? 0;
    const collectionEff    = totalSales > 0 ? parseFloat(((collectedAmount / totalSales) * 100).toFixed(2)) : 0;

    return ok({
      period:               { from, to },
      collectedAmount,
      outstandingDues,
      pendingCollection,
      collectionEfficiency: collectionEff,
      topDebtors,
    });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error('[reports/collection]', e);
    return internalError();
  }
}

