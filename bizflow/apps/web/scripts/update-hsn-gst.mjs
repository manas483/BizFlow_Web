/**
 * Script: Update HSN and GST for fertilizers and seeds
 *
 * Run: node scripts/update-hsn-gst.mjs
 */
import pg from 'pg';

const DATABASE_URL = "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require";

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const USER_EMAIL = "sachan.manas483@gmail.com";

const fertilizerUpdates = [
  { name: "Matix Urea 45 Kg",       hsn: "31021000", gst: 5.0 },
  { name: "GR 28:28:0 50 Kg",      hsn: "31055100", gst: 5.0 },
  { name: "IPL DAP 50 Kg",         hsn: "31053000", gst: 5.0 },
  { name: "NR DAP 50 Kg",          hsn: "31053000", gst: 5.0 },
  { name: "GR 20:20:0:13 50 Kg",   hsn: "31055100", gst: 5.0 },
  { name: "NR 20:20:0:13 50 Kg",   hsn: "31055900", gst: 5.0 },
  { name: "IPL MOP 50 Kg",         hsn: "31042000", gst: 5.0 },
  { name: "NR TSP 46% 50 Kg",      hsn: "31031100", gst: 5.0 },
];

const seedUpdates = [
  { name: "Trump-162LS",          hsn: "12099990", gst: 0.0 },
  { name: "Yashraj",              hsn: "12099990", gst: 0.0 },
  { name: "Pan 804 (Jamuna)",     hsn: "100610",   gst: 0.0 },
  { name: "NP-7075",              hsn: "120999",   gst: 0.0 },
  { name: "Vishal Gaurav",        hsn: "12099990", gst: 0.0 },
  { name: "Sindhu",               hsn: "12099990", gst: 0.0 },
  { name: "Kalachampa Gold",      hsn: "12099990", gst: 0.0 },
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

  console.log("Starting updates...");

  // 2. Update Fertilizers
  let fertilizerCount = 0;
  for (const item of fertilizerUpdates) {
    const res = await client.query(
      `UPDATE "Product"
       SET "hsnCode" = $1, "gstRate" = $2
       WHERE "businessId" = $3 AND "category" = 'Fertilizer' AND "name" = $4`,
      [item.hsn, item.gst, businessId, item.name]
    );
    if (res.rowCount > 0) fertilizerCount++;
  }
  console.log(`Updated ${fertilizerCount}/${fertilizerUpdates.length} fertilizers.`);

  // 3. Update Seeds
  let seedCount = 0;
  for (const item of seedUpdates) {
    const res = await client.query(
      `UPDATE "Product"
       SET "hsnCode" = $1, "gstRate" = $2
       WHERE "businessId" = $3 AND "category" = 'Seeds' AND "name" = $4`,
      [item.hsn, item.gst, businessId, item.name]
    );
    if (res.rowCount > 0) seedCount++;
  }
  console.log(`Updated ${seedCount}/${seedUpdates.length} seeds.`);

  await client.end();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
