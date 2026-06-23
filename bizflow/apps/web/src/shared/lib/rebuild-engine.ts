/**
 * Rebuild Engine — backdated transaction recalculation.
 *
 * When a backdated purchase receipt or cost change is entered, this engine:
 * 1. Fetches all layers and consumptions for the product from a given date forward
 * 2. Re-sorts layers by receipt date
 * 3. Re-applies consumption in transaction date order using the configured costing method
 * 4. Identifies differences in COGS amounts
 * 5. Posts corrective journal entries for any differences
 * 6. Updates SaleItem.purchasePrice where COGS changed
 *
 * ⚠️ CAUTION: This is a destructive operation that modifies historical COGS.
 * Should only be available to SUPER_ADMIN and requires confirmation.
 */

import { prisma } from '@/shared/lib/db';
import { getCostingMethod, type CostingMethod } from '@/shared/lib/layer-engine';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RebuildInventoryCostParams {
  productId: string;
  fromDate: Date;
  businessId: string;
  dryRun?: boolean;                // If true, only calculate diffs without applying
  tx?: any;
}

export interface RebuildResult {
  layersRecalculated: number;
  cogsAdjustments: number;
  totalCogsDifference: number;
  journalEntriesPosted: number;
  details: RebuildDetail[];
  dryRun: boolean;
}

