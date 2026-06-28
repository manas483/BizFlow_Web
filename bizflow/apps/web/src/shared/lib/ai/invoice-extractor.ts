import { parseInvoicePdfLocally } from "../pdf-parser";

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export interface ExtractedProduct {
  name: string;
  sku: string;
  category: string;
  stock: number; // Represents quantity
  unitsPerBag: number;
  basePurchasePrice: number; // Pre-tax per unit
  purchasePrice: number; // Post-tax per unit
  sellingPrice: number; // MRP
  transportCost: number;
  unit: string;
  gstRate: number;
  hsnCode: string;
  lineTotal: number; // Important for validation
}

export interface ExtractedInvoice {
  invoiceNumber: string;
  supplier: string;
  supplierGstin: string;
  supplierConfidence?: number;
  purchaseDate: string;
  eWayBillNo: string;
  format: string;
  templateName: string;
  grandTotal: number;
  validationPassed: boolean;
  validationDetails: string;
  products: ExtractedProduct[];
}

export interface GeminiExtractionResult {
  invoiceNumber: string | null;
  supplier: string | null;
  supplierGstin: string | null;
  supplierConfidence: number | null;
  purchaseDate: string | null;
  eWayBillNo: string | null;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  grandTotal: number;
  products: ExtractedProduct[];
}

/**
 * Validates the extracted math exactly as the local parser does.
 */
function validateGeminiExtraction(
  data: GeminiExtractionResult
): { passed: boolean; details: string } {
  const lineTotal = data.products.reduce((sum, p) => sum + (p.lineTotal || 0), 0);
  const totalTax = (data.cgst || 0) + (data.sgst || 0) + (data.igst || 0);
  const hasGst = totalTax > 0 || data.products.some(p => (p.gstRate || 0) > 0);

  if (!hasGst) {
    const diff = Math.abs(lineTotal - (data.grandTotal || 0));
    if (diff > 1.0) {
      return {
        passed: false,
        details: `Sum of line items (${lineTotal.toFixed(2)}) ≠ grand total (${(data.grandTotal || 0).toFixed(2)}). Diff: ${diff.toFixed(2)}`,
      };
    }
    return { passed: true, details: 'Line item sum matches grand total' };
  }

  const expectedGrandTotal = lineTotal + totalTax + (data.roundOff || 0);
  const diff = Math.abs(expectedGrandTotal - (data.grandTotal || 0));

  if (diff > 1.0) {
    return {
      passed: false,
      details: `Calculated (${expectedGrandTotal.toFixed(2)}) ≠ grand total (${(data.grandTotal || 0).toFixed(2)}). Diff: ${diff.toFixed(2)}`,
    };
  }

  return {
    passed: true,
    details: `Subtotal ${lineTotal.toFixed(2)} + Taxes ${totalTax.toFixed(2)} + Rounding ${(data.roundOff || 0).toFixed(2)} = ${expectedGrandTotal.toFixed(2)} ≈ Grand Total ${(data.grandTotal || 0).toFixed(2)}`,
  };
}

/**
 * Extracts invoice data using Gemini Vision.
 */
