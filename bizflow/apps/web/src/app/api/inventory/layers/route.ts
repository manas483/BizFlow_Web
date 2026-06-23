export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { LayerService } from '@/modules/inventory';

/**
 * GET /api/inventory/layers
 *
 * List inventory layers with filtering and pagination.
 * Query params: productId, warehouseId, status, batchNo, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);

    const filters = {
      productId: searchParams.get('productId') || undefined,
      warehouseId: searchParams.get('warehouseId') || undefined,
      status: searchParams.get('status') || undefined,
      batchNo: searchParams.get('batchNo') || undefined,
      page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10)),
      limit: Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10)),
    };

    const result = await LayerService.getLayersByProduct(
      session.user.businessId,
      filters
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[Layers API] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

