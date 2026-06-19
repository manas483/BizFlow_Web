/**
 * Invoice Engine — centralized invoice total calculation.
 *
 * Extracts the duplicated inline calculation from sales/route.ts,
 * v1/sales/route.ts, and quotations/route.ts into a single, testable
 * pure function module.
 *
 * Ordering: discount first → clamp to zero → GST on discounted amount.
 * Composes `calculateGST()` from gst-engine for CGST/SGST/IGST split.
 */

import { calculateGST, type GSTResult } from './gst-engine';

// ── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceLineInput {
  qty: number;
  price: number;        // unit selling price
  discount: number;     // flat rupee discount on this line (matches SaleItem.discount)
  gstRate: number;      // GST percentage (0, 5, 12, 18, 28)
}

export interface InvoiceLineResult {
  lineSubtotal: number;   // qty × price
  discountAmount: number; // echo of input discount
  taxableAmount: number;  // Math.max(0, lineSubtotal - discount)
  gstResult: GSTResult;   // from gst-engine
  lineTotal: number;      // taxableAmount + gstResult.totalTax (or taxableAmount if gst-inclusive)
}

export interface InvoiceTotalResult {
  lines: InvoiceLineResult[];
  subtotal: number;
  totalDiscount: number;
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  grandTotal: number;
  isInterState: boolean;
}

// ── Core ─────────────────────────────────────────────────────────────────────

/**
 * Calculate the full invoice total with GST breakdown.
 *
 * @param lines             Array of line items (qty, price, discount, gstRate)
 * @param businessStateCode State code of the business (e.g. "29" for Karnataka)
 * @param placeOfSupplyCode State code of the place of supply
 * @param gstInclusive      If true, line prices already include GST
 */
export function calculateInvoiceTotal(
  lines: InvoiceLineInput[],
  businessStateCode: string | null,
  placeOfSupplyCode: string | null,
  gstInclusive: boolean = false,
): InvoiceTotalResult {
  const lineResults: InvoiceLineResult[] = lines.map((line) => {
    const lineSubtotal = round(line.qty * line.price);
    const discountAmount = round(line.discount);

    // Clamp: never let taxable go negative if discount > subtotal
    const taxableAmount = round(Math.max(0, lineSubtotal - discountAmount));

    // Delegate GST calculation to the GST engine
    const gstResult = calculateGST({
      amount: taxableAmount,
      gstRate: line.gstRate,
      businessStateCode,
      placeOfSupplyCode,
      gstInclusive,
    });

    // When GST-inclusive, the gstResult.grandTotal is the taxable amount
    // (back-calculated) + tax = original amount. lineTotal = grandTotal from GST engine.
    // When GST-exclusive, lineTotal = taxableAmount + totalTax.
    const lineTotal = gstResult.grandTotal;

    return {
      lineSubtotal,
      discountAmount,
      taxableAmount,
      gstResult,
      lineTotal,
    };
  });

  const isInterState = lineResults.length > 0 ? lineResults[0].gstResult.isInterState : false;

  return {
    lines: lineResults,
    subtotal: round(lineResults.reduce((s, l) => s + l.lineSubtotal, 0)),
    totalDiscount: round(lineResults.reduce((s, l) => s + l.discountAmount, 0)),
    totalTaxable: round(lineResults.reduce((s, l) => s + l.gstResult.taxableValue, 0)),
    totalCgst: round(lineResults.reduce((s, l) => s + l.gstResult.cgst, 0)),
    totalSgst: round(lineResults.reduce((s, l) => s + l.gstResult.sgst, 0)),
    totalIgst: round(lineResults.reduce((s, l) => s + l.gstResult.igst, 0)),
    totalTax: round(lineResults.reduce((s, l) => s + l.gstResult.totalTax, 0)),
    grandTotal: round(lineResults.reduce((s, l) => s + l.lineTotal, 0)),
    isInterState,
  };
}

// ── Helper ───────────────────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
