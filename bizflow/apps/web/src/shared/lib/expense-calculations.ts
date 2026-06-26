
import { prisma } from './db';
import { postCOGSAdjustmentJournal } from './auto-journal';

// Helper to fully recalculate or allocate a specific expense incrementally
export async function recalculateTransportCosts(businessId: string) {
  // Keeping this for backward compatibility or rebuild utility
  console.log('Use incremental allocation instead');
}

export async function allocateExpenseToLayers(expenseId: string, businessId: string, tx: any = prisma) {
  const expense = await tx.expense.findFirst({ where: { id: expenseId, businessId } });
  if (!expense) return;

  const invs = (expense as any).invoiceNumbers || [];
  if (invs.length === 0) return;
  const validInvs = invs.map((i: string) => i.trim());
  const excludedProducts = (expense as any).excludedProductIds || [];

  const layers = await tx.inventoryLayer.findMany({
    where: { businessId, purchaseInvoiceId: { in: validInvs } },
    include: { product: true }
  });

  if (layers.length === 0) return;

  let totalTransportUnitsForExpense = 0;
  for (const layer of layers) {
    if (!excludedProducts.includes(layer.itemId)) {
      totalTransportUnitsForExpense += layer.originalQty;
    }
  }

  if (totalTransportUnitsForExpense > 0) {
    const expensePerTransportUnit = expense.amount / totalTransportUnitsForExpense;

    for (const layer of layers) {
      if (!excludedProducts.includes(layer.itemId)) {
        const expenseForLayer = expensePerTransportUnit * layer.originalQty;
        
        // Use applyLateLandedCost
        const { applyLateLandedCost } = await import('./layer-engine');
        await applyLateLandedCost({
          layerId: layer.id,
          expenseType: expense.category,
          amount: expenseForLayer,
          remarks: `Allocated from Expense ${expense.id}`,
          businessId,
          tx
        });

        // Record history
        await tx.expenseAllocationHistory.create({
          data: {
            expenseId: expense.id,
            layerId: layer.id,
            oldAmount: 0,
            newAmount: expenseForLayer,
            action: 'ALLOCATED'
          }
        });
      }
    }
  }
}

export async function reverseExpenseAllocation(expenseId: string, businessId: string, tx: any = prisma) {
  const histories = await tx.expenseAllocationHistory.findMany({
    where: { expenseId, action: 'ALLOCATED' }
  });

  const { applyLateLandedCost } = await import('./layer-engine');

  for (const history of histories) {
    await applyLateLandedCost({
      layerId: history.layerId,
      expenseType: 'reversal',
      amount: -history.newAmount, // negative amount to reverse
      remarks: `Reversed from Expense ${expenseId}`,
      businessId,
      tx
    });

    await tx.expenseAllocationHistory.create({
      data: {
        expenseId: expenseId,
        layerId: history.layerId,
        oldAmount: history.newAmount,
        newAmount: 0,
        action: 'DELETED'
      }
    });
  }
}

