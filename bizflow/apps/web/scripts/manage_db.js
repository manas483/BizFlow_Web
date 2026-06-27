import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is not set.");
  process.exit(1);
}

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
