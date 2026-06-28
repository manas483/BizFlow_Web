const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function main() {
  console.log('Connecting to db.prisma.io...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  try {
    const query = `
      SELECT 
        b.id,
        b.name,
        b."ownerName",
        (SELECT COUNT(*)::int FROM "User" u WHERE u."businessId" = b.id) as users_count,
        (SELECT string_agg(u.email, ', ') FROM "User" u WHERE u."businessId" = b.id) as user_emails,
        (SELECT COUNT(*)::int FROM "Product" p WHERE p."businessId" = b.id) as products_count,
        (SELECT COUNT(*)::int FROM "Sale" s WHERE s."businessId" = b.id) as sales_count,
        (SELECT COUNT(*)::int FROM "Customer" c WHERE c."businessId" = b.id) as customers_count,
        (SELECT COUNT(*)::int FROM "Employee" e WHERE e."businessId" = b.id) as employees_count
      FROM "Business" b;
    `;
    
    console.log('Running combined query...');
    const res = await client.query(query);
    console.log('--- COUNTS BY BUSINESS IN DB.PRISMA.IO ---');
    console.log(JSON.stringify(res.rows, null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