async function callGeminiExtractor(base64Pdf: string): Promise<ExtractedInvoice> {
  const prompt = `You are a strict data extraction engine for an ERP system.
Your ONLY job is to extract invoice details from this PDF document into structured JSON.

CRITICAL INSTRUCTIONS:
- Extract ONLY invoice information.
- IGNORE e-Way Bill pages, declarations, signatures, company seals, and Terms & Conditions.
- PRESERVE original product names exactly as written.
- NEVER invent or estimate missing values (like HSN, GST, quantity, or prices). If a value is missing or unreadable, return null or 0 as appropriate.
- ALWAYS respond with valid JSON ONLY (no markdown, no code blocks, no backticks).

SUPPLIER EXTRACTION PRIORITY:
Find the supplier/company name based on this priority:
1. GSTIN owner/company issuing the invoice
2. "Sold By"
3. "Supplier"
4. "Vendor"
5. "Dealer"
6. Company logo text
7. Address block near GSTIN
NEVER return: "INVOICE", "TAX INVOICE", "GST INVOICE", "ORIGINAL", "DUPLICATE", "CUSTOMER COPY", "CASH MEMO".

Extract the data into this EXACT JSON structure:
{
  "invoiceNumber": "string | null",
  "supplier": "string | null",
  "supplierGstin": "string | null",
  "supplierConfidence": 0.0 to 1.0 (float),
  "purchaseDate": "YYYY-MM-DD | null",
  "eWayBillNo": "string | null",
  "subtotal": 0.0,
  "cgst": 0.0,
  "sgst": 0.0,
  "igst": 0.0,
  "roundOff": 0.0,
  "grandTotal": 0.0,
  "products": [
    {
      "name": "string",
      "sku": "string | null",
      "category": "string | null",
      "stock": 0.0,
      "unitsPerBag": 1,
      "basePurchasePrice": 0.0,
      "purchasePrice": 0.0,
      "sellingPrice": 0.0,
      "transportCost": 0.0,
      "unit": "string | null",
      "gstRate": 0.0,
      "hsnCode": "string | null",
      "lineTotal": 0.0
    }
  ]
}

Definitions:
- 'stock': The exact quantity purchased for the line item.
- 'basePurchasePrice': The price per unit INCLUSIVE of GST (After Tax). If the invoice only shows exclusive price, you MUST add the GST amount to calculate the final price per unit.
- 'purchasePrice': The price per unit INCLUSIVE of GST (After Tax).
- 'lineTotal': The total amount for the line item BEFORE overall invoice taxes are applied.
- Taxes: Extract total cgst, sgst, igst, and rounding from the invoice summary at the bottom.
`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const startTime = Date.now();
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'application/pdf', data: base64Pdf } }
        ]
      }],
      generationConfig: {
        temperature: 0.0, // Strictly zero for deterministic extraction
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });

  const duration = Date.now() - startTime;

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  try {
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const geminiData: GeminiExtractionResult = JSON.parse(cleaned);

    // Validate the extracted math
    const validation = validateGeminiExtraction(geminiData);
    console.log(`[InvoiceExtractor] Gemini parsing took ${duration}ms. Validation: ${validation.passed ? 'PASSED' : 'FAILED'}`);

    let finalSupplier = geminiData.supplier || "";
    const lowerSupplier = finalSupplier.toLowerCase();
    if (
      lowerSupplier.includes("invoice") ||
      lowerSupplier.includes("e-way") ||
      lowerSupplier.includes("bill") ||
      lowerSupplier.includes("challan") ||
      lowerSupplier.includes("original") ||
      lowerSupplier.includes("duplicate") ||
      lowerSupplier.includes("customer copy") ||
      lowerSupplier.includes("cash memo") ||
      lowerSupplier.includes("unknown")
    ) {
      finalSupplier = "";
    }

    return {
      invoiceNumber: geminiData.invoiceNumber || "",
      supplier: finalSupplier,
      supplierGstin: geminiData.supplierGstin || "",
      supplierConfidence: geminiData.supplierConfidence ?? 1.0,
      purchaseDate: geminiData.purchaseDate || new Date().toISOString(),
      eWayBillNo: geminiData.eWayBillNo || "",
      format: "gemini_vision",
      templateName: "AI Extraction",
      grandTotal: geminiData.grandTotal || 0,
      validationPassed: validation.passed,
      validationDetails: validation.details,
      products: (geminiData.products || []).filter(p => p != null).map(p => {
        const exclusivePrice = p.basePurchasePrice ?? p.purchasePrice ?? 0;
        
        return {
          ...p,
          stock: p.stock ?? 0,
          unitsPerBag: p.unitsPerBag ?? 1,
          basePurchasePrice: exclusivePrice,
          purchasePrice: exclusivePrice,
          lineTotal: p.lineTotal ?? 0
        };
      })
    };
  } catch (e: any) {
    throw new Error(`Failed to parse structured JSON from Gemini response: ${e.message}`);
  }
}

/**
 * Main Entry Point for Invoice Extraction.
 * Attempts Gemini AI Extraction if enabled, gracefully falling back to the local parser on ANY failure.
 */
export async function extractInvoiceWithAI(buffer: Buffer, businessId?: string): Promise<any> {
  const isGeminiEnabled = process.env.ENABLE_GEMINI_INVOICE_EXTRACTION === 'true';

  if (isGeminiEnabled) {
    try {
      console.log("[InvoiceExtractor] Attempting Gemini extraction...");
      const base64Pdf = buffer.toString('base64');
      const result = await callGeminiExtractor(base64Pdf);
      
      // Ensure we actually got products
      if (!result.products || result.products.length === 0) {
         throw new Error("Gemini returned zero products.");
      }

      return result;
    } catch (err: any) {
      console.warn(`[InvoiceExtractor] Gemini extraction failed. Reason: ${err.message}. Falling back to local parser.`);
      // Proceed to fallback
    }
  } else {
    console.log("[InvoiceExtractor] Gemini extraction is disabled. Using local parser.");
  }

  // Fallback to existing local parser
  console.log("[InvoiceExtractor] Executing local parseInvoicePdfLocally...");
  const localStart = Date.now();
  try {
      const localResult = await parseInvoicePdfLocally(buffer, businessId);
      console.log(`[InvoiceExtractor] Local parser took ${Date.now() - localStart}ms.`);
      return localResult;
  } catch(err) {
      console.error("[InvoiceExtractor] Local parser also failed:", err);
      throw err;
  }
}
