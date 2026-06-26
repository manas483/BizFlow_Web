// ─────────────────────────────────────────────────────────────────────────────
// BizFlow — Inventory Import Intelligence Engine
// Generates store-type-specific Excel templates and validates uploaded files
// ─────────────────────────────────────────────────────────────────────────────

import { getBusinessProfile } from "./business-intelligence";

// ─── Column Definitions ──────────────────────────────────────────────────────

export interface ColumnDef {
  key: string;         // maps to product schema field
  header: string;      // Excel column header
  required: boolean;
  type: "string" | "number" | "integer";
  example: string | number;
  notes: string;
  aliases?: string[];  // alternative column names for auto-mapping
}

export interface ImportTemplate {
  columns: ColumnDef[];
  exampleRows: Record<string, string | number>[];
  notes: string[];
  storeType: string;
}

// ─── Store-Type Specific Extra Columns ───────────────────────────────────────

const PHARMACY_EXTRAS: ColumnDef[] = [
  {
    key: "expiryDate",
    header: "Expiry Date",
    required: false,
    type: "string",
    example: "2027-03-31",
    notes: "Format: YYYY-MM-DD. Critical for near-expiry alerts.",
    aliases: ["expiry", "exp date", "exp", "expiration date", "expiry_date"],
  },
  {
    key: "batchNumber",
    header: "Batch Number",
    required: false,
    type: "string",
    example: "BN-202401",
    notes: "Manufacturer batch ID for traceability.",
    aliases: ["batch", "batch no", "batch_no", "lot number", "lot_no"],
  },
  {
    key: "scheduleType",
    header: "Schedule Type",
    required: false,
    type: "string",
    example: "OTC",
    notes: "Values: OTC, Schedule H, Schedule X, Schedule G",
    aliases: ["schedule", "drug schedule", "drug_schedule"],
  },
];

const ELECTRONICS_EXTRAS: ColumnDef[] = [
  {
    key: "imeiNumber",
    header: "IMEI / Serial Number",
    required: false,
    type: "string",
    example: "358671234567890",
    notes: "Required for GST compliance on mobile phones.",
    aliases: ["imei", "serial", "serial no", "serial number", "imei number"],
  },
  {
    key: "warrantyMonths",
    header: "Warranty (Months)",
    required: false,
    type: "integer",
    example: 12,
    notes: "Manufacturer warranty period in months.",
    aliases: ["warranty", "warranty months", "warranty_months"],
  },
  {
    key: "brand",
    header: "Brand",
    required: false,
    type: "string",
    example: "Samsung",
    notes: "Brand/manufacturer name.",
    aliases: ["brand name", "manufacturer", "make"],
  },
];

const FERTILIZER_EXTRAS: ColumnDef[] = [
  {
    key: "expiryDate",
    header: "Expiry / Best Before",
    required: false,
    type: "string",
    example: "2026-12-31",
    notes: "Format: YYYY-MM-DD. Important for pesticide batch tracking.",
    aliases: ["expiry", "best before", "expiry date", "expiry_date"],
  },
  {
    key: "licenseNo",
    header: "License Number",
    required: false,
    type: "string",
    example: "FERT-LIC-2024",
    notes: "Regulatory license number if applicable.",
    aliases: ["license", "licence", "license no", "lic no"],
  },
];

const CONSTRUCTION_EXTRAS: ColumnDef[] = [
  {
    key: "weight",
    header: "Weight per Unit (kg)",
    required: false,
    type: "number",
    example: 50,
    notes: "Weight for E-Way bill generation.",
    aliases: ["weight", "weight kg", "wt", "unit weight"],
  },
  {
    key: "brand",
    header: "Brand / Manufacturer",
    required: false,
    type: "string",
    example: "UltraTech",
    notes: "Brand/manufacturer of the material.",
    aliases: ["brand", "manufacturer", "make", "brand name"],
  },
];

