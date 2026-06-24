/**
 * BizFlow — ML Invoice Template Learner
 *
 * Trains invoice extraction templates from sample PDFs using:
 *   1. K-Means 1D Clustering — auto-discovers column positions
 *   2. Label Proximity Analysis — learns header field positions
 *   3. Table Boundary Detection — finds product table start/end
 *   4. Format Fingerprinting — creates unique signatures for template matching
 *
 * All ML runs locally. No external APIs. The "model" is a learned JSON config.
 */

import PDFParser from 'pdf2json';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TextElement {
  x: number;
  y: number;
  text: string;
  bold: boolean;
  fontSize: number;
}

/** The learned coordinate config — same shape as FormatConfig in pdf-parser.ts */
export interface LearnedFormatConfig {
  // Header positions (learned from label proximity)
  supplierNameMinX: number;
  supplierNameMaxX: number;
  supplierNameMinY: number;
  supplierNameMaxY: number;

  invoiceNoLabelText: string;
  invoiceNoValueMinX: number;
  invoiceNoValueMaxX: number;

  dateLabelText: string;
  dateValueMinX: number;

  // Product table columns (learned from K-means clustering)
  slNoMinX: number;
  slNoMaxX: number;
  descMinX: number;
  descMaxX: number;
  hsnMinX: number;
  hsnMaxX: number;
  qtyMinX: number;
  qtyMaxX: number;
  rateInclMinX: number;
  rateInclMaxX: number;
  rateTaxableMinX: number;
  rateTaxableMaxX: number;
  perUnitMinX: number;
  perUnitMaxX: number;
  amountMinX: number;
  amountMaxX: number;

  // Table boundaries (learned)
  tableHeaderText: string;
  tableStartYOffset: number;

  totalRowText: string;
  totalRowMinX: number;

  // GST summary (learned)
  hsnSummaryHeaderText: string;
  cgstRateMinX: number;
  cgstRateMaxX: number;
  sgstRateMinX: number;
  sgstRateMaxX: number;
}

export interface TrainingResult {
  config: LearnedFormatConfig;
  fingerprint: string;
  formatName: string;
  hasGst: boolean;
  columnCount: number;
  productRowCount: number;
  accuracy: number; // 0.0 - 1.0
  details: string;
}

export interface TemplateMatch {
  templateId: string;
  name: string;
  similarity: number;
  config: LearnedFormatConfig;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeDecode(str: string): string {
  try { return decodeURIComponent(str); } catch { return str; }
}

export function getTextElements(page: any): TextElement[] {
  if (!page?.Texts) return [];
  return page.Texts.map((t: any) => ({
    x: t.x as number,
    y: t.y as number,
    text: safeDecode((t.R || []).map((r: any) => r.T).join('')).trim(),
    bold: (t.R || []).some((r: any) => r.TS && r.TS[2] === 1),
    fontSize: t.R?.[0]?.TS?.[1] || 0,
  })).filter((t: TextElement) => t.text.length > 0);
}

export function parsePdfToPages(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, false);
    pdfParser.on("pdfParser_dataError", (e: any) => reject(e));
    pdfParser.on("pdfParser_dataReady", (data: any) => {
      if (!data?.Pages || data.Pages.length === 0) reject(new Error('PDF has no pages'));
      else resolve(data.Pages);
    });
    pdfParser.parseBuffer(buffer);
  });
}

// ── 1. K-Means 1D Clustering ─────────────────────────────────────────────────

/**
 * 1D K-Means clustering for column position detection.
 * Groups X-coordinates of text elements into K clusters.
 * Returns sorted cluster centers with their min/max ranges.
 */
