/**
 * BizFlow — Structural Invoice PDF Parser
 *
 * This parser uses robust text-pattern matching to extract data from invoices,
 * removing the need for brittle ML coordinate-based training. It is completely
 * immune to font rendering shifts between Windows and Linux.
 */

import PDFParser from 'pdf2json';
import { type TextElement } from '@/shared/lib/invoice-template-learner';

// ── Types ────────────────────────────────────────────────────────────────────

interface ExtractedProduct {
  name: string;
  sku: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  purchasePrice: number;       // Rate (Incl. of Tax) / MRP rate
  basePurchasePrice: number;   // Taxable rate (excl. GST)
  lineTotal: number;           // Amount (Incl. of Tax)
  gstRate: number;             // Total GST rate (CGST + SGST)
}

interface RawTextElement {
  x: number;
  y: number;
  text: string;
  bold?: boolean;
  fontSize?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sameRow(y1: number, y2: number, tolerance = 0.3): boolean {
  return Math.abs(y1 - y2) < tolerance;
}

function safeDecode(str: string) {
  try { return decodeURIComponent(str); } catch { return str; }
}

function parseNumber(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[^0-9.\-]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (u === 'nos' || u === 'no' || u === 'pcs' || u === 'pieces') return 'pcs';
  if (u === 'bags' || u === 'bag') return 'bag';
  if (u === 'kg' || u === 'kgs') return 'kg';
  if (u === 'ltr' || u === 'litre' || u === 'litres') return 'ltr';
  if (u === 'box' || u === 'boxes') return 'box';
  if (u === 'pkt' || u === 'packet' || u === 'packets') return 'pkt';
  if (u === 'btl' || u === 'bottle' || u === 'bottles') return 'btl';
  if (u === 'pack' || u === 'packs') return 'pack';
  return u || 'pcs';
}

function parseInvoiceDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const match = dateStr.match(/(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const month = months[match[2].toLowerCase()] || '01';
    let year = match[3];
    if (year.length === 2) year = (parseInt(year) > 50 ? '19' : '20') + year;
    return `${year}-${month}-${day}`;
  }
  const match2 = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (match2) {
    const day = match2[1].padStart(2, '0');
    const month = match2[2].padStart(2, '0');
    let year = match2[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
}

// ── Header Extraction ────────────────────────────────────────────────────────

function extractHeader(texts: RawTextElement[]) {
    let supplierGstin = '';
    let invoiceNumber = '';
    let purchaseDate = '';
    let supplier = 'Unknown Supplier';
    
    const fullText = texts.map(t => t.text).join(' ');
    
    // Extract GSTIN
    const gstinMatch = fullText.match(/GSTIN(?:\/UIN)?:\s*([A-Z0-9]{15})/i);
    if (gstinMatch) supplierGstin = gstinMatch[1];
    
    // Extract Invoice No
    const invMatch = fullText.match(/\b(AGCMBP[A-Z0-9]+|ASDBP[A-Z0-9]+|AGR-SLP-[A-Z0-9-]+)\b/i);
    if (invMatch) {
      invoiceNumber = invMatch[1];
    } else {
      // Fallback: look for generic invoice number near "Invoice No"
      const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
      const invLabel = sorted.find(t => t.text.toLowerCase().includes('invoice no'));
      if (invLabel) {
        const invVal = sorted.find(t => sameRow(t.y, invLabel.y, 1.0) && t.x > invLabel.x + 2 && /^[A-Z0-9-]+$/.test(t.text));
        if (invVal) invoiceNumber = invVal.text;
      }
    }
    
    // Extract Date (dd-Mmm-yy)
    const dateMatch = fullText.match(/\b(\d{1,2}-[A-Za-z]{3}-\d{2,4})\b/);
    if (dateMatch) purchaseDate = dateMatch[1];
    
    // Extract Supplier Name (heuristic: large bold text near the top)
    const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const t of sorted) {
       const textLower = t.text.toLowerCase();
       // A common pattern is finding a recognizable company name before GSTIN
       // It usually contains letters and spaces (not just an ID like AGR-SLP-26-01608)
       if (
         t.y < 15 && 
         t.text.length > 5 && 
         /[a-zA-Z]/.test(t.text) && 
         t.text.includes(' ') && 
         !textLower.includes('gstin') && 
         !textLower.includes('invoice') && 
         !textLower.includes('erp slip') &&
         !textLower.includes('original') &&
         !textLower.includes('duplicate') &&
         !textLower.includes('challan')
       ) {
         supplier = t.text;
         break;
       }
    }
    
    return { supplierGstin, invoiceNumber, purchaseDate, supplier, eWayBillNo: '' };
}

// ── Product Table Extraction ─────────────────────────────────────────────────

function groupIntoRows(texts: RawTextElement[]) {
    const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
    const rows: RawTextElement[][] = [];
    let currentRow: RawTextElement[] = [];
    if (sorted.length === 0) return rows;
    
    let currentY = sorted[0].y;
    
    for (const t of sorted) {
      if (Math.abs(t.y - currentY) > 0.5) {
        if (currentRow.length > 0) rows.push(currentRow);
        currentRow = [];
        currentY = t.y;
      }
      currentRow.push(t);
    }
    if (currentRow.length > 0) rows.push(currentRow);
    return rows;
}

function extractProductRows(rows: RawTextElement[][]) {
    const products = [];
    
    // Find the Y coordinate of the "Total" row to stop parsing products
    let tableEndY = 99999;
    for (const row of rows) {
        const textStr = row.map(t => t.text.toLowerCase()).join(' ');
        if (
            textStr.includes('total') || 
            textStr.includes('rounded') || 
            textStr.includes('continued') || 
            textStr.includes('amount chargeable') ||
            textStr.includes('computer generated invoice')
        ) {
            tableEndY = row[0].y - 0.5; // stop slightly before
            break;
        }
    }

    for (const row of rows) {
      if (row[0].y > tableEndY) continue; // Skip GST summary rows at bottom

      const textsInRow = row.map(t => t.text);
      
      const hsnText = textsInRow.find(t => /^\d{4,8}$/.test(t) && t !== '2026' && t.length >= 4);
      const qtyRegex = /^(\d+)\s*(Nos|bags|pcs|kg|gm|ltr|ml|box|pack|pkt)s?$/i;
      const qtyText = textsInRow.find(t => qtyRegex.test(t));
      
      const numberTexts = textsInRow.filter(t => /^[\d,]+\.\d{2}$/.test(t));
      const numbers = numberTexts.map(parseNumber).sort((a, b) => a - b);
      
      if (hsnText && (qtyText || numbers.length >= 2)) {
        let quantity = 0;
        let unit = 'pcs';
        if (qtyText) {
            const match = qtyText.match(qtyRegex);
            if (match) {
               quantity = parseInt(match[1]);
               unit = match[2];
            }
        }
        
        let amount = numbers.length > 0 ? numbers[numbers.length - 1] : 0;
        let rateIncl = numbers.length > 1 ? numbers[numbers.length - 2] : amount;
        let rateTaxable = numbers.length > 2 ? numbers[0] : rateIncl;

        if (quantity === 0 && amount > 0 && rateIncl > 0) {
           quantity = Math.round(amount / rateIncl);
        }

        const descTexts = textsInRow.filter(t => 
            t !== hsnText && 
            t !== qtyText && 
            !numberTexts.includes(t) && 
            !/^\d+$/.test(t) &&
            !/^(Nos|bags|pcs|kg|gm|ltr|ml|box|pack|pkt)$/i.test(t) &&
            !/^\d+\s*$/.test(t) // filter isolated numbers like sl no
        );
        let description = descTexts.join(' ').replace(/\|/g, '').trim();

        products.push({
            name: description,
            sku: '',
            hsnCode: hsnText,
            quantity,
            unit: normalizeUnit(unit),
            purchasePrice: rateIncl,
            basePurchasePrice: rateTaxable,
            lineTotal: amount,
            gstRate: 0 // Will populate later
        });
      } else if (products.length > 0 && numbers.length === 0 && !hsnText && !qtyText) {
        // Orphan row: likely a continuation of the previous item's description
        const textStr = textsInRow.join(' ').toLowerCase();
        if (
            !textStr.includes('continued') &&
            !textStr.includes('computer generated') &&
            !textStr.includes('authorised') &&
            !textStr.includes('amount chargeable')
        ) {
            const descTexts = textsInRow.filter(t => 
                !/^\d+$/.test(t) &&
                !/^(Nos|bags|pcs|kg|gm|ltr|ml|box|pack|pkt)$/i.test(t) &&
                !/^\d+\s*$/.test(t)
            );
            const extraDesc = descTexts.join(' ').replace(/\|/g, '').trim();
            if (extraDesc) {
                products[products.length - 1].name += ' ' + extraDesc;
            }
        }
      }
    }
    
    return products;
}

// ── GST Rate Extraction ──────────────────────────────────────────────────────

function extractGSTRates(rows: RawTextElement[][]): Map<string, number> {
  const rates = new Map<string, number>();
  
  for (const row of rows) {
    const textsInRow = row.map(t => t.text);
    const hsnText = textsInRow.find(t => /^\d{4,8}$/.test(t) && t !== '2026' && t.length >= 4);
    const pctTexts = textsInRow.filter(t => t.includes('%'));
    
    if (hsnText && pctTexts.length > 0) {
      const gstRate = pctTexts.reduce((sum, t) => sum + (parseFloat(t.replace('%', '')) || 0), 0);
      rates.set(hsnText, gstRate);
    }
  }
  
  return rates;
}

// ── Tax Totals Extraction ────────────────────────────────────────────────────

function extractTaxTotals(texts: RawTextElement[], hasGst: boolean): {
  cgst: number; sgst: number; roundedOff: number; grandTotal: number;
} {
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
  let cgst = 0, sgst = 0, roundedOff = 0, grandTotal = 0;

  if (hasGst) {
    const cgstLabel = sorted.find(t => t.text === 'Output CGST');
    if (cgstLabel) {
      const cv = sorted.find(t => sameRow(t.y, cgstLabel.y, 0.3) && t.x > cgstLabel.x + 5 && /[\d,.]/.test(t.text));
      if (cv) cgst = parseNumber(cv.text);
    }
    const sgstLabel = sorted.find(t => t.text === 'Output SGST');
    if (sgstLabel) {
      const sv = sorted.find(t => sameRow(t.y, sgstLabel.y, 0.3) && t.x > sgstLabel.x + 5 && /[\d,.]/.test(t.text));
      if (sv) sgst = parseNumber(sv.text);
    }
    const roundLabel = sorted.find(t => t.text.includes('Rounded'));
    if (roundLabel) {
      const rv = sorted.find(t => sameRow(t.y, roundLabel.y, 0.3) && t.x > roundLabel.x + 5 && /[\d,.]/.test(t.text));
      if (rv) roundedOff = parseNumber(rv.text);
    }
  }

  // Grand total
  const amtChargeable = sorted.find(t => t.text.includes('Amount Chargeable'));
  if (amtChargeable) {
    const totalCandidates = sorted.filter(t =>
      t.y < amtChargeable.y && t.y > amtChargeable.y - 2.0 &&
      /^[\d,]+\.\d{2}$/.test(t.text.trim())
    );
    if (totalCandidates.length > 0) {
      grandTotal = parseNumber(totalCandidates.sort((a, b) => b.x - a.x)[0].text);
    }
  }

  if (grandTotal === 0) {
    const totalTexts = sorted.filter(t => t.text === 'Total' && t.y > 30);
    for (const total of totalTexts) {
      const rupeeSymbol = sorted.find(t =>
        sameRow(t.y, total.y, 0.3) && (t.text === '₹' || t.text === 'I')
      );
      if (rupeeSymbol) {
        const amountText = sorted.find(t =>
          sameRow(t.y, total.y, 0.3) && t.x > rupeeSymbol.x && /[\d,.]/.test(t.text)
        );
        if (amountText) { grandTotal = parseNumber(amountText.text); break; }
      }
    }
  }

  // Fallback: search the whole document for the largest number near "Total"
  if (grandTotal === 0) {
      const allNumbers = sorted.filter(t => /^[\d,]+\.\d{2}$/.test(t.text)).map(t => parseNumber(t.text));
      if (allNumbers.length > 0) {
         grandTotal = Math.max(...allNumbers);
      }
  }

  return { cgst, sgst, roundedOff, grandTotal };
}

// ── Validation ───────────────────────────────────────────────────────────────

function validateExtraction(
  products: ExtractedProduct[],
  taxTotals: { cgst: number; sgst: number; roundedOff: number; grandTotal: number },
  hasGst: boolean
): { passed: boolean; details: string } {
  const lineTotal = products.reduce((sum, p) => sum + p.lineTotal, 0);

  if (!hasGst) {
    const diff = Math.abs(lineTotal - taxTotals.grandTotal);
    if (diff > 1.0) {
      return {
        passed: false,
        details: `Sum of line items (${lineTotal.toFixed(2)}) ≠ grand total (${taxTotals.grandTotal.toFixed(2)}). Diff: ${diff.toFixed(2)}`,
      };
    }
    return { passed: true, details: 'Line item sum matches grand total' };
  }

  const expectedGrandTotal = lineTotal + taxTotals.cgst + taxTotals.sgst + taxTotals.roundedOff;
  const diff = Math.abs(expectedGrandTotal - taxTotals.grandTotal);

  if (diff > 1.0) {
    return {
      passed: false,
      details: `Calculated (${expectedGrandTotal.toFixed(2)}) ≠ grand total (${taxTotals.grandTotal.toFixed(2)}). Diff: ${diff.toFixed(2)}`,
    };
  }

  return {
    passed: true,
    details: `Subtotal ${lineTotal.toFixed(2)} + CGST ${taxTotals.cgst.toFixed(2)} + SGST ${taxTotals.sgst.toFixed(2)} + Rounding ${taxTotals.roundedOff.toFixed(2)} = ${expectedGrandTotal.toFixed(2)} ≈ Grand Total ${taxTotals.grandTotal.toFixed(2)}`,
  };
}

// ── Main Parser ──────────────────────────────────────────────────────────────

/**
 * Parse an invoice PDF using robust structural text extraction.
 *
 * @param buffer - The PDF file buffer
 * @param businessId - Unused (kept for API compatibility)
 * @returns Extracted invoice data
 */
export async function parseInvoicePdfLocally(buffer: Buffer, businessId?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, false);

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      console.error('[PDFParser] Parse error:', errData.parserError);
      reject(new Error("Failed to parse PDF"));
    });

    pdfParser.on("pdfParser_dataReady", async (pdfData: any) => {
      try {
        if (!pdfData?.Pages || pdfData.Pages.length === 0) {
          return reject(new Error('PDF has no pages'));
        }

        const texts: RawTextElement[] = [];
        let yOffset = 0;
        for (const page of pdfData.Pages) {
            for (const t of page.Texts) {
                texts.push({
                    x: t.x,
                    y: t.y + yOffset,
                    text: safeDecode(t.R[0].T).trim(),
                    bold: t.R?.[0]?.TS?.[2] === 1,
                    fontSize: t.R?.[0]?.TS?.[1]
                });
            }
            yOffset += page.Height || 100;
        }

        if (texts.length === 0) {
          return reject(new Error('No text found in PDF'));
        }

        const fullText = texts.map(t => t.text).join(' ').toLowerCase();
        const hasGst = fullText.includes('cgst') || fullText.includes('sgst') || fullText.includes('igst');
        const format = hasGst ? 'gst_composite' : 'sales';

        const header = extractHeader(texts);
        console.log(`[PDFParser] Header: supplier=${header.supplier}, invoice=${header.invoiceNumber}, date=${header.purchaseDate}`);

        const rows = groupIntoRows(texts);
        const products = extractProductRows(rows);
        console.log(`[PDFParser] Found ${products.length} product rows`);

        if (products.length === 0) {
          return resolve({
            error: `Could not extract any products from this invoice.`,
            invoiceNumber: header.invoiceNumber,
            supplier: header.supplier,
            products: [],
          });
        }

        const gstRates = extractGSTRates(rows);
        
        // Populate GST rates into products
        for (const p of products) {
            p.gstRate = gstRates.get(p.hsnCode) || (hasGst ? 5 : 0); // Default to 5% if it's a GST invoice and missing
        }

        const taxTotals = extractTaxTotals(texts, hasGst);
        const validation = validateExtraction(products, taxTotals, hasGst);

        console.log(`[PDFParser] Validation: ${validation.passed ? 'PASSED' : 'FAILED'} — ${validation.details}`);

        resolve({
          invoiceNumber: header.invoiceNumber,
          supplier: header.supplier,
          supplierGstin: header.supplierGstin,
          purchaseDate: parseInvoiceDate(header.purchaseDate),
          eWayBillNo: header.eWayBillNo,
          format,
          templateName: 'Structural Auto-Parser',
          grandTotal: taxTotals.grandTotal,
          validationPassed: validation.passed,
          validationDetails: validation.details,
          products
        });
      } catch (err) {
        console.error('[PDFParser] Extraction error:', err);
        reject(err);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}
