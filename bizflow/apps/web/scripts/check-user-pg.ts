import 'dotenv/config';
import { Client } from 'pg';

async function checkUser() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL not set');
  
  const client = new Client({ connectionString });
  await client.connect();
  
  const email = 'sachan.manas483@gmail.com';
  const res = await client.query('SELECT id, name, "emailVerified" FROM "User" WHERE email = $1', [email]);
  
  if (res.rows.length > 0) {
    console.log('User found:', res.rows[0]);
  } else {
    console.log(`User NOT found for email: ${email}`);
  }
  
  await client.end();
}

checkUser().catch(console.error);
