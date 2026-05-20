/**
 * GET /api/v1/reports/gst
 *
 * Returns GST analytics for the period:
 *   totalGstCollected, gstBySlab, gstPayable, gstInputCredit, taxSummaryByMonth
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { ok, err, internalError } from '@/lib/response';
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

    const [business, cogsItems, creditNotesAgg] = await Promise.all([
      prisma.business.findUnique({ where: { id: biz }, select: { gstInclusive: true } }),
      prisma.saleItem.findMany({
        where:  { sale: { businessId: biz, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } } },
        select: { qty: true, price: true, gstRate: true, discount: true, sale: { select: { createdAt: true } } },
      }),
      prisma.creditNote.aggregate({ where: { businessId: biz, createdAt: { gte: from, lte: to } }, _sum: { taxAmount: true } }),
    ]);

    const gstInclusive = business?.gstInclusive ?? false;
    let totalGstCollected = 0;
    const gstBySlab: Record<string, number> = { '5': 0, '12': 0, '18': 0, '28': 0 };
    const taxSummaryByMonth: Record<string, number> = {};

    for (const item of cogsItems) {
      const qty      = Number(item.qty) || 0;
      const gross    = (qty * item.price) - (item.discount || 0);
      const rate     = item.gstRate || 0;
      if (rate <= 0) continue;

      const tax = gstInclusive
        ? gross - gross / (1 + rate / 100)
        : gross * (rate / 100);

      totalGstCollected += tax;
      const slabKey = String(rate);
      gstBySlab[slabKey] = (gstBySlab[slabKey] ?? 0) + tax;
      const monthKey = new Date(item.sale.createdAt).toLocaleString('default', { month: 'short', year: 'numeric' });
      taxSummaryByMonth[monthKey] = (taxSummaryByMonth[monthKey] || 0) + tax;
    }

    const returnedTax = creditNotesAgg._sum.taxAmount ?? 0;
    totalGstCollected = Math.max(0, totalGstCollected - returnedTax);

    return ok({
      period:             { from, to },
      totalGstCollected:  parseFloat(totalGstCollected.toFixed(2)),
      gstBySlab:          Object.fromEntries(Object.entries(gstBySlab).map(([k, v]) => [k, parseFloat(v.toFixed(2))])),
      gstPayable:         parseFloat(totalGstCollected.toFixed(2)),
      gstInputCredit:     0,  // ITC not yet tracked — placeholder
      taxSummaryByMonth,
    });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error('[reports/gst]', e);
    return internalError();
  }
}
