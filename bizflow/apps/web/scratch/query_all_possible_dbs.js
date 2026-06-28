const { Client } = require('pg');

const urls = {};
if (process.env.DATABASE_URL) {
  urls["Active Database (DATABASE_URL)"] = process.env.DATABASE_URL;
}

async function queryDb(name, url) {
  console.log(`\n=== Querying: ${name} ===`);
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Check if Business table exists
    const checkTableRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Business'
      );
    `);
    
    if (!checkTableRes.rows[0].exists) {
      console.log("Business table does not exist in this database.");
      return;
    }

    const query = `
      SELECT 
        b.id,
        b.name,
        b."ownerName",
        (SELECT COUNT(*)::int FROM "User" u WHERE u."businessId" = b.id) as users_count,
        (SELECT COUNT(*)::int FROM "Product" p WHERE p."businessId" = b.id) as products_count,
        (SELECT COUNT(*)::int FROM "Sale" s WHERE s."businessId" = b.id) as sales_count,
        (SELECT COUNT(*)::int FROM "Customer" c WHERE c."businessId" = b.id) as customers_count,
        (SELECT COUNT(*)::int FROM "Employee" e WHERE e."businessId" = b.id) as employees_count
      FROM "Business" b;
    `;
    
    const res = await client.query(query);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(`Error querying ${name}:`, err.message);
  } finally {
    await client.end();
  }
}

async function main() {
  for (const [name, url] of Object.entries(urls)) {
    await queryDb(name, url);
  }
}

main().catch(console.error);