export function kMeansCluster1D(
  values: number[],
  k: number,
  maxIterations = 50
): Array<{ center: number; min: number; max: number; count: number }> {
  if (values.length === 0) return [];
  if (values.length <= k) {
    return values.sort((a, b) => a - b).map(v => ({
      center: v, min: v - 0.5, max: v + 0.5, count: 1
    }));
  }

  // Initialize centers with K-means++ seeding
  const sorted = [...values].sort((a, b) => a - b);
  const centers: number[] = [];
  
  // First center: pick the value closest to the minimum
  centers.push(sorted[0]);
  
  // K-means++ remaining centers
  for (let c = 1; c < k; c++) {
    const distances = sorted.map(v => {
      const minDist = Math.min(...centers.map(ctr => Math.abs(v - ctr)));
      return minDist * minDist; // Distance squared
    });
    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) {
      // All remaining values are identical to existing centers
      centers.push(sorted[Math.floor(sorted.length * (c / k))]);
      continue;
    }
    let r = Math.random() * totalDist;
    let idx = 0;
    for (let i = 0; i < distances.length; i++) {
      r -= distances[i];
      if (r <= 0) { idx = i; break; }
    }
    centers.push(sorted[idx]);
  }

  // Iterate
  let assignments = new Array(values.length).fill(0);
  
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each value to nearest center
    const newAssignments = values.map(v => {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const dist = Math.abs(v - centers[c]);
        if (dist < bestDist) { bestDist = dist; bestIdx = c; }
      }
      return bestIdx;
    });

    // Check convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    
    if (!changed) break;

    // Recompute centers
    for (let c = 0; c < k; c++) {
      const clusterVals = values.filter((_, i) => assignments[i] === c);
      if (clusterVals.length > 0) {
        centers[c] = clusterVals.reduce((a, b) => a + b, 0) / clusterVals.length;
      }
    }
  }

  // Build cluster results with ranges
  const clusters = centers.map((center, idx) => {
    const clusterVals = values.filter((_, i) => assignments[i] === idx);
    if (clusterVals.length === 0) return { center, min: center - 0.5, max: center + 0.5, count: 0 };
    const min = Math.min(...clusterVals);
    const max = Math.max(...clusterVals);
    return {
      center: clusterVals.reduce((a, b) => a + b, 0) / clusterVals.length,
      min: min - 0.5,
      max: max + 0.5,
      count: clusterVals.length,
    };
  });

  // Sort by center position (left to right)
  return clusters.sort((a, b) => a.center - b.center).filter(c => c.count > 0);
}

// ── 2. Table Detection ───────────────────────────────────────────────────────

/** Known column header labels (used to identify columns) */
const COLUMN_HEADERS = [
  { key: 'sl', labels: ['Sl', 'S.No', 'Sr', 'No.', 'S.No.'] },
  { key: 'desc', labels: ['Description of Goods', 'Description', 'Particulars', 'Item'] },
  { key: 'hsn', labels: ['HSN/SAC', 'HSN', 'SAC'] },
  { key: 'qty', labels: ['Quantity', 'Qty'] },
  { key: 'rate', labels: ['Rate', 'Price'] },
  { key: 'per', labels: ['per', 'Per', 'Unit'] },
  { key: 'disc', labels: ['Disc. %', 'Disc', 'Discount'] },
  { key: 'amount', labels: ['Amount', 'Total', 'Value'] },
];

interface DetectedTable {
  headerY: number;
  firstDataY: number;
  endY: number;
  headerTexts: TextElement[];
}

/**
 * Detect the product table by finding the row of column headers.
 */
function detectTable(texts: TextElement[]): DetectedTable | null {
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);

  // Find "Sl" text — the leftmost column header, marks the start of the product table
  const slCandidates = sorted.filter(t =>
    t.text === 'Sl' && t.x < 4.0
  );

  if (slCandidates.length === 0) return null;

  // Use the first "Sl" occurrence
  const slHeader = slCandidates[0];
  const headerY = slHeader.y;

  // Find all texts on the header row (within ±0.5 Y tolerance)
  const headerTexts = sorted.filter(t =>
    Math.abs(t.y - headerY) < 0.5
  );

  // Find the first data row: look for a serial number "1" below the header
  const firstDataCandidates = sorted.filter(t =>
    t.text === '1' &&
    t.y > headerY + 0.5 &&
    t.y < headerY + 5.0 &&
    t.x < 4.0
  );

  const firstDataY = firstDataCandidates.length > 0
    ? firstDataCandidates[0].y
    : headerY + 2.0;

  // Find "Total" row — marks the end of the product table
  const totalCandidates = sorted.filter(t =>
    t.text === 'Total' &&
    t.y > firstDataY + 0.5 &&
    t.x > 4.0 // "Total" label is not in the Sl column
  );

  const endY = totalCandidates.length > 0 ? totalCandidates[0].y : 999;

  return { headerY, firstDataY, endY, headerTexts };
}

