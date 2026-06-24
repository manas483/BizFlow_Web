export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

/**
 * GET /api/inventory/layer-audit?layerId={id}
 * 
 * Returns the full audit lineage of an inventory layer:
 * - Base Layer (Purchase Cost, Landed Cost, Remaining Qty)
 * - Costs/Expenses mapped to it
 * - Consumptions mapped from it (Sales/Returns)
 * - Expense Allocation History logs
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const layerId = searchParams.get('layerId');

    if (!layerId) {
      return NextResponse.json({ error: 'layerId is required' }, { status: 400 });
    }

    const layer = await prisma.inventoryLayer.findUnique({
      where: {
        id: layerId,
        businessId: session.user.businessId,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        costs: {
          orderBy: { createdAt: 'asc' }
        },
        consumptions: {
          orderBy: { createdAt: 'asc' }
        },
        expenseAllocations: {
          include: { expense: { select: { category: true, date: true, amount: true } } },
          orderBy: { createdAt: 'asc' }
        },
        costAdjustments: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!layer) {
      return NextResponse.json({ error: 'Layer not found' }, { status: 404 });
    }

    // Build the audit reconciliation report payload
    const reconciliation = {
      layerId: layer.id,
      product: layer.product.name,
      status: layer.status,
      receiptNo: layer.receiptNo,
      receiptDate: layer.receiptDate,
      quantities: {
        originalQty: layer.originalQty,
        remainingQty: layer.remainingQty,
        consumedQty: layer.originalQty - layer.remainingQty,
      },
      valuation: {
        purchaseCost: layer.purchaseCost,
        totalLandedCost: layer.landedCost,
        unitCost: layer.unitCost,
        remainingValue: layer.remainingQty * layer.unitCost,
      },
      expenses: layer.costs,
      consumptions: layer.consumptions,
      expenseAllocationLogs: layer.expenseAllocations,
      costAdjustments: layer.costAdjustments,
    };

    return NextResponse.json({ data: reconciliation });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[Layer Audit API] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
