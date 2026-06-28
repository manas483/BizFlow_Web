const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const CONNECTION_STRING = process.env.DATABASE_URL;

async function main() {
  const newPassword = "Manas@483";
  const hash = bcrypt.hashSync(newPassword, 12);
  
  console.log(`Hashing password with bcrypt (12 rounds)...`);
  console.log(`Hash: ${hash.substring(0, 20)}...`);
  
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const result = await client.query(
    `UPDATE "User" SET password = $1 WHERE email = 'sachan.manas483@gmail.com' RETURNING id, name, email;`,
    [hash]
  );
  
  if (result.rows.length > 0) {
    console.log(`\n✅ Password reset for: ${result.rows[0].name} (${result.rows[0].email})`);
    
    // Verify it works
    const verify = bcrypt.compareSync(newPassword, hash);
    console.log(`✅ Verification: ${verify ? 'PASS' : 'FAIL'}`);
  } else {
    console.log("❌ User not found!");
  }
  
  await client.end();
}

main().catch(console.error);
