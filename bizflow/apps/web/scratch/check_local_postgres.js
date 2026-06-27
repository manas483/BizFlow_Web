const { Client } = require('pg');

const urls = [
  "postgresql://postgres:postgres@localhost:5432/bizflow_test",
  "postgresql://postgres:postgres@localhost:5432/bizflow",
  "postgresql://postgres:postgres@localhost:5432/postgres",
  "postgresql://postgres:postgres@localhost:5432/neondb"
];

async function checkUrl(url) {
  console.log(`\nChecking connection to: ${url}`);
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    console.log("  Successfully connected!");
    
    // Check tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log("  Tables found:", tables.join(', '));
    
    if (tables.includes('Business')) {
      const bizRes = await client.query('SELECT id, name, "ownerName" FROM "Business";');
      console.log("  Businesses:", JSON.stringify(bizRes.rows, null, 2));
      
      for (const biz of bizRes.rows) {
        const productCount = await client.query('SELECT COUNT(*) FROM "Product" WHERE "businessId" = $1', [biz.id]);
        const salesCount = await client.query('SELECT COUNT(*) FROM "Sale" WHERE "businessId" = $1', [biz.id]);
        const customerCount = await client.query('SELECT COUNT(*) FROM "Customer" WHERE "businessId" = $1', [biz.id]);
        console.log(`  - Business "${biz.name}": Products=${productCount.rows[0].count}, Sales=${salesCount.rows[0].count}, Customers=${customerCount.rows[0].count}`);
      }
    }
  } catch (err) {
    console.log(`  Failed to connect: ${err.message}`);
  } finally {
    try {
      await client.end();
    } catch(e) {}
  }
}

async function main() {
  for (const url of urls) {
    await checkUrl(url);
  }
}

main().catch(console.error);
