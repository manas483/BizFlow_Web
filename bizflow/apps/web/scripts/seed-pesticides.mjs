/**
 * Seed script: Insert 2 pesticide products for user sachan.manas483@gmail.com
 *
 * Run: node scripts/seed-pesticides.mjs
 */
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const USER_EMAIL = "sachan.manas483@gmail.com";
const CATEGORY = "Pesticides";

const products = [
  { name: "Nashak 500 ml", qty: 20, hsn: "38089390", gst: 18.0, basePrice: 233.05, unit: "pcs" },
  { name: "Nashak 250 ml", qty: 40, hsn: "38089390", gst: 18.0, basePrice: 127.12, unit: "pcs" },
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
    const id = generateCuid();

    try {
      await client.query(
        `INSERT INTO "Product" (
          id, name, sku, category, stock, "minStock",
          "purchasePrice", "basePurchasePrice", "transportCost",
          "sellingPrice", supplier, "businessId",
          "gstRate", "hsnCode", unit,
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
          p.basePrice,              // purchasePrice (After = Before + Transport)
          p.basePrice,              // basePurchasePrice (Before)
          0,                        // transportCost
          0,                        // sellingPrice (blank/0)
          null,                     // supplier
          businessId,               // businessId
          p.gst,                    // gstRate
          p.hsn,                    // hsnCode
          p.unit,                   // unit
        ]
      );

      console.log(`  ✅ Added: ${p.name} — ${p.qty} packs @ ₹${p.basePrice} (HSN: ${p.hsn}, GST: ${p.gst}%)`);
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
          source: "seed-pesticides-script",
          count: successCount,
          category: CATEGORY,
        }),
      ]
    );
  } catch { /* non-critical */ }

  console.log(`\n🎉 Done! ${successCount}/${products.length} pesticides added to inventory.`);
  await client.end();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
