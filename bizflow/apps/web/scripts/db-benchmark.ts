import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('No DATABASE_URL');

  const startConnect = performance.now();
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  const prisma = new PrismaClient({ adapter });
  console.log(`Pool & Client init: ${(performance.now() - startConnect).toFixed(2)}ms`);

  const startSelect1 = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  console.log(`SELECT 1 (Cold): ${(performance.now() - startSelect1).toFixed(2)}ms`);

  const startSelect1Warm = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  console.log(`SELECT 1 (Warm): ${(performance.now() - startSelect1Warm).toFixed(2)}ms`);

  const startCount = performance.now();
  const count = await prisma.product.count();
  console.log(`SELECT COUNT(*) FROM Product (Warm): ${(performance.now() - startCount).toFixed(2)}ms, Count: ${count}`);

  const startFindMany = performance.now();
  await prisma.product.findMany({ take: 20 });
  console.log(`findMany(take: 20) (Warm): ${(performance.now() - startFindMany).toFixed(2)}ms`);

  await prisma.$disconnect();
  await pool.end();
}

run().catch(console.error);
