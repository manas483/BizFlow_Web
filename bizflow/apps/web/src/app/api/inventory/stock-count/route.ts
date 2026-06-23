export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';
import {
  createStockCount,
  recordPhysicalCount,
  approveStockCount,
  getStockCount,
  listStockCounts,
} from '@/shared/lib/stock-count-engine';
import { postStockCountJournal } from '@/shared/lib/auto-journal';

/**
 * GET /api/inventory/stock-count
 *
 * List stock counts or get a single stock count by ID.
 * Query params: id (single), status, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);

    const id = searchParams.get('id');
    if (id) {
      const count = await getStockCount(id, session.user.businessId);
      if (!count) {
        return NextResponse.json({ error: 'Stock count not found' }, { status: 404 });
      }
      return NextResponse.json(count);
    }

    const result = await listStockCounts(
      session.user.businessId,
      {
        status: searchParams.get('status') || undefined,
        page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10)),
        limit: Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10)),
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[StockCount API] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/inventory/stock-count
 *
 * Create a new stock count, record physical counts, or approve.
 *
 * Body: {
 *   action: "create" | "record" | "approve",
 *
 *   // For "create":
 *   warehouseId?: string,
 *   productIds?: string[],
 *   notes?: string,
 *
 *   // For "record":
 *   stockCountId: string,
 *   items: Array<{ productId: string, physicalQty: number, notes?: string }>,
 *
 *   // For "approve":
 *   stockCountId: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const { action } = body;

    if (!action || !['create', 'record', 'approve'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be one of: create, record, approve' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'create': {
        result = await prisma.$transaction(async (tx: any) => {
          return createStockCount({
            warehouseId: body.warehouseId,
            productIds: body.productIds,
            notes: body.notes,
            businessId: session.user.businessId,
            tx,
          });
        });

        // Audit log
        const { logAudit } = await import('@/shared/lib/audit');
        await logAudit({
          session,
          action: 'CREATE',
          entityType: 'StockCount',
          entityId: result.id,
          entityLabel: `Stock Count ${result.countNo} (${result.itemCount} items)`,
        });

        return NextResponse.json({
          ...result,
          message: `Stock count ${result.countNo} created with ${result.itemCount} items`,
        }, { status: 201 });
      }

      case 'record': {
        if (!body.stockCountId || !body.items || body.items.length === 0) {
          return NextResponse.json(
            { error: 'stockCountId and items array are required for recording' },
            { status: 400 }
          );
        }

        result = await prisma.$transaction(async (tx: any) => {
          return recordPhysicalCount({
            stockCountId: body.stockCountId,
            items: body.items,
            businessId: session.user.businessId,
            tx,
          });
        });

        return NextResponse.json({
          ...result,
          message: `Physical count recorded for ${result.countNo}`,
        });
      }

      case 'approve': {
        if (!body.stockCountId) {
          return NextResponse.json(
            { error: 'stockCountId is required for approval' },
            { status: 400 }
          );
        }

        result = await prisma.$transaction(async (tx: any) => {
          const approveResult = await approveStockCount({
            stockCountId: body.stockCountId,
            approvedBy: session.user.id,
            businessId: session.user.businessId,
            tx,
          });

          // Post adjustment journal
          if (approveResult.totalValueImpact !== 0) {
            await postStockCountJournal({
              stockCountNo: approveResult.countNo,
              totalValueImpact: approveResult.totalValueImpact,
              businessId: session.user.businessId,
              tx,
            });
          }

          return approveResult;
        });

        // Audit log
        const { logAudit: logAudit2 } = await import('@/shared/lib/audit');
        await logAudit2({
          session,
          action: 'UPDATE',
          entityType: 'StockCount',
          entityId: result.id,
          entityLabel: `Stock Count ${result.countNo} APPROVED (variance: ${result.totalVariance}, impact: ₹${result.totalValueImpact})`,
        });

        return NextResponse.json({
          ...result,
          message: `Stock count ${result.countNo} approved. Adjustments applied.`,
        });
      }
    }
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('[StockCount API] POST error:', error);

    const isBusinessError = error.message?.includes('not found') ||
      error.message?.includes('not in') || error.message?.includes('already');
    return NextResponse.json(
      { error: isBusinessError ? error.message : 'Internal Server Error' },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}

