/**
 * Loose Inventory Utilities — shared functions for loose sale module.
 *
 * All loose-enabled products store inventory in a single source of truth: `baseStock` (Decimal),
 * measured in the smallest base unit (Kg, Liter, g, ml, etc.). These utilities handle conversions,
 * display formatting, stock validation, and the `updateLooseStock` write guard.
 */

import { prisma } from '@/shared/lib/db';

// ── Conversion Utilities ─────────────────────────────────────────────────────

/**
 * Convert packaging quantity to base-unit deduction.
 * e.g., qty=2, factor=50 → 100 Kg
 * e.g., qty=5, factor=1 (loose Kg) → 5 Kg
 */
export function packToBaseUnit(qty: number, conversionFactor: number): number {
  return qty * conversionFactor;
}

/**
 * Convert base-unit deduction to bag-equivalent for layer consumption.
 * The costing engine always works in primary purchase units (bags).
 * e.g., deduction=75 Kg, primaryFactor=50 → 1.5 bags for layer consumption
 */
export function baseToLayerQty(baseDeduction: number, primaryFactor: number): number {
  if (primaryFactor <= 0) throw new Error('Primary factor must be positive');
  return baseDeduction / primaryFactor;
}

/**
 * Derive Product.stock (Int) from baseStock for the transitional compatibility field.
 * e.g., baseStock=4895, primaryFactor=50 → stock=97 (floor)
 */
export function deriveStockFromBase(baseStock: number, primaryFactor: number): number {
  if (primaryFactor <= 0) return 0;
  return Math.floor(baseStock / primaryFactor);
}

// ── Display Utilities ────────────────────────────────────────────────────────

/**
 * Convert base-unit quantity to primary-pack breakdown for display.
 *
 * @example
 * formatLooseStock(4895, 50, "Bag", "Kg")
 * → { wholePacks: 97, remainder: 45, display: "97 Bags + 45 Kg" }
 *
 * formatLooseStock(5000, 50, "Bag", "Kg")
 * → { wholePacks: 100, remainder: 0, display: "100 Bags" }
 *
 * formatLooseStock(12, 50, "Bag", "Kg")
 * → { wholePacks: 0, remainder: 12, display: "12 Kg" }
 */
export function formatLooseStock(
  baseQty: number,
  primaryFactor: number,
  purchaseUnit: string,
  baseUnit: string
): { wholePacks: number; remainder: number; display: string } {
  if (primaryFactor <= 0) {
    return { wholePacks: 0, remainder: baseQty, display: `${baseQty} ${baseUnit}` };
  }

  const wholePacks = Math.floor(baseQty / primaryFactor);
  // Use modulo with rounding to avoid floating-point noise
  const remainder = Math.round((baseQty - wholePacks * primaryFactor) * 1000) / 1000;

  const packLabel = wholePacks === 1 ? purchaseUnit : `${purchaseUnit}s`;

  if (wholePacks === 0) {
    return { wholePacks: 0, remainder, display: `${remainder} ${baseUnit}` };
  }
  if (remainder === 0 || remainder < 0.001) {
    return { wholePacks, remainder: 0, display: `${wholePacks} ${packLabel}` };
  }
  return { wholePacks, remainder, display: `${wholePacks} ${packLabel} + ${remainder} ${baseUnit}` };
}

// ── Stock Validation ─────────────────────────────────────────────────────────

/**
 * Validate that baseStock has enough for a deduction.
 */
export function canDeduct(deduction: number, currentBaseStock: number): boolean {
  return deduction <= currentBaseStock;
}

// ── Write Guard: updateLooseStock ────────────────────────────────────────────

/**
 * The ONLY function allowed to modify stock for loose-enabled products.
 *
 * Updates `baseStock` (single source of truth) and derives `stock` (transitional
 * compatibility field) in the same transaction. Any direct writes to `Product.stock`
 * for loose products is a bug.
 *
 * @param tx - Prisma transaction client
 * @param productId - Product to update
 * @param baseStockDelta - Change in base units (negative for sales/removals, positive for purchases/additions)
 * @param primaryFactor - Conversion factor of the primary purchase packaging
 * @returns The new baseStock value
 * @throws If the resulting baseStock would be negative
 */
export async function updateLooseStock(
  tx: any,
  productId: string,
  baseStockDelta: number,
  primaryFactor: number,
): Promise<number> {
  // Use a raw query with FOR UPDATE to acquire a row lock.
  // This guarantees serialization under high concurrency (e.g., multiple cashiers selling the same loose product),
  // preventing lost updates or overselling.
  const products = await tx.$queryRaw<Array<{ baseStock: any, name: string }>>`
    SELECT "baseStock", "name" 
    FROM "Product" 
    WHERE id = ${productId} 
    FOR UPDATE
  `;

  if (!products || products.length === 0) {
    throw new Error(`Product not found: ${productId}`);
  }

  const product = products[0];

  const currentBase = Number(product.baseStock) || 0;
  const newBase = currentBase + baseStockDelta;

  if (newBase < 0) {
    throw new Error(`Insufficient stock for "${product.name}" (need ${Math.abs(baseStockDelta)}, have ${currentBase})`);
  }

  await tx.product.update({
    where: { id: productId },
    data: {
      baseStock: newBase,                              // single source of truth
      stock: deriveStockFromBase(newBase, primaryFactor), // transitional compatibility
    },
  });

  return newBase;
}

/**
 * Get the primary packaging (purchase unit) for a loose-enabled product.
 * Returns the conversion factor used for display and layer calculations.
 */
export async function getPrimaryPackaging(
  tx: any,
  productId: string,
): Promise<{ id: string; label: string; unit: string; conversionFactor: number } | null> {
  const pkg = await tx.productPackaging.findFirst({
    where: { productId, isPurchaseUnit: true, active: true },
    select: { id: true, label: true, unit: true, conversionFactor: true },
  });
  if (!pkg) return null;
  return { ...pkg, conversionFactor: Number(pkg.conversionFactor) };
}