// ── 3. Column Learning ───────────────────────────────────────────────────────

interface LearnedColumn {
  key: string;     // 'sl', 'desc', 'hsn', 'qty', 'rate', 'rate2', 'per', 'amount'
  centerX: number;
  minX: number;
  maxX: number;
}

/**
 * Learn column positions from the product table.
 *
 * Strategy: Use column header X-positions as anchors, compute column
 * boundaries as midpoints between adjacent headers. Then refine
 * min/max using actual data text positions within each zone.
 *
 * This produces broad column zones (like "desc spans x=2.3 to x=8.5")
 * instead of the too-tight clusters that raw K-means gives.
 */
function learnColumns(texts: TextElement[], table: DetectedTable): LearnedColumn[] {
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);

  // Step 1: Identify column headers and their X-positions
  interface HeaderAnchor { key: string; x: number; text: string }
  const anchors: HeaderAnchor[] = [];

  for (const ht of table.headerTexts) {
    for (const col of COLUMN_HEADERS) {
      if (col.labels.some(l => ht.text.includes(l) || l.includes(ht.text))) {
        // Handle duplicate "Rate" columns
        if (col.key === 'rate') {
          if (anchors.some(a => a.key === 'rate')) {
            anchors.push({ key: 'rate2', x: ht.x, text: ht.text });
          } else {
            anchors.push({ key: 'rate', x: ht.x, text: ht.text });
          }
        } else if (col.key === 'sl' && anchors.some(a => a.key === 'sl')) {
          // Skip duplicate "No." for "Sl No."
          continue;
        } else {
          anchors.push({ key: col.key, x: ht.x, text: ht.text });
        }
        break;
      }
    }
  }

  // Filter out sub-labels like "(Incl. of Tax)"
  // Sort anchors by X position
  anchors.sort((a, b) => a.x - b.x);

  if (anchors.length < 3) return [];

  // Step 2: Compute column boundaries as midpoints between adjacent headers
  const columns: LearnedColumn[] = [];
  const pageMaxX = Math.max(...sorted.map(t => t.x)) + 1.0;

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    
    // Left boundary: midpoint between this header and previous, or 0.5 for first
    const leftBound = i > 0
      ? (anchors[i - 1].x + anchor.x) / 2
      : Math.max(0, anchor.x - 1.5);
    
    // Right boundary: midpoint between this header and next, or pageMaxX for last
    const rightBound = i < anchors.length - 1
      ? (anchor.x + anchors[i + 1].x) / 2
      : pageMaxX;

    columns.push({
      key: anchor.key,
      centerX: anchor.x,
      minX: leftBound,
      maxX: rightBound,
    });
  }

  // Step 3: Refine using actual data text positions
  // Get data rows for refinement
  const dataTexts = sorted.filter(t =>
    t.y >= table.firstDataY - 0.3 &&
    t.y < table.endY - 0.3
  );

  for (const col of columns) {
    // Find texts that fall within this column's range
    const colTexts = dataTexts.filter(t =>
      t.x >= col.minX && t.x <= col.maxX
    );

    if (colTexts.length > 0) {
      // Expand min/max to cover actual data positions (with padding)
      const actualMin = Math.min(...colTexts.map(t => t.x));
      const actualMax = Math.max(...colTexts.map(t => t.x));
      col.minX = Math.min(col.minX, actualMin - 0.3);
      col.maxX = Math.max(col.maxX, actualMax + 0.3);
    }
  }

  return columns;
}

