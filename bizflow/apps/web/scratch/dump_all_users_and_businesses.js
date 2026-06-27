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

    // Query all users and their businesses
    const query = `
      SELECT 
        u.id as user_id,
        u.email as user_email,
        u.name as user_name,
        u."businessId" as business_id,
        b.name as business_name,
        b."ownerName" as business_owner
      FROM "User" u
      LEFT JOIN "Business" b ON u."businessId" = b.id
      ORDER BY user_email;
    `;

    const res = await client.query(query);
    console.log("\n=== ALL USERS & ASSOCIATED BUSINESSES ===");
    console.log(JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error("Error running dump:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
