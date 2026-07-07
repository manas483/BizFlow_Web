import type { Product } from "@/shared/ui/ProductPicker/types";

/** State for a single line item in the invoice form */
export interface LineItem {
  productId: string;
  qty: number | string;
  price: number;
  originalPrice: number;
  priceOverrideReason: string;
  discount: number;               // final flat discount amount applied
  discountType: "flat" | "percent";
  discountInput: number | string;  // raw value the user typed
  hsnCode: string;
  gstRate: number;
  originalGstRate: number;
  unit: string;
  // ── Loose Sale Fields ──
  saleQty?: number | string;      // Canonical sold quantity
  saleUnit?: string;              // Unit of saleQty
  isLoose?: boolean;
  packagingId?: string | null;
  packagingLabel?: string | null;
  allowLooseSale?: boolean;       // Cached from product for UI conditionals
}

/** Computed totals for display in InvoiceSummary */
export interface InvoiceTotals {
  itemCount: number;
  totalQty: number;
  subtotal: number;           // sum of (qty × price) before any discounts
  lineDiscountTotal: number;  // sum of all per-line discounts
  invoiceDiscountAmount: number;
  taxableValue: number;       // subtotal − lineDiscounts − invoiceDiscount
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalGst: number;
  roundOff: number;
  grandTotal: number;
  paid: number;
  balanceDue: number;
}

/** Creates a blank line item for new rows */
export function createEmptyLineItem(): LineItem {
  return {
    productId: "",
    qty: 1,
    price: 0,
    originalPrice: 0,
    priceOverrideReason: "",
    discount: 0,
    discountType: "flat",
    discountInput: "",
    hsnCode: "",
    gstRate: 0,
    originalGstRate: 0,
    unit: "pcs",
    // Loose sale fields default to standard mode
    saleQty: 1,
    saleUnit: "pcs",
    isLoose: false,
    packagingId: null,
    packagingLabel: null,
    allowLooseSale: false,
  };
}

/** Populate a line item from a product picker selection */
export function createLineItemFromProduct(
  product: Product,
  qty: number,
  resolvedPrice: number,
): LineItem {
  // For loose products with a default packaging, auto-fill from that packaging
  const defaultPkg = product.packagingOptions?.find(p => p.isDefault);
  const effectivePrice = defaultPkg?.defaultPrice != null
    ? Number(defaultPkg.defaultPrice)
    : resolvedPrice;

  return {
    productId: product.id,
    qty,
    price: effectivePrice,
    originalPrice: resolvedPrice,
    priceOverrideReason: "",
    discount: 0,
    discountType: "flat",
    discountInput: "",
    hsnCode: product.hsnCode || "",
    gstRate: product.gstRate || 0,
    originalGstRate: product.gstRate || 0,
    unit: product.unit || "pcs",
    // Loose sale fields
    saleQty: qty,
    saleUnit: defaultPkg?.label || product.unit || "pcs",
    isLoose: defaultPkg?.isLoose ?? false,
    packagingId: defaultPkg?.id ?? null,
    packagingLabel: defaultPkg?.label ?? null,
    allowLooseSale: product.allowLooseSale ?? false,
  };
}

/** Convert a line item back to the API payload shape */
export function lineItemToPayload(item: LineItem) {
  return {
    productId: item.productId,
    qty: Number(item.qty) || 0,
    price: item.price,
    discount: item.discount,
    hsnCode: item.hsnCode,
    gstRate: item.gstRate,
    originalPrice: item.originalPrice,
    priceOverrideReason: item.priceOverrideReason,
    // Loose sale fields
    saleQty: item.saleQty != null ? Number(item.saleQty) : Number(item.qty) || 0,
    saleUnit: item.saleUnit || item.unit,
    isLoose: item.isLoose ?? false,
    packagingId: item.packagingId ?? null,
    packagingLabel: item.packagingLabel ?? null,
  };
}

/** Compute the flat discount amount from the user's input */
export function computeFlatDiscount(
  discountType: "flat" | "percent",
  discountInput: number | string,
  lineAmount: number,
): number {
  const raw = Number(discountInput) || 0;
  if (discountType === "percent") {
    return Math.min(Math.round(lineAmount * raw / 100 * 100) / 100, lineAmount);
  }
  return Math.min(raw, lineAmount);
}
