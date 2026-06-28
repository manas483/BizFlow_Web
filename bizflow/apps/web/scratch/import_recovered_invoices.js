/**
 * Clean up partial import and re-import correctly.
 * 
 * Product columns: id, name, sku, category, stock, minStock, reorderLevel, reservedStock,
 *   standardCost, sellingPrice, supplier, businessId, active, gstRate, hsnCode, unit, createdAt, updatedAt
 */
const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');
const { Client } = require('pg');

const CONNECTION_STRING = process.env.DATABASE_URL;
const BUSINESS_ID = "cmp0n1qvg000e2g950xr0tyj6"; // R K SACHAN & SONS

const INVOICES = [
  {
    path: "C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\Invoice-INV-2026-018_balaram-mohanta_2026-06-19_original.pdf",
    invoiceNo: "INV-2026-018",
    customerName: "Balaram Mohanta",
    customerPhone: "8984328645",
    date: "2026-06-19",
  },
  {
    path: "C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\Invoice-INV-2026-021_san-kanhu-murmu_2026-06-19_original (1).pdf",
    invoiceNo: "INV-2026-021",
    customerName: "San Kanhu Murmu",
    customerPhone: "0000000002",
    date: "2026-06-19",
  },
];

function safeDecode(str) { try { return decodeURIComponent(str); } catch { return str; } }
function parseNumber(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[^0-9.\-]/g, '')) || 0;
}

function parsePdf(buffer) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, false);
    parser.on("pdfParser_dataError", err => reject(new Error(err.parserError)));
    parser.on("pdfParser_dataReady", pdfData => {
      if (!pdfData?.Pages) return reject(new Error('No pages'));
      const texts = [];
      let yOffset = 0;
      for (const page of pdfData.Pages) {
        for (const t of page.Texts) {
          texts.push({ x: t.x, y: t.y + yOffset, text: safeDecode(t.R[0].T).trim() });
        }
        yOffset += page.Height || 100;
      }
      resolve(texts);
    });
    parser.parseBuffer(buffer);
  });
}

function groupIntoRows(texts) {
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = []; let currentRow = [], currentY = sorted[0]?.y || 0;
  for (const t of sorted) {
    if (Math.abs(t.y - currentY) > 0.5) {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = []; currentY = t.y;
    }
    currentRow.push(t);
  }
  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
}

