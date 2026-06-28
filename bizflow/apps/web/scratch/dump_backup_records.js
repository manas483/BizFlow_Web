const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

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
