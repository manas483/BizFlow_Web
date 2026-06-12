import pg from 'pg';

const connectionString = 'postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require';

async function run() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to DB successfully.");

    // Check args
    const action = process.argv[2];
    const email = process.argv[3];

    if (action === 'list') {
      const res = await client.query('SELECT id, name, email, role, "emailVerified" FROM "User"');
      console.log("=== USERS ===");
      console.table(res.rows);
    } else if (action === 'verify' && email) {
      const res = await client.query('UPDATE "User" SET "emailVerified" = true WHERE email = $1 RETURNING id, name, email, "emailVerified"', [email]);
      console.log("=== VERIFIED USER ===");
      console.table(res.rows);
    } else {
      console.log("Usage:\n  node manage_db.js list\n  node manage_db.js verify <email>");
      
      const res = await client.query('SELECT id, name, email, role, "emailVerified" FROM "User" LIMIT 5');
      console.log("=== LATEST 5 USERS ===");
      console.table(res.rows);
    }
  } catch (err) {
    console.error("Database error:", err);
  } finally {
    await client.end();
  }
}

run();
