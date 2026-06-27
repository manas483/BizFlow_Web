/**
 * Parse ALL unique PDF invoices found on disk and cross-reference
 * with existing sales in db.prisma.io to identify what can be recovered.
 */
const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');
const { Client } = require('pg');

const CONNECTION_STRING = "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require";

// ── All unique PDF invoice paths (deduplicated) ──────────────────────────────
const ALL_PDFS = [
  // BizFlow-generated invoices (Invoice-INV-*)
  { path: "C:\\Users\\sacha\\Downloads\\Invoice-INV-2026-001_pratyush_2026-05-15_original.pdf", type: "bizflow" },
  { path: "C:\\Users\\sacha\\Downloads\\Invoice-INV-2026-002_manas-ranjan-singdev-sachan_2026-05-14_original.pdf", type: "bizflow" },
  { path: "C:\\Users\\sacha\\Downloads\\Invoice-INV-2026-003_pratik-kumar-singhdev-sachan_2026-05-19_original.pdf", type: "bizflow" },
  { path: "C:\\Users\\sacha\\Downloads\\invoice-INV-2026-005.pdf", type: "bizflow" },
  { path: "C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\Invoice-INV-2026-018_balaram-mohanta_2026-06-19_original.pdf", type: "bizflow" },
  { path: "C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\Invoice-INV-2026-021_san-kanhu-murmu_2026-06-19_original (1).pdf", type: "bizflow" },
  
  // External GST/Sales invoices (purchase invoices from suppliers)
  { path: "C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\invoices\\GST Invoice - Composite_AGCMBPDC0253.pdf", type: "external" },
  { path: "C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\invoices\\GST Invoice - Composite_AGCMBPDF0274.pdf", type: "external" },
  { path: "C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\invoices\\GST Invoice - Composite_AGCMBPDSND0126.pdf", type: "external" },
  { path: "C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\invoices\\Sales_ASDBPDS0277.pdf", type: "external" },
  { path: "C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\invoices\\Sales_ASDBPDS0278.pdf", type: "external" },
  { path: "C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\invoices\\Sales_ASDBPDS0397.pdf", type: "external" },
  { path: "C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\invoices\\Sales_ASDBPDS0434.pdf", type: "external" },
];

// ── PDF parsing helpers ──────────────────────────────────────────────────────
function safeDecode(str) {
  try { return decodeURIComponent(str); } catch { return str; }
}

function parseNumber(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[^0-9.\-]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function sameRow(y1, y2, tolerance = 0.3) {
  return Math.abs(y1 - y2) < tolerance;
}

function parsePdf(buffer) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, false);
    parser.on("pdfParser_dataError", err => reject(new Error(err.parserError)));
    parser.on("pdfParser_dataReady", pdfData => {
      if (!pdfData?.Pages || pdfData.Pages.length === 0) {
        return reject(new Error('PDF has no pages'));
      }
      const texts = [];
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
      resolve(texts);
    });
    parser.parseBuffer(buffer);
  });
}

function extractInvoiceData(texts) {
  const fullText = texts.map(t => t.text).join(' ');
  const fullTextLower = fullText.toLowerCase();
  
  // Invoice number
  let invoiceNumber = '';
  const invPatterns = [
    /INV-\d{4}-\d{3}/i,
    /\b(AGCMBP[A-Z0-9]+)\b/i,
    /\b(ASDBP[A-Z0-9]+)\b/i,
  ];
  for (const pat of invPatterns) {
    const m = fullText.match(pat);
    if (m) { invoiceNumber = m[0]; break; }
  }
  
  // Date
  let invoiceDate = '';
  const dateMatch = fullText.match(/\b(\d{1,2}-[A-Za-z]{3}-\d{2,4})\b/);
  if (dateMatch) invoiceDate = dateMatch[1];
  const dateMatch2 = fullText.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
  if (!invoiceDate && dateMatch2) invoiceDate = dateMatch2[1];
  
  // Customer name (for BizFlow invoices, look for "Bill To" or customer name)
  let customerName = '';
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
  const billToLabel = sorted.find(t => t.text.toLowerCase().includes('bill to') || t.text.toLowerCase().includes('customer'));
  if (billToLabel) {
    const nameCandidate = sorted.find(t => 
      t.y > billToLabel.y && t.y < billToLabel.y + 3 && 
      /[a-zA-Z]/.test(t.text) && t.text.length > 2 &&
      !t.text.toLowerCase().includes('address') &&
      !t.text.toLowerCase().includes('phone') &&
      !t.text.toLowerCase().includes('gstin')
    );
    if (nameCandidate) customerName = nameCandidate.text;
  }
  
  // Supplier name
  let supplier = '';
  for (const t of sorted) {
    if (
      t.y < 15 && t.text.length > 5 && /[a-zA-Z]/.test(t.text) && t.text.includes(' ') &&
      !t.text.toLowerCase().includes('gstin') && !t.text.toLowerCase().includes('invoice') &&
      !t.text.toLowerCase().includes('original') && !t.text.toLowerCase().includes('duplicate')
    ) {
      supplier = t.text;
      break;
    }
  }
  
  // Grand total
  let grandTotal = 0;
  const allNumbers = texts.filter(t => /^[\d,]+\.\d{2}$/.test(t.text)).map(t => parseNumber(t.text));
  if (allNumbers.length > 0) grandTotal = Math.max(...allNumbers);
  
  // Count product lines (lines with HSN codes)
  const rows = groupIntoRows(texts);
  let productCount = 0;
  for (const row of rows) {
    const textsInRow = row.map(t => t.text);
    const hsnText = textsInRow.find(t => /^\d{4,8}$/.test(t) && t !== '2026' && t.length >= 4);
    const qtyRegex = /^(\d+)\s*(Nos|bags|pcs|kg|gm|ltr|ml|box|pack|pkt)s?$/i;
    const qtyText = textsInRow.find(t => qtyRegex.test(t));
    const numberTexts = textsInRow.filter(t => /^[\d,]+\.\d{2}$/.test(t));
    if (hsnText && (qtyText || numberTexts.length >= 2)) productCount++;
  }
  
  // Check for GST
  const hasGst = fullTextLower.includes('cgst') || fullTextLower.includes('sgst');
  
  return {
    invoiceNumber,
    invoiceDate,
    customerName,
    supplier,
    grandTotal,
    productCount,
    hasGst,
    textSample: fullText.substring(0, 500)
  };
}

