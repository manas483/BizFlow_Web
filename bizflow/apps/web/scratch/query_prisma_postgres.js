const { Client } = require('pg');

const connectionString = "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require";

async function runQuery() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  try {
    console.log('\n--- COUNTS BY BUSINESS ---');
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
    const resCounts = await client.query(query);
    console.log(JSON.stringify(resCounts.rows, null, 2));
    
  } finally {
    await client.end();
  }
}

async function main() {
  const maxRetries = 5;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      console.log(`Connection attempt ${i}/${maxRetries}...`);
      await runQuery();
      console.log('Success!');
      break;
    } catch (err) {
      console.error(`Attempt ${i} failed:`, err.message);
      if (i < maxRetries) {
        console.log('Waiting 3 seconds before next attempt...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.error('All connection attempts failed.');
      }
    }
  }
}

main().catch(console.error);
