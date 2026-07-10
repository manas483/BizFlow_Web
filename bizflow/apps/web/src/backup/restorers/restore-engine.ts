import { prisma } from '@/shared/lib/db';
import { getTransactionalPrisma } from '../db-transactional';
import { backupManifest } from '../manifest/backup-manifest';
import { getStorageProvider } from '../storage';
import { decryptBuffer } from '../encryption/encryption';
import { enterMaintenanceMode, exitMaintenanceMode } from './maintenance-mode';
import { validateBackupPreRestore, validateRestoreIntegrity } from '../validators/restore-validator';

export interface RestoreOptions {
  businessId: string;
  backupRecordId: string; // The ID of the BackupRecord in the DB
  dryRun?: boolean;
}

export interface RestoreResult {
  success: boolean;
  dryRun: boolean;
  recordsDeleted: Record<string, number>;
  recordsInserted: Record<string, number>;
  message: string;
}

export class DryRunRollbackError extends Error {
  constructor() {
    super('Dry run completed. Rolling back transaction.');
    this.name = 'DryRunRollbackError';
  }
}

export async function executeRestore(options: RestoreOptions): Promise<RestoreResult> {
  const { businessId, backupRecordId, dryRun = false } = options;

  // 1. Enter Maintenance Mode (blocks other backup/restore/write ops)
  enterMaintenanceMode(businessId);

  const recordsDeleted: Record<string, number> = {};
  const recordsInserted: Record<string, number> = {};

  try {
    // 2. Fetch backup record metadata
    const backupRecord = await prisma.backupRecord.findUnique({
      where: { id: backupRecordId }
    });

    if (!backupRecord) {
      throw new Error(`Backup record not found: ${backupRecordId}`);
    }

    if (backupRecord.businessId !== businessId) {
      throw new Error('Tenant isolation violation: Attempted to restore a backup belonging to another business.');
    }

    if (!backupRecord.fileName) {
      throw new Error('Backup record is missing a fileName.');
    }

    // 3. Decrypt and parse payload
    const storage = getStorageProvider();
    const encryptedPayload = await storage.download(backupRecord.fileName);
    const unencryptedPayload = decryptBuffer(encryptedPayload);

    // --- PRE-RESTORE VALIDATION ---
    const preValidationResult = validateBackupPreRestore(backupRecord, unencryptedPayload);
    if (!preValidationResult.isValid) {
      throw new Error(`Pre-restore validation failed: ${preValidationResult.errors.join(', ')}`);
    }
    // ------------------------------

    const payloadString = unencryptedPayload.toString('utf-8');
    const lines = payloadString.split('\n').filter(line => line.trim().length > 0);
    const parsedData: Record<string, any[]> = {};
    
    // Group records by model for faster bulk insertion
    for (const line of lines) {
      const { model, data } = JSON.parse(line);
      if (!parsedData[model]) {
        parsedData[model] = [];
      }
      parsedData[model].push(data);
    }

    // 4. Execute transactional wipe and restore
    const txPrisma = getTransactionalPrisma();
    
    try {
      await txPrisma.$transaction(async (tx) => {
        // A. Reverse Topological Deletion
        // We delete in reverse order to ensure foreign key dependents are deleted before their parents.
        const reverseModels = [...backupManifest.models].reverse();
        
        for (const modelDef of reverseModels) {
          const modelName = modelDef.modelName;
          const prismaModel = (tx as any)[modelName];
          
          if (!prismaModel) continue; // Should be caught by validator, but safe guard

          let whereClause: any = {};
          if (modelName === 'Business') {
            whereClause = { id: businessId };
          } else if (modelDef.businessIdField.includes('.')) {
            const parts = modelDef.businessIdField.split('.');
            whereClause = { [parts[0]]: { [parts[1]]: businessId } };
          } else {
            whereClause = { [modelDef.businessIdField]: businessId };
          }

          const deleteResult = await prismaModel.deleteMany({ where: whereClause });
          recordsDeleted[modelName] = deleteResult.count;
        }

        // B. Topological Insertion
        // We insert in regular topological order to ensure parents exist before dependents.
        for (const modelDef of backupManifest.models) {
          const modelName = modelDef.modelName;
          const recordsToInsert = parsedData[modelName] || [];
          const prismaModel = (tx as any)[modelName];

          if (recordsToInsert.length > 0) {
            const createResult = await prismaModel.createMany({
              data: recordsToInsert,
              // Some databases might require skipDuplicates or similar, 
              // but since we just wiped it, it should be clean.
            });
            recordsInserted[modelName] = createResult.count;
          } else {
            recordsInserted[modelName] = 0;
          }
        }

        // --- POST-RESTORE INTEGRITY VALIDATION ---
        const postValidationResult = await validateRestoreIntegrity(tx, businessId, parsedData);
        if (!postValidationResult.isValid) {
          throw new Error(`Post-restore validation failed: ${postValidationResult.errors.join(', ')}`);
        }
        // -----------------------------------------

        // C. Dry Run Abort
        if (dryRun) {
          throw new DryRunRollbackError();
        }
      }, {
        maxWait: 10000, // 10 seconds max wait for transaction lock
        timeout: 60000 // 60 seconds timeout for the transaction to complete
      });
      
    } catch (error: any) {
      if (error instanceof DryRunRollbackError) {
        // Expected behavior for a dry run
        return {
          success: true,
          dryRun: true,
          recordsDeleted,
          recordsInserted,
          message: 'Dry run completed successfully. No data was permanently changed.'
        };
      }
      // Re-throw actual errors to abort the restore process
      throw error;
    }

    return {
      success: true,
      dryRun: false,
      recordsDeleted,
      recordsInserted,
      message: 'Restore completed successfully.'
    };

  } finally {
    // 5. Exit Maintenance Mode
    exitMaintenanceMode(businessId);
  }
}
