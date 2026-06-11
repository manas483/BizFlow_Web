/**
 * Seed script: Insert 8 fertilizer products for user sachan.manas483@gmail.com
 *
 * Run: node scripts/seed-fertilizers.mjs
 */
import pg from 'pg';

const DATABASE_URL = "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require";

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const USER_EMAIL = "sachan.manas483@gmail.com";
const PURCHASE_DATE = "2026-06-08T00:00:00.000Z"; // 8 June 2026
const PURCHASE_FROM = "AGROCHEM";
const PURCHASE_INVOICE_NO = "AGCMBPDF0274";
const TRANSPORT_COST = 0;
const CATEGORY = "Fertilizer";
const UNIT = "bag";
const SUPPLIER = "AGROCHEM";

const products = [
  { name: "Matix Urea 45 Kg",       qty: 20, basePurchasePrice: 260.00 },
  { name: "GR 28:28:0 50 Kg",       qty: 15, basePurchasePrice: 1890.00 },
  { name: "IPL DAP 50 Kg",          qty: 10, basePurchasePrice: 1345.00 },
  { name: "NR DAP 50 Kg",           qty: 10, basePurchasePrice: 1345.00 },
  { name: "GR 20:20:0:13 50 Kg",    qty: 20, basePurchasePrice: 1790.00 },
  { name: "NR 20:20:0:13 50 Kg",    qty: 20, basePurchasePrice: 1790.00 },
  { name: "IPL MOP 50 Kg",          qty: 25, basePurchasePrice: 1845.00 },
  { name: "NR TSP 46% 50 Kg",       qty: 10, basePurchasePrice: 1295.00 },
];

function generateCuid() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 12);
  return `c${timestamp}${random}`;
}

async function main() {
  await client.connect();
  console.log("Connected to database.");

  // 1. Find user by email
  const userResult = await client.query(
    `SELECT id, "businessId" FROM "User" WHERE email = $1`,
    [USER_EMAIL]
  );

  if (userResult.rows.length === 0) {
    console.error(`❌ User not found with email: ${USER_EMAIL}`);
    await client.end();
    process.exit(1);
  }

  const { id: userId, businessId } = userResult.rows[0];
  console.log(`✅ Found user: ${userId}, businessId: ${businessId}`);

  // 2. Insert products
  let successCount = 0;
  for (const p of products) {
    const purchasePrice = p.basePurchasePrice + TRANSPORT_COST;
    const id = generateCuid();

    try {
      await client.query(
        `INSERT INTO "Product" (
          id, name, sku, category, stock, "minStock",
          "purchasePrice", "basePurchasePrice", "transportCost",
          "sellingPrice", supplier, "businessId",
          "gstRate", unit,
          "purchaseDate", "purchaseFrom", "purchaseInvoiceNo",
          "createdAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12,
          $13, $14,
          $15, $16, $17,
          NOW()
        )`,
        [
          id,                       // id
          p.name,                   // name
          "",                       // sku (empty)
          CATEGORY,                 // category
          p.qty,                    // stock
          5,                        // minStock (default)
          purchasePrice,            // purchasePrice (After = Before + Transport)
          p.basePurchasePrice,      // basePurchasePrice (Before)
          TRANSPORT_COST,           // transportCost
          0,                        // sellingPrice (blank/0 as requested)
          SUPPLIER,                 // supplier
          businessId,               // businessId
          0,                        // gstRate
          UNIT,                     // unit
          PURCHASE_DATE,            // purchaseDate
          PURCHASE_FROM,            // purchaseFrom
          PURCHASE_INVOICE_NO,      // purchaseInvoiceNo
        ]
      );

      console.log(`  ✅ Added: ${p.name} — ${p.qty} bags @ ₹${p.basePurchasePrice} + ₹${TRANSPORT_COST} = ₹${purchasePrice.toFixed(2)}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Failed: ${p.name} — ${err.message}`);
    }
  }

  // 3. Log activity
  try {
    await client.query(
      `INSERT INTO "UserActivity" (id, "businessId", "userId", "eventType", metadata, "createdAt")
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        generateCuid(),
        businessId,
        userId,
        "inventory_bulk_seed",
        JSON.stringify({
          source: "seed-fertilizers-script",
          count: successCount,
          invoiceNo: PURCHASE_INVOICE_NO,
          supplier: PURCHASE_FROM,
        }),
      ]
    );
  } catch { /* non-critical */ }

  console.log(`\n🎉 Done! ${successCount}/${products.length} fertilizer products added to inventory.`);
  await client.end();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
