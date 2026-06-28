const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to restless-glitter-34381474 'postgres' database successfully.");

    // Check if tables exist in public schema
    const resTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
    console.log("Tables in public schema:", resTables.rows.map(r => r.table_name));

    if (resTables.rows.some(r => r.table_name === 'User')) {
      const resUsers = await client.query('SELECT id, email, name, "businessId" FROM "User"');
      console.log(`=== TOTAL USERS: ${resUsers.rows.length} ===`);
      
      for (const u of resUsers.rows) {
        console.log(`\nUser: ${u.email} (${u.name || 'No Name'})`);
        if (u.businessId) {
          const resBiz = await client.query('SELECT name FROM "Business" WHERE id = $1', [u.businessId]);
          const bizName = resBiz.rows[0]?.name || 'Unknown Business';
          
          const products = await client.query('SELECT COUNT(*)::int FROM "Product" WHERE "businessId" = $1', [u.businessId]).catch(() => ({ rows: [{ count: 0 }] }));
          const customers = await client.query('SELECT COUNT(*)::int FROM "Customer" WHERE "businessId" = $1', [u.businessId]).catch(() => ({ rows: [{ count: 0 }] }));
          const sales = await client.query('SELECT COUNT(*)::int FROM "Sale" WHERE "businessId" = $1', [u.businessId]).catch(() => ({ rows: [{ count: 0 }] }));
          const expenses = await client.query('SELECT COUNT(*)::int FROM "Expense" WHERE "businessId" = $1', [u.businessId]).catch(() => ({ rows: [{ count: 0 }] }));
          
          console.log(`  Business: "${bizName}" (ID: ${u.businessId})`);
          console.log(`  Products: ${products.rows[0].count}`);
          console.log(`  Customers: ${customers.rows[0].count}`);
          console.log(`  Sales: ${sales.rows[0].count}`);
          console.log(`  Expenses: ${expenses.rows[0].count}`);
        } else {
          console.log("  No Business associated.");
        }
      }
    } else {
      console.log("No User table found in public schema.");
    }

  } catch (err) {
    console.error("Error querying 'postgres' database:", err.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
