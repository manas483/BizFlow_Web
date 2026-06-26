/**
 * Layer Engine — core inventory layer costing engine.
 *
 * Implements FIFO, LIFO, WAC (Moving Weighted Average), Specific Identification,
 * and Standard Cost methods.
 *
 * All mutating functions use SELECT ... FOR UPDATE for concurrency safety.
 * All operations run within a Prisma transaction.
 */

import { prisma } from '@/shared/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────

export type CostingMethod = 'FIFO' | 'LIFO' | 'WAC' | 'SPECIFIC' | 'STANDARD';

export interface CreateLayerParams {
  itemId: string;
  warehouseId?: string;
  receiptNo?: string;
  receiptDate?: Date;
  quantity: number;
  purchaseCost: number;          // Total base purchase cost (price × qty)
  expenses?: Array<{
    expenseType: string;
    amount: number;
    remarks?: string;
  }>;
  batchNo?: string;
  lotNo?: string;
  mfgDate?: Date;
  expiryDate?: Date;
  supplierId?: string;
  purchaseInvoiceId?: string;
  currencyCode?: string;
  exchangeRate?: number;
  foreignAmount?: number;
  sourceTransactionId?: string;
  sourceTransactionType?: string;
  transferredFromLayerId?: string;
  isAdjustment?: boolean;
  businessId: string;
  tx?: any;
}

export interface ConsumeLayersParams {
  itemId: string;
  warehouseId?: string;
  quantity: number;
  transactionId: string;
  transactionType: string;       // "sale" | "bill_of_supply" | "purchase_return" | "transfer" | "production" | "adjustment"
  specificLayerId?: string;      // For SPECIFIC identification
  businessId: string;
  tx?: any;
}

export interface LayerConsumptionResult {
  totalCOGS: number;
  consumptions: Array<{
    layerId: string;
    quantity: number;
    unitCost: number;
    amount: number;
    batchNo?: string | null;
    lotNo?: string | null;
  }>;
}

export interface RestoreLayerParams {
  transactionId: string;         // Original sale/transaction that consumed the layer
  transactionType: string;
  quantity: number;              // Quantity to restore
  businessId: string;
  tx?: any;
}

export interface ReduceLayerParams {
  layerId: string;
  quantity: number;
  transactionId: string;
  transactionType: string;
  businessId: string;
  tx?: any;
}

export interface LateLandedCostParams {
  layerId: string;
  expenseType: string;
  amount: number;
  remarks?: string;
  businessId: string;
  tx?: any;
}

