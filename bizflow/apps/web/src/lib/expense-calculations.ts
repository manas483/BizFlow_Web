import { prisma } from './db';

export async function recalculateTransportCosts(businessId: string) {
  // 1. Fetch all products for this business
  const products = await prisma.product.findMany({
    where: { businessId },
  });

  // 2. Fetch all expenses for this business
  const expenses = await prisma.expense.findMany({
    where: { businessId },
  });

  // 3. For each invoice number, find all products associated with it
  // Map: invoiceNo -> Product[]
  const invoiceProductsMap: Record<string, typeof products> = {};
  for (const p of products) {
    if (p.purchaseInvoiceNo) {
      const inv = p.purchaseInvoiceNo.trim();
      if (inv) {
        if (!invoiceProductsMap[inv]) {
          invoiceProductsMap[inv] = [];
        }
        invoiceProductsMap[inv].push(p);
      }
    }
  }

  // 4. Calculate total transport units (bags/kattas) for each invoice
  // Map: invoiceNo -> total transport units
  const invoiceTotalTransportUnitsMap: Record<string, number> = {};
  for (const [inv, prods] of Object.entries(invoiceProductsMap)) {
    invoiceTotalTransportUnitsMap[inv] = prods.reduce(
      (sum, p) => sum + (p.stock || 0) / (p.unitsPerBag || 1),
      0
    );
  }

  // 5. For each product with a purchaseInvoiceNo, we need to calculate its new transportCost.
  // Let's initialize a map: productId -> newTransportCost
  const productTransportCostMap: Record<string, number> = {};

  // Initialize all products with purchaseInvoiceNo to 0 first (in case there are no expenses)
  for (const p of products) {
    if (p.purchaseInvoiceNo && p.purchaseInvoiceNo.trim()) {
      productTransportCostMap[p.id] = 0;
    }
  }

  // 6. Go through each expense and distribute its amount
  for (const exp of expenses) {
    const invs = (exp as any).invoiceNumbers || [];
    if (!invs || invs.length === 0) continue;

    // Filter to invoices that actually exist in our products
    const validInvs = invs.map((i: string) => i.trim()).filter((i: string) => !!invoiceProductsMap[i]);
    if (validInvs.length === 0) continue;

    // Find the sum of transport units across all products in ALL selected invoices for this expense
    let totalTransportUnitsForExpense = 0;
    for (const inv of validInvs) {
      totalTransportUnitsForExpense += invoiceTotalTransportUnitsMap[inv] || 0;
    }

    if (totalTransportUnitsForExpense > 0) {
      const expensePerTransportUnit = exp.amount / totalTransportUnitsForExpense;

      // Allocate to all products in these invoices
      for (const inv of validInvs) {
        for (const p of invoiceProductsMap[inv]) {
          const expensePerRetailUnit = expensePerTransportUnit / (p.unitsPerBag || 1);
          productTransportCostMap[p.id] = (productTransportCostMap[p.id] || 0) + expensePerRetailUnit;
        }
      }
    }
  }

  // 7. Update products in the database if their transportCost has changed
  // We can do this in a prisma transaction to be fast and safe
  const updatePromises = [];
  for (const p of products) {
    if (p.purchaseInvoiceNo && p.purchaseInvoiceNo.trim()) {
      const newTransportCost = Number((productTransportCostMap[p.id] || 0).toFixed(2));
      const newPurchasePrice = Number((p.basePurchasePrice + newTransportCost).toFixed(2));

      // Only update if it actually changed
      if (
        Math.abs(p.transportCost - newTransportCost) > 0.005 ||
        Math.abs(p.purchasePrice - newPurchasePrice) > 0.005
      ) {
        updatePromises.push(
          prisma.product.update({
            where: { id: p.id },
            data: {
              transportCost: newTransportCost,
              purchasePrice: newPurchasePrice,
            },
          })
        );
      }
    }
  }

  if (updatePromises.length > 0) {
    await prisma.$transaction(updatePromises);
  }
}
