/**
 * Landed Cost Allocator — distributes shared expenses across multiple inventory layers.
 *
 * Supports 5 allocation methods:
 *   BY_QUANTITY — proportional to layer quantity
 *   BY_WEIGHT   — proportional to product weight (requires Product.weight or custom input)
 *   BY_VOLUME   — proportional to product volume (requires custom input)
 *   BY_VALUE    — proportional to layer purchase cost
 *   MANUAL      — user-specified amounts per layer
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type AllocationMethod = 'BY_QUANTITY' | 'BY_WEIGHT' | 'BY_VOLUME' | 'BY_VALUE' | 'MANUAL';

export interface LayerAllocationInput {
  layerId: string;
  quantity: number;
  purchaseCost: number;
  weight?: number;
  volume?: number;
  manualAmount?: number;       // Only used for MANUAL method
}

export interface LandedCostAllocationInput {
  expenseAmount: number;
  expenseType: string;
  allocationMethod: AllocationMethod;
  layers: LayerAllocationInput[];
  remarks?: string;
}

export interface LayerAllocationResult {
  layerId: string;
  allocatedAmount: number;
}

// ── Allocator ────────────────────────────────────────────────────────────────

/**
 * Allocate a shared expense across multiple layers using the specified method.
 *
 * Returns an array of { layerId, allocatedAmount }.
 *
 * For BY_WEIGHT and BY_VOLUME, the relevant dimension must be provided
 * in each layer input. If any layer is missing the dimension, the allocation
 * falls back to BY_QUANTITY with a console warning.
 */
export function allocateLandedCost(input: LandedCostAllocationInput): LayerAllocationResult[] {
  const { expenseAmount, allocationMethod, layers } = input;

  if (!layers.length) return [];
  if (expenseAmount === 0) return layers.map(l => ({ layerId: l.layerId, allocatedAmount: 0 }));

  switch (allocationMethod) {
    case 'BY_QUANTITY':
      return allocateByQuantity(expenseAmount, layers);

    case 'BY_WEIGHT':
      // Validate all layers have weight
      if (layers.some(l => !l.weight || l.weight <= 0)) {
        console.warn('[LandedCostAllocator] Missing weight data, falling back to BY_QUANTITY');
        return allocateByQuantity(expenseAmount, layers);
      }
      return allocateByDimension(expenseAmount, layers, 'weight');

    case 'BY_VOLUME':
      if (layers.some(l => !l.volume || l.volume <= 0)) {
        console.warn('[LandedCostAllocator] Missing volume data, falling back to BY_QUANTITY');
        return allocateByQuantity(expenseAmount, layers);
      }
      return allocateByDimension(expenseAmount, layers, 'volume');

    case 'BY_VALUE':
      return allocateByValue(expenseAmount, layers);

    case 'MANUAL':
      return allocateManual(expenseAmount, layers);

    default:
      return allocateByQuantity(expenseAmount, layers);
  }
}

// ── Allocation Strategies ────────────────────────────────────────────────────

function allocateByQuantity(total: number, layers: LayerAllocationInput[]): LayerAllocationResult[] {
  const totalQty = layers.reduce((sum, l) => sum + l.quantity, 0);
  if (totalQty <= 0) return layers.map(l => ({ layerId: l.layerId, allocatedAmount: 0 }));

  return distributeProportionally(
    total,
    layers.map(l => ({ layerId: l.layerId, proportion: l.quantity / totalQty }))
  );
}

function allocateByDimension(
  total: number,
  layers: LayerAllocationInput[],
  dimension: 'weight' | 'volume'
): LayerAllocationResult[] {
  const totalDim = layers.reduce((sum, l) => sum + (l[dimension] || 0), 0);
  if (totalDim <= 0) return layers.map(l => ({ layerId: l.layerId, allocatedAmount: 0 }));

  return distributeProportionally(
    total,
    layers.map(l => ({ layerId: l.layerId, proportion: (l[dimension] || 0) / totalDim }))
  );
}

function allocateByValue(total: number, layers: LayerAllocationInput[]): LayerAllocationResult[] {
  const totalValue = layers.reduce((sum, l) => sum + l.purchaseCost, 0);
  if (totalValue <= 0) return layers.map(l => ({ layerId: l.layerId, allocatedAmount: 0 }));

  return distributeProportionally(
    total,
    layers.map(l => ({ layerId: l.layerId, proportion: l.purchaseCost / totalValue }))
  );
}

function allocateManual(total: number, layers: LayerAllocationInput[]): LayerAllocationResult[] {
  // Use manualAmount from each layer. If total doesn't match, scale proportionally.
  const specifiedTotal = layers.reduce((sum, l) => sum + (l.manualAmount || 0), 0);

  if (specifiedTotal === 0) {
    // Fall back to equal distribution
    const equal = round4(total / layers.length);
    const results = layers.map(l => ({ layerId: l.layerId, allocatedAmount: equal }));
    // Fix rounding — assign remainder to last layer
    const distributed = results.reduce((s, r) => s + r.allocatedAmount, 0);
    if (results.length > 0) {
      results[results.length - 1].allocatedAmount = round4(results[results.length - 1].allocatedAmount + (total - distributed));
    }
    return results;
  }

  // Scale to match total if manual amounts don't add up
  const scale = total / specifiedTotal;
  return distributeProportionally(
    total,
    layers.map(l => ({ layerId: l.layerId, proportion: ((l.manualAmount || 0) * scale) / total }))
  );
}

// ── Distribution Helper ──────────────────────────────────────────────────────

/**
 * Distribute a total amount proportionally, handling rounding correctly.
 * The last item absorbs any rounding difference to ensure exact total.
 */
function distributeProportionally(
  total: number,
  items: Array<{ layerId: string; proportion: number }>
): LayerAllocationResult[] {
  const results: LayerAllocationResult[] = items.map(item => ({
    layerId: item.layerId,
    allocatedAmount: round4(total * item.proportion),
  }));

  // Fix rounding — ensure distributed total matches original total exactly
  const distributed = results.reduce((sum, r) => sum + r.allocatedAmount, 0);
  const diff = round4(total - distributed);
  if (diff !== 0 && results.length > 0) {
    results[results.length - 1].allocatedAmount = round4(
      results[results.length - 1].allocatedAmount + diff
    );
  }

  return results;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