const CLOTHING_EXTRAS: ColumnDef[] = [
  {
    key: "sizes",
    header: "Available Sizes",
    required: false,
    type: "string",
    example: "S, M, L, XL",
    notes: "Comma-separated list of available sizes.",
    aliases: ["sizes", "size", "available sizes", "variants"],
  },
  {
    key: "colors",
    header: "Available Colors",
    required: false,
    type: "string",
    example: "Red, Blue, Black",
    notes: "Comma-separated list of available colors.",
    aliases: ["colors", "colour", "color", "colours"],
  },
];

// ─── Base Columns (All Store Types) ──────────────────────────────────────────

const BASE_COLUMNS: ColumnDef[] = [
  {
    key: "name",
    header: "Product Name",
    required: true,
    type: "string",
    example: "Product Name Here",
    notes: "Full product name. Max 100 characters.",
    aliases: ["name", "product", "product name", "item", "item name", "description"],
  },
  {
    key: "sku",
    header: "SKU",
    required: false,
    type: "string",
    example: "SKU-001",
    notes: "Unique product code. Auto-generated if empty.",
    aliases: ["sku", "product code", "item code", "barcode", "product_code", "code"],
  },
  {
    key: "category",
    header: "Category",
    required: true,
    type: "string",
    example: "Category Name",
    notes: "Must match one of the store categories.",
    aliases: ["category", "product category", "cat", "type", "group", "dept"],
  },
  {
    key: "stock",
    header: "Current Stock",
    required: true,
    type: "integer",
    example: 100,
    notes: "Current quantity in stock. Must be 0 or positive integer.",
    aliases: ["stock", "quantity", "qty", "current stock", "opening stock", "inventory"],
  },
  {
    key: "minStock",
    header: "Minimum Stock",
    required: false,
    type: "integer",
    example: 10,
    notes: "Reorder alert threshold. Default is 5.",
    aliases: ["min stock", "minimum stock", "reorder level", "min_stock", "reorder point", "safety stock"],
  },
  {
    key: "standardCost",
    header: "Standard Cost (₹)",
    required: false,
    type: "number",
    example: 100,
    notes: "Standard cost per unit. Used for fallback valuation.",
    aliases: ["purchase price", "cost price", "buying price", "cost", "purchase_price", "cp", "standard cost"],
  },
  {
    key: "sellingPrice",
    header: "Selling Price (₹)",
    required: true,
    type: "number",
    example: 150,
    notes: "MRP or selling price per unit.",
    aliases: ["selling price", "sale price", "mrp", "price", "selling_price", "sp", "retail price"],
  },
  {
    key: "unit",
    header: "Unit",
    required: false,
    type: "string",
    example: "pcs",
    notes: "Measurement unit: pcs, kg, ltr, box, bag, strip, etc.",
    aliases: ["unit", "unit of measure", "uom", "measure", "unit_of_measure"],
  },
  {
    key: "supplier",
    header: "Supplier Name",
    required: false,
    type: "string",
    example: "Supplier Co. Ltd.",
    notes: "Primary supplier/vendor name.",
    aliases: ["supplier", "vendor", "supplier name", "vendor name", "distributor"],
  },
  {
    key: "hsnCode",
    header: "HSN Code",
    required: false,
    type: "string",
    example: "1006",
    notes: "HSN code for GST compliance.",
    aliases: ["hsn", "hsn code", "hsn_code", "tariff code", "sac code"],
  },
  {
    key: "gstRate",
    header: "GST Rate (%)",
    required: false,
    type: "number",
    example: 18,
    notes: "GST rate: 0, 5, 12, 18, or 28",
    aliases: ["gst", "gst rate", "tax rate", "gst%", "gst_rate", "tax %"],
  },
];

// ─── Template Generation ──────────────────────────────────────────────────────