// ── 4. Header Learning ───────────────────────────────────────────────────────

interface LearnedHeader {
  supplierNameX: number;
  supplierNameY: number;
  invoiceNoLabelX: number;
  invoiceNoLabelY: number;
  invoiceNoValueDeltaX: number;
  invoiceNoValueDeltaY: number;
  dateLabelX: number;
  dateLabelY: number;
  dateValueDeltaX: number;
  dateValueDeltaY: number;
  hasGst: boolean;
  hasEWayBill: boolean;
  titleText: string;
}

/**
 * Learn header field positions by finding known labels and measuring
 * the offset to their values.
 */
function learnHeader(texts: TextElement[]): LearnedHeader {
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);

  // Detect title
  const titleCandidates = sorted.filter(t => t.y < 2.0 && t.bold);
  let titleText = '';
  for (const t of titleCandidates) {
    if (t.text === 'I N V O I C E' || t.text === 'INVOICE') {
      titleText = t.text;
      break;
    }
  }

  // Find "Invoice No." label
  const invoiceLabel = sorted.find(t => t.text === 'Invoice No.');
  const invoiceNoLabelX = invoiceLabel?.x ?? 15;
  const invoiceNoLabelY = invoiceLabel?.y ?? 1.5;

  // Find invoice number value (below/beside label)
  let invoiceNoValueDeltaX = 0;
  let invoiceNoValueDeltaY = 0.6;
  if (invoiceLabel) {
    const valueCandidates = sorted.filter(t =>
      t.y > invoiceLabel.y && t.y < invoiceLabel.y + 1.2 &&
      Math.abs(t.x - invoiceLabel.x) < 3.0 &&
      t.text !== 'Invoice No.' &&
      !t.text.includes('e-Way') && !t.text.includes('Delivery') &&
      !t.text.includes('Bill No') && !/^\d{10,}$/.test(t.text)
    );
    if (valueCandidates.length > 0) {
      valueCandidates.sort((a, b) => Math.abs(a.x - invoiceLabel.x) - Math.abs(b.x - invoiceLabel.x));
      invoiceNoValueDeltaX = valueCandidates[0].x - invoiceLabel.x;
      invoiceNoValueDeltaY = valueCandidates[0].y - invoiceLabel.y;
    }
  }

  // Find "Dated" label
  const dateLabel = sorted.find(t => t.text === 'Dated' && t.y < 3.0);
  const dateLabelX = dateLabel?.x ?? 21;
  const dateLabelY = dateLabel?.y ?? 1.5;

  let dateValueDeltaX = 0;
  let dateValueDeltaY = 0.6;
  if (dateLabel) {
    const dateCandidates = sorted.filter(t =>
      t.y > dateLabel.y && t.y < dateLabel.y + 1.2 &&
      Math.abs(t.x - dateLabel.x) < 3.0 &&
      t.text !== 'Dated' && /\d/.test(t.text)
    );
    if (dateCandidates.length > 0) {
      dateValueDeltaX = dateCandidates[0].x - dateLabel.x;
      dateValueDeltaY = dateCandidates[0].y - dateLabel.y;
    }
  }

  // Find supplier name — first non-label text in the left column area, below the title
  const supplierCandidates = sorted.filter(t =>
    t.y > 1.0 && t.y < 3.0 &&
    t.x > 3.0 && t.x < 15.0 &&
    !t.text.includes('Invoice') && !t.text.includes('Dated') &&
    !t.text.includes('e-Way') && !t.text.includes('Bill No') &&
    t.text.length > 2 && !/^\d+$/.test(t.text)
  );
  const supplierNameX = supplierCandidates.length > 0 ? supplierCandidates[0].x : 5.5;
  const supplierNameY = supplierCandidates.length > 0 ? supplierCandidates[0].y : 1.8;

  // Check for GST — require "Output CGST" or "Output SGST" (tax line items)
  // Simple text like "CGST" in the HSN summary header is not enough
  const hasGst = sorted.some(t => t.text === 'Output CGST' || t.text === 'Output SGST');
  const hasEWayBill = sorted.some(t => t.text.includes('e-Way Bill'));

  return {
    supplierNameX, supplierNameY,
    invoiceNoLabelX, invoiceNoLabelY,
    invoiceNoValueDeltaX, invoiceNoValueDeltaY,
    dateLabelX, dateLabelY,
    dateValueDeltaX, dateValueDeltaY,
    hasGst, hasEWayBill, titleText,
  };
}

