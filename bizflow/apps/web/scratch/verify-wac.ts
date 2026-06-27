import { prisma } from '../src/shared/lib/db';
import { CostingService } from '../src/modules/inventory/costing.service';
import { logger } from '../src/shared/lib/logger';
async function runTests() {
  const businessId = "cmqpggqbl000005ier4oy5qfs"; // Ashirwad Business ID
  let testProductId: string | null = null;

  try {
    logger.info("Starting WAC Costing verification tests...");

    // 1. Create a temporary product for testing
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

    // 2. Scenario A: Insert two purchase invoice layers
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

    logger.info(`Inserted test inventory layers: ${layer1.id}, ${layer2.id}`);

    // Run first calculation
    const [resultA] = await CostingService.computeProductAverageCosts([testProduct], businessId);
    
    logger.info("Scenario A Results (Full Inventory):", {
      purchaseCost: resultA.purchaseCost,
      additionalCost: resultA.additionalCost,
      landedCost: resultA.landedCost,
      activeLayersCount: resultA.activeLayersCount,
      activeLayerQty: resultA.activeLayerQty,
      metadata: resultA.costingMetadata
    });

    // Asserts Scenario A
    if (Math.abs(resultA.purchaseCost - 760) > 0.0001) throw new Error(`Scenario A Purchase Cost mismatch: expected 760, got ${resultA.purchaseCost}`);
    if (Math.abs(resultA.landedCost - 770) > 0.0001) throw new Error(`Scenario A Landed Cost mismatch: expected 770, got ${resultA.landedCost}`);
    if (Math.abs(resultA.additionalCost - 10) > 0.0001) throw new Error(`Scenario A Additional Cost mismatch: expected 10, got ${resultA.additionalCost}`);
    if (resultA.activeLayersCount !== 2) throw new Error(`Scenario A layers count mismatch: expected 2, got ${resultA.activeLayersCount}`);
    if (resultA.activeLayerQty !== 16) throw new Error(`Scenario A layers qty mismatch: expected 16, got ${resultA.activeLayerQty}`);
    if (resultA.costingMetadata.source !== 'ACTIVE_LAYERS') throw new Error(`Scenario A metadata source mismatch: expected ACTIVE_LAYERS, got ${resultA.costingMetadata.source}`);
    logger.info("✅ Scenario A Passed!");

    // 3. Scenario B: Simulate partial FIFO consumption (reducing stock to 13 units)
    // We consume 3 units from Layer 1, leaving remainingQty = 5
    await prisma.inventoryLayer.update({
      where: { id: layer1.id },
      data: { remainingQty: 5 }
    });

    const [resultB] = await CostingService.computeProductAverageCosts([testProduct], businessId);

    // Expected averages:
    // Total stock = 13
    // Landed = (5 * 767.50 + 8 * 772.50) / 13 = 770.576923
    // Purchase = (5 * 760 + 8 * 760) / 13 = 760.00
    // Additional = 770.576923 - 760 = 10.576923
    const expectedLandedB = (5 * 767.50 + 8 * 772.50) / 13;
    const expectedAdditionalB = expectedLandedB - 760;

    logger.info("Scenario B Results (Partial FIFO Consumption):", {
      purchaseCost: resultB.purchaseCost,
      additionalCost: resultB.additionalCost,
      landedCost: resultB.landedCost,
      activeLayersCount: resultB.activeLayersCount,
      activeLayerQty: resultB.activeLayerQty,
      metadata: resultB.costingMetadata
    });

    // Asserts Scenario B
    if (Math.abs(resultB.purchaseCost - 760) > 0.0001) throw new Error(`Scenario B Purchase Cost mismatch`);
    if (Math.abs(resultB.landedCost - expectedLandedB) > 0.0001) throw new Error(`Scenario B Landed Cost mismatch: expected ${expectedLandedB}, got ${resultB.landedCost}`);
    if (Math.abs(resultB.additionalCost - expectedAdditionalB) > 0.0001) throw new Error(`Scenario B Additional Cost mismatch: expected ${expectedAdditionalB}, got ${resultB.additionalCost}`);
    if (resultB.activeLayersCount !== 2) throw new Error(`Scenario B layers count mismatch`);
    if (resultB.activeLayerQty !== 13) throw new Error(`Scenario B layers qty mismatch: expected 13, got ${resultB.activeLayerQty}`);
    logger.info("✅ Scenario B Passed!");

    // 4. Scenario C: Simulate purchase return (Debit Note)
    // Reset Layer 1 to 8 units. Set Layer 2 remainingQty to 6 units (returning 2 units from invoice 2)
    await prisma.inventoryLayer.updateMany({
      where: { id: { in: [layer1.id, layer2.id] } },
      data: { remainingQty: 8 } // Reset layer1 to 8
    });
    await prisma.inventoryLayer.update({
      where: { id: layer2.id },
      data: { remainingQty: 6 } // Layer 2 has 6 left
    });

    const [resultC] = await CostingService.computeProductAverageCosts([testProduct], businessId);

    // Expected averages:
    // Total stock = 14
    // Landed = (8 * 767.50 + 6 * 772.50) / 14 = 769.642857
    // Purchase = (8 * 760 + 6 * 760) / 14 = 760.00
    // Additional = 769.642857 - 760 = 9.642857
    const expectedLandedC = (8 * 767.50 + 6 * 772.50) / 14;
    const expectedAdditionalC = expectedLandedC - 760;

    logger.info("Scenario C Results (Purchase Return):", {
      purchaseCost: resultC.purchaseCost,
      additionalCost: resultC.additionalCost,
      landedCost: resultC.landedCost,
      activeLayersCount: resultC.activeLayersCount,
      activeLayerQty: resultC.activeLayerQty,
      metadata: resultC.costingMetadata
    });

    // Asserts Scenario C
    if (Math.abs(resultC.purchaseCost - 760) > 0.0001) throw new Error(`Scenario C Purchase Cost mismatch`);
    if (Math.abs(resultC.landedCost - expectedLandedC) > 0.0001) throw new Error(`Scenario C Landed Cost mismatch: expected ${expectedLandedC}, got ${resultC.landedCost}`);
    if (Math.abs(resultC.additionalCost - expectedAdditionalC) > 0.0001) throw new Error(`Scenario C Additional Cost mismatch: expected ${expectedAdditionalC}, got ${resultC.additionalCost}`);
    if (resultC.activeLayersCount !== 2) throw new Error(`Scenario C layers count mismatch`);
    if (resultC.activeLayerQty !== 14) throw new Error(`Scenario C layers qty mismatch: expected 14, got ${resultC.activeLayerQty}`);
    logger.info("✅ Scenario C Passed!");

    // 5. Scenario D: Fallback Priority 2 (Seed Data: stock > 0, but no active layers)
    // Delete the active layers for our test product
    await prisma.inventoryLayer.deleteMany({
      where: { itemId: testProductId }
    });

    const [resultD] = await CostingService.computeProductAverageCosts([testProduct], businessId);

    logger.info("Scenario D Results (Fallback Seed Data):", {
      purchaseCost: resultD.purchaseCost,
      additionalCost: resultD.additionalCost,
      landedCost: resultD.landedCost,
      activeLayersCount: resultD.activeLayersCount,
      activeLayerQty: resultD.activeLayerQty,
      metadata: resultD.costingMetadata
    });

    // Asserts Scenario D
    if (resultD.purchaseCost !== 770.00) throw new Error(`Scenario D Purchase Cost mismatch`);
    if (resultD.landedCost !== 770.00) throw new Error(`Scenario D Landed Cost mismatch`);
    if (resultD.additionalCost !== 0) throw new Error(`Scenario D Additional Cost mismatch`);
    if (resultD.activeLayersCount !== 0) throw new Error(`Scenario D layers count mismatch`);
    if (resultD.activeLayerQty !== 16) throw new Error(`Scenario D layers qty mismatch: expected 16, got ${resultD.activeLayerQty}`);
    if (resultD.costingMetadata.source !== 'PRODUCT_FALLBACK') throw new Error(`Scenario D source mismatch`);
    logger.info("✅ Scenario D Passed!");

    // 6. Scenario E: Fallback Priority 3 (Zero Stock: stock = 0, no active layers)
    const zeroStockProduct = { ...testProduct, stock: 0 };
    const [resultE] = await CostingService.computeProductAverageCosts([zeroStockProduct], businessId);

    logger.info("Scenario E Results (Zero Stock):", {
      purchaseCost: resultE.purchaseCost,
      additionalCost: resultE.additionalCost,
      landedCost: resultE.landedCost,
      activeLayersCount: resultE.activeLayersCount,
      activeLayerQty: resultE.activeLayerQty,
      metadata: resultE.costingMetadata
    });

    // Asserts Scenario E
    if (resultE.purchaseCost !== 0) throw new Error(`Scenario E Purchase Cost mismatch`);
    if (resultE.landedCost !== 0) throw new Error(`Scenario E Landed Cost mismatch`);
    if (resultE.additionalCost !== 0) throw new Error(`Scenario E Additional Cost mismatch`);
    if (resultE.activeLayersCount !== 0) throw new Error(`Scenario E layers count mismatch`);
    if (resultE.activeLayerQty !== 0) throw new Error(`Scenario E layers qty mismatch`);
    if (resultE.costingMetadata.source !== 'ZERO_STOCK') throw new Error(`Scenario E source mismatch`);
    logger.info("✅ Scenario E Passed!");

    logger.info("🎉 All WAC calculations verified successfully!");

  } catch (error) {
    logger.error("❌ Test Verification failed!", error);
    throw error;
  } finally {
    // Cleanup temporary data
    if (testProductId) {
      logger.info("Cleaning up test data...");
      await prisma.inventoryLayer.deleteMany({ where: { itemId: testProductId } });
      await prisma.product.delete({ where: { id: testProductId } });
      logger.info("Cleanup completed.");
    }
  }
}

runTests().catch(err => {
  console.error("Fatal Test Failure:", err);
  process.exit(1);
});
