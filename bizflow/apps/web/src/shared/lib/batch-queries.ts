export async function loadProductsForDocument(
  tx: any,
  businessId: string,
  productIds: string[]
) {
  // Deduplicate requested IDs
  const uniqueIds = [...new Set(productIds)];
  
  if (uniqueIds.length === 0) {
    return { productMap: new Map(), missingIds: [] };
  }

  // Batch query
  const products = await tx.product.findMany({
    where: {
      id: { in: uniqueIds },
      businessId
    }
  });

  // Create O(1) lookup map
  const productMap = new Map();
  products.forEach((p: any) => productMap.set(p.id, p));

  // Find missing IDs (difference between requested and returned)
  const returnedIds = new Set(products.map((p: any) => p.id));
  const missingIds = uniqueIds.filter(id => !returnedIds.has(id));

  return { productMap, missingIds };
}
