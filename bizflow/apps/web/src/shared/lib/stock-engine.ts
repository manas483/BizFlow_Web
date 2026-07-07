/**
 * Stock Engine — centralized inventory management functions.
 *
 * Handles stock adjustments for sales, returns, and transfers.
 * Generates reorder alerts when stock falls below reorder level.
 * Checks AutomationSettings before executing.
 */

import { prisma } from '@/shared/lib/db';
import { consumeLayers, type LayerConsumptionResult } from '@/shared/lib/layer-engine';

// ── Types ────────────────────────────────────────────────────────────────────

export type StockAdjustmentType = 'purchase' | 'sale' | 'sale_return' | 'purchase_return' | 'transfer' | 'manual';

export interface StockAdjustmentParams {
  productId: string;
  qty: number;
  type: StockAdjustmentType;
  businessId: string;
  tx?: any; // Prisma transaction client
}

export interface ReorderAlert {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  reorderLevel: number;
  minStock: number;
  suggestedQty: number;
  preferredSupplier: string | null;
  category: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function isAutoStockEnabled(businessId: string): Promise<boolean> {
  const settings = await prisma.automationSettings.findUnique({
    where: { businessId },
    select: { autoStockUpdate: true },
  });
  return settings?.autoStockUpdate ?? true;
}

async function isAutoReorderEnabled(businessId: string): Promise<boolean> {
  const settings = await prisma.automationSettings.findUnique({
    where: { businessId },
    select: { autoReorderAlert: true },
  });
  return settings?.autoReorderAlert ?? true;
}

// ── Stock Adjustment ─────────────────────────────────────────────────────────

/**
 * Adjust stock for a product based on transaction type.
 *
 * - purchase / sale_return → increment stock
 * - sale / purchase_return → decrement stock
 * - transfer → no net change (handled separately)
 * - manual → direct set (not used here, but available)
 *
 * After adjusting, checks if stock is below reorder level and creates
 * a notification if needed.
 *
 * @returns The updated product
 */
export async function adjustStock(params: StockAdjustmentParams) {
  const { productId, qty, type, businessId, tx = prisma } = params;

  if (!await isAutoStockEnabled(businessId)) {
    // Return current product without adjusting
    return tx.product.findUnique({ where: { id: productId } });
  }

  // Determine the stock change direction
  let increment = 0;
  switch (type) {
    case 'purchase':
    case 'sale_return':
      increment = qty;
      break;
    case 'sale':
    case 'purchase_return':
      increment = -qty;
      break;
    case 'transfer':
    case 'manual':
      // Transfer and manual are handled differently
      return tx.product.findUnique({ where: { id: productId } });
  }

  const updatedProduct = await tx.product.update({
    where: { id: productId },
    data: { stock: { increment } },
  });

  // Check reorder level and create notification if needed
  if (updatedProduct.stock <= (updatedProduct.reorderLevel || updatedProduct.minStock)) {
    await checkAndNotifyReorder(updatedProduct, businessId, tx);
  }

  return updatedProduct;
}

/**
 * Check if a product needs reorder notification and create one if so.
 * Avoids duplicate unread notifications for the same product.
 */
async function checkAndNotifyReorder(
  product: any,
  businessId: string,
  tx: any = prisma
): Promise<void> {
  try {
    if (!await isAutoReorderEnabled(businessId)) return;

    // Check if a recent unread notification already exists
    const existing = await tx.notification.findFirst({
      where: {
        businessId,
        category: 'inventory',
        sourceType: 'stock',
        sourceId: product.id,
        read: false,
      },
    });

    if (existing) return; // Don't spam

    const reorderLevel = product.reorderLevel || product.minStock;
    const suggestedQty = Math.max(reorderLevel * 2 - product.stock, reorderLevel);

    await tx.notification.create({
      data: {
        type: 'alert',
        title: 'Low Stock Alert',
        message: `"${product.name}" stock is low (${product.stock} left, reorder level: ${reorderLevel}). Suggested reorder: ${suggestedQty} units.`,
        priority: product.stock <= 0 ? 'urgent' : 'high',
        category: 'inventory',
        sourceType: 'stock',
        sourceId: product.id,
        businessId,
      },
    });
  } catch (err) {
    console.error('[StockEngine] Failed to create reorder notification:', err);
  }
}

// ── Reorder Alerts ───────────────────────────────────────────────────────────

/**
 * Get all products that need reordering for a business.
 * Returns products where current stock <= reorder level (or minStock if reorderLevel is 0).
 */
export async function getReorderAlerts(businessId: string): Promise<ReorderAlert[]> {
  // Fetch all products and filter in-memory since Prisma doesn't support
  // comparing two columns directly in WHERE
  const products = await prisma.product.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      sku: true,
      stock: true,
      minStock: true,
      reorderLevel: true,
      preferredSupplier: true,
      category: true,
    },
  });

  return products
    .filter((p) => {
      const threshold = p.reorderLevel > 0 ? p.reorderLevel : p.minStock;
      return p.stock <= threshold;
    })
    .map((p) => {
      const threshold = p.reorderLevel > 0 ? p.reorderLevel : p.minStock;
      const suggestedQty = Math.max(threshold * 2 - p.stock, threshold);

      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        currentStock: p.stock,
        reorderLevel: p.reorderLevel > 0 ? p.reorderLevel : p.minStock,
        minStock: p.minStock,
        suggestedQty,
        preferredSupplier: p.preferredSupplier,
        category: p.category,
      };
    })
    .sort((a, b) => a.currentStock - b.currentStock); // Most critical first
}

