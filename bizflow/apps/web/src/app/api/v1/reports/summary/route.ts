export const dynamic = 'force-dynamic';
/**
 * GET /api/v1/reports/summary
 *
 * Returns high-level KPIs for the dashboard:
 * totalSales, cogs, operatingExpenses, grossProfit, netProfit,
 * outstandingDues, collectedAmount, pendingCollection, salesCount,
 * collectionEfficiency, profitMargin, inventoryValuation
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { ok, err, internalError } from '@/shared/lib/response';
import { parseDateRange }         from '../_dateRange';

export async function GET(req: NextRequest) {
  try {
    const session    = await requireAuth();
    const biz        = session.user.businessId;
    const sp         = new URL(req.url).searchParams;
    let   dateRange  = { from: new Date(), to: new Date(), period: 'monthly' };

    try { dateRange = parseDateRange(sp); }
    catch (e: any) { return err('VALIDATION_ERROR', e.message, 422); }

    const { from, to, period } = dateRange;

    const business     = await prisma.business.findUnique({ where: { id: biz }, select: { gstInclusive: true } });
    const gstInclusive = business?.gstInclusive ?? false;

    const [salesAgg, expensesAgg, cogsItems, creditNotesAgg, customersAgg, inventoryProducts] = await Promise.all([
      prisma.sale.aggregate({ where: { businessId: biz, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' }, workflowState: { notIn: ['voided', 'draft'] } }, _sum: { total: true, paid: true }, _count: true }),
      prisma.expense.aggregate({ where: { businessId: biz, date: { gte: from, lte: to } }, _sum: { amount: true } }),
      prisma.saleItem.findMany({ where: { sale: { businessId: biz, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' }, workflowState: { notIn: ['voided', 'draft'] } } }, select: { qty: true, purchasePrice: true } }),
      prisma.creditNote.aggregate({ where: { businessId: biz, createdAt: { gte: from, lte: to } }, _sum: { amount: true } }),
      prisma.customer.aggregate({ where: { businessId: biz }, _sum: { dues: true } }),
      prisma.product.findMany({ where: { businessId: biz }, select: { stock: true, standardCost: true } }),
    ]);

    const cogs               = cogsItems.reduce((acc, i) => acc + (i.qty * (i.purchasePrice || 0)), 0);
    const grossSales         = salesAgg._sum.total ?? 0;
    const returnedAmount     = creditNotesAgg._sum.amount ?? 0;
    const totalSales         = Math.max(0, grossSales - returnedAmount);
    const collectedAmount    = salesAgg._sum.paid ?? 0;
    const opExpenses         = expensesAgg._sum.amount ?? 0;
    const grossProfit        = totalSales - cogs;
    const netProfit          = grossProfit - opExpenses;
    const outstandingDues    = totalSales - collectedAmount;
    const pendingCollection  = customersAgg._sum.dues ?? 0;
    const collectionEff      = totalSales > 0 ? (collectedAmount / totalSales) * 100 : 0;
    const profitMargin       = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
    const inventoryValuation = inventoryProducts.reduce((acc, p) => acc + (Math.max(0, p.stock) * p.standardCost), 0);

    return ok({
      period: { from, to, label: period },
      totalSales, cogs, operatingExpenses: opExpenses,
      grossProfit, netProfit,
      outstandingDues, collectedAmount, pendingCollection,
      salesCount: salesAgg._count,
      collectionEfficiency: parseFloat(collectionEff.toFixed(2)),
      profitMargin: parseFloat(profitMargin.toFixed(2)),
      inventoryValuation,
    });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error('[reports/summary]', e);
    return internalError();
  }
}

