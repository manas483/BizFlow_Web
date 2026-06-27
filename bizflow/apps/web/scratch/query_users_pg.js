const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read database URL from .env file
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const dbUrlLine = envContent.split('\n').find(line => line.startsWith('DATABASE_URL='));
if (!dbUrlLine) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}
const dbUrl = dbUrlLine.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');

async function main() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  try {
    const res = await client.query('SELECT id, email, name, role, "emailVerified", "twoFactorEnabled", password IS NOT NULL as "hasPassword" FROM "User"');
    console.log('--- USERS IN DATABASE ---');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Query error:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
