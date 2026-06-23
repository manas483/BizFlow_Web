/**
 * Transfer Engine — handles inter-warehouse stock transfers.
 *
 * When stock is transferred between warehouses:
 * 1. Consumes from source warehouse layers (using business costing method)
 * 2. Creates new layer(s) in destination warehouse at source cost
 * 3. Optionally absorbs additional transfer costs into the destination layer
 * 4. Creates StockMovement records for both warehouses
 */

import { prisma } from '@/shared/lib/db';
import { consumeLayers, createLayer, type LayerConsumptionResult } from '@/shared/lib/layer-engine';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TransferStockParams {
  productId: string;
  qty: number;
  sourceWarehouseId: string;
  destWarehouseId: string;
  transferCosts?: Array<{
    expenseType: string;
    amount: number;
    remarks?: string;
  }>;
  batchNo?: string;
  notes?: string;
  businessId: string;
  tx?: any;
}

export interface TransferResult {
  sourceConsumptions: LayerConsumptionResult;
  destinationLayerIds: string[];
  transferId: string;
}

// ── Transfer Logic ───────────────────────────────────────────────────────────

/**
 * Transfer stock from source warehouse to destination warehouse.
 *
 * Logic:
 * 1. Consume from source layers (FIFO/LIFO/WAC based on business setting)
 * 2. For each consumed source layer, create a corresponding layer in destination
 * 3. Add transfer costs (if any) to destination layer's cost breakdown
 * 4. Create StockMovement OUT (source) and IN (destination)
 *
 * Each source layer consumed creates its own destination layer to preserve
 * the original cost identity (critical for FIFO/LIFO accuracy).
 */
export async function transferStock(params: TransferStockParams): Promise<TransferResult> {
  const {
    productId,
    qty,
    sourceWarehouseId,
    destWarehouseId,
    transferCosts = [],
    batchNo,
    notes,
    businessId,
    tx = prisma,
  } = params;

  if (sourceWarehouseId === destWarehouseId) {
    throw new Error('Source and destination warehouse cannot be the same');
  }

  // Generate a transfer reference ID
  const transferId = `TRF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 1. Consume from source warehouse
  const sourceConsumptions = await consumeLayers({
    itemId: productId,
    warehouseId: sourceWarehouseId,
    quantity: qty,
    transactionId: transferId,
    transactionType: 'transfer',
    businessId,
    tx,
  });

  // 2. Calculate total transfer costs to distribute across destination layers
  const totalTransferCost = transferCosts.reduce((sum, c) => sum + c.amount, 0);
  const totalTransferQty = sourceConsumptions.consumptions.reduce((sum, c) => sum + c.quantity, 0);

  // 3. Create destination layers — one per source layer consumed
  const destinationLayerIds: string[] = [];

  for (const consumption of sourceConsumptions.consumptions) {
    // Proportional share of transfer costs
    const proportionalTransferCost = totalTransferCost > 0
      ? (consumption.quantity / totalTransferQty) * totalTransferCost
      : 0;

    const expenses = transferCosts.map(c => ({
      expenseType: c.expenseType,
      amount: (consumption.quantity / totalTransferQty) * c.amount,
      remarks: c.remarks || `Transfer cost from ${sourceWarehouseId}`,
    }));

    const destLayerId = await createLayer({
      itemId: productId,
      warehouseId: destWarehouseId,
      receiptNo: transferId,
      receiptDate: new Date(),
      quantity: consumption.quantity,
      purchaseCost: consumption.amount,       // Source layer cost = purchase cost for destination
      expenses,
      batchNo: batchNo || consumption.batchNo || undefined,
      sourceTransactionId: transferId,
      sourceTransactionType: 'transfer',
      transferredFromLayerId: consumption.layerId,
      businessId,
      tx,
    });

    destinationLayerIds.push(destLayerId);
  }

  // 4. Create StockMovement records for audit
  await tx.stockMovement.create({
    data: {
      productId,
      warehouseId: sourceWarehouseId,
      type: 'TRANSFER',
      quantity: -qty,
      referenceId: transferId,
      notes: notes || `Transfer to warehouse`,
      businessId,
    },
  });

  await tx.stockMovement.create({
    data: {
      productId,
      warehouseId: destWarehouseId,
      type: 'TRANSFER',
      quantity: qty,
      referenceId: transferId,
      notes: notes || `Transfer from warehouse`,
      businessId,
    },
  });

  return {
    sourceConsumptions,
    destinationLayerIds,
    transferId,
  };
}