// ── 5. GST Summary Learning ──────────────────────────────────────────────────

interface LearnedGstSummary {
  hasGstTable: boolean;
  cgstRateCenterX: number;
  cgstRateMinX: number;
  cgstRateMaxX: number;
  sgstRateCenterX: number;
  sgstRateMinX: number;
  sgstRateMaxX: number;
}

/**
 * Learn GST rate column positions from the HSN summary table.
 */
function learnGstSummary(texts: TextElement[]): LearnedGstSummary {
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
  const NO_GST: LearnedGstSummary = { hasGstTable: false, cgstRateCenterX: 0, cgstRateMinX: 0, cgstRateMaxX: 0, sgstRateCenterX: 0, sgstRateMinX: 0, sgstRateMaxX: 0 };

  // Must have actual GST tax line items ("Output CGST"/"Output SGST")
  const hasGstTaxLines = sorted.some(t => t.text === 'Output CGST' || t.text === 'Output SGST');
  if (!hasGstTaxLines) return NO_GST;

  // Find the second "HSN/SAC" header (the summary table one, y > 30)
  const hsnHeaders = sorted.filter(t => t.text === 'HSN/SAC' && t.y > 30);
  
  if (hsnHeaders.length === 0) return NO_GST;

  const hsnHeaderY = hsnHeaders[0].y;

  // Find "CGST" and "SGST/UTGST" header labels near the HSN summary row
  const cgstHeader = sorted.find(t => t.text.includes('CGST') && !t.text.includes('SGST') && Math.abs(t.y - hsnHeaderY) < 0.5);
  const sgstHeader = sorted.find(t => t.text.includes('SGST') && Math.abs(t.y - hsnHeaderY) < 0.5);

  // Both CGST and SGST headers must exist for a valid GST summary table
  if (!cgstHeader && !sgstHeader) return NO_GST;

  // Find "Rate" labels that appear under CGST and SGST headers
  const rateLabels = sorted.filter(t =>
    t.text === 'Rate' &&
    t.y > hsnHeaderY && t.y < hsnHeaderY + 2.0
  );

  let cgstRateX = cgstHeader ? cgstHeader.x : 0;
  let sgstRateX = sgstHeader ? sgstHeader.x : 0;

  // Use Rate labels if available (they're more precise)
  if (rateLabels.length >= 2) {
    rateLabels.sort((a, b) => a.x - b.x);
    cgstRateX = rateLabels[0].x;
    sgstRateX = rateLabels[1].x;
  }

  // Find actual percentage values to determine range
  const percentTexts = sorted.filter(t =>
    t.text.includes('%') &&
    t.y > hsnHeaderY + 1.0 &&
    t.y < hsnHeaderY + 5.0
  );

  let cgstRateMinX = cgstRateX - 2.0;
  let cgstRateMaxX = cgstRateX + 2.0;
  let sgstRateMinX = sgstRateX - 2.0;
  let sgstRateMaxX = sgstRateX + 2.0;

  // Refine ranges from actual data
  if (percentTexts.length >= 2) {
    percentTexts.sort((a, b) => a.x - b.x);
    const cgstPcts = percentTexts.filter(t => Math.abs(t.x - cgstRateX) < Math.abs(t.x - sgstRateX));
    const sgstPcts = percentTexts.filter(t => Math.abs(t.x - sgstRateX) < Math.abs(t.x - cgstRateX));

    if (cgstPcts.length > 0) {
      cgstRateMinX = Math.min(...cgstPcts.map(t => t.x)) - 0.5;
      cgstRateMaxX = Math.max(...cgstPcts.map(t => t.x)) + 0.5;
      cgstRateX = cgstPcts.reduce((s, t) => s + t.x, 0) / cgstPcts.length;
    }
    if (sgstPcts.length > 0) {
      sgstRateMinX = Math.min(...sgstPcts.map(t => t.x)) - 0.5;
      sgstRateMaxX = Math.max(...sgstPcts.map(t => t.x)) + 0.5;
      sgstRateX = sgstPcts.reduce((s, t) => s + t.x, 0) / sgstPcts.length;
    }
  }

  return {
    hasGstTable: true,
    cgstRateCenterX: cgstRateX,
    cgstRateMinX, cgstRateMaxX,
    sgstRateCenterX: sgstRateX,
    sgstRateMinX, sgstRateMaxX,
  };
}

