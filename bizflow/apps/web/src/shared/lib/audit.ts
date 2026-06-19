/**
 * Audit Logger — records immutable audit trail entries for every data mutation.
 *
 * Usage in API routes:
 *   await logAudit({
 *     session,
 *     action: 'CREATE',
 *     entityType: 'Sale',
 *     entityId: sale.id,
 *     entityLabel: sale.invoiceNo,
 *   });
 *
 * For updates, pass the changes object:
 *   await logAudit({
 *     session,
 *     action: 'UPDATE',
 *     entityType: 'Product',
 *     entityId: product.id,
 *     entityLabel: product.name,
 *     changes: { stock: { old: 100, new: 80 } },
 *   });
 */

import { prisma } from './db';
import type { AuthSession } from './api-guard';

interface AuditLogParams {
  session: AuthSession;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  entityLabel?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Compute a changes object by diffing two plain objects.
 * Only includes fields whose values actually changed.
 */
export function computeChanges(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fieldsToTrack?: string[],
): Record<string, { old: unknown; new: unknown }> | undefined {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  const keys = fieldsToTrack ?? Object.keys(newObj);

  for (const key of keys) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    // Skip undefined/missing fields in newObj
    if (newVal === undefined) continue;

    // Simple equality check (covers primitives and null)
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal ?? null, new: newVal ?? null };
    }
  }

  return Object.keys(changes).length > 0 ? changes : undefined;
}

/**
 * Record an audit log entry. Runs as fire-and-forget: errors are caught
 * and logged but never propagated to the caller.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        businessId:  params.session.user.businessId,
        userId:      params.session.user.id,
        userName:    params.session.user.name,
        action:      params.action,
        entityType:  params.entityType,
        entityId:    params.entityId,
        entityLabel: params.entityLabel ?? null,
        changes:     params.changes ? (params.changes as any) : undefined,
        ipAddress:   params.ipAddress ?? null,
        userAgent:   params.userAgent ?? null,
      },
    });
  } catch (err) {
    // Audit logging must NEVER break the application — fail silently
    console.error('[AuditLog] Failed to write audit entry:', err);
  }
}

/**
 * Log a user activity event (enriched version).
 * Wraps the existing UserActivity model with better defaults.
 */
export async function logActivity(params: {
  session: AuthSession;
  eventType: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.userActivity.create({
      data: {
        businessId: params.session.user.businessId,
        userId:     params.session.user.id,
        userName:   params.session.user.name,
        eventType:  params.eventType,
        metadata:   params.metadata ? (params.metadata as any) : undefined,
        ipAddress:  params.ipAddress ?? null,
        userAgent:  params.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error('[Activity] Failed to write activity entry:', err);
  }
}
