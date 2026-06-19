/**
 * GST Calculation Engine — pure functions for Indian GST computation.
 *
 * Determines Intra-State (CGST+SGST) vs Inter-State (IGST) based on
 * business state code and place of supply. All parameters are dynamic.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface GSTResult {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
  isInterState: boolean;
  gstRate: number;
}

export interface InvoiceGSTBreakdown {
  items: GSTResult[];
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  grandTotal: number;
  isInterState: boolean;
}

export interface GSTItemInput {
  amount: number;       // qty × price - discount (before GST)
  gstRate: number;      // GST percentage (e.g. 5, 12, 18, 28)
}

// ── State Code Utilities ─────────────────────────────────────────────────────

/**
 * Extract state code from GSTIN (first 2 digits).
 * Returns null if GSTIN is invalid.
 */
export function extractStateCodeFromGST(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.substring(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

/**
 * Indian state codes (as per GST registration).
 */
export const INDIAN_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh',
};

// ── Core Calculation ─────────────────────────────────────────────────────────

/**
 * Calculate GST for a single item/amount.
 *
 * @param amount         Taxable value (qty × price − discount)
 * @param gstRate        GST percentage (e.g. 18 for 18%)
 * @param businessState  State code of the business (e.g. "27" for Maharashtra)
 * @param placeOfSupply  State code of the place of supply
 * @param gstInclusive   If true, amount includes GST — back-calculate taxable value
 */
export function calculateGST(params: {
  amount: number;
  gstRate: number;
  businessStateCode: string | null;
  placeOfSupplyCode: string | null;
  gstInclusive?: boolean;
}): GSTResult {
  const { amount, gstRate, businessStateCode, placeOfSupplyCode, gstInclusive = false } = params;

  // Determine if inter-state
  const isInterState = !!(businessStateCode && placeOfSupplyCode && businessStateCode !== placeOfSupplyCode);

  // Calculate taxable value
  let taxableValue: number;
  if (gstInclusive && gstRate > 0) {
    // Back-calculate: amount = taxable + tax → taxable = amount / (1 + rate/100)
    taxableValue = round(amount / (1 + gstRate / 100));
  } else {
    taxableValue = round(amount);
  }

  if (gstRate <= 0) {
    return {
      taxableValue,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalTax: 0,
      grandTotal: taxableValue,
      isInterState,
      gstRate: 0,
    };
  }

  let cgst = 0, sgst = 0, igst = 0;

  if (isInterState) {
    // Inter-State: full GST as IGST
    igst = round(taxableValue * gstRate / 100);
  } else {
    // Intra-State: split equally into CGST + SGST
    const halfRate = gstRate / 2;
    cgst = round(taxableValue * halfRate / 100);
    sgst = round(taxableValue * halfRate / 100);
  }

  const totalTax = round(cgst + sgst + igst);
  const grandTotal = round(taxableValue + totalTax);

  return { taxableValue, cgst, sgst, igst, totalTax, grandTotal, isInterState, gstRate };
}

/**
 * Calculate GST breakdown for an entire invoice (multiple items).
 */
export function calculateInvoiceGST(params: {
  items: GSTItemInput[];
  businessStateCode: string | null;
  placeOfSupplyCode: string | null;
  gstInclusive?: boolean;
}): InvoiceGSTBreakdown {
  const { items, businessStateCode, placeOfSupplyCode, gstInclusive = false } = params;

  const results = items.map(item =>
    calculateGST({
      amount: item.amount,
      gstRate: item.gstRate,
      businessStateCode,
      placeOfSupplyCode,
      gstInclusive,
    })
  );

  const isInterState = results.length > 0 ? results[0].isInterState : false;

  return {
    items: results,
    totalTaxableValue: round(results.reduce((s, r) => s + r.taxableValue, 0)),
    totalCgst: round(results.reduce((s, r) => s + r.cgst, 0)),
    totalSgst: round(results.reduce((s, r) => s + r.sgst, 0)),
    totalIgst: round(results.reduce((s, r) => s + r.igst, 0)),
    totalTax: round(results.reduce((s, r) => s + r.totalTax, 0)),
    grandTotal: round(results.reduce((s, r) => s + r.grandTotal, 0)),
    isInterState,
  };
}

// ── Helper ───────────────────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
