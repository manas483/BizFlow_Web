import 'dotenv/config';
import { prisma } from '../src/shared/lib/db';

async function main() {
  const productId = 'cmqryn8cr000104jpewhnj17f';
  
  // Find all layers
  const layers = await prisma.inventoryLayer.findMany({
    where: { itemId: productId }
  });
  
  console.log(`Found ${layers.length} layers for the drifting product.`);
  
  // Delete all layers for this product
  for (const layer of layers) {
    await prisma.inventoryLayerCost.deleteMany({ where: { layerId: layer.id }});
    await prisma.inventoryLayer.delete({ where: { id: layer.id }});
  }
  
  // Re-seed it once
  const product = await prisma.product.findUnique({ where: { id: productId }});
  if (product && product.stock > 0) {
    await prisma.inventoryLayer.create({
      data: {
        itemId: product.id,
        businessId: product.businessId,
        receiptNo: 'SEED-LAYER-0',
        sourceTransactionType: 'OPENING_STOCK',
        originalQty: product.stock,
        remainingQty: product.stock,
        purchaseCost: product.stock * product.basePurchasePrice,
        landedCost: product.stock * product.purchasePrice,
        unitCost: product.purchasePrice,
        status: 'ACTIVE',
        costingMethodSnapshot: 'FIFO',
        receiptDate: new Date(),
      }
    });
    console.log('Fixed the drifting product layer sum to match stock.');
  }
}

main().finally(() => prisma.$disconnect());