export function getImportTemplate(businessType: string): ImportTemplate {
  const profile = getBusinessProfile(businessType);
  const type = businessType.toLowerCase();

  // Get store-specific extras
  let extraColumns: ColumnDef[] = [];
  let extraNotes: string[] = [];

  if (type.includes("pharmacy") || type === "pharmacy") {
    extraColumns = PHARMACY_EXTRAS;
    extraNotes = [
      "⚠️ Batch and expiry tracking is mandatory for scheduled drugs.",
      "⚠️ Schedule H/X drugs require a separate register maintained offline.",
    ];
  } else if (type.includes("electronics")) {
    extraColumns = ELECTRONICS_EXTRAS;
    extraNotes = [
      "⚠️ IMEI is mandatory for mobile phones under GST regulations.",
      "💡 Warranty months enable automatic expiry alerts.",
    ];
  } else if (type.includes("fertilizer") || type.includes("agri")) {
    extraColumns = FERTILIZER_EXTRAS;
    extraNotes = [
      "⚠️ License numbers are required for pesticide sales.",
      "💡 Pesticide expiry dates are critical for compliance.",
    ];
  } else if (type.includes("construction")) {
    extraColumns = CONSTRUCTION_EXTRAS;
    extraNotes = [
      "💡 Weight data required for E-Way bill generation (orders >₹50,000).",
    ];
  } else if (
    type.includes("boutique") ||
    type.includes("cloth") ||
    type.includes("fashion") ||
    type.includes("garment")
  ) {
    extraColumns = CLOTHING_EXTRAS;
    extraNotes = [
      "💡 Use comma-separated values for sizes and colors.",
    ];
  }

  const columns = [...BASE_COLUMNS, ...extraColumns];

  // Customize example row with seed products from profile
  const seed = profile.seedProducts[0];
  const firstExample: Record<string, string | number> = {
    "Product Name": seed?.name ?? "Sample Product",
    SKU: seed?.sku ?? "SKU-001",
    Category: seed?.category ?? (profile.productCategories[0] ?? "General"),
    "Current Stock": seed?.stock ?? 100,
    "Minimum Stock": seed?.minStock ?? 10,
    "Purchase Price (₹)": seed?.standardCost ?? 100,
    "Selling Price (₹)": seed?.sellingPrice ?? 150,
    Unit: seed?.unit ?? profile.primaryUnit,
    "Supplier Name": "Main Supplier Co.",
    "HSN Code": seed?.hsnCode ?? "",
    "GST Rate (%)": seed?.gstRate ?? profile.gstDefaultRate,
    ...extraColumns.reduce((acc, col) => ({ ...acc, [col.header]: col.example }), {}),
  };

  const secondSeed = profile.seedProducts[1];
  const secondExample: Record<string, string | number> = {
    "Product Name": secondSeed?.name ?? "Another Product",
    SKU: secondSeed?.sku ?? "SKU-002",
    Category: secondSeed?.category ?? (profile.productCategories[1] ?? profile.productCategories[0] ?? "General"),
    "Current Stock": secondSeed?.stock ?? 50,
    "Minimum Stock": secondSeed?.minStock ?? 5,
    "Purchase Price (₹)": secondSeed?.standardCost ?? 200,
    "Selling Price (₹)": secondSeed?.sellingPrice ?? 280,
    Unit: secondSeed?.unit ?? profile.primaryUnit,
    "Supplier Name": "Secondary Vendor Ltd.",
    "HSN Code": secondSeed?.hsnCode ?? "",
    "GST Rate (%)": secondSeed?.gstRate ?? profile.gstDefaultRate,
    ...extraColumns.reduce((acc, col) => ({ ...acc, [col.header]: "" }), {}),
  };

  const notes = [
    `📋 Template for: ${profile.displayName} ${profile.emoji}`,
    `✅ Required columns: ${columns.filter((c) => c.required).map((c) => c.header).join(", ")}`,
    `📏 Valid categories for this store: ${profile.productCategories.join(", ")}, Other`,
    `💰 Default GST rate: ${profile.gstDefaultRate}% | Primary unit: ${profile.primaryUnit}`,
    `🔢 Stock values must be 0 or positive integers. Prices can be decimals.`,
    `🔁 Existing SKUs will be updated. New/empty SKUs will create new products.`,
    ...extraNotes,
    `❌ Do NOT modify column headers. Add data from row 3 onwards.`,
  ];

  return {
    columns,
    exampleRows: [firstExample, secondExample],
    notes,
    storeType: businessType,
  };
}

// ─── Smart Column Mapper ──────────────────────────────────────────────────────

