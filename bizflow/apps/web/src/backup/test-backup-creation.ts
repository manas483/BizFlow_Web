import 'dotenv/config';
import { prisma } from '@/shared/lib/db';
import { createBackup } from './engine';

async function run() {
  process.env.BACKUP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  let business = await prisma.business.findFirst();
  if (!business) {
    console.log("No business found. Creating a dummy business for testing...");
    business = await prisma.business.create({
      data: {
        name: "Test Business",
        ownerName: "Test Owner",
        phone: "1234567890",
        businessType: "TEST"
      }
    });
  }

  console.log(`Starting backup for business: ${business.id}`);
  
  try {
    const backupRecord = await createBackup({
      businessId: business.id,
      backupType: 'MANUAL',
      notes: 'Test backup from Phase 2 validation'
    });
    
    console.log("SUCCESS: Backup created and validated successfully!");
    console.log(backupRecord);
  } catch (error) {
    console.error("FAILED to create backup:", error);
    process.exit(1);
  }
}

run().then(() => process.exit(0));
