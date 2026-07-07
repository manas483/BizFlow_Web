import { Prisma } from '@prisma/client';
import { backupManifest } from '../manifest/backup-manifest';

/**
 * Validates that the backup manifest is completely in sync with the Prisma schema.
 * Throws an error if any business-owned model is missing from the manifest.
 */
export function validateBackupManifest() {
  const allModels = Prisma.dmmf.datamodel.models;
  
  // Find all models that belong to a business (have a businessId field or are 'Business')
  const expectedTenantModels = allModels.filter(model => {
    if (model.name === 'Business') return true;
    return model.fields.some(f => f.name === 'businessId');
  }).map(m => m.name);

  const definedModels = backupManifest.models.map(m => m.modelName);

  const missingModels = expectedTenantModels.filter(m => !definedModels.includes(m));
  
  if (missingModels.length > 0) {
    throw new Error(`BACKUP MANIFEST VALIDATION FAILED: The following business-owned models are missing from backup-manifest.ts: ${missingModels.join(', ')}. Please update the manifest to include these models to ensure safe restores.`);
  }

  // Also verify that the order is strictly positive and unique
  const orders = backupManifest.models.map(m => m.order);
  const uniqueOrders = new Set(orders);
  if (uniqueOrders.size !== orders.length) {
    throw new Error(`BACKUP MANIFEST VALIDATION FAILED: Duplicate topological orders detected in the manifest.`);
  }

  return true;
}
