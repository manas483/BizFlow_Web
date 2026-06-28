const { Client } = require('pg');

const CONNECTION_STRING = process.env.DATABASE_URL;

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Check user record
  const userRes = await client.query(`
    SELECT id, name, email, password, role, "businessId", "emailVerified", "createdAt"
    FROM "User"
    WHERE email = 'sachan.manas483@gmail.com';
  `);
  
  console.log("User records for sachan.manas483@gmail.com:");
  for (const u of userRes.rows) {
    console.log(`  ID: ${u.id}`);
    console.log(`  Name: ${u.name}`);
    console.log(`  Email: ${u.email}`);
    console.log(`  Password hash: ${u.password ? u.password.substring(0, 20) + '...' : 'NULL'}`);
    console.log(`  Role: ${u.role}`);
    console.log(`  BusinessId: ${u.businessId}`);
    console.log(`  EmailVerified: ${u.emailVerified}`);
    console.log(`  Created: ${u.createdAt}`);
    console.log('');
  }

  // Also check all users
  const allUsers = await client.query(`SELECT id, name, email, password IS NOT NULL as "hasPassword", role, "businessId" FROM "User" ORDER BY "createdAt";`);
  console.log("\nAll users:");
  for (const u of allUsers.rows) {
    console.log(`  ${u.email} | hasPassword: ${u.hasPassword} | role: ${u.role} | business: ${u.businessId}`);
  }

  await client.end();
}

main().catch(console.error);
