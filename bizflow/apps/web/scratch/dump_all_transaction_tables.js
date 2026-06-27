const { Client } = require('pg');

const connectionString = "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require";

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to db.prisma.io successfully.");

    const businessId = "cmq585g2u0001q8952akgolz4"; // R. K SACHAN & SACHAN

    const tables = [
      "Sale",
      "BillOfSupply",
      "Quotation",
      "CashBookEntry",
      "JournalEntry",
      "Expense",
      "Customer"
    ];

    console.log(`\n=== RECORD COUNTS FOR BUSINESS ${businessId} ===`);
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*)::int as count FROM "${table}" WHERE "businessId" = $1;`, [businessId]);
      console.log(`${table}: ${res.rows[0].count}`);
    }

  } catch (err) {
    console.error("Error querying table counts:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