export function mapColumns(
  uploadedHeaders: string[],
  templateColumns: ColumnDef[]
): Record<string, string | null> {
  // Returns: { templateKey → uploadedHeader | null }
  const mapping: Record<string, string | null> = {};

  for (const col of templateColumns) {
    const templateKey = col.header.toLowerCase().trim();
    const allNames = [
      col.header.toLowerCase(),
      col.key.toLowerCase(),
      ...(col.aliases ?? []),
    ];

    let matched: string | null = null;

    for (const uploaded of uploadedHeaders) {
      const normalized = uploaded.toLowerCase().trim().replace(/[_\-]/g, " ");
      if (allNames.some((name) => name.replace(/[_\-]/g, " ") === normalized)) {
        matched = uploaded;
        break;
      }
    }

    // Fuzzy fallback: partial match
    if (!matched) {
      for (const uploaded of uploadedHeaders) {
        const normalized = uploaded.toLowerCase().trim();
        if (allNames.some((name) => name.includes(normalized) || normalized.includes(name.split(" ")[0]))) {
          matched = uploaded;
          break;
        }
      }
    }

    mapping[templateKey] = matched;
  }

  return mapping;
}

// ─── Validation Engine ────────────────────────────────────────────────────────

export interface ValidationError {
  row: number;
  column: string;
  value: string | number | null;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  processedRows: ProcessedRow[];
  summary: {
    total: number;
    valid: number;
    errors: number;
    warnings: number;
    duplicates: number;
  };
}

export interface ProcessedRow {
  rowIndex: number;
  data: Record<string, unknown>;
  action: "create" | "update" | "skip";
  errors: ValidationError[];
  warnings: ValidationError[];
}

