const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Test concurrency for layer-engine
  const { adjustStockWithLayers } = require('../src/shared/lib/layer-engine');
  
  // Find a product with stock and layer
  const layer = await prisma.inventoryLayer.findFirst({
    where: { remainingQty: { gt: 10 }, status: 'ACTIVE' },
    include: { product: true }
  });

  if (!layer) {
    console.log('No active layer found for testing.');
    return;
  }

  console.log(\Testing concurrency on product \ (\), Layer ID: \\);
  console.log(\Initial Remaining Qty: \\);

  // Try to consume 5 units, 3 times concurrently
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(
      adjustStockWithLayers({
        itemId: layer.itemId,
        quantity: 5,
        type: 'sale',
        businessId: layer.businessId,
        transactionId: \TEST-SALE-\\,
        transactionType: 'sale',
      }).catch(e => console.error(\Request \ failed:\, e.message))
    );
  }

  await Promise.all(promises);

  const updatedLayer = await prisma.inventoryLayer.findUnique({ where: { id: layer.id } });
  console.log(\Final Remaining Qty: \\);
  console.log(\Expected Remaining Qty: \\);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.\();
  });

