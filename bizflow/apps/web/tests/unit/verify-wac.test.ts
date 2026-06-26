import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/shared/lib/db';
import { CostingService } from '../../src/modules/inventory/costing.service';
import { logger } from '../../src/shared/lib/logger';
describe('WAC Costing Service', () => {
  const businessId = "cmqpggqbl000005ier4oy5qfs"; // Ashirwad Business ID
  let testProductId: string;

  beforeAll(async () => {
    // Create a temporary product for testing
    const testProduct = await prisma.product.create({
      data: {
        name: "Test WAC Product",
        sku: "TEST-WAC-001",
        category: "Other",
        stock: 16,
        minStock: 5,
        standardCost: 770.00,
        sellingPrice: 1000.00,
        businessId,
        unit: "pcs"
      }
    });
    testProductId = testProduct.id;
    logger.info(`Created test product with ID: ${testProductId}`);
  });

  afterAll(async () => {
    // Cleanup temporary data
    if (testProductId) {
      logger.info("Cleaning up test data...");
      await prisma.inventoryLayer.deleteMany({ where: { itemId: testProductId } });
      await prisma.product.delete({ where: { id: testProductId } });
      logger.info("Cleanup completed.");
    }
  });

  test('Scenario A: Full Inventory WAC calculation across two layers', async () => {
    // Invoice 1: 8 units @ ₹767.50 unit cost (Purchase: ₹760, Additional: ₹7.50)
    const layer1 = await prisma.inventoryLayer.create({
      data: {
        itemId: testProductId,
        receiptNo: "INV-TEST-001",
        originalQty: 8,
        remainingQty: 8,
        purchaseCost: 8 * 760, // Total purchase cost = ₹6080
        landedCost: 8 * 767.50, // Total landed cost = ₹6140
        unitCost: 767.50,
        status: "ACTIVE",
        businessId,
        sourceTransactionType: "purchase"
      }
    });

    // Invoice 2: 8 units @ ₹772.50 unit cost (Purchase: ₹760, Additional: ₹12.50)
    const layer2 = await prisma.inventoryLayer.create({
      data: {
        itemId: testProductId,
        receiptNo: "INV-TEST-002",
        originalQty: 8,
        remainingQty: 8,
        purchaseCost: 8 * 760, // Total purchase cost = ₹6080
        landedCost: 8 * 772.50, // Total landed cost = ₹6180
        unitCost: 772.50,
        status: "ACTIVE",
        businessId,
        sourceTransactionType: "purchase"
      }
    });

    const testProduct = await prisma.product.findUnique({ where: { id: testProductId } });
    const [resultA] = await CostingService.computeProductAverageCosts([testProduct], businessId);

    expect(resultA.purchaseCost).toBeCloseTo(760, 4);
    expect(resultA.landedCost).toBeCloseTo(770, 4);
    expect(resultA.additionalCost).toBeCloseTo(10, 4);
    expect(resultA.activeLayersCount).toBe(2);
    expect(resultA.activeLayerQty).toBe(16);
    expect(resultA.costingMetadata.source).toBe('ACTIVE_LAYERS');

    // Clean up layers for this test to avoid leakage
    await prisma.inventoryLayer.deleteMany({ where: { itemId: testProductId } });
  });

  test('Scenario B: Partial FIFO consumption (reducing stock to 13 units)', async () => {
    // Setup layers again
    const layer1 = await prisma.inventoryLayer.create({
      data: {
        itemId: testProductId,
        receiptNo: "INV-TEST-001",
        originalQty: 8,
        remainingQty: 5, // Consumed 3 units from Layer 1
        purchaseCost: 8 * 760,
        landedCost: 8 * 767.50,
        unitCost: 767.50,
        status: "ACTIVE",
        businessId,
        sourceTransactionType: "purchase"
      }
    });

    const layer2 = await prisma.inventoryLayer.create({
      data: {
        itemId: testProductId,
        receiptNo: "INV-TEST-002",
        originalQty: 8,
        remainingQty: 8,
        purchaseCost: 8 * 760,
        landedCost: 8 * 772.50,
        unitCost: 772.50,
        status: "ACTIVE",
        businessId,
        sourceTransactionType: "purchase"
      }
    });

    const testProduct = await prisma.product.findUnique({ where: { id: testProductId } });
    const [resultB] = await CostingService.computeProductAverageCosts([testProduct], businessId);

    const expectedLandedB = (5 * 767.50 + 8 * 772.50) / 13;
    const expectedAdditionalB = expectedLandedB - 760;

    expect(resultB.purchaseCost).toBeCloseTo(760, 4);
    expect(resultB.landedCost).toBeCloseTo(expectedLandedB, 4);
    expect(resultB.additionalCost).toBeCloseTo(expectedAdditionalB, 4);
    expect(resultB.activeLayersCount).toBe(2);
    expect(resultB.activeLayerQty).toBe(13);

    // Clean up layers
    await prisma.inventoryLayer.deleteMany({ where: { itemId: testProductId } });
  });

  test('Scenario C: Purchase return (Debit Note)', async () => {
    // Setup layers
    const layer1 = await prisma.inventoryLayer.create({
      data: {
        itemId: testProductId,
        receiptNo: "INV-TEST-001",
        originalQty: 8,
        remainingQty: 8,
        purchaseCost: 8 * 760,
        landedCost: 8 * 767.50,
        unitCost: 767.50,
        status: "ACTIVE",
        businessId,
        sourceTransactionType: "purchase"
      }
    });

    const layer2 = await prisma.inventoryLayer.create({
      data: {
        itemId: testProductId,
        receiptNo: "INV-TEST-002",
        originalQty: 8,
        remainingQty: 6, // Returned 2 units
        purchaseCost: 8 * 760,
        landedCost: 8 * 772.50,
        unitCost: 772.50,
        status: "ACTIVE",
        businessId,
        sourceTransactionType: "purchase"
      }
    });

    const testProduct = await prisma.product.findUnique({ where: { id: testProductId } });
    const [resultC] = await CostingService.computeProductAverageCosts([testProduct], businessId);

    const expectedLandedC = (8 * 767.50 + 6 * 772.50) / 14;
    const expectedAdditionalC = expectedLandedC - 760;

    expect(resultC.purchaseCost).toBeCloseTo(760, 4);
    expect(resultC.landedCost).toBeCloseTo(expectedLandedC, 4);
    expect(resultC.additionalCost).toBeCloseTo(expectedAdditionalC, 4);
    expect(resultC.activeLayersCount).toBe(2);
    expect(resultC.activeLayerQty).toBe(14);

    // Clean up layers
    await prisma.inventoryLayer.deleteMany({ where: { itemId: testProductId } });
  });

  test('Scenario D: Fallback Priority 2 (Seed Data: stock > 0, no active layers)', async () => {
    const testProduct = await prisma.product.findUnique({ where: { id: testProductId } });
    // Verify no layers are present
    const layers = await prisma.inventoryLayer.findMany({ where: { itemId: testProductId } });
    expect(layers.length).toBe(0);

    const [resultD] = await CostingService.computeProductAverageCosts([testProduct], businessId);

    expect(resultD.purchaseCost).toBe(770.00);
    expect(resultD.landedCost).toBe(770.00);
    expect(resultD.additionalCost).toBe(0);
    expect(resultD.activeLayersCount).toBe(0);
    expect(resultD.activeLayerQty).toBe(16);
    expect(resultD.costingMetadata.source).toBe('PRODUCT_FALLBACK');
  });

  test('Scenario E: Fallback Priority 3 (Zero Stock: stock = 0, no active layers)', async () => {
    const testProduct = await prisma.product.findUnique({ where: { id: testProductId } });
    const zeroStockProduct = { ...testProduct, stock: 0 };

    const [resultE] = await CostingService.computeProductAverageCosts([zeroStockProduct], businessId);

    expect(resultE.purchaseCost).toBe(0);
    expect(resultE.landedCost).toBe(0);
    expect(resultE.additionalCost).toBe(0);
    expect(resultE.activeLayersCount).toBe(0);
    expect(resultE.activeLayerQty).toBe(0);
    expect(resultE.costingMetadata.source).toBe('ZERO_STOCK');
  });
});
