import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { LayerService } from '@/modules/inventory';
import { prisma } from '@/shared/lib/db';

/**
 * GET /api/inventory/layers/[id]
 *
 * Get a single layer with full cost breakdown and consumption history.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const layer = await LayerService.getLayerById(id, session.user.businessId);

    if (!layer) {
      return NextResponse.json({ error: 'Layer not found' }, { status: 404 });
    }

    return NextResponse.json(layer);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[Layers API] GET [id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/inventory/layers/[id]
 *
 * Update batch/lot/expiry metadata on a layer.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    // Verify layer belongs to this business
    const existing = await prisma.inventoryLayer.findFirst({
      where: { id, businessId: session.user.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Layer not found' }, { status: 404 });
    }

    // Only allow updating metadata fields, not cost fields
    const allowedFields: Record<string, any> = {};
    if (body.batchNo !== undefined) allowedFields.batchNo = body.batchNo;
    if (body.lotNo !== undefined) allowedFields.lotNo = body.lotNo;
    if (body.mfgDate !== undefined) allowedFields.mfgDate = body.mfgDate ? new Date(body.mfgDate) : null;
    if (body.expiryDate !== undefined) allowedFields.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
    if (body.supplierId !== undefined) allowedFields.supplierId = body.supplierId;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.inventoryLayer.update({
      where: { id },
      data: allowedFields,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[Layers API] PATCH [id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
