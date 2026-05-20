/**
 * GET /api/v1/reports/inventory
 *
 * Inventory health snapshot (not date-scoped — always current state):
 *   inventoryValuation, lowStockItems, totalProducts, totalStockUnits
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { ok, internalError }      from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const biz     = session.user.businessId;
    const sp      = new URL(req.url).searchParams;
    const maxLow  = Math.min(50, parseInt(sp.get('lowStockLimit') ?? '10', 10));

    const products = await prisma.product.findMany({
      where:  { businessId: biz },
      select: { id: true, name: true, sku: true, category: true, stock: true, minStock: true, purchasePrice: true, sellingPrice: true },
    });

    const lowStockItems      = products.filter((p) => p.stock <= p.minStock).slice(0, maxLow);
    const inventoryValuation = products.reduce((acc, p) => acc + (Math.max(0, p.stock) * p.purchasePrice), 0);
    const totalStockUnits    = products.reduce((acc, p) => acc + Math.max(0, p.stock), 0);

    return ok({
      totalProducts:       products.length,
      totalStockUnits,
      inventoryValuation:  parseFloat(inventoryValuation.toFixed(2)),
      lowStockCount:       lowStockItems.length,
      lowStockItems,
    });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error('[reports/inventory]', e);
    return internalError();
  }
}
