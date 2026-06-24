import 'dotenv/config';
import { prisma } from '../src/shared/lib/db';

async function main() {
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 } },
  });

  console.log(`Found ${products.length} products with stock > 0. Creating Seed Layers...`);

  let count = 0;
  for (const product of products) {
    // Check if layer already exists to prevent duplicate seeding
    const existing = await prisma.inventoryLayer.findFirst({
      where: { itemId: product.id, receiptNo: 'SEED-LAYER-0' }
    });

    if (!existing) {
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
        // Also seed the transport cost into InventoryLayerCost
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
  }

  console.log(`Successfully seeded ${count} layers.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
