export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { LayerService } from '@/modules/inventory';

/**
 * GET /api/inventory/valuation
 *
 * Inventory valuation report — total value by product/warehouse.
 * Query params: warehouseId, category
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);

    const warehouseId = searchParams.get('warehouseId') || undefined;
    const category = searchParams.get('category') || undefined;

    const valuation = await LayerService.getInventoryValuation(
      session.user.businessId,
      warehouseId,
      category
    );

    // Calculate summary
    const totalValue = valuation.reduce((sum, row) => sum + row.totalValue, 0);
    const totalQuantity = valuation.reduce((sum, row) => sum + row.totalQty, 0);
    const totalProducts = new Set(valuation.map(v => v.productId)).size;

    return NextResponse.json({
      data: valuation,
      summary: {
        totalValue: Math.round(totalValue * 100) / 100,
        totalQuantity,
        totalProducts,
        totalRows: valuation.length,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[Valuation API] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

