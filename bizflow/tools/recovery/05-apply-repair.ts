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
  console.log('=== Phase 5: Apply Repairs (Idempotent & Transactional) ===');
  const outDir = path.join(__dirname, 'output');
  
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'repair_manifest.json'), 'utf8'));
  
  const executionReport = {
    applied: 0,
    skipped_already_repaired: 0,
    skipped_not_ready: 0,
    failed: 0,
    details: [] as any[]
  };

  for (const inv of manifest.invoices) {
    if (inv.status !== 'READY') {
      executionReport.skipped_not_ready++;
      executionReport.details.push({ invoiceNo: inv.invoiceNo, status: 'SKIPPED_NOT_READY' });
      continue;
    }

    // Idempotency Check
    const sale = await prisma.sale.findFirst({
      where: { invoiceNo: inv.invoiceNo },
      include: { items: true }
    });

    if (!sale) {
      console.error(`[ERROR] Invoice ${inv.invoiceNo} not found in DB!`);
      executionReport.failed++;
      executionReport.details.push({ invoiceNo: inv.invoiceNo, status: 'FAILED_NOT_FOUND' });
      continue;
    }

    if (sale.items.length > 0) {
      console.log(`[SKIP] Invoice ${inv.invoiceNo} already has ${sale.items.length} items.`);
      executionReport.skipped_already_repaired++;
      executionReport.details.push({ invoiceNo: inv.invoiceNo, status: 'SKIPPED_ALREADY_REPAIRED' });
      continue;
    }

    // Apply repair transactionally
    try {
      await prisma.$transaction(async (tx) => {
        // Insert items one by one or createMany. createMany is supported on PostgreSQL.
        await tx.saleItem.createMany({
          data: inv.items
        });
      });

      console.log(`[SUCCESS] Repaired Invoice ${inv.invoiceNo} (${inv.items.length} items)`);
      executionReport.applied++;
      executionReport.details.push({ invoiceNo: inv.invoiceNo, status: 'SUCCESS', itemsRepaired: inv.items.length });
    } catch (e: any) {
      console.error(`[ERROR] Failed to repair Invoice ${inv.invoiceNo}: ${e.message}`);
      executionReport.failed++;
      executionReport.details.push({ invoiceNo: inv.invoiceNo, status: 'FAILED_TX_ERROR', error: e.message });
    }
  }

  const reportPath = path.join(outDir, 'execution_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(executionReport, null, 2));

  let mdReport = `# Repair Execution Report\n\n`;
  mdReport += `- **Applied**: ${executionReport.applied}\n`;
  mdReport += `- **Skipped (Already Repaired)**: ${executionReport.skipped_already_repaired}\n`;
  mdReport += `- **Skipped (Not Ready)**: ${executionReport.skipped_not_ready}\n`;
  mdReport += `- **Failed**: ${executionReport.failed}\n\n`;
  mdReport += `## Details\n\n`;
  for (const d of executionReport.details) {
    mdReport += `- ${d.invoiceNo}: **${d.status}**\n`;
  }

  const mdReportPath = path.join(outDir, 'execution_report.md');
  fs.writeFileSync(mdReportPath, mdReport);

  console.log('\n=== EXECUTION SUMMARY ===');
  console.log(`Applied: ${executionReport.applied}`);
  console.log(`Skipped (Already Repaired): ${executionReport.skipped_already_repaired}`);
  console.log(`Failed: ${executionReport.failed}`);
  console.log(`\nWrote execution reports to ${outDir}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
