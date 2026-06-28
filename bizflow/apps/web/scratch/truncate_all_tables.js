const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const dbUrlLine = envContent.split('\n').find(line => line.startsWith('DATABASE_URL='));
if (!dbUrlLine) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}
const dbUrl = dbUrlLine.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');

async function main() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  try {
    // Get all tables in public schema except _prisma_migrations
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != '_prisma_migrations'
      ORDER BY table_name;
    `);
    
    const tables = res.rows.map(r => r.table_name);
    
    if (tables.length === 0) {
      console.log('No tables to truncate.');
      return;
    }
    
    console.log(`Found ${tables.length} tables to truncate.`);
    
    // Construct TRUNCATE statement with double quotes around table names
    const quotedTables = tables.map(t => `"${t}"`).join(', ');
    const truncateQuery = `TRUNCATE TABLE ${quotedTables} CASCADE;`;
    
    console.log('Executing truncation query...');
    await client.query(truncateQuery);
    console.log('Successfully truncated all tables.');
    
  } catch (err) {
    console.error('Error during truncation:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
