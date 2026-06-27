const { Client } = require('pg');

const connectionString = "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require";

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to db.prisma.io.");

    const res = await client.query(
      'SELECT id, name, category, stock, "sellingPrice" FROM "Product" WHERE "businessId" = $1;',
      ['cmq585g2u0001q8952akgolz4']
    );

    console.log("\n=== PRODUCTS FOR R. K SACHAN & SACHAN ===");
    for (const row of res.rows) {
      console.log(`- ${row.name} | Category: ${row.category} | Stock: ${row.stock} | Selling Price: ₹${row.sellingPrice}`);
    }

  } catch (err) {
    console.error("Error querying products:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
