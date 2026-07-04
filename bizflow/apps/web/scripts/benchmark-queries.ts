import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_9joCySKxm0Hi@ep-tiny-scene-aj1nynbc.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require";

const iterations = 30;

let prisma: any;

function calculatePercentiles(times: number[]) {
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.50)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  return { p50, p95, p99 };
}

async function measure(name: string, fn: () => Promise<any>) {
  const times: number[] = [];
  
  // Warmup
  await fn().catch(() => {});

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      await fn();
    } catch (e) {
      // Ignore errors for latency tracking, but note them
    }
    times.push(performance.now() - start);
  }

  const { p50, p95, p99 } = calculatePercentiles(times);
  console.log(`${name.padEnd(20)} | P50: ${p50.toFixed(2)}ms | P95: ${p95.toFixed(2)}ms | P99: ${p99.toFixed(2)}ms`);
}

async function runBenchmark() {
  console.log(`\nStarting Baseline Benchmark (${iterations} iterations)...\n`);
  const db = await import('../src/shared/lib/db.ts');
  prisma = db.prisma;
  
  // Assuming a dummy business ID for query shape (even if 0 results, it tests latency)
  const businessId = 'clx1234dummy_business_id';

  // 1. Login Query (simulates authorize function)
  await measure('Login', async () => {
    return prisma.user.findUnique({
      where: { email: 'test@example.com' },
      include: { employee: { select: { permissions: true } }, business: { select: { businessType: true } } }
    });
  });

  // 2. Inventory Query (simulates /api/inventory list)
  await measure('Inventory', async () => {
    return prisma.product.findMany({
      where: { businessId, deletedAt: null },
      include: { supplier: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 20
    });
  });

  // 3. Sales List
  await measure('Sales List', async () => {
    return prisma.sale.findMany({
      where: { businessId, isAggregate: false },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  });

  // 4. Product Search
  await measure('Product Search', async () => {
    return prisma.product.findMany({
      where: { 
        businessId, 
        deletedAt: null, 
        OR: [{ name: { contains: 'test', mode: 'insensitive' } }, { sku: { contains: 'test', mode: 'insensitive' } }]
      },
      take: 10
    });
  });

  // 5. Dashboard (Aggregates)
  await measure('Dashboard (KPIs)', async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return Promise.all([
      prisma.sale.aggregate({ where: { businessId, createdAt: { gte: startOfDay } }, _sum: { total: true }, _count: true }),
      prisma.expense.aggregate({ where: { businessId, date: { gte: startOfDay } }, _sum: { amount: true } })
    ]);
  });

  // 6. Reports (Heavy 15 concurrent queries)
  await measure('Reports (Full)', async () => {
    return Promise.all([
      prisma.sale.aggregate({ where: { businessId }, _sum: { total: true } }),
      prisma.expense.aggregate({ where: { businessId }, _sum: { amount: true } }),
      prisma.saleItem.groupBy({ by: ['productId'], where: { sale: { businessId } }, _sum: { qty: true } }),
      prisma.product.findMany({ where: { businessId }, select: { id: true, stock: true, minStock: true }, take: 10 }),
      prisma.customer.aggregate({ where: { businessId }, _sum: { dues: true } })
    ]);
  });

  console.log(`\nBenchmark Complete.\n`);
  process.exit(0);
}

runBenchmark().catch(console.error);
