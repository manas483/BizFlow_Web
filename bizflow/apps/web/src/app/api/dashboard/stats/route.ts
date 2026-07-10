export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

import { withTelemetry, getTimer } from '@/shared/lib/telemetry';

async function handler(req: NextRequest) {
  try {
    const timer = getTimer();

    timer?.phase('auth');
    const session = await requireAuth();
    const businessId = session.user.businessId;

    const now = new Date();
    
    // Current month bounds
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Previous month bounds
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const { getCachedOrSet, CACHE_TTL } = await import('@/shared/lib/cache');
    const cacheKey = `dashboard:${businessId}`;

    timer?.phase('db_query_cached');
    const dashboardData = await getCachedOrSet(cacheKey, CACHE_TTL.DASHBOARD, async () => {
      const [
        currentSales,
        prevSales,
        currentExpenses,
        prevExpenses,
        currentCustomers,
        prevCustomers
      ] = await Promise.all([
        prisma.sale.aggregate({
          where: { businessId, createdAt: { gte: startOfMonth, lte: endOfMonth }, status: { not: 'CANCELLED' }, workflowState: { notIn: ['voided', 'draft'] } },
          _sum: { total: true },
          _count: true,
        }),
        prisma.sale.aggregate({
          where: { businessId, createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth }, status: { not: 'CANCELLED' }, workflowState: { notIn: ['voided', 'draft'] } },
          _sum: { total: true },
          _count: true,
        }),
        prisma.expense.aggregate({
          where: { businessId, date: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: { businessId, date: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
          _sum: { amount: true },
        }),
        prisma.customer.aggregate({
          where: { businessId, createdAt: { gte: startOfMonth, lte: endOfMonth } },
          _count: true,
        }),
        prisma.customer.aggregate({
          where: { businessId, createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
          _count: true,
        }),
      ]);

      // Also get total customers (not just this month)
      const totalCustomersCount = await prisma.customer.count({
        where: { businessId }
      });

      const revenue = currentSales._sum.total ?? 0;
      const prevRevenue = prevSales._sum.total ?? 0;
      
      const salesCount = currentSales._count ?? 0;
      const prevSalesCount = prevSales._count ?? 0;
      
      const expenses = currentExpenses._sum.amount ?? 0;
      const prevExpensesSum = prevExpenses._sum.amount ?? 0;
      
      const newCustomers = currentCustomers._count ?? 0;
      const prevNewCustomers = prevCustomers._count ?? 0;

      const calcChange = (current: number, prev: number) => {
        if (prev === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - prev) / prev) * 100);
      };

      return {
        revenue,
        salesCount,
        customerCount: totalCustomersCount,
        expenses,
        changes: {
          revenue: calcChange(revenue, prevRevenue),
          sales: calcChange(salesCount, prevSalesCount),
          customers: calcChange(newCustomers, prevNewCustomers),
          expenses: calcChange(expenses, prevExpensesSum),
        }
      };
    });

    timer?.phase('serialization');
    return NextResponse.json(dashboardData);

  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = withTelemetry(handler);

