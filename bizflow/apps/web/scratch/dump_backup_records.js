const { Client } = require('pg');

const connectionString = "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require";

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to db.prisma.io successfully.");

    // Check if BackupRecord table exists
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'BackupRecord'
      );
    `);
    
    if (!checkTable.rows[0].exists) {
      console.log("BackupRecord table does not exist in this database.");
      return;
    }

    // Query all backup records
    const res = await client.query('SELECT * FROM "BackupRecord" ORDER BY "createdAt" DESC;');
    console.log(`\n=== FOUND ${res.rows.length} BACKUP RECORDS ===`);
    console.log(JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error("Error querying BackupRecord:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
