/**
 * Production Engine — Manufacturing BOM execution.
 *
 * When a production run is executed:
 * 1. Fetches the BOM recipe (Bill of Material + component items)
 * 2. Consumes raw material layers for each component (qty × outputQty)
 * 3. Calculates total material cost from consumed layers
 * 4. Adds labor, overhead, and any additional costs
 * 5. Creates a new InventoryLayer for the finished product
 * 6. Creates StockMovement records for audit
 *
 * All operations run within a Prisma transaction.
 */

import { prisma } from '@/shared/lib/db';
import { consumeLayers, createLayer, getCostingMethod, type LayerConsumptionResult } from '@/shared/lib/layer-engine';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExecuteProductionParams {
  bomId: string;
  outputQty: number;                         // How many finished units to produce
  warehouseId: string;
  additionalCosts?: Array<{
    expenseType: string;
    amount: number;
    remarks?: string;
  }>;
  batchNo?: string;
  lotNo?: string;
  mfgDate?: Date;
  expiryDate?: Date;
  notes?: string;
  businessId: string;
  tx?: any;
}

export interface ProductionResult {
  finishedLayerId: string;
  productionId: string;
  totalMaterialCost: number;
  laborCost: number;
  overheadCost: number;
  additionalCost: number;
  totalCost: number;
  componentConsumptions: Array<{
    productId: string;
    productName: string;
    requiredQty: number;
    layerResult: LayerConsumptionResult;
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Production Logic ─────────────────────────────────────────────────────────

/**
 * Execute a production run from a Bill of Material.
 *
 * Logic:
 * 1. Fetch BOM with components
 * 2. Validate all raw materials have sufficient stock
 * 3. Consume raw material layers for each component
 * 4. Calculate total cost: material + labor + overhead + additional
 * 5. Create finished product layer
 * 6. Create stock movements
 */
export async function executeProduction(params: ExecuteProductionParams): Promise<ProductionResult> {
  const {
    bomId,
    outputQty,
    warehouseId,
    additionalCosts = [],
    batchNo,
    lotNo,
    mfgDate,
    expiryDate,
    notes,
    businessId,
    tx = prisma,
  } = params;

  if (outputQty <= 0) {
    throw new Error('Output quantity must be greater than 0');
  }

  // Generate production reference ID
  const productionId = `PRD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 1. Fetch BOM with components
  const bom = await tx.billOfMaterial.findFirst({
    where: { id: bomId, businessId, status: 'ACTIVE' },
    include: {
      components: {
        include: {
          // We need the product info for the raw materials
        },
      },
    },
  });

  if (!bom) {
    throw new Error(`Bill of Material ${bomId} not found or not active`);
  }

  // Fetch finished product
  const finishedProduct = await tx.product.findFirst({
    where: { id: bom.finishedItemId, businessId },
    select: { id: true, name: true },
  });

  if (!finishedProduct) {
    throw new Error(`Finished product ${bom.finishedItemId} not found`);
  }

  // Calculate multiplier: how many BOM batches are needed
  const batchMultiplier = outputQty / bom.outputQty;

  // 2. Consume raw material layers for each component
  const componentConsumptions: ProductionResult['componentConsumptions'] = [];
  let totalMaterialCost = 0;

  for (const component of bom.components) {
    const requiredQty = round4(component.quantity * batchMultiplier);

    // Get component product info
    const componentProduct = await tx.product.findFirst({
      where: { id: component.productId, businessId },
      select: { id: true, name: true },
    });

    if (!componentProduct) {
      throw new Error(`Component product ${component.productId} not found`);
    }

    // Consume from layers
    const layerResult = await consumeLayers({
      itemId: component.productId,
      warehouseId,
      quantity: requiredQty,
      transactionId: productionId,
      transactionType: 'production',
      businessId,
      tx,
    });

    // Decrement product stock
    await tx.product.update({
      where: { id: component.productId },
      data: { stock: { decrement: requiredQty } },
    });

    // Create stock movement for raw material consumption
    await tx.stockMovement.create({
      data: {
        productId: component.productId,
        warehouseId,
        type: 'OUT',
        quantity: -requiredQty,
        referenceId: productionId,
        notes: `Production consumption: ${finishedProduct.name} (${notes || productionId})`,
        businessId,
      },
    });

    componentConsumptions.push({
      productId: component.productId,
      productName: componentProduct.name,
      requiredQty,
      layerResult,
    });

    totalMaterialCost += layerResult.totalCOGS;
  }

  totalMaterialCost = round4(totalMaterialCost);

  // 3. Calculate costs
  const laborCost = round4(bom.laborCost * batchMultiplier);

  let overheadCost: number;
  if (bom.overheadType === 'percentage') {
    // Overhead as percentage of material cost
    overheadCost = round4(totalMaterialCost * (bom.overheadCost / 100));
  } else {
    // Fixed overhead per BOM batch
    overheadCost = round4(bom.overheadCost * batchMultiplier);
  }

  const additionalCost = round4(additionalCosts.reduce((sum, c) => sum + c.amount, 0));
  const totalCost = round4(totalMaterialCost + laborCost + overheadCost + additionalCost);

  // 4. Build expense breakdown for the finished product layer
  const expenses: Array<{ expenseType: string; amount: number; remarks?: string }> = [];

  if (laborCost > 0) {
    expenses.push({
      expenseType: 'labor',
      amount: laborCost,
      remarks: `Labor cost for production`,
    });
  }

  if (overheadCost > 0) {
    expenses.push({
      expenseType: 'overhead',
      amount: overheadCost,
      remarks: `Overhead (${bom.overheadType}: ${bom.overheadCost})`,
    });
  }

  for (const cost of additionalCosts) {
    expenses.push({
      expenseType: cost.expenseType,
      amount: cost.amount,
      remarks: cost.remarks || `Additional production cost`,
    });
  }

  // 5. Create finished product layer
  const finishedLayerId = await createLayer({
    itemId: bom.finishedItemId,
    warehouseId,
    receiptNo: productionId,
    receiptDate: new Date(),
    quantity: outputQty,
    purchaseCost: totalMaterialCost,    // Material cost = "purchase cost" for the finished good
    expenses,
    batchNo,
    lotNo,
    mfgDate: mfgDate || new Date(),
    expiryDate,
    sourceTransactionId: productionId,
    sourceTransactionType: 'production',
    isAdjustment: false,
    businessId,
    tx,
  });

  // 6. Increment finished product stock
  await tx.product.update({
    where: { id: bom.finishedItemId },
    data: { stock: { increment: outputQty } },
  });

  // Create stock movement for finished product
  await tx.stockMovement.create({
    data: {
      productId: bom.finishedItemId,
      warehouseId,
      type: 'IN',
      quantity: outputQty,
      referenceId: productionId,
      notes: `Production output: ${finishedProduct.name} × ${outputQty} (${notes || productionId})`,
      businessId,
    },
  });

  return {
    finishedLayerId,
    productionId,
    totalMaterialCost,
    laborCost,
    overheadCost,
    additionalCost,
    totalCost,
    componentConsumptions,
  };
}