/**
 * Get stock summary for a business — available, reserved, total.
 */
export async function getStockSummary(businessId: string) {
  const products = await prisma.product.findMany({
    where: { businessId },
    select: { stock: true, reservedStock: true },
  });

  const totalStock = products.reduce((s, p) => s + p.stock, 0);
  const reservedStock = products.reduce((s, p) => s + p.reservedStock, 0);
  const availableStock = totalStock - reservedStock;
  const totalProducts = products.length;

  return { totalStock, reservedStock, availableStock, totalProducts };
}

// ── Layer-Aware Stock Adjustment ─────────────────────────────────────────────

export interface AdjustStockWithLayersParams {
  productId: string;
  qty: number;
  type: StockAdjustmentType;
  businessId: string;
  warehouseId?: string;
  transactionId: string;
  transactionType: string;
  specificLayerId?: string;    // For SPECIFIC identification method
  skipStockUpdate?: boolean;   // If true, skip Product.stock update (caller manages stock, e.g. loose products)
  skipMovement?: boolean;      // If true, skip StockMovement creation (caller creates its own)
  tx?: any;
}

/**
 * Layer-aware stock adjustment.
 *
 * For outbound movements (sale, purchase_return):
 *   Consumes inventory layers via the business's costing method (FIFO/LIFO/WAC/etc.)
 *   Returns the COGS breakdown from consumed layers.
 *
 * For inbound movements (purchase, sale_return):
 *   Only adjusts the product stock count (layers are created separately by createLayer).
 *
 * Always updates Product.stock and creates a StockMovement record,
 * unless skipStockUpdate / skipMovement are set (used for loose-enabled products
 * where the caller manages baseStock and stock movements directly).
 */
export async function adjustStockWithLayers(params: AdjustStockWithLayersParams): Promise<LayerConsumptionResult | null> {
  const {
    productId,
    qty,
    type,
    businessId,
    warehouseId,
    transactionId,
    transactionType,
    specificLayerId,
    skipStockUpdate = false,
    skipMovement = false,
    tx = prisma,
  } = params;

  if (qty === 0) return null;

  if (!await isAutoStockEnabled(businessId)) {
    return null;
  }

  let layerResult: LayerConsumptionResult | null = null;

  // Determine stock direction and whether to consume layers
  let increment = 0;
  switch (type) {
    case 'sale':
    case 'purchase_return': {
      increment = -qty;

      // Consume from inventory layers
      layerResult = await consumeLayers({
        itemId: productId,
        warehouseId,
        quantity: qty,
        transactionId,
        transactionType,
        specificLayerId,
        businessId,
        tx,
      });
      break;
    }
    case 'purchase':
    case 'sale_return': {
      increment = qty;
      // Layers are created by createLayer() in the calling code, not here
      break;
    }
    case 'transfer':
    case 'manual': {
      // Transfers handled by transfer-engine; manual adjustments may or may not consume layers
      return null;
    }
  }

  // Update product stock count (skip for loose products — caller manages baseStock)
  if (!skipStockUpdate) {
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { stock: { increment } },
    });

    // Check reorder level
    if (updatedProduct.stock <= (updatedProduct.reorderLevel || updatedProduct.minStock)) {
      await checkAndNotifyReorder(updatedProduct, businessId, tx);
    }
  }

  // Create stock movement record (skip for loose products — caller creates its own)
  if (!skipMovement) {
    await tx.stockMovement.create({
      data: {
        productId,
        warehouseId: warehouseId || null,
        type: increment > 0 ? 'IN' : 'OUT',
        quantity: increment,
        referenceId: transactionId,
        notes: `${transactionType}: ${transactionId}`,
        businessId,
      },
    });
  }

  return layerResult;
}
