import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { LayerService } from '@/modules/inventory';

/**
 * GET /api/inventory/layers/[id]/costs
 *
 * Get cost breakdown for a specific layer.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const result = await LayerService.getLayerCosts(id, session.user.businessId);

    if (!result) {
      return NextResponse.json({ error: 'Layer not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[Layers API] GET costs error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/inventory/layers/[id]/costs
 *
 * Add a landed cost line item to a layer.
 * If the layer is partially consumed, triggers a late cost adjustment with COGS correction.
 *
 * Body: { expenseType, amount, remarks? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const { expenseType, amount, remarks } = body;

    if (!expenseType || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid expenseType and positive amount are required' },
        { status: 400 }
      );
    }

    const result = await LayerService.addLandedCost({
      layerId: id,
      expenseType,
      amount,
      remarks,
      businessId: session.user.businessId,
    });

    // If a cost adjustment was created (layer was partially consumed),
    // post the COGS adjustment journal
    if ('costAdjustmentId' in result && result.allocatedToConsumed > 0) {
      const { postCOGSAdjustmentJournal } = await import('@/shared/lib/auto-journal');
      postCOGSAdjustmentJournal({
        costAdjustmentId: result.costAdjustmentId,
        layerId: id,
        allocatedToConsumed: result.allocatedToConsumed,
        allocatedToRemaining: result.allocatedToRemaining,
        expenseType,
        businessId: session.user.businessId,
      }).catch(err => console.error('[AutoJournal] COGS adjustment failed:', err));
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('[Layers API] POST costs error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
}
