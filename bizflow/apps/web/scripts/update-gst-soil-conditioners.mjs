/**
 * Script: Update GST rate to 5% for Soil Conditioners
 *
 * Run: node scripts/update-gst-soil-conditioners.mjs
 */
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const USER_EMAIL = "sachan.manas483@gmail.com";
const CATEGORY = "Soil Conditioners";
const GST_RATE = 5.0;

const targetProducts = [
  "Chemfree Vamax 4 KG",
  "Shaktiman Oorja (FCO) 1 KG",
  "Matix Zinc Sulphate (33%) 1 KG",
  "PROM (Prabhat) 50 KG",
];

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

  const { businessId } = userResult.rows[0];

  // 2. Update GST Rate
  const result = await client.query(
    `UPDATE "Product"
     SET "gstRate" = $1
     WHERE "businessId" = $2 AND "category" = $3 AND "name" = ANY($4)`,
    [GST_RATE, businessId, CATEGORY, targetProducts]
  );

  console.log(`✅ Successfully updated GST rate to 5% for ${result.rowCount} products.`);
  await client.end();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