// ── 6. Format Fingerprinting ─────────────────────────────────────────────────

/**
 * Generate a fingerprint from the invoice structure.
 * Combines: title, column count, column spacing ratios, hasGst, header layout.
 * Fingerprint is a stable hash string for template matching.
 */
export function generateFingerprint(texts: TextElement[]): string {
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);

  // Title
  const title = sorted.find(t => t.y < 2.0 && t.bold)?.text || '';

  // Column headers present
  const headers = sorted.filter(t => t.y > 10 && t.y < 25);
  const hasHsn = headers.some(t => t.text.includes('HSN'));
  const hasDesc = headers.some(t => t.text.includes('Description'));
  const hasSl = headers.some(t => t.text === 'Sl');

  // GST presence
  const hasGst = sorted.some(t => t.text.includes('CGST') || t.text.includes('Output CGST'));
  const hasEWay = sorted.some(t => t.text.includes('e-Way'));

  // Supplier position zone (rough — left side vs centered)
  const supplierCandidates = sorted.filter(t =>
    t.y > 1.0 && t.y < 3.0 && t.x > 3.0 && t.x < 15.0 &&
    !t.text.includes('Invoice') && !t.text.includes('Dated') &&
    t.text.length > 2 && !/^\d+$/.test(t.text)
  );
  const supplierXZone = supplierCandidates.length > 0
    ? Math.round(supplierCandidates[0].x) : 0;

  // Build deterministic fingerprint
  const parts = [
    `title:${title.replace(/\s+/g, '')}`,
    `hasSl:${hasSl}`,
    `hasDesc:${hasDesc}`,
    `hasHsn:${hasHsn}`,
    `hasGst:${hasGst}`,
    `hasEWay:${hasEWay}`,
    `supplierZone:${supplierXZone}`,
  ];

  // Simple hash from fingerprint string
  const str = parts.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit int
  }
  return `tpl_${Math.abs(hash).toString(36)}_${hasGst ? 'gst' : 'nogst'}`;
}

// ── 7. Template Matching (Cosine Similarity) ─────────────────────────────────

/**
 * Compute similarity between an incoming PDF's features and a stored template.
 * Returns 0.0 - 1.0 (1.0 = perfect match).
 */
