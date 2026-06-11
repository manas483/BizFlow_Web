/**
 * Seed script: Insert 4 soil conditioner products for user sachan.manas483@gmail.com
 *
 * Run: node scripts/seed-soil-conditioners.mjs
 */
import pg from 'pg';

const DATABASE_URL = "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require";

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const USER_EMAIL = "sachan.manas483@gmail.com";
const CATEGORY = "Soil Conditioners";

const products = [
  { name: "Chemfree Vamax 4 KG",             hsn: "31010099", qty: 18, unit: "pcs", price: 550.00 },
  { name: "Shaktiman Oorja (FCO) 1 KG",      hsn: "31010099", qty: 25, unit: "pcs", price: 90.00 },
  { name: "Matix Zinc Sulphate (33%) 1 KG",  hsn: "28332990", qty: 20, unit: "pcs", price: 190.00 },
  { name: "PROM (Prabhat) 50 KG",            hsn: "31010099", qty: 5,  unit: "bag", price: 1250.00 },
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
          p.price,                  // purchasePrice (After)
          p.price,                  // basePurchasePrice (Before)
          0,                        // transportCost (0)
          0,                        // sellingPrice (blank/0)
          null,                     // supplier
          businessId,               // businessId
          0,                        // gstRate
          p.hsn,                    // hsnCode
          p.unit,                   // unit
        ]
      );

      console.log(`  ✅ Added: ${p.name} (HSN: ${p.hsn}) — ${p.qty} ${p.unit} @ ₹${p.price}`);
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
          source: "seed-soil-conditioners-script",
          count: successCount,
          category: CATEGORY,
        }),
      ]
    );
  } catch { /* non-critical */ }

  console.log(`\n🎉 Done! ${successCount}/${products.length} soil conditioners added to inventory.`);
  await client.end();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
