const { Client } = require('pg');

const urls = {
  "Prisma Postgres": "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require",
  "Neon Project restless-glitter (production)": "postgresql://neondb_owner:npg_LzZK7qv3UAJV@ep-damp-feather-aqe6k0jz.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require",
  "Neon Project billowing-sun (main - current .env)": "postgresql://neondb_owner:npg_9joCySKxm0Hi@ep-tiny-scene-aj1nynbc.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require",
  "Neon Project billowing-sun (WAC test commit pwd)": "postgresql://neondb_owner:npg_VIc7akHMWOb0@ep-tiny-scene-aj1nynbc.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require"
};

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
