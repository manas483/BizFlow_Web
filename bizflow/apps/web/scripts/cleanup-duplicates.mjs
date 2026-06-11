/**
 * Script: Clean up duplicate Soil Conditioners from Pesticides category
 *
 * Run: node scripts/cleanup-duplicates.mjs
 */
import pg from 'pg';

const DATABASE_URL = "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require";

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const USER_EMAIL = "sachan.manas483@gmail.com";
const WRONG_CATEGORY = "Pesticides";

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

  // 2. Delete the duplicates under Pesticides category
  const res = await client.query(
    `DELETE FROM "Product"
     WHERE "businessId" = $1 AND "category" = $2 AND "name" = ANY($3)`,
    [businessId, WRONG_CATEGORY, targetProducts]
  );

  console.log(`✅ Cleaned up: Deleted ${res.rowCount} duplicate products from the "${WRONG_CATEGORY}" category.`);
  
  await client.end();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
