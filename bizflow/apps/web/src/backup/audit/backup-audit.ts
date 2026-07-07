import { prisma } from '@/shared/lib/db';

export type BackupAuditAction = 'BACKUP_CREATED' | 'RESTORE_DRY_RUN' | 'RESTORE_FULL';

export async function logBackupAudit(
  businessId: string,
  userId: string,
  userName: string,
  action: BackupAuditAction,
  entityId: string,
  entityLabel: string,
  metadata?: any,
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        userName,
        action,
        entityType: 'Backup',
        entityId,
        entityLabel,
        changes: metadata ? JSON.parse(JSON.stringify(metadata)) : {}, // Prisma requires valid JSON
        ipAddress: ipAddress || 'unknown'
      }
    });
  } catch (error) {
    // Log the error but do not throw, as audit logging shouldn't crash the core operation
    console.error('Failed to write backup audit log:', error);
  }
}
