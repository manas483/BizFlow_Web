import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaNeonHttp } from '@prisma/adapter-neon';

async function measure(name: string, fn: () => Promise<any>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

async function benchmark() {
  console.log('--- Database Transport Benchmark ---');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  // 1. Prisma + Neon HTTP
  console.log('\nInitializing Prisma + Neon HTTP...');
  const neonHttpAdapter = new PrismaNeonHttp(connectionString);
  const httpPrisma = new PrismaClient({ adapter: neonHttpAdapter });
  
  // 2. Standard PostgreSQL (raw pg)
  console.log('Initializing Standard PostgreSQL (pg)...');
  const pgPool = new Pool({ connectionString });

  const queries = [
    { 
      name: 'User.findFirst', 
      fnHttp: (p: any) => p.user.findFirst(),
      fnPg: async (pool: any) => {
        const res = await pool.query('SELECT * FROM "User" LIMIT 1');
        return res.rows;
      }
    },
    { 
      name: 'Sale.findMany', 
      fnHttp: (p: any) => p.sale.findMany({ take: 10 }),
      fnPg: async (pool: any) => {
        const res = await pool.query('SELECT * FROM "Sale" LIMIT 10');
        return res.rows;
      }
    }
  ];

  const results: Record<string, any> = {};

  for (const clientConfig of [
    { name: 'Prisma + Neon HTTP', client: httpPrisma, type: 'http' },
    { name: 'Standard PostgreSQL (pg)', client: pgPool, type: 'pg' }
  ]) {
    console.log(`\nTesting ${clientConfig.name}...`);
    results[clientConfig.name] = {};

    for (const query of queries) {
      console.log(`  Query: ${query.name}`);
      
      const runQuery = async () => {
        if (clientConfig.type === 'http') {
          return await query.fnHttp(clientConfig.client);
        } else {
          return await query.fnPg(clientConfig.client);
        }
      };
      
      // Cold run
      const coldTime = await measure('cold', runQuery);
      
      // Warm runs
      const warmTimes: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t = await measure(`warm ${i+1}`, runQuery);
        warmTimes.push(t);
      }
      
      const avgWarm = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;
      const sortedWarm = [...warmTimes].sort((a, b) => a - b);
      const p95Warm = sortedWarm[Math.floor(sortedWarm.length * 0.95)];
      
      console.log(`    Cold: ${coldTime.toFixed(2)}ms`);
      console.log(`    Warm Avg: ${avgWarm.toFixed(2)}ms`);
      
      results[clientConfig.name][query.name] = {
        cold: coldTime,
        avgWarm,
        p95Warm
      };
    }
  }

  // Clean up
  await httpPrisma.$disconnect();
  await pgPool.end();

  // Print summary
  console.log('\n--- Benchmark Summary Table ---');
  console.log('| Configuration | Query | Cold (ms) | Warm Avg (ms) | Warm P95 (ms) |');
  console.log('|---------------|-------|----------:|--------------:|--------------:|');
  
  for (const [config, queries] of Object.entries(results)) {
    for (const [queryName, stats] of Object.entries(queries)) {
      console.log(`| ${config.padEnd(25)} | ${queryName.padEnd(15)} | ${stats.cold.toFixed(1).padStart(9)} | ${stats.avgWarm.toFixed(1).padStart(13)} | ${stats.p95Warm.toFixed(1).padStart(13)} |`);
    }
  }
}

benchmark().catch(console.error);
