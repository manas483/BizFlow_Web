/**
 * BizFlow — ML-Trained Invoice PDF Parser
 *
 * Uses trained templates (stored per-business in DB) for extraction.
 * Templates are learned from sample PDFs using K-means clustering,
 * label proximity analysis, and table boundary detection.
 *
 * When no template matches, returns a "training required" response
 * so the frontend can prompt the user to train on the new format.
 *
 * No hardcoded configs. No AI/LLM calls. Fully deterministic.
 */

import PDFParser from 'pdf2json';
import { prisma } from '@/shared/lib/db';
import {
  type TextElement,
  type LearnedFormatConfig,
  getTextElements,
  generateFingerprint,
  computeSimilarity,
  trainTemplate,
} from '@/shared/lib/invoice-template-learner';

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function sameRow(y1: number, y2: number, tolerance = 0.2): boolean {
  return Math.abs(y1 - y2) < tolerance;
}

function parseNumber(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[^0-9.\-]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function parseQuantityUnit(text: string): { quantity: number; unit: string } {
  const match = text.match(/^\s*(\d+)\s+(.+)\s*$/);
  if (match) {
    return { quantity: parseInt(match[1], 10), unit: match[2].trim().toLowerCase() };
  }
  const num = parseInt(text.trim(), 10);
  if (!isNaN(num)) return { quantity: num, unit: 'pcs' };
  return { quantity: 0, unit: 'pcs' };
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
  const match = dateStr.match(/(\d{1,2})-(\w{3})-(\d{2,4})/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const months: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const month = months[match[2]] || '01';
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

// ── Template Matching ────────────────────────────────────────────────────────

const SIMILARITY_THRESHOLD = 0.85;

/**
 * Find the best matching template for the given PDF texts.
 * Returns null if no template matches above threshold.
 */
async function findMatchingTemplate(
  texts: TextElement[],
  businessId: string
): Promise<{ templateId: string; name: string; config: LearnedFormatConfig; similarity: number } | null> {
  const templates = await prisma.invoiceTemplate.findMany({
    where: { businessId },
    select: { id: true, name: true, fingerprint: true, templateData: true },
  });

  if (templates.length === 0) return null;

  let bestMatch: { templateId: string; name: string; config: LearnedFormatConfig; similarity: number } | null = null;
  let bestSimilarity = 0;

  const incomingFingerprint = generateFingerprint(texts);

  for (const tpl of templates) {
    const config = tpl.templateData as unknown as LearnedFormatConfig;

    // Fast path: exact fingerprint match
    if (tpl.fingerprint === incomingFingerprint) {
      return { templateId: tpl.id, name: tpl.name, config, similarity: 1.0 };
    }

    // Slow path: cosine similarity
    const similarity = computeSimilarity(texts, tpl.fingerprint, config);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = { templateId: tpl.id, name: tpl.name, config, similarity };
    }
  }

  if (bestMatch && bestMatch.similarity >= SIMILARITY_THRESHOLD) {
    return bestMatch;
  }

  return null;
}

// ── Header Extraction ────────────────────────────────────────────────────────

function extractHeader(texts: TextElement[], config: LearnedFormatConfig): {
  supplier: string;
  supplierAddress: string;
  supplierGstin: string;
  invoiceNumber: string;
  date: string;
  eWayBillNo: string;
} {
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);

  // Supplier name
  const supplierTexts = sorted.filter(t =>
    t.y >= config.supplierNameMinY &&
    t.y <= config.supplierNameMaxY &&
    t.x >= config.supplierNameMinX &&
    t.x < config.supplierNameMaxX
  );
  const supplier = supplierTexts.length > 0 ? supplierTexts[0].text : 'Unknown Supplier';

  // Supplier address
  const addressTexts = sorted.filter(t =>
    t.y > config.supplierNameMaxY &&
    t.y < config.supplierNameMaxY + 1.5 &&
    t.x >= config.supplierNameMinX &&
    t.x < config.supplierNameMaxX
  );
  const supplierAddress = addressTexts.length > 0 ? addressTexts[0].text : '';

  // GSTIN
  const gstinText = sorted.find(t =>
    t.text.startsWith('GSTIN/UIN:') || t.text.startsWith('GSTIN:')
  );
  const supplierGstin = gstinText
    ? (gstinText.text.match(/GSTIN(?:\/UIN)?:\s*(\S+)/)?.[1] || '')
    : '';

  // Invoice Number
  const invoiceNoLabel = sorted.find(t => t.text === 'Invoice No.');
  let invoiceNumber = '';
  if (invoiceNoLabel) {
    const candidates = sorted.filter(t =>
      t.y > invoiceNoLabel.y &&
      t.y < invoiceNoLabel.y + 1.2 &&
      t.x >= config.invoiceNoValueMinX - 1.0 &&
      t.x <= config.invoiceNoValueMaxX + 1.0 &&
      t.text !== 'Invoice No.' &&
      !t.text.includes('e-Way') &&
      !t.text.includes('Delivery') &&
      !t.text.includes('Bill No') &&
      !/^\d{10,}$/.test(t.text)
    );
    if (candidates.length > 0) {
      candidates.sort((a, b) => Math.abs(a.x - invoiceNoLabel.x) - Math.abs(b.x - invoiceNoLabel.x));
      invoiceNumber = candidates[0].text;
    }
  }

  // Date
  const dateLabel = sorted.find(t => t.text === 'Dated' && t.y < 3.0);
  let dateStr = '';
  if (dateLabel) {
    const dateCandidates = sorted.filter(t =>
      t.y > dateLabel.y &&
      t.y < dateLabel.y + 1.2 &&
      t.x >= config.dateValueMinX - 1.0 &&
      t.text !== 'Dated' && /\d/.test(t.text)
    );
    if (dateCandidates.length > 0) dateStr = dateCandidates[0].text;
  }

  // e-Way Bill
  let eWayBillNo = '';
  const eWayLabel = sorted.find(t => t.text.includes('e-Way Bill No'));
  if (eWayLabel) {
    const eWayCandidates = sorted.filter(t =>
      t.y > eWayLabel.y &&
      t.y < eWayLabel.y + 1.2 &&
      Math.abs(t.x - eWayLabel.x) < 2.0 &&
      /^\d{8,}$/.test(t.text)
    );
    if (eWayCandidates.length > 0) eWayBillNo = eWayCandidates[0].text;
  }

  return { supplier, supplierAddress, supplierGstin, invoiceNumber, date: dateStr, eWayBillNo };
}

// ── Product Table Extraction ─────────────────────────────────────────────────

interface RawProductRow {
  slNo: number;
  y: number;
  description: string;
  hsnCode: string;
  quantityText: string;
  rateIncl: number;
  rateTaxable: number;
  perUnit: string;
  amount: number;
}

function extractProductRows(texts: TextElement[], config: LearnedFormatConfig): { products: RawProductRow[], debugInfo: string } {
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);

  const slHeader = sorted.find(t => 
    /^(sl|s\.?\s*no\.?|sr\.?\s*no\.?|s\.n\.|#|item|code)/i.test(t.text.trim()) && t.x < 10.0
  );
  if (!slHeader) {
    const possibleHeaders = sorted.filter(t => t.y < 15 && t.x < 10).map(t => t.text).join(', ');
    return { products: [], debugInfo: `slHeader not found. Looked for 'sl', 's.no', etc. Possible headers found: ${possibleHeaders}` };
  }

  // Use the slHeader Y position directly instead of strict offset
  const minDataY = slHeader.y + 0.2;

  const totalRow = sorted.find(t =>
    t.text.toLowerCase().includes('total') &&
    t.y > minDataY + 1.0 &&
    t.x >= config.totalRowMinX - 2.0 // Add some tolerance
  );
  const tableEndY = totalRow ? totalRow.y : 999;

  const slEntries = sorted.filter(t =>
    /^\d+\.?$/.test(t.text.trim()) &&
    t.x >= config.slNoMinX - 0.5 && t.x <= config.slNoMaxX + 0.5 && // Add some tolerance
    t.y > minDataY && t.y < tableEndY &&
    parseInt(t.text.trim()) <= 999
  );

  console.log('DEBUG slNoTexts:', slEntries.map(s => ({ text: s.text, y: s.y, x: s.x })));

  const products: RawProductRow[] = [];
  const excludePatterns = /^(Output|CGST|SGST|Rounded|Total|Amount|Tax|HSN)/i;

  for (let i = 0; i < slEntries.length; i++) {
    const sl = slEntries[i];
    const slNo = parseInt(sl.text, 10);
    const rowY = sl.y;
    const prevSlY = i > 0 ? slEntries[i - 1].y : minDataY - 2.0;
    const nextSlY = (i + 1 < slEntries.length) ? slEntries[i + 1].y : tableEndY;

    const fullRowSlice = sorted.filter(t =>
      t.y > prevSlY + 0.2 && t.y < nextSlY - 0.2 && t.y >= minDataY - 0.15 && t.y < tableEndY
    );

    const descTexts = fullRowSlice.filter(t =>
      sameRow(t.y, rowY, 0.3) && t.x >= config.descMinX && t.x <= config.descMaxX && t.text !== String(slNo)
    );
    const hsnTexts = fullRowSlice.filter(t =>
      sameRow(t.y, rowY, 0.3) && t.x >= config.hsnMinX - 1.0 && t.x <= config.hsnMaxX + 1.0 && /^\d{4,8}$/.test(t.text)
    );
    const qtyTexts = fullRowSlice.filter(t => {
      const isSameRow = sameRow(t.y, rowY, 0.3);
      if (!isSameRow) return false;
      const inX = t.x >= config.qtyMinX - 3.0 && t.x <= config.qtyMaxX + 3.0;
      const notHsn = !(t.x >= config.hsnMinX - 0.5 && t.x <= config.hsnMaxX + 0.5 && /^\d{4,8}$/.test(t.text));
      const hasUnitText = /Nos|bags|pcs|kg|gm|ltr|ml|box/i.test(t.text);
      const notRateIncl = !(config.rateInclMinX > 0 && t.x >= config.rateInclMinX - 0.1 && !hasUnitText);
      const notRateTaxable = !(config.rateTaxableMinX > 0 && t.x >= config.rateTaxableMinX - 0.1 && !hasUnitText);
      return inX && notHsn && notRateIncl && notRateTaxable;
    });
    const rateInclTexts = fullRowSlice.filter(t =>
      sameRow(t.y, rowY, 0.3) && t.x >= config.rateInclMinX - 1.0 && t.x <= config.rateInclMaxX + 1.0 &&
      /[\d,.]/.test(t.text) && !/Nos|bags|pcs|kg|gm|ltr|ml|box/i.test(t.text)
    );
    const rateTaxableTexts = fullRowSlice.filter(t =>
      sameRow(t.y, rowY, 0.3) && t.x >= config.rateTaxableMinX - 1.0 && t.x <= config.rateTaxableMaxX + 1.0 &&
      /[\d,.]/.test(t.text) && !/Nos|bags|pcs|kg|gm|ltr|ml|box/i.test(t.text)
    );
    const perUnitTexts = fullRowSlice.filter(t =>
      sameRow(t.y, rowY, 0.3) && t.x >= config.perUnitMinX - 1.0 && t.x <= config.perUnitMaxX + 1.0 && /^[A-Za-z]+$/.test(t.text)
    );
    const amountTexts = fullRowSlice.filter(t => {
      const isSameRow = sameRow(t.y, rowY, 0.3);
      if (!isSameRow) return false;
      // Use a wider tolerance for amount in case it's misaligned to the right
      const inX = t.x >= config.amountMinX - 2.0 && t.x <= config.amountMaxX + 3.0;
      const isNum = /[\d,.]/.test(t.text);
      return inX && isNum;
    });

    // Multi-line description continuation
    const continuationTexts = sorted.filter(t =>
      t.y > rowY + 0.2 && t.y < nextSlY - 0.2 &&
      t.x >= config.descMinX && t.x <= config.descMaxX &&
      !excludePatterns.test(t.text.trim())
    );

    let description = descTexts.map(t => t.text).join(' ');
    for (const ct of continuationTexts.sort((a, b) => a.y - b.y || a.x - b.x)) {
      if (ct.x < config.hsnMinX) description += ' ' + ct.text;
    }
    description = description.replace(/\s+/g, ' ').trim();

    products.push({
      slNo, y: rowY, description,
      hsnCode: hsnTexts.length > 0 ? hsnTexts[0].text : '',
      quantityText: qtyTexts.map(t => t.text).join(' '),
      rateIncl: rateInclTexts.length > 0 ? parseNumber(rateInclTexts[0].text) : 0,
      rateTaxable: rateTaxableTexts.length > 0 ? parseNumber(rateTaxableTexts[0].text) : 0,
      perUnit: perUnitTexts.length > 0 ? perUnitTexts[0].text : '',
      amount: amountTexts.length > 0 ? parseNumber(amountTexts[0].text) : 0,
    });
  }

  const debugInfo = `slHeader found at y=${slHeader.y}. slEntries found: ${slEntries.length}. First data y: ${minDataY}. TableEndY: ${tableEndY}. Products extracted: ${products.length}.`;
  return { products, debugInfo };
}

// ── GST Rate Extraction ──────────────────────────────────────────────────────

function extractGSTRates(texts: TextElement[], config: LearnedFormatConfig): Map<string, number> {
  const rates = new Map<string, number>();
  if (!config.hsnSummaryHeaderText) return rates;

  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);

  const hsnHeaders = sorted.filter(t => t.text === 'HSN/SAC' && t.y > 30);
  if (hsnHeaders.length === 0) return rates;

  const summaryHeaderY = hsnHeaders[0].y;
  const summaryTotal = sorted.find(t => t.text === 'Total' && t.y > summaryHeaderY + 1.0);
  const summaryEndY = summaryTotal ? summaryTotal.y : summaryHeaderY + 10;

  const hsnRows = sorted.filter(t =>
    /^\d{4,8}$/.test(t.text) &&
    t.y > summaryHeaderY + 0.5 && t.y < summaryEndY && t.x < 5.0
  );

  for (const hsnRow of hsnRows) {
    const rowY = hsnRow.y;
    const cgstRateText = sorted.find(t =>
      sameRow(t.y, rowY, 0.3) &&
      t.x >= config.cgstRateMinX && t.x <= config.cgstRateMaxX && t.text.includes('%')
    );
    const sgstRateText = sorted.find(t =>
      sameRow(t.y, rowY, 0.3) &&
      t.x >= config.sgstRateMinX && t.x <= config.sgstRateMaxX && t.text.includes('%')
    );

    const cgstRate = cgstRateText ? parseFloat(cgstRateText.text.replace('%', '')) || 0 : 0;
    const sgstRate = sgstRateText ? parseFloat(sgstRateText.text.replace('%', '')) || 0 : 0;
    rates.set(hsnRow.text, cgstRate + sgstRate);
  }

  return rates;
}