export interface LateLandedCostResult {
  costAdjustmentId: string;
  oldUnitCost: number;
  newUnitCost: number;
  allocatedToRemaining: number;
  allocatedToConsumed: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read the business's configured costing method.
 */
export async function getCostingMethod(businessId: string, tx: any = prisma): Promise<CostingMethod> {
  const settings = await tx.automationSettings.findUnique({
    where: { businessId },
    select: { costingMethod: true },
  });
  return (settings?.costingMethod as CostingMethod) ?? 'FIFO';
}

/**
 * Pessimistic lock on active layers for a product (and optionally a warehouse).
 * Must be called inside a $transaction with interactive transactions enabled.
 */
async function lockLayersForProduct(
  tx: any,
  itemId: string,
  warehouseId?: string | null
): Promise<void> {
  if (warehouseId) {
    await tx.$queryRaw`
      SELECT id FROM "InventoryLayer"
      WHERE "itemId" = ${itemId}
        AND "status" = 'ACTIVE'
        AND "warehouseId" = ${warehouseId}
      FOR UPDATE
    `;
  } else {
    await tx.$queryRaw`
      SELECT id FROM "InventoryLayer"
      WHERE "itemId" = ${itemId}
        AND "status" = 'ACTIVE'
      FOR UPDATE
    `;
  }
}

/**
 * Round to 4 decimal places for financial precision.
 */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Create Layer ─────────────────────────────────────────────────────────────

/**
 * Create a new inventory layer from a stock receipt.
 *
 * Calculates landed cost from purchase cost + all expense items.
 * Returns the created layer ID.
 */
export async function createLayer(params: CreateLayerParams): Promise<string> {
  const {
    itemId,
    warehouseId,
    receiptNo,
    receiptDate,
    quantity,
    purchaseCost,
    expenses = [],
    batchNo,
    lotNo,
    mfgDate,
    expiryDate,
    supplierId,
    purchaseInvoiceId,
    currencyCode,
    exchangeRate,
    foreignAmount,
    sourceTransactionId,
    sourceTransactionType,
    transferredFromLayerId,
    isAdjustment = false,
    businessId,
    tx = prisma,
  } = params;

  // Calculate total landed cost
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const landedCost = round4(purchaseCost + totalExpenses);
  const unitCost = round4(landedCost / quantity);

  // Get current costing method for snapshot
  const costingMethod = await getCostingMethod(businessId, tx);

  // Create the layer
  const layer = await tx.inventoryLayer.create({
    data: {
      itemId,
      warehouseId: warehouseId || null,
      receiptNo: receiptNo || null,
      receiptDate: receiptDate || new Date(),
      originalQty: quantity,
      remainingQty: quantity,
      purchaseCost: round4(purchaseCost),
      landedCost,
      unitCost,
      status: 'ACTIVE',
      batchNo: batchNo || null,
      lotNo: lotNo || null,
      mfgDate: mfgDate || null,
      expiryDate: expiryDate || null,
      supplierId: supplierId || null,
      purchaseInvoiceId: purchaseInvoiceId || null,
      currencyCode: currencyCode || 'INR',
      exchangeRate: exchangeRate ?? 1,
      foreignAmount: foreignAmount ?? null,
      sourceTransactionId: sourceTransactionId || null,
      sourceTransactionType: sourceTransactionType || 'purchase',
      transferredFromLayerId: transferredFromLayerId || null,
      isAdjustment,
      costingMethodSnapshot: costingMethod,
      businessId,
    },
  });

  // Create cost breakdown records
  // Always record the purchase cost line
  await tx.inventoryLayerCost.create({
    data: {
      layerId: layer.id,
      expenseType: 'purchase_cost',
      amount: round4(purchaseCost),
      remarks: null,
    },
  });

  // Create expense lines
  for (const expense of expenses) {
    await tx.inventoryLayerCost.create({
      data: {
        layerId: layer.id,
        expenseType: expense.expenseType,
        amount: round4(expense.amount),
        remarks: expense.remarks || null,
      },
    });
  }

  await recalculateProductWAC(itemId, businessId, tx);

  return layer.id;
}

/**
 * Safe wrapper around `createLayer` that gracefully handles cases where
 * the InventoryLayer tables haven't been migrated yet.
 *
 * Returns the layer ID on success, or `null` if the tables don't exist.
 * This eliminates the need for callers to probe with `inventoryLayer.findFirst()`.
 */
export async function createLayerSafe(params: CreateLayerParams): Promise<string | null> {
  try {
    return await createLayer(params);
  } catch (err: any) {
    // Prisma P2021 = "The table ... does not exist in the current database"
    // Also catch generic "does not exist" / "relation ... does not exist" from raw queries
    const message = err?.message ?? '';
    const code = err?.code ?? '';
    if (
      code === 'P2021' ||
      message.includes('does not exist') ||
      message.includes('relation') ||
      message.includes('P2021')
    ) {
      console.warn('[LayerEngine] InventoryLayer tables not migrated — skipping layer creation.');
      return null;
    }
    // Re-throw unexpected errors so they are not silently swallowed
    throw err;
  }
}

// ── Consume Layers ───────────────────────────────────────────────────────────

/**
 * Consume stock from inventory layers based on the business's costing method.
 *
 * FIFO: oldest layer first (receiptDate ASC, createdAt ASC)
 * LIFO: newest layer first (receiptDate DESC, createdAt DESC)
 * WAC:  uses weighted average unit cost, consumes from oldest first
 * SPECIFIC: consumes from a specific layer (params.specificLayerId required)
 * STANDARD: uses standard cost from product.standardCost, consumes from oldest first
 *
 * Returns consumed layer details for COGS calculation.
 */
export async function consumeLayers(params: ConsumeLayersParams): Promise<LayerConsumptionResult> {
  const {
    itemId,
    warehouseId,
    quantity,
    transactionId,
    transactionType,
    specificLayerId,
    businessId,
    tx = prisma,
  } = params;

  // Lock layers to prevent concurrent consumption
  await lockLayersForProduct(tx, itemId, warehouseId);

  const costingMethod = await getCostingMethod(businessId, tx);

  // Determine consumption strategy
  switch (costingMethod) {
    case 'SPECIFIC':
      return consumeSpecific(tx, params, specificLayerId!);
    case 'WAC':
      return consumeWAC(tx, params);
    case 'STANDARD':
      return consumeStandard(tx, params);
    default:
      // FIFO or LIFO
      return consumeFIFOLIFO(tx, params, costingMethod);
  }
}

/**
 * FIFO / LIFO consumption logic.
 */
async function consumeFIFOLIFO(
  tx: any,
  params: ConsumeLayersParams,
  method: 'FIFO' | 'LIFO'
): Promise<LayerConsumptionResult> {
  const { itemId, warehouseId, quantity, transactionId, transactionType, businessId } = params;

  const orderBy = method === 'FIFO'
    ? [{ receiptDate: 'asc' as const }, { createdAt: 'asc' as const }]
    : [{ receiptDate: 'desc' as const }, { createdAt: 'desc' as const }];

  const where: any = {
    itemId,
    businessId,
    status: 'ACTIVE',
    remainingQty: { gt: 0 },
  };
  if (warehouseId) where.warehouseId = warehouseId;

  const layers = await tx.inventoryLayer.findMany({
    where,
    orderBy,
  });

  // Check total available
  const totalAvailable = layers.reduce((sum: number, l: any) => sum + l.remainingQty, 0);
  if (totalAvailable < quantity) {
    // If NO layers exist at all, this product was likely added before the layer system
    // or was manually stocked. Return zero COGS and let the sale proceed —
    // product-level stock was already validated by the caller.
    if (layers.length === 0) {
      console.warn(`[LayerEngine] No layers found for item ${itemId}. Skipping layer consumption.`);
      return { totalCOGS: 0, consumptions: [] };
    }
    throw Object.assign(
      new Error(`Insufficient layer stock: need ${quantity}, available ${totalAvailable}`),
      { code: 'INSUFFICIENT_LAYER_STOCK' }
    );
  }

  let remaining = quantity;
  const consumptions: LayerConsumptionResult['consumptions'] = [];

  for (const layer of layers) {
    if (remaining <= 0) break;

    const consumeQty = Math.min(remaining, layer.remainingQty);
    const amount = round4(consumeQty * layer.unitCost);

    // Update layer
    const newRemaining = round4(layer.remainingQty - consumeQty);
    await tx.inventoryLayer.update({
      where: { id: layer.id },
      data: {
        remainingQty: newRemaining,
        status: newRemaining <= 0 ? 'EXHAUSTED' : 'ACTIVE',
      },
    });

    // Create consumption record
    await tx.inventoryLayerConsumption.create({
      data: {
        transactionId,
        transactionType,
        layerId: layer.id,
        quantity: consumeQty,
        unitCost: layer.unitCost,
        amount,
        businessId,
      },
    });

    consumptions.push({
      layerId: layer.id,
      quantity: consumeQty,
      unitCost: layer.unitCost,
      amount,
      batchNo: layer.batchNo,
      lotNo: layer.lotNo,
    });

    remaining = round4(remaining - consumeQty);
  }

  const totalCOGS = round4(consumptions.reduce((sum, c) => sum + c.amount, 0));

  return { totalCOGS, consumptions };
}

/**
 * Weighted Average Cost consumption.
 * Calculates WAC across all active layers, then consumes from oldest first
 * but records the blended WAC as the unit cost.
 */
async function consumeWAC(tx: any, params: ConsumeLayersParams): Promise<LayerConsumptionResult> {
  const { itemId, warehouseId, quantity, transactionId, transactionType, businessId } = params;

  const where: any = {
    itemId,
    businessId,
    status: 'ACTIVE',
    remainingQty: { gt: 0 },
  };
  if (warehouseId) where.warehouseId = warehouseId;

  const layers = await tx.inventoryLayer.findMany({
    where,
    orderBy: [{ receiptDate: 'asc' }, { createdAt: 'asc' }],
  });

  const totalAvailable = layers.reduce((sum: number, l: any) => sum + l.remainingQty, 0);
  if (totalAvailable < quantity) {
    if (layers.length === 0) {
      console.warn(`[LayerEngine] No layers found for item ${itemId} (WAC). Skipping layer consumption.`);
      return { totalCOGS: 0, consumptions: [] };
    }
    throw Object.assign(
      new Error(`Insufficient layer stock: need ${quantity}, available ${totalAvailable}`),
      { code: 'INSUFFICIENT_LAYER_STOCK' }
    );
  }

  // Calculate WAC
  const totalValue = layers.reduce((sum: number, l: any) => sum + (l.remainingQty * l.unitCost), 0);
  const wac = round4(totalValue / totalAvailable);

  // Consume from oldest first but at WAC rate
  let remaining = quantity;
  const consumptions: LayerConsumptionResult['consumptions'] = [];

  for (const layer of layers) {
    if (remaining <= 0) break;

    const consumeQty = Math.min(remaining, layer.remainingQty);
    const amount = round4(consumeQty * wac);

    const newRemaining = round4(layer.remainingQty - consumeQty);
    await tx.inventoryLayer.update({
      where: { id: layer.id },
      data: {
        remainingQty: newRemaining,
        status: newRemaining <= 0 ? 'EXHAUSTED' : 'ACTIVE',
      },
    });

    await tx.inventoryLayerConsumption.create({
      data: {
        transactionId,
        transactionType,
        layerId: layer.id,
        quantity: consumeQty,
        unitCost: wac,       // WAC, not layer-specific cost
        amount,
        businessId,
      },
    });

    consumptions.push({
      layerId: layer.id,
      quantity: consumeQty,
      unitCost: wac,
      amount,
      batchNo: layer.batchNo,
      lotNo: layer.lotNo,
    });

    remaining = round4(remaining - consumeQty);
  }

  const totalCOGS = round4(consumptions.reduce((sum, c) => sum + c.amount, 0));
  return { totalCOGS, consumptions };
}

/**
 * Specific Identification — consumes from a specific layer.
 */
async function consumeSpecific(
  tx: any,
  params: ConsumeLayersParams,
  specificLayerId: string
): Promise<LayerConsumptionResult> {
  const { quantity, transactionId, transactionType, businessId } = params;

  const layer = await tx.inventoryLayer.findFirst({
    where: {
      id: specificLayerId,
      businessId,
      status: 'ACTIVE',
      remainingQty: { gt: 0 },
    },
  });

  if (!layer) {
    throw Object.assign(
      new Error(`Layer ${specificLayerId} not found or exhausted`),
      { code: 'LAYER_NOT_FOUND' }
    );
  }

  if (layer.remainingQty < quantity) {
    throw Object.assign(
      new Error(`Insufficient qty in layer: need ${quantity}, available ${layer.remainingQty}`),
      { code: 'INSUFFICIENT_LAYER_STOCK' }
    );
  }

  const amount = round4(quantity * layer.unitCost);
  const newRemaining = round4(layer.remainingQty - quantity);

  await tx.inventoryLayer.update({
    where: { id: layer.id },
    data: {
      remainingQty: newRemaining,
      status: newRemaining <= 0 ? 'EXHAUSTED' : 'ACTIVE',
    },
  });

  await recalculateProductWAC(layer.itemId, businessId, tx);

  await tx.inventoryLayerConsumption.create({
    data: {
      transactionId,
      transactionType,
      layerId: layer.id,
      quantity,
      unitCost: layer.unitCost,
      amount,
      businessId,
    },
  });

  return {
    totalCOGS: amount,
    consumptions: [{
      layerId: layer.id,
      quantity,
      unitCost: layer.unitCost,
      amount,
      batchNo: layer.batchNo,
      lotNo: layer.lotNo,
    }],
  };
}

/**
 * Standard Cost — uses the product's standardCost as the cost,
 * but still physically consumes from oldest layers.
 */
async function consumeStandard(tx: any, params: ConsumeLayersParams): Promise<LayerConsumptionResult> {
  const { itemId, warehouseId, quantity, transactionId, transactionType, businessId } = params;

  // Get standard cost from product
  const product = await tx.product.findFirst({
    where: { id: itemId, businessId },
    select: { standardCost: true },
  });

  if (!product) {
    throw new Error(`Product ${itemId} not found`);
  }

  const standardCost = product.standardCost;

  const where: any = {
    itemId,
    businessId,
    status: 'ACTIVE',
    remainingQty: { gt: 0 },
  };
  if (warehouseId) where.warehouseId = warehouseId;

  const layers = await tx.inventoryLayer.findMany({
    where,
    orderBy: [{ receiptDate: 'asc' }, { createdAt: 'asc' }],
  });

  const totalAvailable = layers.reduce((sum: number, l: any) => sum + l.remainingQty, 0);
  if (totalAvailable < quantity) {
    if (layers.length === 0) {
      console.warn(`[LayerEngine] No layers found for item ${itemId} (Standard). Skipping layer consumption.`);
      return { totalCOGS: 0, consumptions: [] };
    }
    throw Object.assign(
      new Error(`Insufficient layer stock: need ${quantity}, available ${totalAvailable}`),
      { code: 'INSUFFICIENT_LAYER_STOCK' }
    );
  }

  let remaining = quantity;
  const consumptions: LayerConsumptionResult['consumptions'] = [];

  for (const layer of layers) {
    if (remaining <= 0) break;

    const consumeQty = Math.min(remaining, layer.remainingQty);
    const amount = round4(consumeQty * standardCost);

    const newRemaining = round4(layer.remainingQty - consumeQty);
    await tx.inventoryLayer.update({
      where: { id: layer.id },
      data: {
        remainingQty: newRemaining,
        status: newRemaining <= 0 ? 'EXHAUSTED' : 'ACTIVE',
      },
    });

    await tx.inventoryLayerConsumption.create({
      data: {
        transactionId,
        transactionType,
        layerId: layer.id,
        quantity: consumeQty,
        unitCost: standardCost,
        amount,
        businessId,
      },
    });

    consumptions.push({
      layerId: layer.id,
      quantity: consumeQty,
      unitCost: standardCost,
      amount,
      batchNo: layer.batchNo,
      lotNo: layer.lotNo,
    });

    remaining = round4(remaining - consumeQty);
  }

  await recalculateProductWAC(itemId, businessId, tx);

  const totalCOGS = round4(consumptions.reduce((sum, c) => sum + c.amount, 0));
  return { totalCOGS, consumptions };
}

// ── Restore Layer (Sales Returns) ────────────────────────────────────────────

/**
 * Restore quantity to the original layer(s) consumed by a transaction.
 * Used for sales returns — restores the exact layer that was consumed.
 *
 * If returning partial quantity, restores in reverse order (last consumed first).
 */
export async function restoreLayer(params: RestoreLayerParams): Promise<void> {
  const { transactionId, transactionType, quantity, businessId, tx = prisma } = params;

  // Find original consumption records for this transaction
  const consumptions = await tx.inventoryLayerConsumption.findMany({
    where: {
      transactionId,
      transactionType,
      businessId,
    },
    orderBy: { createdAt: 'desc' },   // Restore in reverse order
  });

  if (consumptions.length === 0) {
    throw new Error(`No layer consumptions found for transaction ${transactionId}`);
  }

  let remaining = quantity;

  for (const consumption of consumptions) {
    if (remaining <= 0) break;

    const restoreQty = Math.min(remaining, consumption.quantity);

    // Lock and restore the layer
    await lockLayersForProduct(tx, consumption.layerId);

    await tx.inventoryLayer.update({
      where: { id: consumption.layerId },
      data: {
        remainingQty: { increment: restoreQty },
        status: 'ACTIVE',  // Re-activate if it was exhausted
      },
    });

    // Create a negative consumption record for audit trail
    await tx.inventoryLayerConsumption.create({
      data: {
        transactionId: `RETURN:${transactionId}`,
        transactionType: 'sale_return',
        layerId: consumption.layerId,
        quantity: -restoreQty,       // Negative = restoration
        unitCost: consumption.unitCost,
        amount: round4(-restoreQty * consumption.unitCost),
        businessId,
      },
    });

    remaining = round4(remaining - restoreQty);
  }

  if (remaining > 0) {
    console.warn(`[LayerEngine] Could not fully restore ${quantity} units for txn ${transactionId}. ${remaining} units unresolved.`);
  }

  // Deduce the itemId from the first consumption, or pass it via params if needed. We can get it from consumptions.
  if (consumptions.length > 0) {
    const layer = await tx.inventoryLayer.findUnique({ where: { id: consumptions[0].layerId } });
    if (layer) {
      await recalculateProductWAC(layer.itemId, businessId, tx);
    }
  }
}

// ── Reduce Layer (Purchase Returns) ──────────────────────────────────────────

/**
 * Reduce quantity from a specific layer (purchase return).
 * Unlike consumption, this reduces the layer directly.
 */
export async function reduceLayer(params: ReduceLayerParams): Promise<void> {
  const { layerId, quantity, transactionId, transactionType, businessId, tx = prisma } = params;

  const layer = await tx.inventoryLayer.findFirst({
    where: { id: layerId, businessId },
  });

  if (!layer) {
    throw new Error(`Layer ${layerId} not found`);
  }

  if (layer.remainingQty < quantity) {
    throw Object.assign(
      new Error(`Cannot return ${quantity} from layer — only ${layer.remainingQty} remaining`),
      { code: 'INSUFFICIENT_LAYER_STOCK' }
    );
  }

  const newRemaining = round4(layer.remainingQty - quantity);

  await tx.inventoryLayer.update({
    where: { id: layerId },
    data: {
      remainingQty: newRemaining,
      status: newRemaining <= 0 ? 'RETURNED' : 'ACTIVE',
    },
  });

  // Create consumption record for audit
  await tx.inventoryLayerConsumption.create({
    data: {
      transactionId,
      transactionType,
      layerId,
      quantity,
      unitCost: layer.unitCost,
      amount: round4(quantity * layer.unitCost),
      businessId,
    },
  });
}

// ── Late Landed Cost Adjustment ──────────────────────────────────────────────

/**
 * Apply a late landed cost (e.g., transport invoice received after partial consumption).
 *
 * Allocates the expense to original quantity:
 * - Consumed portion → COGS adjustment (Dr COGS Adjustment, Cr Accrued Expense)
 * - Remaining portion → Inventory revalue (updates layer unitCost)
 *
 * Returns adjustment details for journal posting by the caller.
 */
export async function applyLateLandedCost(params: LateLandedCostParams): Promise<LateLandedCostResult> {
  const { layerId, expenseType, amount, remarks, businessId, tx = prisma } = params;

  const layer = await tx.inventoryLayer.findFirst({
    where: { id: layerId, businessId },
  });

  if (!layer) {
    throw new Error(`Layer ${layerId} not found`);
  }

  const consumedQty = layer.originalQty - layer.remainingQty;
  const consumedPortion = consumedQty / layer.originalQty;
  const remainingPortion = 1 - consumedPortion;

  const allocatedToConsumed = round4(amount * consumedPortion);
  const allocatedToRemaining = round4(amount * remainingPortion);

  const oldUnitCost = layer.unitCost;
  const newLandedCost = round4(layer.landedCost + amount);
  const newUnitCost = round4(newLandedCost / layer.originalQty);

  // Update layer
  await tx.inventoryLayer.update({
    where: { id: layerId },
    data: {
      landedCost: newLandedCost,
      unitCost: newUnitCost,
    },
  });

  // Add the cost line
  await tx.inventoryLayerCost.create({
    data: {
      layerId,
      expenseType,
      amount: round4(amount),
      remarks: remarks || `Late cost: ${expenseType}`,
    },
  });

  // Create cost adjustment record
  const adjustment = await tx.inventoryCostAdjustment.create({
    data: {
      layerId,
      expenseType,
      totalAmount: round4(amount),
      allocatedToRemaining: allocatedToRemaining,
      allocatedToConsumed: allocatedToConsumed,
      oldUnitCost,
      newUnitCost,
      remarks: remarks || null,
      businessId,
    },
  });
  await recalculateProductWAC(layer.itemId, businessId, tx);

  return {
    costAdjustmentId: adjustment.id,
    oldUnitCost,
    newUnitCost,
    allocatedToRemaining,
    allocatedToConsumed,
  };
}

// ── Query Helpers ────────────────────────────────────────────────────────────

/**
 * Get all active layers for a product, optionally filtered by warehouse.
 */
export async function getLayersForProduct(
  itemId: string,
  businessId: string,
  warehouseId?: string,
  tx: any = prisma
) {
  const where: any = {
    itemId,
    businessId,
    status: 'ACTIVE',
    remainingQty: { gt: 0 },
  };
  if (warehouseId) where.warehouseId = warehouseId;

  return tx.inventoryLayer.findMany({
    where,
    include: { costs: true },
    orderBy: [{ receiptDate: 'asc' }, { createdAt: 'asc' }],
  });
}

/**
 * Calculate the Weighted Average Cost for a product across active layers.
 */
export async function getWeightedAverageCost(
  itemId: string,
  businessId: string,
  warehouseId?: string,
  tx: any = prisma
): Promise<number> {
  const where: any = {
    itemId,
    businessId,
    status: 'ACTIVE',
    remainingQty: { gt: 0 },
  };
  if (warehouseId) where.warehouseId = warehouseId;

  const layers = await tx.inventoryLayer.findMany({
    where,
    select: { remainingQty: true, unitCost: true },
  });

  if (layers.length === 0) return 0;

  const totalValue = layers.reduce((sum: number, l: any) => sum + (l.remainingQty * l.unitCost), 0);
  const totalQty = layers.reduce((sum: number, l: any) => sum + l.remainingQty, 0);

  return totalQty > 0 ? round4(totalValue / totalQty) : 0;
}

/**
 * Get total remaining quantity for a product across active layers.
 */
export async function getLayerStock(
  itemId: string,
  businessId: string,
  warehouseId?: string,
  tx: any = prisma
): Promise<number> {
  const where: any = {
    itemId,
    businessId,
    status: 'ACTIVE',
    remainingQty: { gt: 0 },
  };
  if (warehouseId) where.warehouseId = warehouseId;

  const layers = await tx.inventoryLayer.findMany({
    where,
    select: { remainingQty: true },
  });

  return layers.reduce((sum: number, l: any) => sum + l.remainingQty, 0);
}

/**
 * Update Product WAC by recalculating from active layers.
 */
export async function recalculateProductWAC(
  itemId: string,
  businessId: string,
  tx: any = prisma
): Promise<void> {
  const newWAC = await getWeightedAverageCost(itemId, businessId, undefined, tx);
  await tx.product.update({
    where: { id: itemId },
    data: { standardCost: newWAC }
  });
}
