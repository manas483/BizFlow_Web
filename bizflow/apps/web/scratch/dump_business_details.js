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

    const res = await client.query('SELECT id, name, "ownerName", "createdAt", "onboardingCompleted" FROM "Business" ORDER BY "createdAt" DESC;');
    console.log("\n=== ALL BUSINESS DETAILS ===");
    for (const row of res.rows) {
      console.log(`- ID: ${row.id}`);
      console.log(`  Name: ${row.name}`);
      console.log(`  Owner: ${row.ownerName}`);
      console.log(`  Created At: ${row.createdAt.toISOString()}`);
      console.log(`  Onboarding Completed: ${row.onboardingCompleted}`);
    }

  } catch (err) {
    console.error("Error querying Business:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