export function validateImportData(
  rows: Record<string, unknown>[],
  template: ImportTemplate,
  existingSkus: string[],
  allowedCategories: string[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const processedRows: ProcessedRow[] = [];
  const seenSkus = new Set<string>();
  const duplicates: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 3; // 1-indexed + 2 header rows
    const rowErrors: ValidationError[] = [];
    const rowWarnings: ValidationError[] = [];

    // 1. Required fields
    for (const col of template.columns.filter((c) => c.required)) {
      const val = row[col.header] ?? row[col.key];
      if (val === null || val === undefined || String(val).trim() === "") {
        const err: ValidationError = {
          row: rowNum,
          column: col.header,
          value: null,
          message: `"${col.header}" is required but empty.`,
          severity: "error",
        };
        rowErrors.push(err);
        errors.push(err);
      }
    }

    // 2. Type validation
    for (const col of template.columns) {
      const val = row[col.header] ?? row[col.key];
      if (val === null || val === undefined || String(val).trim() === "") continue;

      if (col.type === "number" || col.type === "integer") {
        const num = Number(val);
        if (isNaN(num)) {
          const err: ValidationError = {
            row: rowNum,
            column: col.header,
            value: String(val),
            message: `"${col.header}" must be a number. Got: "${val}"`,
            severity: "error",
          };
          rowErrors.push(err);
          errors.push(err);
        } else if (col.type === "integer" && !Number.isInteger(num)) {
          const warn: ValidationError = {
            row: rowNum,
            column: col.header,
            value: String(val),
            message: `"${col.header}" should be a whole number. "${val}" will be rounded to ${Math.round(num)}.`,
            severity: "warning",
          };
          rowWarnings.push(warn);
          warnings.push(warn);
        }
      }
    }

    // 3. Negative values
    const stock = Number(row["Current Stock"] ?? row["stock"] ?? 0);
    if (!isNaN(stock) && stock < 0) {
      const err: ValidationError = {
        row: rowNum,
        column: "Current Stock",
        value: stock,
        message: `Stock cannot be negative. Got: ${stock}`,
        severity: "error",
      };
      rowErrors.push(err);
      errors.push(err);
    }

    const sellPrice = Number(row["Selling Price (₹)"] ?? row["sellingPrice"] ?? 0);
    if (!isNaN(sellPrice) && sellPrice < 0) {
      const err: ValidationError = {
        row: rowNum,
        column: "Selling Price (₹)",
        value: sellPrice,
        message: `Selling price cannot be negative. Got: ${sellPrice}`,
        severity: "error",
      };
      rowErrors.push(err);
      errors.push(err);
    }

    const purchPrice = Number(row["Purchase Price (₹)"] ?? row["purchasePrice"] ?? 0);
    if (!isNaN(purchPrice) && !isNaN(sellPrice) && purchPrice > sellPrice && sellPrice > 0) {
      const warn: ValidationError = {
        row: rowNum,
        column: "Purchase Price (₹)",
        value: purchPrice,
        message: `Purchase price (₹${purchPrice}) is greater than selling price (₹${sellPrice}). Negative margin.`,
        severity: "warning",
      };
      rowWarnings.push(warn);
      warnings.push(warn);
    }

    // 4. Category validation
    const category = String(row["Category"] ?? row["category"] ?? "").trim();
    if (category && allowedCategories.length > 0) {
      const validCats = [...allowedCategories.map((c) => c.toLowerCase()), "other"];
      if (!validCats.includes(category.toLowerCase())) {
        const warn: ValidationError = {
          row: rowNum,
          column: "Category",
          value: category,
          message: `Category "${category}" not in store categories. It will be created as a new category.`,
          severity: "warning",
        };
        rowWarnings.push(warn);
        warnings.push(warn);
      }
    }

    // 5. Duplicate SKU detection within the file
    const sku = String(row["SKU"] ?? row["sku"] ?? "").trim();
    if (sku) {
      if (seenSkus.has(sku.toLowerCase())) {
        duplicates.push(sku);
        const err: ValidationError = {
          row: rowNum,
          column: "SKU",
          value: sku,
          message: `Duplicate SKU "${sku}" found in this file. Each SKU must be unique.`,
          severity: "error",
        };
        rowErrors.push(err);
        errors.push(err);
      }
      seenSkus.add(sku.toLowerCase());
    }

    // 6. GST rate validation
    const gstRaw = row["GST Rate (%)"] ?? row["gstRate"];
    if (gstRaw !== null && gstRaw !== undefined && String(gstRaw).trim() !== "") {
      const gst = Number(gstRaw);
      const validRates = [0, 5, 12, 18, 28];
      if (!isNaN(gst) && !validRates.includes(gst)) {
        const warn: ValidationError = {
          row: rowNum,
          column: "GST Rate (%)",
          value: gst,
          message: `GST rate ${gst}% is non-standard. Valid rates: 0, 5, 12, 18, 28%.`,
          severity: "warning",
        };
        rowWarnings.push(warn);
        warnings.push(warn);
      }
    }

    // Determine action
    const action: "create" | "update" | "skip" =
      sku && existingSkus.map((s) => s.toLowerCase()).includes(sku.toLowerCase())
        ? "update"
        : "create";

    // Build normalised data object
    const data: Record<string, unknown> = {
      name: String(row["Product Name"] ?? row["name"] ?? "").trim(),
      sku: sku || undefined,
      category: category || "Other",
      stock: Math.max(0, Math.round(Number(row["Current Stock"] ?? row["stock"] ?? 0))),
      minStock: Math.max(0, Math.round(Number(row["Minimum Stock"] ?? row["minStock"] ?? 5))),
      purchasePrice: Math.max(0, Number(row["Purchase Price (₹)"] ?? row["purchasePrice"] ?? 0)),
      sellingPrice: Math.max(0, Number(row["Selling Price (₹)"] ?? row["sellingPrice"] ?? 0)),
      unit: String(row["Unit"] ?? row["unit"] ?? "pcs").trim() || "pcs",
      supplier: String(row["Supplier Name"] ?? row["supplier"] ?? "").trim() || null,
      hsnCode: String(row["HSN Code"] ?? row["hsnCode"] ?? "").trim() || null,
      gstRate: Number(row["GST Rate (%)"] ?? row["gstRate"] ?? 0) || 0,
    };

    processedRows.push({
      rowIndex: rowNum,
      data,
      action,
      errors: rowErrors,
      warnings: rowWarnings,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    processedRows,
    summary: {
      total: rows.length,
      valid: processedRows.filter((r) => r.errors.length === 0).length,
      errors: errors.length,
      warnings: warnings.length,
      duplicates: duplicates.length,
    },
  };
}