export function computeSimilarity(
  incomingTexts: TextElement[],
  templateFingerprint: string,
  templateConfig: LearnedFormatConfig
): number {
  const incomingFingerprint = generateFingerprint(incomingTexts);

  // Exact fingerprint match = highest confidence
  if (incomingFingerprint === templateFingerprint) return 1.0;

  // Feature vector comparison
  const sorted = [...incomingTexts].sort((a, b) => a.y - b.y || a.x - b.x);

  // Build feature vectors
  const incoming: number[] = [];
  const template: number[] = [];

  // Feature 1: Title type (INVOICE=0, I N V O I C E=1)
  const title = sorted.find(t => t.y < 2.0 && t.bold)?.text || '';
  incoming.push(title === 'I N V O I C E' ? 1 : 0);
  template.push(templateConfig.hsnSummaryHeaderText ? 1 : 0);

  // Feature 2: Supplier X position (normalized)
  const supplierCandidates = sorted.filter(t =>
    t.y > 1.0 && t.y < 3.0 && t.x > 3.0 && t.x < 15.0 &&
    !t.text.includes('Invoice') && !t.text.includes('Dated') &&
    t.text.length > 2 && !/^\d+$/.test(t.text)
  );
  const supplierX = supplierCandidates.length > 0 ? supplierCandidates[0].x / 30 : 0;
  incoming.push(supplierX);
  template.push(templateConfig.supplierNameMinX / 30);

  // Feature 3: Invoice No label X (normalized)
  const invLabel = sorted.find(t => t.text === 'Invoice No.');
  incoming.push(invLabel ? invLabel.x / 30 : 0.5);
  template.push(templateConfig.invoiceNoValueMinX / 30);

  // Feature 4: Has GST
  const hasGst = sorted.some(t => t.text.includes('Output CGST'));
  incoming.push(hasGst ? 1 : 0);
  template.push(templateConfig.cgstRateMinX > 0 ? 1 : 0);

  // Feature 5: HSN column position (normalized)
  const hsnHeader = sorted.find(t => t.text === 'HSN/SAC' && t.y > 10 && t.y < 25);
  incoming.push(hsnHeader ? hsnHeader.x / 30 : 0.3);
  template.push(templateConfig.hsnMinX / 30);

  // Feature 6: Amount column position (normalized)
  const amtHeader = sorted.find(t => t.text === 'Amount' && t.y > 10 && t.y < 25);
  incoming.push(amtHeader ? amtHeader.x / 30 : 0.8);
  template.push(templateConfig.amountMinX / 30);

  // Cosine similarity
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < incoming.length; i++) {
    dotProduct += incoming[i] * template[i];
    normA += incoming[i] * incoming[i];
    normB += template[i] * template[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

// ── 8. Main Training Function ────────────────────────────────────────────────

/**
 * Train a template from a sample PDF buffer.
 * Returns the learned FormatConfig and training metadata.
 */
export async function trainTemplate(pdfBuffer: Buffer): Promise<TrainingResult> {
  const pages = await parsePdfToPages(pdfBuffer);
  const texts = getTextElements(pages[0]);

  if (texts.length === 0) {
    throw new Error('No text found in PDF — cannot train');
  }

  // Step 1: Detect table structure
  const table = detectTable(texts);
  if (!table) {
    throw new Error('Could not detect product table in PDF — no "Sl" column header found');
  }

  // Step 2: Learn columns via K-means clustering
  const columns = learnColumns(texts, table);
  if (columns.length < 3) {
    throw new Error(`Only detected ${columns.length} columns — need at least 3`);
  }

  // Step 3: Learn header positions
  const header = learnHeader(texts);

  // Step 4: Learn GST summary
  const gstSummary = learnGstSummary(texts);

  // Step 5: Generate fingerprint
  const fingerprint = generateFingerprint(texts);

  // Step 6: Build FormatConfig from learned data
  const getCol = (key: string): LearnedColumn | undefined => columns.find(c => c.key === key);
  const sl = getCol('sl');
  const desc = getCol('desc');
  const hsn = getCol('hsn');
  const qty = getCol('qty');
  const rate = getCol('rate');
  const rate2 = getCol('rate2');
  const per = getCol('per');
  const amount = getCol('amount');

  // Compute supplier name zone from learned position
  // Cap maxX at invoiceNoLabelX - 1.0 to avoid capturing "Invoice No." text
  const supplierMargin = 2.0;
  const supplierMaxX = Math.min(header.supplierNameX + 10.0, header.invoiceNoLabelX - 1.0);
  
  const config: LearnedFormatConfig = {
    supplierNameMinX: header.supplierNameX - supplierMargin,
    supplierNameMaxX: supplierMaxX,
    supplierNameMinY: header.supplierNameY - 0.5,
    supplierNameMaxY: header.supplierNameY + 0.5,

    invoiceNoLabelText: 'Invoice No.',
    invoiceNoValueMinX: header.invoiceNoLabelX + header.invoiceNoValueDeltaX - 1.0,
    invoiceNoValueMaxX: header.invoiceNoLabelX + header.invoiceNoValueDeltaX + 3.0,

    dateLabelText: 'Dated',
    dateValueMinX: header.dateLabelX + header.dateValueDeltaX - 1.0,

    slNoMinX: sl?.minX ?? 1.0,
    slNoMaxX: sl?.maxX ?? 2.5,
    // Description starts right after Sl No column, not at the midpoint
    descMinX: (sl?.maxX ?? 2.3) + 0.1,
    descMaxX: desc?.maxX ?? (hsn?.minX ?? 8.5),
    hsnMinX: hsn?.minX ?? 8.0,
    hsnMaxX: hsn?.maxX ?? 12.0,
    qtyMinX: qty?.minX ?? 11.5,
    qtyMaxX: qty?.maxX ?? 15.0,
    rateInclMinX: rate?.minX ?? 14.5,
    rateInclMaxX: rate?.maxX ?? 18.0,
    rateTaxableMinX: rate2?.minX ?? (rate?.maxX ?? 17.5),
    rateTaxableMaxX: rate2?.maxX ?? 21.0,
    perUnitMinX: per?.minX ?? 20.0,
    perUnitMaxX: per?.maxX ?? 22.0,
    amountMinX: amount?.minX ?? 23.0,
    amountMaxX: amount?.maxX ?? 27.0,

    tableHeaderText: 'Sl',
    tableStartYOffset: table.firstDataY - table.headerY,

    totalRowText: 'Total',
    totalRowMinX: 5.0,

    hsnSummaryHeaderText: gstSummary.hasGstTable ? 'HSN/SAC' : '',
    cgstRateMinX: gstSummary.cgstRateMinX,
    cgstRateMaxX: gstSummary.cgstRateMaxX,
    sgstRateMinX: gstSummary.sgstRateMinX,
    sgstRateMaxX: gstSummary.sgstRateMaxX,
  };

  // ── Post-config refinement: tighten Sl/Desc boundary from actual data ──
  // The midpoint approach gives too-wide sl column; refine from actual serial numbers
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
  const actualSlNos = sorted.filter(t =>
    /^\d+$/.test(t.text) &&
    t.x >= config.slNoMinX && t.x <= config.slNoMaxX &&
    t.y >= table.firstDataY - 0.3 && t.y < table.endY &&
    parseInt(t.text) <= 999
  );

  if (actualSlNos.length > 0) {
    const maxSlX = Math.max(...actualSlNos.map(t => t.x));
    // Tighten slNoMaxX to actual serial number positions + small padding
    config.slNoMaxX = maxSlX + 0.3;
    // Description starts right after serial numbers
    config.descMinX = maxSlX + 0.4;
  }

  // Count product rows for metadata
  const productSlNos = sorted.filter(t =>
    /^\d+$/.test(t.text) &&
    t.x >= config.slNoMinX && t.x <= config.slNoMaxX &&
    t.y >= table.firstDataY - 0.3 && t.y < table.endY &&
    parseInt(t.text) <= 999
  );

  // Determine format name
  const formatName = header.hasGst
    ? `GST Invoice (${header.titleText || 'Unknown'})`
    : `Sales Invoice (${header.titleText || 'Unknown'})`;

  return {
    config,
    fingerprint,
    formatName,
    hasGst: header.hasGst,
    columnCount: columns.length,
    productRowCount: productSlNos.length,
    accuracy: 1.0, // Will be validated externally
    details: `Learned ${columns.length} columns, ${productSlNos.length} product rows. ` +
             `Columns: [${columns.map(c => c.key).join(', ')}]. ` +
             `GST: ${header.hasGst ? 'yes' : 'no'}. ` +
             `Table Y: ${table.headerY.toFixed(1)} → ${table.endY.toFixed(1)}.`,
  };
}
