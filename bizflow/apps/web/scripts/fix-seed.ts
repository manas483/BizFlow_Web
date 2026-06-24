import 'dotenv/config';
import { prisma } from '../src/shared/lib/db';

async function main() {
  console.log('Fixing corrupted seed data...');

  // 1. Delete all seed layers
  await prisma.inventoryLayerCost.deleteMany({
    where: { layer: { receiptNo: 'SEED-LAYER-0' } }
  });
  
  await prisma.inventoryLayer.deleteMany({
    where: { receiptNo: 'SEED-LAYER-0' }
  });

  console.log('Deleted old seed layers. Re-seeding properly...');

  // 2. Re-seed layers
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 } },
  });

  let count = 0;
  for (const product of products) {
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

    if (product.transportCost > 0) {
      const layer = await prisma.inventoryLayer.findFirst({
        where: { itemId: product.id, receiptNo: 'SEED-LAYER-0' }
      });
      if (layer) {
        await prisma.inventoryLayerCost.create({
          data: {
            layerId: layer.id,
            expenseType: 'transport',
            amount: product.transportCost * product.stock,
            remarks: 'Seed layer transport cost'
          }
        });
      }
    }
    count++;
  }

  console.log(`Successfully seeded ${count} layers.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
