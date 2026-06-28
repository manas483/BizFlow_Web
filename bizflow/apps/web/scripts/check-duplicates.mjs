import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const userRes = await client.query('SELECT id, "businessId" FROM "User" WHERE email = $1', ['sachan.manas483@gmail.com']);
  if (userRes.rows.length === 0) {
    console.log("User not found.");
    await client.end();
    return;
  }
  const { businessId } = userRes.rows[0];
  
  const productsRes = await client.query('SELECT id, name, category, stock, "purchasePrice", "hsnCode", "gstRate" FROM "Product" WHERE "businessId" = $1 ORDER BY name, category', [businessId]);
  console.log(`\nFound ${productsRes.rows.length} products:`);
  console.table(productsRes.rows);
  
  await client.end();
}

main().catch(console.error);
