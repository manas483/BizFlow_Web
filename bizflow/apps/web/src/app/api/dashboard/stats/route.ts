import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const biz = session.user.businessId;

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      // All-time totals
      revenueAll,
      salesCountAll,
      customerCountAll,
      expensesAll,
      // This month
      revenueThis,
      salesCountThis,
      expensesThis,
      customerCountThis,
      // Last month
      revenueLast,
      salesCountLast,
      expensesLast,
      customerCountLast,
    ] = await Promise.all([
      // All-time
      prisma.sale.aggregate({ where: { businessId: biz }, _sum: { total: true } }),
      prisma.sale.count({ where: { businessId: biz } }),
      prisma.customer.count({ where: { businessId: biz } }),
      prisma.expense.aggregate({ where: { businessId: biz }, _sum: { amount: true } }),

      // This month
      prisma.sale.aggregate({ where: { businessId: biz, createdAt: { gte: thisMonthStart } }, _sum: { total: true } }),
      prisma.sale.count({ where: { businessId: biz, createdAt: { gte: thisMonthStart } } }),
      prisma.expense.aggregate({ where: { businessId: biz, date: { gte: thisMonthStart } }, _sum: { amount: true } }),
      prisma.customer.count({ where: { businessId: biz, createdAt: { gte: thisMonthStart } } }),

      // Last month
      prisma.sale.aggregate({ where: { businessId: biz, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { total: true } }),
      prisma.sale.count({ where: { businessId: biz, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
      prisma.expense.aggregate({ where: { businessId: biz, date: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { amount: true } }),
      prisma.customer.count({ where: { businessId: biz, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
    ]);

    const cur = {
      revenue: revenueThis._sum.total ?? 0,
      sales: salesCountThis,
      expenses: expensesThis._sum.amount ?? 0,
      customers: customerCountThis,
    };
    const prev = {
      revenue: revenueLast._sum.total ?? 0,
      sales: salesCountLast,
      expenses: expensesLast._sum.amount ?? 0,
      customers: customerCountLast,
    };

    return NextResponse.json({
      // All-time totals shown in cards
      revenue: revenueAll._sum.total ?? 0,
      salesCount: salesCountAll,
      customerCount: customerCountAll,
      expenses: expensesAll._sum.amount ?? 0,

      // Month-over-month % changes
      changes: {
        revenue:   pctChange(cur.revenue,   prev.revenue),
        sales:     pctChange(cur.sales,     prev.sales),
        expenses:  pctChange(cur.expenses,  prev.expenses),
        customers: pctChange(cur.customers, prev.customers),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