export interface RebuildDetail {
  transactionId: string;
  transactionType: string;
  oldCOGS: number;
  newCOGS: number;
  difference: number;
  consumptions: Array<{
    layerId: string;
    quantity: number;
    oldUnitCost: number;
    newUnitCost: number;
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Rebuild Logic ────────────────────────────────────────────────────────────

/**
 * Rebuild inventory cost for a product from a specific date forward.
 *
 * This recalculates what the COGS *should* have been for each transaction
 * based on the current layer state, and identifies differences.
 *
 * In non-dry-run mode, it updates consumption records, SaleItem prices,
 * and posts corrective journal entries.
 */
export async function rebuildInventoryCost(
  params: RebuildInventoryCostParams
): Promise<RebuildResult> {
  const { productId, fromDate, businessId, dryRun = false, tx = prisma } = params;

  const costingMethod = await getCostingMethod(businessId, tx);

  // 1. Fetch all layers for this product (sorted by receipt date)
  const layers = await tx.inventoryLayer.findMany({
    where: {
      itemId: productId,
      businessId,
    },
    orderBy: costingMethod === 'LIFO'
      ? [{ receiptDate: 'desc' }, { createdAt: 'desc' }]
      : [{ receiptDate: 'asc' }, { createdAt: 'asc' }],
  });

  if (layers.length === 0) {
    return {
      layersRecalculated: 0,
      cogsAdjustments: 0,
      totalCogsDifference: 0,
      journalEntriesPosted: 0,
      details: [],
      dryRun,
    };
  }

  // 2. Fetch all consumptions from fromDate forward, ordered by transaction date
  const consumptions = await tx.inventoryLayerConsumption.findMany({
    where: {
      businessId,
      layer: { itemId: productId },
      createdAt: { gte: fromDate },
      quantity: { gt: 0 },           // Ignore restoration records (negative qty)
    },
    orderBy: { createdAt: 'asc' },
  });

  if (consumptions.length === 0) {
    return {
      layersRecalculated: layers.length,
      cogsAdjustments: 0,
      totalCogsDifference: 0,
      journalEntriesPosted: 0,
      details: [],
      dryRun,
    };
  }

  // 3. Group consumptions by transaction
  const transactionMap = new Map<string, typeof consumptions>();
  for (const c of consumptions) {
    const key = `${c.transactionId}:${c.transactionType}`;
    const existing = transactionMap.get(key);
    if (existing) {
      existing.push(c);
    } else {
      transactionMap.set(key, [c]);
    }
  }

  // 4. Build a layer cost lookup (current unit costs)
  const layerCostMap = new Map<string, number>();
  for (const layer of layers) {
    layerCostMap.set(layer.id, layer.unitCost);
  }

  // 5. Compare old vs new COGS for each transaction
  const details: RebuildDetail[] = [];
  let totalCogsDifference = 0;
  let cogsAdjustments = 0;
  let journalEntriesPosted = 0;

  for (const [key, txConsumptions] of transactionMap) {
    const [transactionId, transactionType] = key.split(':');

    const consumptionDetails: RebuildDetail['consumptions'] = [];
    let oldCOGS = 0;
    let newCOGS = 0;

    for (const c of txConsumptions) {
      const currentLayerCost = layerCostMap.get(c.layerId) ?? c.unitCost;
      const oldAmount = c.amount;
      const newAmount = round4(c.quantity * currentLayerCost);

      oldCOGS += oldAmount;
      newCOGS += newAmount;

      if (Math.abs(c.unitCost - currentLayerCost) > 0.0001) {
        consumptionDetails.push({
          layerId: c.layerId,
          quantity: c.quantity,
          oldUnitCost: c.unitCost,
          newUnitCost: currentLayerCost,
        });
      }
    }

    oldCOGS = round4(oldCOGS);
    newCOGS = round4(newCOGS);
    const difference = round4(newCOGS - oldCOGS);

    if (Math.abs(difference) > 0.01) {
      details.push({
        transactionId,
        transactionType,
        oldCOGS,
        newCOGS,
        difference,
        consumptions: consumptionDetails,
      });

      totalCogsDifference += difference;
      cogsAdjustments++;

      // 6. Apply corrections if not dry run
      if (!dryRun) {
        // Update consumption records
        for (const cd of consumptionDetails) {
          await tx.inventoryLayerConsumption.updateMany({
            where: {
              transactionId,
              layerId: cd.layerId,
              businessId,
              quantity: cd.quantity,
            },
            data: {
              unitCost: cd.newUnitCost,
              amount: round4(cd.quantity * cd.newUnitCost),
            },
          });
        }

        // Update SaleItem.purchasePrice for sales
        if (transactionType === 'sale') {
          const totalQty = txConsumptions.reduce((sum: number, c: any) => sum + c.quantity, 0);
          if (totalQty > 0) {
            const newAvgCost = round4(newCOGS / totalQty);
            // Find sale items for this transaction
            await tx.saleItem.updateMany({
              where: {
                saleId: transactionId,
                productId,
              },
              data: {
                purchasePrice: newAvgCost,
              },
            });
          }
        }

        // Post corrective journal entry
        if (Math.abs(difference) > 0.01) {
          // Import createJournal pattern — create corrective entry
          const { generateNextNumber: genNum } = await import('@/shared/lib/accounting-utils');

          const lastEntry = await tx.journalEntry.findFirst({
            where: { businessId },
            orderBy: { createdAt: 'desc' },
            select: { entryNumber: true },
          });
          const entryNumber = genNum('JE', lastEntry?.entryNumber ?? null);

          // Find or create accounts
          const findOrCreate = async (code: string, name: string, type: string) => {
            let account = await tx.account.findFirst({
              where: { businessId, code },
              select: { id: true },
            });
            if (!account) {
              account = await tx.account.create({
                data: {
                  code,
                  name,
                  accountType: type,
                  isSystemAccount: true,
                  businessId,
                },
              });
            }
            return account.id;
          };

          const cogsAccountId = await findOrCreate('5310', 'COGS Adjustment', 'EXPENSE');
          const inventoryAccountId = await findOrCreate('1200', 'Inventory Asset', 'ASSET');

          const lines = [];
          if (difference > 0) {
            // COGS increased — Dr COGS Adjustment, Cr Inventory
            lines.push(
              { accountId: cogsAccountId, debit: difference, credit: 0, narration: `Rebuild: COGS increase for ${transactionId}` },
              { accountId: inventoryAccountId, debit: 0, credit: difference, narration: `Rebuild: Inventory adjustment for ${transactionId}` }
            );
          } else {
            // COGS decreased — Dr Inventory, Cr COGS Adjustment
            const absDiff = Math.abs(difference);
            lines.push(
              { accountId: inventoryAccountId, debit: absDiff, credit: 0, narration: `Rebuild: Inventory adjustment for ${transactionId}` },
              { accountId: cogsAccountId, debit: 0, credit: absDiff, narration: `Rebuild: COGS decrease for ${transactionId}` }
            );
          }

          await tx.journalEntry.create({
            data: {
              entryNumber,
              date: new Date(),
              narration: `Auto: COGS Rebuild for product ${productId} (txn: ${transactionId})`,
              reference: `REBUILD:${transactionId}`,
              status: 'POSTED',
              totalAmount: Math.abs(difference),
              businessId,
              lines: { create: lines },
            },
          });

          journalEntriesPosted++;
        }
      }
    }
  }

  return {
    layersRecalculated: layers.length,
    cogsAdjustments,
    totalCogsDifference: round4(totalCogsDifference),
    journalEntriesPosted,
    details,
    dryRun,
  };
}
