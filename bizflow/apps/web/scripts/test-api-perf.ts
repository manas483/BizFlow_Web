import 'dotenv/config';
import { sign } from 'jsonwebtoken';

// This is a simplified version of signAccessToken just for testing
function generateTestToken(userId: string, email: string, role: string, businessId: string) {
  const secret = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
  return sign(
    {
      sub: userId,
      email,
      role,
      businessId,
      type: 'access',
    },
    secret,
    { expiresIn: '15m' }
  );
}

async function run() {
  const { prisma } = await import('../src/shared/lib/db');
  const user = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (!user) {
    console.error('No SUPER_ADMIN user found in the database.');
    process.exit(1);
  }

  console.log(`Found admin: ${user.email} (Business ID: ${user.businessId})`);

  const token = generateTestToken(user.id, user.email, user.role, user.businessId!);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const endpoints = [
    { name: 'Dashboard Stats (Cold)', url: 'http://localhost:3000/api/dashboard/stats' },
    { name: 'Dashboard Stats (Warm)', url: 'http://localhost:3000/api/dashboard/stats' },
    { name: 'Inventory Products (Cold)', url: 'http://localhost:3000/api/inventory/products?limit=10' },
    { name: 'Inventory Products (Warm)', url: 'http://localhost:3000/api/inventory/products?limit=10' },
    { name: 'Sales', url: 'http://localhost:3000/api/sales?limit=10' },
    { name: 'Customers', url: 'http://localhost:3000/api/customers?limit=10' },
    { name: 'Expenses', url: 'http://localhost:3000/api/expenses' },
    { name: 'Employees', url: 'http://localhost:3000/api/employees' },
    { name: 'Automation Settings', url: 'http://localhost:3000/api/settings/automation' },
    { name: 'Reports', url: 'http://localhost:3000/api/reports' },
  ];

  console.log('\n--- Hitting API Endpoints ---');
  for (const ep of endpoints) {
    try {
      const start = performance.now();
      const res = await fetch(ep.url, { headers });
      const text = await res.text();
      const durationMs = Math.round(performance.now() - start);
      
      console.log(`[${durationMs}ms] Fetching ${ep.name}...`);
      if (!res.ok) {
         console.log(`  Error (${res.status}): ${text.substring(0, 100)}...`);
      }
    } catch (err: any) {
      console.error(`  Failed: ${err.message}`);
    }
  }

  console.log('\n--- Fetching Performance Report ---');
  try {
    const res = await fetch('http://localhost:3000/api/health/perf', { headers });
    const text = await res.text();
    if (res.ok) {
      try {
        const data = JSON.parse(text);
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        console.log(`Failed to parse JSON. Raw response:\n${text}`);
      }
    } else {
      console.log(`Failed to fetch perf report: ${res.status} ${text}`);
    }
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
  }

  process.exit(0);
}

run().catch(console.error);
