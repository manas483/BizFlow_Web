export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';
import {
  revalueLayer,
  bulkRevalueProduct,
  getRevaluationHistory,
  type RevaluationReason,
} from '@/shared/lib/revaluation-engine';
import { postRevaluationJournal } from '@/shared/lib/auto-journal';

/**
 * POST /api/inventory/revaluation
 *
 * Revalue an inventory layer or all layers for a product.
 *
 * Body: {
 *   layerId?: string,          // Single layer revaluation
 *   productId?: string,        // Bulk revaluation (all active layers)
 *   warehouseId?: string,      // Optional filter for bulk
 *   newUnitCost: number,
 *   reason: "damage" | "market_adjustment" | "obsolescence" | "quality_issue" | "manual",
 *   notes?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const body = await req.json();

    const { layerId, productId, warehouseId, newUnitCost, reason, notes } = body;

    if (newUnitCost === undefined || newUnitCost === null || newUnitCost < 0) {
      return NextResponse.json(
        { error: 'newUnitCost is required and must be >= 0' },
        { status: 400 }
      );
    }

    const validReasons: RevaluationReason[] = ['damage', 'market_adjustment', 'obsolescence', 'quality_issue', 'manual'];
    if (!reason || !validReasons.includes(reason)) {
      return NextResponse.json(
        { error: `reason must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      );
    }

    if (!layerId && !productId) {
      return NextResponse.json(
        { error: 'Either layerId (single) or productId (bulk) is required' },
        { status: 400 }
      );
    }

    const results = await prisma.$transaction(async (tx: any) => {
      if (layerId) {
        // Single layer revaluation
        const result = await revalueLayer({
          layerId,
          newUnitCost,
          reason,
          notes,
          performedBy: session.user.id,
          businessId: session.user.businessId,
          tx,
        });

        // Post journal
        await postRevaluationJournal({
          revaluationId: result.revaluationId,
          layerId: result.layerId,
          impactAmount: result.impactAmount,
          reason: result.reason,
          businessId: session.user.businessId,
          tx,
        });

        return [result];
      } else {
        // Bulk product revaluation
        const bulkResults = await bulkRevalueProduct({
          productId: productId!,
          warehouseId,
          newUnitCost,
          reason,
          notes,
          performedBy: session.user.id,
          businessId: session.user.businessId,
          tx,
        });

        // Post journals for each revaluation
        for (const result of bulkResults) {
          await postRevaluationJournal({
            revaluationId: result.revaluationId,
            layerId: result.layerId,
            impactAmount: result.impactAmount,
            reason: result.reason,
            businessId: session.user.businessId,
            tx,
          });
        }

        return bulkResults;
      }
    });

    // Audit log
    const { logAudit } = await import('@/shared/lib/audit');
    const totalImpact = results.reduce((sum, r) => sum + r.impactAmount, 0);
    await logAudit({
      session,
      action: 'CREATE',
      entityType: 'InventoryRevaluation',
      entityId: results[0]?.revaluationId || 'unknown',
      entityLabel: `Revaluation (${reason}): ${results.length} layer(s), impact ₹${Math.round(totalImpact * 100) / 100}`,
    });

    return NextResponse.json({
      revaluations: results,
      summary: {
        layersRevalued: results.length,
        totalImpact: Math.round(totalImpact * 100) / 100,
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('[Revaluation API] POST error:', error);

    const isBusinessError = error.message?.includes('not found') ||
      error.message?.includes('No active layers') || error.message?.includes('no remaining');
    return NextResponse.json(
      { error: isBusinessError ? error.message : 'Internal Server Error' },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}

/**
 * GET /api/inventory/revaluation
 *
 * Get revaluation history.
 * Query params: layerId, productId, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);

    const result = await getRevaluationHistory(
      session.user.businessId,
      {
        layerId: searchParams.get('layerId') || undefined,
        productId: searchParams.get('productId') || undefined,
        page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10)),
        limit: Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10)),
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[Revaluation API] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

