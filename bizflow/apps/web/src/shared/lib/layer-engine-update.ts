
/**
 * Update Product WAC by recalculating from active layers.
 */
export async function recalculateProductWAC(
  itemId: string,
  businessId: string,
  tx: any = prisma
): Promise<void> {
  const newWAC = await getWeightedAverageCost(itemId, businessId, undefined, tx);
  await tx.product.update({
    where: { id: itemId },
    data: { purchasePrice: newWAC }
  });
}

