import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  let snapshotPath = args[0];

  if (!snapshotPath) {
    // Find the latest snapshot in the backups directory
    const backupsDir = path.join(process.cwd(), 'backups');
    if (fs.existsSync(backupsDir)) {
      const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.json')).sort();
      if (files.length > 0) {
        snapshotPath = path.join(backupsDir, files[files.length - 1]);
      }
    }
  }

  if (!snapshotPath || !fs.existsSync(snapshotPath)) {
    console.error('❌ Could not find a snapshot file to verify against.');
    process.exit(1);
  }

  console.log(`🔍 Verifying against snapshot: ${snapshotPath}`);
  const snapshotData = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

  const [
    customers,
    products,
    sales,
    saleItems,
    employees,
    inventoryLayers
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.product.count(),
    prisma.sale.count(),
    prisma.saleItem.count(),
    prisma.employee.count(),
    // @ts-ignore
    prisma.inventoryLayer ? prisma.inventoryLayer.count() : Promise.resolve(0)
  ]);

  const currentCounts = {
    customers,
    products,
    sales,
    saleItems,
    employees,
    inventoryLayers,
  };

  let hasErrors = false;
  for (const [key, value] of Object.entries(snapshotData.counts)) {
    const current = (currentCounts as any)[key];
    if (current < (value as number)) {
      console.error(`❌ Data loss detected in ${key}! Expected at least ${value}, got ${current}`);
      hasErrors = true;
    } else {
      console.log(`✅ ${key}: ${current} (Snapshot: ${value})`);
    }
  }

  if (hasErrors) {
    console.error('💥 Verification failed! Data loss detected.');
    process.exit(1);
  } else {
    console.log('🎉 Verification passed. No data loss detected compared to snapshot.');
  }
}

main().finally(() => prisma.$disconnect());
