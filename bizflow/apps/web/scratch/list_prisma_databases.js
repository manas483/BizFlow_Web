const { Client } = require('pg');

const connectionString = "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require";

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
