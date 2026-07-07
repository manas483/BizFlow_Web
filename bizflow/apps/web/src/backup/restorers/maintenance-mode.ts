/**
 * Simple in-memory lock for maintenance mode.
 * In a multi-instance production environment, this should be replaced
 * with a Redis-backed distributed lock or a database flag.
 */

const maintenanceLocks = new Set<string>();

export function enterMaintenanceMode(businessId: string): void {
  if (maintenanceLocks.has(businessId)) {
    throw new Error(`Business ${businessId} is already in maintenance mode. Cannot perform overlapping restore/backup operations.`);
  }
  maintenanceLocks.add(businessId);
}

export function exitMaintenanceMode(businessId: string): void {
  maintenanceLocks.delete(businessId);
}

export function isMaintenanceMode(businessId: string): boolean {
  return maintenanceLocks.has(businessId);
}
