/**
 * Script: Rename category 'Fertilizer' to 'Fertilizers' in the database
 *
 * Run: node scripts/rename-fertilizer-category.mjs
 */
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const USER_EMAIL = "sachan.manas483@gmail.com";

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

  // 2. Update category from Fertilizer to Fertilizers
  const res = await client.query(
    `UPDATE "Product"
     SET "category" = 'Fertilizers'
     WHERE "businessId" = $1 AND "category" = 'Fertilizer'`,
    [businessId]
  );

  console.log(`✅ Successfully updated ${res.rowCount} products from category 'Fertilizer' to 'Fertilizers'.`);
  await client.end();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