// ── Tax Totals Extraction ────────────────────────────────────────────────────

function extractTaxTotals(texts: TextElement[], hasGst: boolean): {
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

  // Grand total — look for amount near "Amount Chargeable" or Total with rupee symbol
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
        sameRow(t.y, total.y, 0.3) && (t.text === 'ī' || t.text === 'I')
      );
      if (rupeeSymbol) {
        const amountText = sorted.find(t =>
          sameRow(t.y, total.y, 0.3) && t.x > rupeeSymbol.x && /[\d,.]/.test(t.text)
        );
        if (amountText) { grandTotal = parseNumber(amountText.text); break; }
      }
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
 * Parse an invoice PDF using ML-trained templates.
 *
 * @param buffer - The PDF file buffer
 * @param businessId - The business ID to look up templates for
 * @returns Extracted invoice data, or a "trainingRequired" response if no template matches
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

        const page0 = pdfData.Pages[0];
        const texts = getTextElements(page0);

        if (texts.length === 0) {
          return reject(new Error('No text found in PDF'));
        }

        // ── Step 1: Find matching template ──
        let config: LearnedFormatConfig | null = null;
        let templateName = 'Unknown';

        if (businessId) {
          const match = await findMatchingTemplate(texts, businessId);
          if (match) {
            config = match.config;
            templateName = match.name;
            console.log(`[PDFParser] Matched template: "${match.name}" (similarity: ${match.similarity.toFixed(2)})`);
          }
        }

        // ── No template found → return "training required" ──
        if (!config) {
          console.log('[PDFParser] No matching template found. Training required.');

          // Auto-train on this PDF to prepare a template for user confirmation
          let trainedPreview: any = null;
          try {
            const trainingResult = await trainTemplate(buffer);
            trainedPreview = {
              formatName: trainingResult.formatName,
              fingerprint: trainingResult.fingerprint,
              columnCount: trainingResult.columnCount,
              productRowCount: trainingResult.productRowCount,
              details: trainingResult.details,
            };
          } catch (trainErr) {
            console.warn('[PDFParser] Auto-training preview failed:', trainErr);
          }

          return resolve({
            trainingRequired: true,
            message: 'This invoice format is not recognized. Please train it first so the system can learn this format.',
            trainedPreview,
            // Pass back the buffer fingerprint for the train-template endpoint
            fingerprint: generateFingerprint(texts),
          });
        }

        // ── Step 2: Extract using matched template ──
        const hasGst = config.hsnSummaryHeaderText !== '';
        const format = hasGst ? 'gst_composite' : 'sales';

        const header = extractHeader(texts, config);
        console.log(`[PDFParser] Header: supplier=${header.supplier}, invoice=${header.invoiceNumber}, date=${header.date}`);

        const productResult = extractProductRows(texts, config);
        const rawProducts = productResult.products;
        console.log(`[PDFParser] Found ${rawProducts.length} product rows`);

        if (rawProducts.length === 0) {
          return resolve({
            error: `Could not extract any products from this invoice. The trained template may need retraining. DEBUG: ${productResult.debugInfo}`,
            invoiceNumber: header.invoiceNumber,
            supplier: header.supplier,
            products: [],
          });
        }

        const gstRates = extractGSTRates(texts, config);
        const taxTotals = extractTaxTotals(texts, hasGst);

        const products: ExtractedProduct[] = rawProducts.map(raw => {
          let { quantity, unit: rawUnit } = parseQuantityUnit(raw.quantityText);
          const unit = normalizeUnit(raw.perUnit || rawUnit);
          const gstRate = gstRates.get(raw.hsnCode) || 0;
          console.log(`DEBUG: raw.quantityText='${raw.quantityText}', parsed quantity=${quantity}, amount=${raw.amount}, rateTaxable=${raw.rateTaxable}, rateIncl=${raw.rateIncl}`);

          // Fallback: If quantity could not be parsed, calculate it using simple math
          if (quantity === 0 && raw.amount > 0) {
            if (raw.rateTaxable > 0) {
              const calculatedQty = Math.round(raw.amount / raw.rateTaxable);
              if (Math.abs(calculatedQty * raw.rateTaxable - raw.amount) < 5.0) {
                quantity = calculatedQty;
              }
            } else if (raw.rateIncl > 0) {
              const calculatedQty = Math.round(raw.amount / raw.rateIncl);
              if (Math.abs(calculatedQty * raw.rateIncl - raw.amount) < 5.0) {
                quantity = calculatedQty;
              }
            }
          }

          return {
            name: raw.description,
            sku: '',
            hsnCode: raw.hsnCode,
            quantity,
            unit,
            purchasePrice: raw.rateIncl,
            basePurchasePrice: raw.rateTaxable,
            lineTotal: raw.amount,
            gstRate,
          };
        });

        const subtotal = products.reduce((sum, p) => sum + p.lineTotal, 0);
        const validation = validateExtraction(products, taxTotals, hasGst);

        console.log(`[PDFParser] Validation: ${validation.passed ? 'PASSED' : 'FAILED'} — ${validation.details}`);

        resolve({
          invoiceNumber: header.invoiceNumber,
          supplier: header.supplier,
          supplierGstin: header.supplierGstin,
          purchaseDate: parseInvoiceDate(header.date),
          eWayBillNo: header.eWayBillNo,
          format,
          templateName,
          grandTotal: taxTotals.grandTotal,
          validationPassed: validation.passed,
          validationDetails: validation.details,
          products: products.map(p => ({
            name: p.name,
            sku: p.sku,
            hsnCode: p.hsnCode,
            quantity: p.quantity,
            unit: p.unit,
            purchasePrice: p.purchasePrice,
            basePurchasePrice: p.basePurchasePrice,
            lineTotal: p.lineTotal,
            gstRate: p.gstRate,
          })),
        });
      } catch (err) {
        console.error('[PDFParser] Extraction error:', err);
        reject(err);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}
