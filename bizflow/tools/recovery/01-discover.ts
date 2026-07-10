import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../../../.env') });
neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Phase 1: Discover Orphan Invoices ===');
  
  // Find all sales with total > 0 but NO items
  const sales = await prisma.sale.findMany({
    where: {
      total: { gt: 0 }
    },
    include: {
      items: true,
      customer: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  const orphans = sales.filter(s => s.items.length === 0);

  console.log(`Found ${orphans.length} orphan invoices.`);

  const outDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const manifest = orphans.map(o => ({
    id: o.id,
    invoiceNo: o.invoiceNo,
    customerId: o.customer.id,
    customerName: o.customer.name,
    total: o.total,
    paid: o.paid,
    date: o.invoiceDate || o.createdAt,
    status: o.status
  }));

  const outFile = path.join(outDir, 'orphan_invoices.json');
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));

  console.log(`Wrote ${orphans.length} records to ${outFile}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