function groupIntoRows(texts) {
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  let currentRow = [];
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

async function main() {
  console.log("=" .repeat(80));
  console.log("PDF INVOICE PARSER & DATABASE CROSS-REFERENCE");
  console.log("=" .repeat(80));
  
  // ── Step 1: Query existing sales from db.prisma.io ──
  console.log("\n📊 Step 1: Querying existing sales from db.prisma.io...\n");
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const salesRes = await client.query(`
    SELECT s.id, s."invoiceNo", s.total, s.status, s."createdAt", s."businessId",
           c.name as "customerName", c.phone as "customerPhone",
           b.name as "businessName"
    FROM "Sale" s
    LEFT JOIN "Customer" c ON s."customerId" = c.id
    LEFT JOIN "Business" b ON s."businessId" = b.id
    ORDER BY s."createdAt" DESC;
  `);
  
  console.log(`Found ${salesRes.rows.length} existing sales in database:`);
  for (const sale of salesRes.rows) {
    console.log(`  [${sale.invoiceNo}] ₹${sale.total} | Customer: ${sale.customerName} | Business: ${sale.businessName} | ${sale.createdAt.toISOString().split('T')[0]}`);
  }
  
  const existingInvoiceNos = new Set(salesRes.rows.map(s => s.invoiceNo.toUpperCase()));
  
  // Also query existing customers
  const customersRes = await client.query(`
    SELECT id, name, phone, email, "businessId", "totalPurchases", dues
    FROM "Customer"
    ORDER BY name;
  `);
  console.log(`\nFound ${customersRes.rows.length} existing customers:`);
  for (const cust of customersRes.rows) {
    console.log(`  ${cust.name} | Phone: ${cust.phone} | Purchases: ₹${cust.totalPurchases} | Dues: ₹${cust.dues}`);
  }
  
  await client.end();
  
  // ── Step 2: Parse all PDFs ──
  console.log("\n\n📄 Step 2: Parsing all PDF invoices...\n");
  
  const parsed = [];
  for (const pdfInfo of ALL_PDFS) {
    if (!fs.existsSync(pdfInfo.path)) {
      console.log(`  ❌ File not found: ${path.basename(pdfInfo.path)}`);
      continue;
    }
    
    try {
      const buffer = fs.readFileSync(pdfInfo.path);
      const texts = await parsePdf(buffer);
      const data = extractInvoiceData(texts);
      data.filePath = pdfInfo.path;
      data.type = pdfInfo.type;
      data.fileName = path.basename(pdfInfo.path);
      parsed.push(data);
      
      const alreadyInDb = existingInvoiceNos.has(data.invoiceNumber.toUpperCase());
      const status = alreadyInDb ? '🟢 ALREADY IN DB' : '🔴 NOT IN DB - CAN IMPORT';
      
      console.log(`  ${status}`);
      console.log(`    File: ${data.fileName}`);
      console.log(`    Type: ${data.type}`);
      console.log(`    Invoice#: ${data.invoiceNumber}`);
      console.log(`    Date: ${data.invoiceDate}`);
      console.log(`    Customer: ${data.customerName || 'N/A'}`);
      console.log(`    Supplier: ${data.supplier || 'N/A'}`);
      console.log(`    Grand Total: ₹${data.grandTotal}`);
      console.log(`    Products: ${data.productCount} items`);
      console.log(`    Has GST: ${data.hasGst}`);
      console.log('');
    } catch (err) {
      console.log(`  ❌ Error parsing ${path.basename(pdfInfo.path)}: ${err.message}`);
    }
  }
  
  // ── Summary ──
  console.log("\n" + "=" .repeat(80));
  console.log("SUMMARY");
  console.log("=" .repeat(80));
  console.log(`Total PDFs parsed: ${parsed.length}`);
  console.log(`Existing sales in DB: ${salesRes.rows.length}`);
  
  const canImport = parsed.filter(p => !existingInvoiceNos.has(p.invoiceNumber.toUpperCase()));
  const alreadyExists = parsed.filter(p => existingInvoiceNos.has(p.invoiceNumber.toUpperCase()));
  
  console.log(`PDFs already in DB: ${alreadyExists.length}`);
  console.log(`PDFs available for import: ${canImport.length}`);
  
  if (canImport.length > 0) {
    console.log("\nInvoices that can be imported:");
    for (const inv of canImport) {
      console.log(`  → ${inv.invoiceNumber} | ₹${inv.grandTotal} | ${inv.productCount} items | ${inv.fileName}`);
    }
  }
}

main().catch(console.error);
