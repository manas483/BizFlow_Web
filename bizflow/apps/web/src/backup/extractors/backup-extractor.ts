import { prisma } from '@/shared/lib/db';
import { backupManifest } from '../manifest/backup-manifest';
import crypto from 'crypto';

export interface ExtractedBackup {
  payload: Buffer;
  metadata: {
    recordCount: number;
    checksum: string; // SHA-256 of the unencrypted payload
  };
}

/**
 * Extracts all data for a specific business according to the backup manifest.
 * Guarantees a consistent snapshot by running extraction sequentially and locking
 * or assuming write traffic is paused (Maintenance Mode).
 */
export async function extractBusinessData(businessId: string): Promise<ExtractedBackup> {
  const records: string[] = [];
  let totalRecords = 0;

  // Iterate over models in topological order
  for (const modelDef of backupManifest.models) {
    let cursor: string | undefined = undefined;
    const batchSize = 1000;
    let hasMore = true;

    // Type casting the prisma client to any so we can access models dynamically
    const prismaModel = (prisma as any)[modelDef.modelName];
    if (!prismaModel) {
      throw new Error(`Prisma model ${modelDef.modelName} not found on PrismaClient.`);
    }

    while (hasMore) {
      // Build query
      const query: any = {
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      };

      // Apply business isolation
      if (modelDef.modelName === 'Business') {
        query.where = { id: businessId };
      } else if (modelDef.businessIdField.includes('.')) {
        const parts = modelDef.businessIdField.split('.');
        // Handle max 2 levels for now: e.g. "sale.businessId"
        query.where = { [parts[0]]: { [parts[1]]: businessId } };
      } else {
        query.where = { [modelDef.businessIdField]: businessId };
      }

      // Order by ID for stable pagination
      // Assuming all tenant tables have an 'id' field, which is standard in BizFlow.
      query.orderBy = { id: 'asc' };

      const batch = await prismaModel.findMany(query);

      for (const record of batch) {
        // Serialize as JSON lines
        records.push(JSON.stringify({
          model: modelDef.modelName,
          data: record
        }));
        totalRecords++;
      }

      if (batch.length === batchSize) {
        cursor = batch[batch.length - 1].id;
      } else {
        hasMore = false;
      }
    }
  }

  // Join lines and convert to buffer
  const jsonlData = records.join('\n') + '\n';
  const payloadBuffer = Buffer.from(jsonlData, 'utf-8');

  // Compute checksum of the unencrypted payload
  const hash = crypto.createHash('sha256');
  hash.update(payloadBuffer);
  const checksum = hash.digest('hex');

  return {
    payload: payloadBuffer,
    metadata: {
      recordCount: totalRecords,
      checksum,
    }
  };
}
