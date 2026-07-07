import 'dotenv/config';
import { prisma } from '@/shared/lib/db';
import { executeRestore } from './restorers/restore-engine';

async function run() {
  process.env.BACKUP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  // Find the most recent BackupRecord
  const backupRecord = await prisma.backupRecord.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (!backupRecord) {
    console.error("No backup record found. Run test-backup-creation.ts first.");
    process.exit(1);
  }

  const businessId = backupRecord.businessId;

  console.log(`Starting DRY RUN restore for business: ${businessId}`);
  
  try {
    const dryRunResult = await executeRestore({
      businessId,
      backupRecordId: backupRecord.id,
      dryRun: true
    });
    
    console.log("DRY RUN SUCCESS:");
    console.log(dryRunResult.message);
    console.log("Records deleted (simulated):", dryRunResult.recordsDeleted);
    console.log("Records inserted (simulated):", dryRunResult.recordsInserted);
    
    console.log("\nStarting FULL RESTORE for business:", businessId);
    
    const fullRestoreResult = await executeRestore({
      businessId,
      backupRecordId: backupRecord.id,
      dryRun: false
    });
    
    console.log("FULL RESTORE SUCCESS:");
    console.log(fullRestoreResult.message);
    console.log("Records deleted:", fullRestoreResult.recordsDeleted);
    console.log("Records inserted:", fullRestoreResult.recordsInserted);

  } catch (error) {
    console.error("FAILED to restore backup:", error);
    process.exit(1);
  }
}

run().then(() => process.exit(0));
