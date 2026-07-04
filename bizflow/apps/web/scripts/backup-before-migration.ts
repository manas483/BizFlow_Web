import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function createNeonBranch() {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.warn('⚠️ NEON_API_KEY or NEON_PROJECT_ID not set. Skipping Neon branch creation.');
    return null;
  }

  const branchName = `pre-migration-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  console.log(`🌿 Creating Neon branch: ${branchName}`);

  const response = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/branches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      branch: {
        name: branchName,
      },
      endpoints: [{ type: 'read_write' }]
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`❌ Failed to create Neon branch: ${response.status} ${response.statusText}`, errorBody);
    throw new Error('Failed to create Neon branch');
  }

  const data = await response.json();
  console.log(`✅ Neon branch created successfully: ${data.branch.id}`);
  return data.branch;
}

async function snapshotCounts() {
  console.log('📊 Snapshotting critical table counts...');
  
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
    // @ts-ignore - may not exist if layer engine isn't migrated
    prisma.inventoryLayer ? prisma.inventoryLayer.count() : Promise.resolve(0)
  ]);

  const stats = {
    timestamp: new Date().toISOString(),
    counts: {
      customers,
      products,
      sales,
      saleItems,
      employees,
      inventoryLayers,
    }
  };

  const backupsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const filename = `pre-migration-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
  const filepath = path.join(backupsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(stats, null, 2));
  console.log(`✅ Snapshot saved to backups/${filename}`);
  
  return stats;
}

async function main() {
  console.log('🛡️ Starting pre-migration backup & snapshot...');
  try {
    await snapshotCounts();
    await createNeonBranch();
    console.log('🎉 Pre-migration backup complete. Safe to proceed with migration.');
  } catch (error) {
    console.error('💥 Pre-migration backup failed!', error);
    process.exit(1); // Block migration
  } finally {
    await prisma.$disconnect();
  }
}

main();
