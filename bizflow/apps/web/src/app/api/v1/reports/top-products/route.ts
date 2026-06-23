export const dynamic = 'force-dynamic';
/**
 * GET /api/v1/reports/top-products
 *
 * Top N selling products by quantity and revenue for the period.
 * ?limit=5 (default 5, max 20)
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
    const take      = Math.min(20, parseInt(sp.get('limit') ?? '5', 10));
    let   dateRange = { from: new Date(), to: new Date(), period: 'monthly' };

    try { dateRange = parseDateRange(sp); }
    catch (e: any) { return err('VALIDATION_ERROR', e.message, 422); }

    const { from, to } = dateRange;

    const topProducts = await prisma.saleItem.groupBy({
      by:      ['productId'],
      where:   { sale: { businessId: biz, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } } },
      _sum:    { qty: true, price: true },
      orderBy: { _sum: { qty: 'desc' } },
      take,
    });

    const productIds  = topProducts.map((p) => p.productId);
    const productsInfo = await prisma.product.findMany({
      where:  { id: { in: productIds }, businessId: biz },
      select: { id: true, name: true, category: true, sku: true },
    });
    const productMap = Object.fromEntries(productsInfo.map((p) => [p.id, p]));

    return ok(
      topProducts.map((tp) => ({
        product: productMap[tp.productId] ?? { id: tp.productId, name: 'Unknown' },
        qtySold: tp._sum.qty  ?? 0,
        revenue: tp._sum.price ?? 0,
      })),
      { meta: { period: { from, to }, limit: take } }
    );
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error('[reports/top-products]', e);
    return internalError();
  }
}

