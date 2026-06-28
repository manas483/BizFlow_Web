/**
 * Seed script: Insert 7 seed products for user sachan.manas483@gmail.com
 *
 * Run: node scripts/seed-seeds.mjs
 */
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const USER_EMAIL = "sachan.manas483@gmail.com";
const CATEGORY = "Seeds";
const UNIT = "pack";

const products = [
  { name: "Trump-162LS",          qty: 10, basePurchasePrice: 1000.00, transportCost: 0, unitsPerBag: 5 },
  { name: "Yashraj",              qty: 6,  basePurchasePrice: 510.00,  transportCost: 0, unitsPerBag: 6 },
  { name: "Pan 804 (Jamuna)",     qty: 12, basePurchasePrice: 730.00,  transportCost: 0, unitsPerBag: 6 },
  { name: "NP-7075",              qty: 12, basePurchasePrice: 672.00,  transportCost: 0, unitsPerBag: 6 },
  { name: "Vishal Gaurav",        qty: 12, basePurchasePrice: 600.00,  transportCost: 0, unitsPerBag: 6 },
  { name: "Sindhu",               qty: 8,  basePurchasePrice: 970.00,  transportCost: 0, unitsPerBag: 4 },
  { name: "Kalachampa Gold",      qty: 8,  basePurchasePrice: 760.00,  transportCost: 0, unitsPerBag: 4 },
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
    const purchasePrice = p.basePurchasePrice + p.transportCost;
    const id = generateCuid();

    try {
      await client.query(
        `INSERT INTO "Product" (
          id, name, sku, category, stock, "minStock",
          "purchasePrice", "basePurchasePrice", "transportCost",
          "sellingPrice", supplier, "businessId",
          "gstRate", unit, "unitsPerBag",
          "createdAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15,
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
          p.transportCost,          // transportCost
          0,                        // sellingPrice (blank/0)
          null,                     // supplier (TBD)
          businessId,               // businessId
          0,                        // gstRate
          UNIT,                     // unit
          p.unitsPerBag,            // unitsPerBag
        ]
      );

      console.log(`  ✅ Added: ${p.name} — ${p.qty} packs @ ₹${p.basePurchasePrice} + ₹${p.transportCost} = ₹${purchasePrice.toFixed(2)}`);
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
          source: "seed-seeds-script",
          count: successCount,
          category: CATEGORY,
        }),
      ]
    );
  } catch { /* non-critical */ }

  console.log(`\n🎉 Done! ${successCount}/${products.length} seed products added to inventory.`);
  await client.end();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
