/**
 * Revaluation Engine — manual or system-triggered inventory cost revaluation.
 *
 * When a layer's cost needs to be adjusted (damage, market change, obsolescence):
 * 1. Records the old and new cost on the layer
 * 2. Creates an InventoryRevaluation record for audit
 * 3. Updates the layer's unitCost and landedCost
 * 4. Returns revaluation details for journal posting by the caller
 *
 * Journal posting (gain or loss):
 *   If loss (newCost < oldCost):
 *     Dr Inventory Write-Down (5320)
 *       Cr Inventory Asset (1200)
 *   If gain (newCost > oldCost):
 *     Dr Inventory Asset (1200)
 *       Cr Inventory Gain (4100)
 */

import { prisma } from '@/shared/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────

export type RevaluationReason = 'damage' | 'market_adjustment' | 'obsolescence' | 'quality_issue' | 'manual';

export interface RevalueLayerParams {
  layerId: string;
  newUnitCost: number;
  reason: RevaluationReason;
  notes?: string;
  performedBy: string;           // userId
  businessId: string;
  tx?: any;
}

export interface RevaluationResult {
  revaluationId: string;
  layerId: string;
  oldUnitCost: number;
  newUnitCost: number;
  oldLandedCost: number;
  newLandedCost: number;
  quantityAffected: number;
  impactAmount: number;          // Positive = gain, Negative = loss
  reason: RevaluationReason;
}

export interface BulkRevalueParams {
  productId: string;
  warehouseId?: string;
  newUnitCost: number;
  reason: RevaluationReason;
  notes?: string;
  performedBy: string;
  businessId: string;
  tx?: any;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Revaluation Logic ────────────────────────────────────────────────────────

/**
 * Revalue a single inventory layer.
 *
 * Only affects the remaining quantity — consumed portions are not adjusted
 * (those are handled by late landed cost adjustments or COGS corrections).
 */
export async function revalueLayer(params: RevalueLayerParams): Promise<RevaluationResult> {
  const {
    layerId,
    newUnitCost,
    reason,
    notes,
    performedBy,
    businessId,
    tx = prisma,
  } = params;

  const layer = await tx.inventoryLayer.findFirst({
    where: { id: layerId, businessId },
  });

  if (!layer) {
    throw new Error(`Layer ${layerId} not found`);
  }

  if (layer.remainingQty <= 0) {
    throw new Error(`Layer ${layerId} has no remaining quantity to revalue`);
  }

  if (newUnitCost < 0) {
    throw new Error('New unit cost cannot be negative');
  }

  const oldUnitCost = layer.unitCost;
  const oldLandedCost = layer.landedCost;

  // Calculate new landed cost based on the cost change for remaining units
  // New landed cost = old landed cost + (newUnitCost - oldUnitCost) × remainingQty
  // This preserves the historical cost for already-consumed units
  const costDiffPerUnit = round4(newUnitCost - oldUnitCost);
  const newLandedCost = round4(oldLandedCost + (costDiffPerUnit * layer.remainingQty));
  const quantityAffected = layer.remainingQty;
  const impactAmount = round4(costDiffPerUnit * quantityAffected);

  // Update the layer
  await tx.inventoryLayer.update({
    where: { id: layerId },
    data: {
      unitCost: round4(newUnitCost),
      landedCost: newLandedCost,
    },
  });

  // Create revaluation record
  const revaluation = await tx.inventoryRevaluation.create({
    data: {
      layerId,
      reason,
      oldUnitCost,
      newUnitCost: round4(newUnitCost),
      oldLandedCost,
      newLandedCost,
      quantityAffected,
      impactAmount,
      notes: notes || null,
      performedBy,
      businessId,
    },
  });

  return {
    revaluationId: revaluation.id,
    layerId,
    oldUnitCost,
    newUnitCost: round4(newUnitCost),
    oldLandedCost,
    newLandedCost,
    quantityAffected,
    impactAmount,
    reason,
  };
}

/**
 * Bulk revalue all active layers for a product (and optionally a warehouse).
 * Applies the same new unit cost to every active layer.
 */
export async function bulkRevalueProduct(params: BulkRevalueParams): Promise<RevaluationResult[]> {
  const { productId, warehouseId, newUnitCost, reason, notes, performedBy, businessId, tx = prisma } = params;

  const where: any = {
    itemId: productId,
    businessId,
    status: 'ACTIVE',
    remainingQty: { gt: 0 },
  };
  if (warehouseId) where.warehouseId = warehouseId;

  const layers = await tx.inventoryLayer.findMany({
    where,
    select: { id: true },
  });

  if (layers.length === 0) {
    throw new Error('No active layers found for this product');
  }

  const results: RevaluationResult[] = [];

  for (const layer of layers) {
    const result = await revalueLayer({
      layerId: layer.id,
      newUnitCost,
      reason,
      notes,
      performedBy,
      businessId,
      tx,
    });
    results.push(result);
  }

  return results;
}

/**
 * Get revaluation history for a layer or product.
 */
export async function getRevaluationHistory(
  businessId: string,
  params: {
    layerId?: string;
    productId?: string;
    page?: number;
    limit?: number;
  }
) {
  const { layerId, productId, page = 1, limit = 50 } = params;
  const skip = (page - 1) * limit;

  const where: any = { businessId };
  if (layerId) where.layerId = layerId;
  if (productId) {
    where.layer = { itemId: productId };
  }

  const [records, total] = await Promise.all([
    prisma.inventoryRevaluation.findMany({
      where,
      include: {
        layer: {
          select: {
            id: true,
            receiptNo: true,
            batchNo: true,
            remainingQty: true,
            product: { select: { id: true, name: true, sku: true } },
            warehouse: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.inventoryRevaluation.count({ where }),
  ]);

  return {
    data: records,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
