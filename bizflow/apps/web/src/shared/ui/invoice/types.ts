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
  };
}

/** Populate a line item from a product picker selection */
export function createLineItemFromProduct(
  product: Product,
  qty: number,
  resolvedPrice: number,
): LineItem {
  return {
    productId: product.id,
    qty,
    price: resolvedPrice,
    originalPrice: resolvedPrice,
    priceOverrideReason: "",
    discount: 0,
    discountType: "flat",
    discountInput: "",
    hsnCode: product.hsnCode || "",
    gstRate: product.gstRate || 0,
    originalGstRate: product.gstRate || 0,
    unit: product.unit || "pcs",
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
