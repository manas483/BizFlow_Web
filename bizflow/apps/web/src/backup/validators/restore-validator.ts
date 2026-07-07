import { BackupRecord } from '@prisma/client';
import crypto from 'crypto';
import { backupManifest } from '../manifest/backup-manifest';

export interface PreRestoreValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PostRestoreValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a backup package before starting a restore.
 * - Checks schema version compatibility
 * - Verifies the SHA-256 checksum
 */
export function validateBackupPreRestore(
  backupRecord: BackupRecord,
  unencryptedPayload: Buffer
): PreRestoreValidationResult {
  const errors: string[] = [];

  // 1. Schema Version Check
  const currentSchemaVersion = '1.0'; // In a real app, this might come from package.json or config
  if (backupRecord.schemaVersion !== currentSchemaVersion) {
    errors.push(`Incompatible schema version. Backup is ${backupRecord.schemaVersion}, system is ${currentSchemaVersion}.`);
  }

  // 2. Checksum Verification
  const hash = crypto.createHash('sha256');
  hash.update(unencryptedPayload);
  const actualChecksum = hash.digest('hex');

  if (actualChecksum !== backupRecord.checksum) {
    errors.push(`Checksum mismatch. Expected ${backupRecord.checksum}, got ${actualChecksum}. The backup package may be corrupted or tampered with.`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates the database integrity immediately after a restore (inside the active transaction).
 * - Verifies that record counts match exactly what was in the payload.
 * - Future: could check inventory quantities and ledger balances.
 */
export async function validateRestoreIntegrity(
  txPrisma: any,
  businessId: string,
  parsedData: Record<string, any[]>
): Promise<PostRestoreValidationResult> {
  const errors: string[] = [];

  for (const modelDef of backupManifest.models) {
    const modelName = modelDef.modelName;
    const expectedCount = parsedData[modelName]?.length || 0;
    const prismaModel = txPrisma[modelName];

    if (!prismaModel) continue;

    // Build query to count records for this business
    let whereClause: any = {};
    if (modelName === 'Business') {
      whereClause = { id: businessId };
    } else if (modelDef.businessIdField.includes('.')) {
      const parts = modelDef.businessIdField.split('.');
      whereClause = { [parts[0]]: { [parts[1]]: businessId } };
    } else {
      whereClause = { [modelDef.businessIdField]: businessId };
    }

    const actualCount = await prismaModel.count({ where: whereClause });

    if (actualCount !== expectedCount) {
      errors.push(`Record count mismatch for ${modelName}. Expected ${expectedCount} (from payload), but database has ${actualCount} after restore.`);
    }
  }

  // In a robust system, we would also:
  // 1. Sum up InventoryLayer quantities and match against payload's expected sum.
  // 2. Sum up JournalEntry debits and credits and ensure they balance.
  // For Phase 4, exact row count matching is our primary data loss prevention mechanism.

  return {
    isValid: errors.length === 0,
    errors
  };
}
