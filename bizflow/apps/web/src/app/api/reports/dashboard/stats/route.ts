export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const biz = session.user.businessId;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
      // ── New widget data ──
      todaySales,
      todayExpenses,
      totalReceivables,
      totalPayables,
      lowStockCount,
      activeLoans,
      nextEmi,
      unfiledGst,
      customerDues,
      unreadNotifs,
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

      // ── Today's sales ──
      prisma.sale.aggregate({ where: { businessId: biz, createdAt: { gte: todayStart } }, _sum: { total: true }, _count: true }),
      // ── Today's expenses ──
      prisma.expense.aggregate({ where: { businessId: biz, date: { gte: todayStart } }, _sum: { amount: true }, _count: true }),
      // ── Total receivables ──
      prisma.accountsReceivable.aggregate({
        where: { businessId: biz, status: { not: 'PAID' } },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),
      // ── Total payables ──
      prisma.accountsPayable.aggregate({
        where: { businessId: biz, status: { not: 'PAID' } },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),
      // ── Low stock count (raw query to compare columns) ──
      prisma.product.count({
        where: { businessId: biz, stock: { lte: 5 } },
      }),
      // ── Active loans ──
      prisma.loanMaster.count({ where: { businessId: biz, status: 'ACTIVE' } }),
      // ── Next upcoming EMI ──
      prisma.loanSchedule.findFirst({
        where: {
          status: 'PENDING',
          dueDate: { gte: now },
          loan: { businessId: biz, status: 'ACTIVE' },
        },
        orderBy: { dueDate: 'asc' },
        select: { dueDate: true, emiAmount: true, loan: { select: { loanNumber: true, borrowerName: true } } },
      }),
      // ── Unfiled GST returns ──
      prisma.gstReturn.count({ where: { businessId: biz, status: 'PENDING' } }),
      // ── Customer dues ──
      prisma.customer.aggregate({
        where: { businessId: biz, dues: { gt: 0 } },
        _sum: { dues: true },
        _count: true,
      }),
      // ── Unread notifications ──
      prisma.notification.count({ where: { businessId: biz, read: false } }),
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

    const receivableOutstanding = (totalReceivables._sum.amount ?? 0) - (totalReceivables._sum.paidAmount ?? 0);
    const payableOutstanding = (totalPayables._sum.amount ?? 0) - (totalPayables._sum.paidAmount ?? 0);

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

      // ── New widget data ──
      widgets: {
        todaySales: todaySales._sum.total ?? 0,
        todaySalesCount: todaySales._count ?? 0,
        todayExpenses: todayExpenses._sum.amount ?? 0,
        todayExpensesCount: todayExpenses._count ?? 0,
        totalReceivables: Math.round(receivableOutstanding),
        receivablesCount: totalReceivables._count ?? 0,
        totalPayables: Math.round(payableOutstanding),
        payablesCount: totalPayables._count ?? 0,
        lowStockCount,
        activeLoans,
        nextEmi: nextEmi ? {
          dueDate: nextEmi.dueDate,
          amount: nextEmi.emiAmount,
          loanNumber: nextEmi.loan.loanNumber,
          borrower: nextEmi.loan.borrowerName,
        } : null,
        unfiledGst,
        customerDues: customerDues._sum.dues ?? 0,
        customersWithDues: customerDues._count ?? 0,
        unreadNotifs,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

