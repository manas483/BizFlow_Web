/**
 * Layer Service — query and management service for inventory layers.
 *
 * Provides read operations for the UI/API layer:
 * - Layer listing, filtering, pagination
 * - Cost breakdown queries
 * - Consumption history
 * - Inventory valuation reports
 * - Expiring stock alerts
 */

import { prisma } from '@/shared/lib/db';
import {
  applyLateLandedCost,
  type LateLandedCostResult,
} from '@/shared/lib/layer-engine';
import {
  allocateLandedCost,
  type AllocationMethod,
  type LayerAllocationInput,
} from '@/shared/lib/landed-cost-allocator';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LayerFilters {
  productId?: string;
  warehouseId?: string;
  status?: string;          // ACTIVE | EXHAUSTED | RETURNED
  batchNo?: string;
  page?: number;
  limit?: number;
}

export interface InventoryValuationRow {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  warehouseId: string | null;
  totalQty: number;
  totalValue: number;
  avgUnitCost: number;
  layerCount: number;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class LayerService {
  /**
   * Get layers for a product with cost breakdown.
   * Supports filtering by warehouse, status, batch, and pagination.
   */
  static async getLayersByProduct(businessId: string, filters: LayerFilters) {
    const { productId, warehouseId, status, batchNo, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { businessId };
    if (productId) where.itemId = productId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (status) where.status = status;
    if (batchNo) where.batchNo = { contains: batchNo, mode: 'insensitive' };

    const [layers, total] = await Promise.all([
      prisma.inventoryLayer.findMany({
        where,
        include: {
          costs: true,
          product: { select: { id: true, name: true, sku: true, category: true, unit: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: [{ receiptDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.inventoryLayer.count({ where }),
    ]);

    return {
      data: layers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single layer with full details: costs + consumption history.
   */
  static async getLayerById(layerId: string, businessId: string) {
    return prisma.inventoryLayer.findFirst({
      where: { id: layerId, businessId },
      include: {
        costs: { orderBy: { createdAt: 'asc' } },
        consumptions: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        costAdjustments: { orderBy: { createdAt: 'desc' } },
        product: { select: { id: true, name: true, sku: true, category: true, unit: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Get cost breakdown for a specific layer.
   */
  static async getLayerCosts(layerId: string, businessId: string) {
    // Verify layer belongs to this business
    const layer = await prisma.inventoryLayer.findFirst({
      where: { id: layerId, businessId },
      select: { id: true, landedCost: true, unitCost: true, originalQty: true, remainingQty: true },
    });

    if (!layer) return null;

    const costs = await prisma.inventoryLayerCost.findMany({
      where: { layerId },
      orderBy: { createdAt: 'asc' },
    });

    return { layer, costs };
  }

  /**
   * Get consumption history for a specific layer or transaction.
   */
  static async getConsumptionHistory(
    businessId: string,
    params: { layerId?: string; transactionId?: string; page?: number; limit?: number }
  ) {
    const { layerId, transactionId, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: any = { businessId };
    if (layerId) where.layerId = layerId;
    if (transactionId) where.transactionId = transactionId;

    const [records, total] = await Promise.all([
      prisma.inventoryLayerConsumption.findMany({
        where,
        include: {
          layer: {
            select: {
              id: true,
              receiptNo: true,
              receiptDate: true,
              unitCost: true,
              batchNo: true,
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inventoryLayerConsumption.count({ where }),
    ]);

    return { data: records, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Add a landed cost to an existing layer.
   * If the layer has been partially consumed, this triggers a late cost adjustment.
   */
  static async addLandedCost(params: {
    layerId: string;
    expenseType: string;
    amount: number;
    remarks?: string;
    businessId: string;
  }): Promise<LateLandedCostResult | { message: string }> {
    const { layerId, expenseType, amount, remarks, businessId } = params;

    return prisma.$transaction(async (tx) => {
      const layer = await tx.inventoryLayer.findFirst({
        where: { id: layerId, businessId },
      });

      if (!layer) throw new Error(`Layer ${layerId} not found`);

      const consumedQty = layer.originalQty - layer.remainingQty;

      if (consumedQty > 0) {
        // Layer partially consumed — use late landed cost adjustment
        return applyLateLandedCost({ layerId, expenseType, amount, remarks, businessId, tx });
      }

      // Layer not yet consumed — simple cost addition
      const newLandedCost = layer.landedCost + amount;
      const newUnitCost = newLandedCost / layer.originalQty;

      await tx.inventoryLayer.update({
        where: { id: layerId },
        data: {
          landedCost: Math.round(newLandedCost * 10000) / 10000,
          unitCost: Math.round(newUnitCost * 10000) / 10000,
        },
      });

      await tx.inventoryLayerCost.create({
        data: {
          layerId,
          expenseType,
          amount: Math.round(amount * 10000) / 10000,
          remarks: remarks || null,
        },
      });

      return { message: 'Cost added successfully' };
    });
  }

  /**
   * Allocate a shared expense across multiple layers.
   * Used when a transport bill covers multiple purchase invoices.
   */
  static async allocateExpenseToLayers(params: {
    expenseAmount: number;
    expenseType: string;
    allocationMethod: AllocationMethod;
    layerIds: string[];
    remarks?: string;
    businessId: string;
  }) {
    const { expenseAmount, expenseType, allocationMethod, layerIds, remarks, businessId } = params;

    // Fetch layers
    const layers = await prisma.inventoryLayer.findMany({
      where: { id: { in: layerIds }, businessId },
      select: {
        id: true,
        originalQty: true,
        remainingQty: true,
        purchaseCost: true,
        landedCost: true,
      },
    });

    if (layers.length === 0) throw new Error('No valid layers found');

    // Build allocation inputs
    const allocationInputs: LayerAllocationInput[] = layers.map(l => ({
      layerId: l.id,
      quantity: l.originalQty,
      purchaseCost: l.purchaseCost,
    }));

    // Calculate allocation
    const allocations = allocateLandedCost({
      expenseAmount,
      expenseType,
      allocationMethod,
      layers: allocationInputs,
      remarks,
    });

    // Apply each allocation
    const results = [];
    for (const allocation of allocations) {
      if (allocation.allocatedAmount <= 0) continue;

      const result = await this.addLandedCost({
        layerId: allocation.layerId,
        expenseType,
        amount: allocation.allocatedAmount,
        remarks: remarks || `Shared expense allocation (${allocationMethod})`,
        businessId,
      });

      results.push({ layerId: allocation.layerId, ...result });
    }

    return results;
  }

  /**
   * Get inventory valuation report — total value by product/warehouse.
   */
  static async getInventoryValuation(
    businessId: string,
    warehouseId?: string,
    category?: string
  ): Promise<InventoryValuationRow[]> {
    const where: any = {
      businessId,
      status: 'ACTIVE',
      remainingQty: { gt: 0 },
    };
    if (warehouseId) where.warehouseId = warehouseId;

    const layers = await prisma.inventoryLayer.findMany({
      where,
      include: {
        product: {
          select: { id: true, name: true, sku: true, category: true },
        },
      },
    });

    // Filter by category if provided
    const filtered = category
      ? layers.filter((l: any) => l.product.category === category)
      : layers;

    // Group by product + warehouse
    const groups = new Map<string, {
      productId: string;
      productName: string;
      sku: string;
      category: string;
      warehouseId: string | null;
      totalQty: number;
      totalValue: number;
      layerCount: number;
    }>();

    for (const layer of filtered) {
      const key = `${layer.itemId}:${layer.warehouseId || 'DEFAULT'}`;
      const existing = groups.get(key);

      if (existing) {
        existing.totalQty += layer.remainingQty;
        existing.totalValue += layer.remainingQty * layer.unitCost;
        existing.layerCount += 1;
      } else {
        groups.set(key, {
          productId: (layer as any).product.id,
          productName: (layer as any).product.name,
          sku: (layer as any).product.sku,
          category: (layer as any).product.category,
          warehouseId: layer.warehouseId,
          totalQty: layer.remainingQty,
          totalValue: layer.remainingQty * layer.unitCost,
          layerCount: 1,
        });
      }
    }

    return Array.from(groups.values()).map(g => ({
      ...g,
      avgUnitCost: g.totalQty > 0 ? Math.round((g.totalValue / g.totalQty) * 10000) / 10000 : 0,
    }));
  }

  /**
   * Get layers approaching expiry date.
   */
  static async getExpiringStock(
    businessId: string,
    daysAhead: number = 30
  ) {
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + daysAhead);

    return prisma.inventoryLayer.findMany({
      where: {
        businessId,
        status: 'ACTIVE',
        remainingQty: { gt: 0 },
        expiryDate: { lte: expiryThreshold, not: null },
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }
}
