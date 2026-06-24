const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function round4(num) {
  return Math.round(num * 10000) / 10000;
}

async function main() {
  console.log('Starting Inventory Rebuild Utility...');

  // 1. Recalculate landedCost and unitCost for all InventoryLayers
  const layers = await prisma.inventoryLayer.findMany({
    include: { costs: true }
  });

  let updatedLayers = 0;
  for (const layer of layers) {
    const totalExpenses = layer.costs.reduce((sum, c) => sum + c.amount, 0);
    const newLandedCost = layer.purchaseCost + totalExpenses;
    const newUnitCost = round4(newLandedCost / layer.originalQty);

    if (Math.abs(layer.landedCost - newLandedCost) > 0.001 || Math.abs(layer.unitCost - newUnitCost) > 0.001) {
      await prisma.inventoryLayer.update({
        where: { id: layer.id },
        data: { landedCost: newLandedCost, unitCost: newUnitCost }
      });
      updatedLayers++;
    }
  }
  console.log(\[1/3] Re-calculated Landed Costs. Updated \ layers.\);

  // 2. Rebuild WAC for all Products
  const products = await prisma.product.findMany({ select: { id: true, businessId: true, purchasePrice: true } });
  
  let updatedProducts = 0;
  for (const p of products) {
    const activeLayers = await prisma.inventoryLayer.findMany({
      where: { itemId: p.id, businessId: p.businessId, status: 'ACTIVE', remainingQty: { gt: 0 } }
    });

    let wac = 0;
    if (activeLayers.length > 0) {
      const totalValue = activeLayers.reduce((sum, l) => sum + (l.remainingQty * l.unitCost), 0);
      const totalQty = activeLayers.reduce((sum, l) => sum + l.remainingQty, 0);
      wac = round4(totalValue / totalQty);
    }

    if (Math.abs(p.purchasePrice - wac) > 0.001) {
      await prisma.product.update({
        where: { id: p.id },
        data: { purchasePrice: wac }
      });
      updatedProducts++;
    }
  }
  console.log(\[2/3] Rebuilt Product WACs. Updated \ products.\);

  // 3. Re-evaluate SaleItem COGS
  const saleItems = await prisma.saleItem.findMany({
    include: {
      sale: {
        select: { id: true }
      }
    }
  });

  let updatedSaleItems = 0;
  for (const si of saleItems) {
    // Sum consumptions
    const consumptions = await prisma.inventoryLayerConsumption.findMany({
      where: { transactionId: si.saleId, transactionType: 'sale', layer: { itemId: si.productId } }
    });

    if (consumptions.length > 0) {
      const actualCost = consumptions.reduce((sum, c) => sum + c.amount, 0);
      const actualUnitCost = round4(actualCost / si.qty);
      if (Math.abs(si.purchasePrice - actualUnitCost) > 0.001) {
        await prisma.saleItem.update({
          where: { id: si.id },
          data: { purchasePrice: actualUnitCost }
        });
        updatedSaleItems++;
      }
    }
  }
  console.log(\[3/3] Re-evaluated SaleItem COGS. Updated \ sale items.\);

  console.log('Inventory Rebuild Complete!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.\();
  });

