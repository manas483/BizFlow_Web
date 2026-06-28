const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

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
