const { Client } = require('pg');

const connectionString = "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require";

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to db.prisma.io.");

    // 1. List all schemas
    const schemasRes = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata
      WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema';
    `);
    const schemas = schemasRes.rows.map(r => r.schema_name);
    console.log("Schemas found:", schemas);

    // 2. For each schema, list tables and row counts
    for (const schema of schemas) {
      console.log(`\n--- SCHEMA: ${schema} ---`);
      const tablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1;
      `, [schema]);
      
      for (const tRow of tablesRes.rows) {
        const tName = tRow.table_name;
        try {
          const countRes = await client.query(`SELECT COUNT(*)::int FROM "${schema}"."${tName}";`);
          console.log(`  Table: ${tName} | Rows: ${countRes.rows[0].count}`);
        } catch (e) {
          console.log(`  Table: ${tName} | Error counting: ${e.message}`);
        }
      }
    }

  } catch (err) {
    console.error("Error querying PostgreSQL schemas:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
