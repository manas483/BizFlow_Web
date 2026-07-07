import { prisma } from '@/shared/lib/db';
import { extractBusinessData } from './extractors/backup-extractor';
import { encryptBuffer } from './encryption/encryption';
import { getStorageProvider } from './storage';
import { validateBackupCreation } from './validators/creation-validator';
import { v4 as uuidv4 } from 'uuid';

export interface BackupOptions {
  businessId: string;
  triggeredByUserId?: string;
  backupType?: 'MANUAL' | 'AUTOMATIC' | 'PRE_RESTORE';
  notes?: string;
}

export async function createBackup(options: BackupOptions) {
  const { businessId, triggeredByUserId, backupType = 'MANUAL', notes } = options;
  const storage = getStorageProvider();
  
  // 1. Extract data (Consistency Lock implied/handled by isolated tenant extraction)
  const extractionResult = await extractBusinessData(businessId);
  const { payload: rawPayload, metadata } = extractionResult;

  // 2. Encrypt the payload
  const encryptedPayload = encryptBuffer(rawPayload);

  // 3. Generate secure filename and store
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `backup-${businessId}-${timestamp}-${uuidv4().substring(0, 8)}.enc`;
  
  const storageUrl = await storage.upload(fileName, encryptedPayload);

  // 4. Validate creation integrity
  // We download it back (or use the buffer if local) to ensure the written file is valid
  const storedPayload = await storage.download(fileName);
  
  const validationResult = await validateBackupCreation(
    storedPayload,
    metadata.checksum,
    metadata.recordCount
  );

  if (!validationResult.isValid) {
    // If validation fails, delete the corrupted backup from storage
    await storage.delete(fileName);
    throw new Error(`Backup creation validation failed: ${validationResult.errors.join(', ')}`);
  }

  // 5. Record the successful backup in the database
  const backupRecord = await prisma.backupRecord.create({
    data: {
      businessId,
      fileName,
      fileSize: encryptedPayload.length,
      checksum: metadata.checksum,
      status: 'VERIFIED',
      backupType,
      formatVersion: '1.0',
      schemaVersion: '1.0', // We might read this from package.json in the future
      storageUrl,
      notes,
      createdByUserId: triggeredByUserId || null,
      // Default expiration for automatic backups could be 7 days, manual = never
      expiresAt: backupType === 'AUTOMATIC' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null
    }
  });

  return backupRecord;
}