function extractProducts(texts) {
  const rows = groupIntoRows(texts);
  const products = [];
  let tableEndY = 99999;
  for (const row of rows) {
    const textStr = row.map(t => t.text.toLowerCase()).join(' ');
    if (textStr.includes('total') || textStr.includes('rounded') || textStr.includes('amount chargeable')) {
      tableEndY = row[0].y - 0.5; break;
    }
  }
  for (const row of rows) {
    if (row[0].y > tableEndY) continue;
    const textsInRow = row.map(t => t.text);
    const hsnText = textsInRow.find(t => /^\d{4,8}$/.test(t) && t !== '2026' && t.length >= 4);
    const qtyRegex = /^(\d+)\s*(Nos|bags|pcs|kg|gm|ltr|ml|box|pack|pkt)s?$/i;
    const qtyText = textsInRow.find(t => qtyRegex.test(t));
    const numberTexts = textsInRow.filter(t => /^[\d,]+\.\d{2}$/.test(t));
    const numbers = numberTexts.map(parseNumber).sort((a, b) => a - b);
    if (hsnText && (qtyText || numbers.length >= 2)) {
      let quantity = 0, unit = 'pcs';
      if (qtyText) { const m = qtyText.match(qtyRegex); if (m) { quantity = parseInt(m[1]); unit = m[2]; } }
      let amount = numbers.length > 0 ? numbers[numbers.length - 1] : 0;
      let rateIncl = numbers.length > 1 ? numbers[numbers.length - 2] : amount;
      if (quantity === 0 && amount > 0 && rateIncl > 0) quantity = Math.round(amount / rateIncl);
      const unitMap = { 'nos': 'pcs', 'bags': 'bag', 'kgs': 'kg', 'ltr': 'ltr' };
      const norm = unitMap[unit.toLowerCase()] || unit.toLowerCase();
      const descTexts = textsInRow.filter(t =>
        t !== hsnText && t !== qtyText && !numberTexts.includes(t) &&
        !/^\d+$/.test(t) && !/^(Nos|bags|pcs|kg|gm|ltr|ml|box|pack|pkt)$/i.test(t)
      );
      products.push({ name: descTexts.join(' ').replace(/\|/g, '').trim(), hsnCode: hsnText, quantity: quantity || 1, unit: norm, price: rateIncl, lineTotal: amount, gstRate: 0 });
    } else if (products.length > 0 && numbers.length === 0 && !hsnText && !qtyText) {
      const textStr = textsInRow.join(' ').toLowerCase();
      if (!textStr.includes('continued') && !textStr.includes('computer generated') && !textStr.includes('authorised')) {
        const extra = textsInRow.filter(t => !/^\d+$/.test(t)).join(' ').replace(/\|/g, '').trim();
        if (extra) products[products.length - 1].name += ' ' + extra;
      }
    }
  }
  return products;
}

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let r = 'c'; for (let i = 0; i < 24; i++) r += chars[Math.floor(Math.random() * chars.length)]; return r;
}

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected.\n");

  // Step 0: Clean up partial import from previous run
  console.log("🧹 Cleaning up partial import...");
  
  // Delete the partially created sale (INV-2026-018 in this business)
  const partialSale = await client.query(
    `SELECT id FROM "Sale" WHERE "businessId" = $1 AND "invoiceNo" = 'INV-2026-018';`, [BUSINESS_ID]
  );
  if (partialSale.rows.length > 0) {
    const saleId = partialSale.rows[0].id;
    await client.query(`DELETE FROM "SaleItem" WHERE "saleId" = $1;`, [saleId]);
    await client.query(`DELETE FROM "Sale" WHERE id = $1;`, [saleId]);
    console.log(`  Deleted partial sale INV-2026-018 (${saleId})`);
  }
  
  // Delete the customer created by partial import
  const partialCustomer = await client.query(
    `SELECT id FROM "Customer" WHERE "businessId" = $1 AND name = 'Balaram Mohanta';`, [BUSINESS_ID]
  );
  if (partialCustomer.rows.length > 0) {
    await client.query(`DELETE FROM "Customer" WHERE id = $1;`, [partialCustomer.rows[0].id]);
    console.log(`  Deleted partial customer Balaram Mohanta (${partialCustomer.rows[0].id})`);
  }
  
  console.log("  ✅ Cleanup done.\n");

  // Process each invoice
  for (const invoice of INVOICES) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`IMPORTING: ${invoice.invoiceNo}`);
    console.log(`${"=".repeat(60)}`);

    // Check if already exists
    const exists = await client.query(
      `SELECT id FROM "Sale" WHERE "businessId" = $1 AND "invoiceNo" = $2;`, [BUSINESS_ID, invoice.invoiceNo]
    );
    if (exists.rows.length > 0) { console.log(`  ⚠️ Already exists, skipping.`); continue; }

    // Parse PDF
    const buffer = fs.readFileSync(invoice.path);
    const texts = await parsePdf(buffer);
    const products = extractProducts(texts);
    console.log(`  Parsed ${products.length} products:`);
    for (const p of products) console.log(`    → ${p.name} | Qty: ${p.quantity} | ₹${p.price} | Total: ₹${p.lineTotal}`);

    // Find or create customer
    let customerId;
    const existCust = await client.query(
      `SELECT id FROM "Customer" WHERE "businessId" = $1 AND name ILIKE $2;`, [BUSINESS_ID, invoice.customerName]
    );
    if (existCust.rows.length > 0) {
      customerId = existCust.rows[0].id;
      console.log(`  ✅ Found customer: ${customerId}`);
    } else {
      customerId = generateId();
      await client.query(
        `INSERT INTO "Customer" (id, name, phone, "businessId", status, dues, "totalPurchases", "createdAt")
         VALUES ($1, $2, $3, $4, 'active', 0, 0, NOW());`,
        [customerId, invoice.customerName, invoice.customerPhone, BUSINESS_ID]
      );
      console.log(`  ✅ Created customer: ${invoice.customerName} (${customerId})`);
    }

    // Create Sale
    const saleId = generateId();
    const grandTotal = products.reduce((sum, p) => sum + p.lineTotal, 0);
    await client.query(
      `INSERT INTO "Sale" (id, "invoiceNo", "customerId", total, paid, status, "businessId", "createdAt", "invoiceDate")
       VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7, $7);`,
      [saleId, invoice.invoiceNo, customerId, grandTotal, grandTotal, BUSINESS_ID, new Date(invoice.date)]
    );
    console.log(`  ✅ Created sale: ${invoice.invoiceNo} | ₹${grandTotal}`);

    // Create products and sale items
    for (const p of products) {
      // Try matching existing product
      let productId;
      const existProd = await client.query(
        `SELECT id FROM "Product" WHERE "businessId" = $1 AND name ILIKE $2;`,
        [BUSINESS_ID, `%${p.name.substring(0, 15)}%`]
      );
      if (existProd.rows.length > 0) {
        productId = existProd.rows[0].id;
        console.log(`    ✅ Matched product: ${p.name} → ${productId}`);
      } else {
        productId = generateId();
        const sku = `REC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        await client.query(
          `INSERT INTO "Product" (id, name, sku, category, stock, "minStock", "standardCost", "sellingPrice", "businessId", active, "gstRate", "hsnCode", unit, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 'General', 0, 5, 0, $4, $5, true, $6, $7, $8, NOW(), NOW());`,
          [productId, p.name, sku, p.price, BUSINESS_ID, p.gstRate, p.hsnCode || '', p.unit]
        );
        console.log(`    ✅ Created product: ${p.name} (${productId})`);
      }

      // Create SaleItem
      const saleItemId = generateId();
      await client.query(
        `INSERT INTO "SaleItem" (id, "saleId", "productId", qty, price, "purchasePrice", "gstRate", "hsnCode", discount, "productName", "productUnit")
         VALUES ($1, $2, $3, $4, $5, 0, $6, $7, 0, $8, $9);`,
        [saleItemId, saleId, productId, p.quantity, p.price, p.gstRate, p.hsnCode || '', p.name, p.unit]
      );
      console.log(`    ✅ Created sale item: ${p.name} x${p.quantity} @ ₹${p.price}`);
    }

    // Update customer totals
    await client.query(
      `UPDATE "Customer" SET "totalPurchases" = "totalPurchases" + $1 WHERE id = $2;`,
      [grandTotal, customerId]
    );
    console.log(`  ✅ Updated customer totalPurchases += ₹${grandTotal}`);
  }

  // Final verification
  console.log(`\n${"=".repeat(60)}`);
  console.log("FINAL VERIFICATION");
  console.log(`${"=".repeat(60)}`);
  const sales = await client.query(`SELECT COUNT(*)::int as c FROM "Sale" WHERE "businessId" = $1;`, [BUSINESS_ID]);
  const custs = await client.query(`SELECT COUNT(*)::int as c FROM "Customer" WHERE "businessId" = $1;`, [BUSINESS_ID]);
  const prods = await client.query(`SELECT COUNT(*)::int as c FROM "Product" WHERE "businessId" = $1;`, [BUSINESS_ID]);
  console.log(`"R K SACHAN & SONS" now has:`);
  console.log(`  Sales: ${sales.rows[0].c}`);
  console.log(`  Customers: ${custs.rows[0].c}`);
  console.log(`  Products: ${prods.rows[0].c}`);

  // Overall DB totals
  const totalSales = await client.query(`SELECT COUNT(*)::int as c FROM "Sale";`);
  const totalCustomers = await client.query(`SELECT COUNT(*)::int as c FROM "Customer";`);
  const totalProducts = await client.query(`SELECT COUNT(*)::int as c FROM "Product";`);
  console.log(`\nOverall DB totals:`);
  console.log(`  Sales: ${totalSales.rows[0].c}`);
  console.log(`  Customers: ${totalCustomers.rows[0].c}`);
  console.log(`  Products: ${totalProducts.rows[0].c}`);

  await client.end();
  console.log("\n✅ Import complete!");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
