const { Pool } = require('pg');
require('dotenv').config({ path: '.env.example' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    const { rows: products } = await pool.query('SELECT id, name, category, "businessId" FROM "Product"');
    console.log('--- Products ---');
    console.table(products);

    const { rows: businesses } = await pool.query('SELECT id, "businessType", "displayName" FROM "Business"');
    console.log('\n--- Businesses ---');
    console.table(businesses);

    const { rows: users } = await pool.query('SELECT id, email, role, "businessId" FROM "User"');
    console.log('\n--- Users ---');
    console.table(users);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
main();
