import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const userRes = await client.query('SELECT id, "businessId" FROM "User" WHERE email = $1', ['sachan.manas483@gmail.com']);
  if (userRes.rows.length === 0) {
    console.log("User not found.");
    await client.end();
    return;
  }
  const { id: userId, businessId } = userRes.rows[0];
  
  const bizRes = await client.query('SELECT name, "businessType" FROM "Business" WHERE id = $1', [businessId]);
  console.log("Business details:");
  console.table(bizRes.rows);
  
  await client.end();
}

main().catch(console.error);
