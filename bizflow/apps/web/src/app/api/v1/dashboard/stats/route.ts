export const dynamic = 'force-dynamic';
/**
 * GET /api/v1/dashboard/stats
 *
 * Mobile dashboard KPI cards — all-time totals + month-over-month changes.
 * Same data as /api/dashboard/stats but with standardized envelope.
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { ok, internalError }      from '@/shared/lib/response';

function pctChange(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return parseFloat((((cur - prev) / prev) * 100).toFixed(1));
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const biz     = session.user.businessId;
    const now     = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [rAll, sAll, cAll, eAll, rThis, sThis, eThis, cThis, rLast, sLast, eLast, cLast] = await Promise.all([
      prisma.sale.aggregate({ where: { businessId: biz }, _sum: { total: true } }),
      prisma.sale.count({ where: { businessId: biz } }),
      prisma.customer.count({ where: { businessId: biz } }),
      prisma.expense.aggregate({ where: { businessId: biz }, _sum: { amount: true } }),
      prisma.sale.aggregate({ where: { businessId: biz, createdAt: { gte: thisMonthStart } }, _sum: { total: true } }),
      prisma.sale.count({ where: { businessId: biz, createdAt: { gte: thisMonthStart } } }),
      prisma.expense.aggregate({ where: { businessId: biz, date: { gte: thisMonthStart } }, _sum: { amount: true } }),
      prisma.customer.count({ where: { businessId: biz, createdAt: { gte: thisMonthStart } } }),
      prisma.sale.aggregate({ where: { businessId: biz, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { total: true } }),
      prisma.sale.count({ where: { businessId: biz, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
      prisma.expense.aggregate({ where: { businessId: biz, date: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { amount: true } }),
      prisma.customer.count({ where: { businessId: biz, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
    ]);

    const cur  = { revenue: rThis._sum.total ?? 0, sales: sThis, expenses: eThis._sum.amount ?? 0, customers: cThis };
    const prev = { revenue: rLast._sum.total ?? 0, sales: sLast, expenses: eLast._sum.amount ?? 0, customers: cLast };

    return ok({
      revenue:       rAll._sum.total ?? 0,
      salesCount:    sAll,
      customerCount: cAll,
      expenses:      eAll._sum.amount ?? 0,
      changes: {
        revenue:   pctChange(cur.revenue,   prev.revenue),
        sales:     pctChange(cur.sales,     prev.sales),
        expenses:  pctChange(cur.expenses,  prev.expenses),
        customers: pctChange(cur.customers, prev.customers),
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

