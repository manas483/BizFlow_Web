const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const dbUrlLine = envContent.split('\n').find(line => line.startsWith('DATABASE_URL='));
const dbUrl = dbUrlLine.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');

async function main() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  try {
    const tables = ['Business', 'User', 'Product', 'Sale', 'Customer', 'Employee'];
    console.log('--- TABLE COUNTS ---');
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      console.log(`${table}: ${res.rows[0].count}`);
    }
    
    console.log('\n--- BUSINESSES ---');
    const resBus = await client.query('SELECT id, name, "ownerName" FROM "Business"');
    console.log(JSON.stringify(resBus.rows, null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
