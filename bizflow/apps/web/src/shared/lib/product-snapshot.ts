export function buildProductSnapshot(product: {
  name: string;
  sku: string;
  unit: string;
  hsnCode?: string | null;
  gstRate: number;
  category: string;
  baseUnit?: string | null;
}) {
  return {
    productName: product.name,
    productSku: product.sku,
    productUnit: product.unit,
    productHsnCode: product.hsnCode ?? null,
    productGstRate: product.gstRate,
    productCategory: product.category,
  };
}
