/**
 * Period Closing — month-end / period-end inventory snapshots and locking.
 *
 * Provides:
 * - closeInventoryPeriod()  — Snapshots all active layers, creates InventoryPeriodClosing
 * - isPeriodLocked()        — Checks if a date falls within a locked period
 * - reopenPeriod()          — Re-opens a closed period (SUPER_ADMIN only)
 * - getPeriodClosings()     — List all period closings for the business
 *
 * Once a period is CLOSED or LOCKED, no backdated transactions should be
 * allowed in that period unless it's reopened.
 */

import { prisma } from '@/shared/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────

export type PeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

export interface CloseInventoryPeriodParams {
  period: string;                // e.g. "2026-03", "2026-Q1"
  closingDate?: Date;            // Defaults to end of period
  closedBy?: string;             // userId
  businessId: string;
  tx?: any;
}

export interface PeriodClosingResult {
  id: string;
  period: string;
  status: PeriodStatus;
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  closingDate: Date;
}

interface LayerSnapshot {
  itemId: string;
  productName: string;
  warehouseId: string | null;
  batchNo: string | null;
  remainingQty: number;
  unitCost: number;
  value: number;
  layerId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Parse a period string and return the start and end dates.
 * Supports formats: "2026-03" (monthly), "2026-Q1" (quarterly)
 */
function parsePeriodDates(period: string): { start: Date; end: Date } {
  // Monthly: "2026-03"
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = parseInt(monthMatch[1], 10);
    const month = parseInt(monthMatch[2], 10);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month
    return { start, end };
  }

  // Quarterly: "2026-Q1"
  const quarterMatch = period.match(/^(\d{4})-Q(\d)$/);
  if (quarterMatch) {
    const year = parseInt(quarterMatch[1], 10);
    const quarter = parseInt(quarterMatch[2], 10);
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    return { start, end };
  }

  throw new Error(`Invalid period format: ${period}. Expected "YYYY-MM" or "YYYY-QN"`);
}

// ── Period Closing Logic ─────────────────────────────────────────────────────

/**
 * Close an inventory period — create a snapshot of all active layers.
 *
 * Logic:
 * 1. Verify period hasn't already been closed
 * 2. Fetch all active layers with remaining quantity
 * 3. Calculate totals
 * 4. Create InventoryPeriodClosing with snapshot data
 * 5. Set status to CLOSED
 */
export async function closeInventoryPeriod(
  params: CloseInventoryPeriodParams
): Promise<PeriodClosingResult> {
  const { period, closedBy, businessId, tx = prisma } = params;

  // Validate period format
  parsePeriodDates(period);

  // Check if period already exists
  const existing = await tx.inventoryPeriodClosing.findUnique({
    where: { businessId_period: { businessId, period } },
  });

  if (existing) {
    if (existing.status === 'CLOSED' || existing.status === 'LOCKED') {
      throw new Error(`Period ${period} has already been closed`);
    }
  }

  const closingDate = params.closingDate || new Date();

  // Fetch all active layers
  const layers = await tx.inventoryLayer.findMany({
    where: {
      businessId,
      status: 'ACTIVE',
      remainingQty: { gt: 0 },
    },
    include: {
      product: { select: { name: true } },
    },
  });

  // Build snapshot
  const snapshotData: LayerSnapshot[] = layers.map((l: any) => ({
    itemId: l.itemId,
    productName: l.product?.name || 'Unknown',
    warehouseId: l.warehouseId,
    batchNo: l.batchNo,
    remainingQty: l.remainingQty,
    unitCost: l.unitCost,
    value: round2(l.remainingQty * l.unitCost),
    layerId: l.id,
  }));

  // Calculate totals
  const uniqueItems = new Set(snapshotData.map(s => s.itemId));
  const totalQuantity = round2(snapshotData.reduce((sum, s) => sum + s.remainingQty, 0));
  const totalValue = round2(snapshotData.reduce((sum, s) => sum + s.value, 0));

  // Create or update period closing
  const periodClosing = existing
    ? await tx.inventoryPeriodClosing.update({
        where: { id: existing.id },
        data: {
          closingDate,
          status: 'CLOSED',
          totalItems: uniqueItems.size,
          totalQuantity,
          totalValue,
          snapshotData: snapshotData as any,
          closedBy: closedBy || null,
        },
      })
    : await tx.inventoryPeriodClosing.create({
        data: {
          period,
          closingDate,
          status: 'CLOSED',
          totalItems: uniqueItems.size,
          totalQuantity,
          totalValue,
          snapshotData: snapshotData as any,
          closedBy: closedBy || null,
          businessId,
        },
      });

  return {
    id: periodClosing.id,
    period: periodClosing.period,
    status: periodClosing.status as PeriodStatus,
    totalItems: periodClosing.totalItems,
    totalQuantity: periodClosing.totalQuantity,
    totalValue: periodClosing.totalValue,
    closingDate: periodClosing.closingDate,
  };
}

/**
 * Lock a closed period — prevents any further modifications.
 * After locking, the period cannot be reopened without SUPER_ADMIN intervention.
 */
export async function lockPeriod(
  period: string,
  businessId: string,
  tx: any = prisma
): Promise<void> {
  const existing = await tx.inventoryPeriodClosing.findUnique({
    where: { businessId_period: { businessId, period } },
  });

  if (!existing) {
    throw new Error(`Period ${period} not found — close it first`);
  }

  if (existing.status === 'LOCKED') {
    return; // Already locked
  }

  if (existing.status !== 'CLOSED') {
    throw new Error(`Period ${period} must be CLOSED before it can be LOCKED (current: ${existing.status})`);
  }

  await tx.inventoryPeriodClosing.update({
    where: { id: existing.id },
    data: { status: 'LOCKED' },
  });
}

/**
 * Check if a date falls within a closed or locked period.
 * Used to prevent backdated transactions in locked periods.
 */
export async function isPeriodLocked(
  date: Date,
  businessId: string,
  tx: any = prisma
): Promise<{ locked: boolean; period?: string }> {
  // Get all closed/locked periods
  const closings = await tx.inventoryPeriodClosing.findMany({
    where: {
      businessId,
      status: { in: ['CLOSED', 'LOCKED'] },
    },
    select: { period: true, closingDate: true, status: true },
  });

  for (const closing of closings) {
    try {
      const { start, end } = parsePeriodDates(closing.period);
      if (date >= start && date <= end) {
        return { locked: true, period: closing.period };
      }
    } catch {
      // Skip invalid period formats
      continue;
    }
  }

  return { locked: false };
}

/**
 * Re-open a closed period (SUPER_ADMIN only).
 * Sets the period back to OPEN status.
 */
export async function reopenPeriod(
  period: string,
  businessId: string,
  tx: any = prisma
): Promise<void> {
  const existing = await tx.inventoryPeriodClosing.findUnique({
    where: { businessId_period: { businessId, period } },
  });

  if (!existing) {
    throw new Error(`Period ${period} not found`);
  }

  if (existing.status === 'OPEN') {
    return; // Already open
  }

  await tx.inventoryPeriodClosing.update({
    where: { id: existing.id },
    data: { status: 'OPEN' },
  });
}

/**
 * List all period closings for a business.
 */
export async function getPeriodClosings(
  businessId: string,
  params?: { page?: number; limit?: number }
) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  const skip = (page - 1) * limit;

  const [records, total] = await Promise.all([
    prisma.inventoryPeriodClosing.findMany({
      where: { businessId },
      orderBy: { closingDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.inventoryPeriodClosing.count({ where: { businessId } }),
  ]);

  return {
    data: records,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
