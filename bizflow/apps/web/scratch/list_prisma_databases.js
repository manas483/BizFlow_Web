const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to db.prisma.io cluster.");

    const res = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
    console.log("Databases on cluster:", res.rows.map(r => r.datname));

  } catch (err) {
    console.error("Error listing databases:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
