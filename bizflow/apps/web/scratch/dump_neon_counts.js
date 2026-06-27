const { Client } = require('pg');

const connectionString = "postgresql://neondb_owner:npg_9joCySKxm0Hi@ep-tiny-scene-aj1nynbc.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to Neon db successfully.");

    // Check if Business table exists
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Business'
      );
    `);
    
    if (!checkTable.rows[0].exists) {
      console.log("Business table does not exist in this database.");
      return;
    }

    // Query all businesses and their associated counts
    const query = `
      SELECT 
        b.id as business_id,
        b.name as business_name,
        b."ownerName" as owner_name,
        (SELECT COUNT(*)::int FROM "User" u WHERE u."businessId" = b.id) as users_count,
        (SELECT COUNT(*)::int FROM "Product" p WHERE p."businessId" = b.id) as products_count,
        (SELECT COUNT(*)::int FROM "Sale" s WHERE s."businessId" = b.id) as sales_count,
        (SELECT COUNT(*)::int FROM "Customer" c WHERE c."businessId" = b.id) as customers_count,
        (SELECT COUNT(*)::int FROM "Employee" e WHERE e."businessId" = b.id) as employees_count
      FROM "Business" b
      ORDER BY sales_count DESC;
    `;

    const res = await client.query(query);
    console.log("\n=== ALL BUSINESSES & COUNTS IN NEON DATABASE ===");
    console.log(JSON.stringify(res.rows, null, 2));

    // Also count all orphaned records
    console.log("\n=== ORPHANED RECORD COUNTS IN NEON DATABASE ===");
    for (const table of ["User", "Product", "Sale", "Customer", "Employee"]) {
      try {
        const resOrphan = await client.query(`
          SELECT COUNT(*)::int as count 
          FROM "${table}" t 
          WHERE t."businessId" NOT IN (SELECT id FROM "Business") OR t."businessId" IS NULL;
        `);
        console.log(`Orphaned ${table}s: ${resOrphan.rows[0].count}`);
      } catch (err) {
        console.log(`Table ${table} check failed: ${err.message}`);
      }
    }

  } catch (err) {
    console.error("Error running dump:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
