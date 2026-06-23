/**
 * Inventory Layer Seed Migration Script
 *
 * Creates initial inventory layers from existing product stock data.
 * Run this ONCE after the Prisma migration that creates the InventoryLayer tables.
 *
 * Usage: npx tsx scripts/seed-inventory-layers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting inventory layer seed migration...\n');

  // Fetch all products with stock > 0
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 } },
    select: {
      id: true,
      name: true,
      sku: true,
      stock: true,
      purchasePrice: true,
      basePurchasePrice: true,
      transportCost: true,
      purchaseInvoiceNo: true,
      purchaseDate: true,
      supplier: true,
      purchaseFrom: true,
      businessId: true,
      createdAt: true,
    },
  });

  console.log(`Found ${products.length} products with stock > 0\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of products) {
    try {
      // Check if a layer already exists for this product (idempotency)
      const existingLayer = await prisma.inventoryLayer.findFirst({
        where: {
          itemId: product.id,
          businessId: product.businessId,
        },
      });

      if (existingLayer) {
        console.log(`  ⏭️  Skipping ${product.name} (${product.sku}) — layer already exists`);
        skipped++;
        continue;
      }

      const basePurchasePrice = product.basePurchasePrice || product.purchasePrice;
      const transportCost = product.transportCost || 0;

      const purchaseCostTotal = basePurchasePrice * product.stock;
      const transportCostTotal = transportCost * product.stock;
      const landedCostTotal = product.purchasePrice * product.stock;
      const unitCost = product.purchasePrice;

      // Create the inventory layer
      const layer = await prisma.inventoryLayer.create({
        data: {
          itemId: product.id,
          receiptNo: product.purchaseInvoiceNo || null,
          receiptDate: product.purchaseDate || product.createdAt,
          originalQty: product.stock,
          remainingQty: product.stock,
          purchaseCost: Math.round(purchaseCostTotal * 10000) / 10000,
          landedCost: Math.round(landedCostTotal * 10000) / 10000,
          unitCost: Math.round(unitCost * 10000) / 10000,
          status: 'ACTIVE',
          supplierId: product.supplier || product.purchaseFrom || null,
          sourceTransactionType: 'purchase',
          costingMethodSnapshot: 'FIFO',
          businessId: product.businessId,
        },
      });

      // Create purchase cost breakdown
      await prisma.inventoryLayerCost.create({
        data: {
          layerId: layer.id,
          expenseType: 'purchase_cost',
          amount: Math.round(purchaseCostTotal * 10000) / 10000,
          remarks: 'Seed migration — initial purchase cost',
        },
      });

      // Create transport cost breakdown if applicable
      if (transportCostTotal > 0) {
        await prisma.inventoryLayerCost.create({
          data: {
            layerId: layer.id,
            expenseType: 'transport',
            amount: Math.round(transportCostTotal * 10000) / 10000,
            remarks: 'Seed migration — initial transport cost',
          },
        });
      }

      console.log(
        `  ✅ ${product.name} (${product.sku}): ` +
        `${product.stock} units @ ₹${unitCost.toFixed(2)}/unit = ₹${landedCostTotal.toFixed(2)} total`
      );
      created++;
    } catch (err: any) {
      console.error(`  ❌ Error for ${product.name} (${product.sku}):`, err.message);
      errors++;
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log(`✅ Created: ${created} layers`);
  console.log(`⏭️  Skipped: ${skipped} (already exist)`);
  console.log(`❌ Errors:  ${errors}`);
  console.log('────────────────────────────────────────\n');

  if (errors > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
