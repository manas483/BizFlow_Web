/** Standard GST rate options for the dropdown */
export const GST_RATE_OPTIONS = [
  { value: 0, label: "0% (Exempt)" },
  { value: 0.1, label: "0.1%" },
  { value: 0.25, label: "0.25%" },
  { value: 1, label: "1%" },
  { value: 1.5, label: "1.5%" },
  { value: 3, label: "3%" },
  { value: 5, label: "5%" },
  { value: 12, label: "12%" },
  { value: 18, label: "18%" },
  { value: 28, label: "28%" },
];

/** Common unit options for the unit dropdown */
export const UNIT_OPTIONS = [
  { value: "pcs", label: "Pcs" },
  { value: "kg", label: "Kg" },
  { value: "g", label: "g" },
  { value: "bag", label: "Bag" },
  { value: "packet", label: "Pkt" },
  { value: "box", label: "Box" },
  { value: "dozen", label: "Doz" },
  { value: "ltr", label: "Ltr" },
  { value: "ml", label: "ml" },
  { value: "mtr", label: "Mtr" },
  { value: "ft", label: "Ft" },
  { value: "sqft", label: "Sqft" },
  { value: "pair", label: "Pair" },
  { value: "set", label: "Set" },
  { value: "roll", label: "Roll" },
  { value: "bundle", label: "Bundle" },
  { value: "nos", label: "Nos" },
];

/** Price override reason codes for audit trail */
export const PRICE_OVERRIDE_REASONS = [
  { value: "customer_negotiation", label: "Customer Negotiation" },
  { value: "clearance_sale", label: "Clearance Sale" },
  { value: "damaged_item", label: "Damaged Item" },
  { value: "price_match", label: "Price Match" },
  { value: "manual_correction", label: "Manual Correction" },
  { value: "bulk_discount", label: "Bulk Discount" },
  { value: "loyalty_pricing", label: "Loyalty Pricing" },
  { value: "other", label: "Other" },
];
