import 'dotenv/config';
import { prisma } from '../src/shared/lib/db';

function round4(num: number) {
  return Math.round(num * 10000) / 10000;
}

async function main() {
  console.log('Running Inventory Integrity Validation...');
  let errors = 0;

  // 1. Fetch all products and active layers
  const products = await prisma.product.findMany({
    select: { id: true, businessId: true, name: true, stock: true, purchasePrice: true }
  });

  for (const p of products) {
    const layers = await prisma.inventoryLayer.findMany({
      where: { itemId: p.id, businessId: p.businessId, status: 'ACTIVE' }
    });

    const sumLayerQty = layers.reduce((sum, l) => sum + l.remainingQty, 0);
    const layerValuation = layers.reduce((sum, l) => sum + (l.remainingQty * l.unitCost), 0);
    const wac = sumLayerQty > 0 ? layerValuation / sumLayerQty : 0;

    // Check A: Product Stock == Sum of Layer Qty
    if (Math.abs(p.stock - sumLayerQty) > 0.001) {
      console.error(`❌ Data Drift (Stock) on Product ${p.name} (${p.id}): Product.stock=${p.stock}, LayerSum=${sumLayerQty}`);
      errors++;
    }

    // Check B: Product WAC == Layer Computed WAC
    if (Math.abs(p.purchasePrice - round4(wac)) > 0.001) {
      // Ignore WAC mismatch if there is no stock to value
      if (p.stock > 0 || wac > 0) {
        console.error(`❌ Data Drift (WAC) on Product ${p.name} (${p.id}): Product.purchasePrice=${p.purchasePrice}, LayerWAC=${round4(wac)}`);
        errors++;
      }
    }
  }

  // 2. Check for Negative Layers
  const negativeLayers = await prisma.inventoryLayer.count({
    where: { remainingQty: { lt: 0 } }
  });
  if (negativeLayers > 0) {
    console.error(`❌ Integrity Error: Found ${negativeLayers} layers with negative remainingQty.`);
    errors++;
  }

  // 3. Check for Orphan Consumptions
  // Consumption without a valid layer (should be caught by foreign keys, but just to be sure)
  // A safer manual check for orphans
  const consumptions = await prisma.inventoryLayerConsumption.findMany({
    select: { id: true, layerId: true }
  });
  const layerIds = await prisma.inventoryLayer.findMany({ select: { id: true } }).then(l => new Set(l.map(x => x.id)));
  
  let actualOrphans = 0;
  for (const c of consumptions) {
    if (!layerIds.has(c.layerId)) {
      actualOrphans++;
    }
  }

  if (actualOrphans > 0) {
    console.error(`❌ Integrity Error: Found ${actualOrphans} orphan consumptions.`);
    errors++;
  }

  if (errors === 0) {
    console.log('✅ Inventory Integrity is PERFECT. 0 errors found.');
  } else {
    console.error(`🚨 Validation failed with ${errors} total errors.`);
    process.exit(1);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
