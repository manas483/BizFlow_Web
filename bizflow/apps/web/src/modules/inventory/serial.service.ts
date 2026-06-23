/**
 * Serial Service — per-unit serial/IMEI tracking linked to inventory layers.
 *
 * Provides:
 * - assignSerials()    — Assign serial numbers to a layer on receipt
 * - consumeSerial()    — Mark serial as sold, link to SaleItem
 * - returnSerial()     — Mark serial as returned
 * - getSerialHistory() — Full lifecycle of a serial number
 * - getSerialsByLayer() — All serials for a layer
 * - searchSerials()    — Search across all serials
 */

import { prisma } from '@/shared/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AssignSerialsParams {
  layerId: string;
  serials: Array<{
    serialNumber: string;
    imei?: string;
  }>;
  businessId: string;
  tx?: any;
}

export interface ConsumeSerialParams {
  serialNumber: string;
  soldToId?: string;       // Customer ID
  saleItemId?: string;     // Link to SaleItem
  businessId: string;
  tx?: any;
}

export interface ReturnSerialParams {
  serialNumber: string;
  businessId: string;
  tx?: any;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class SerialService {
  /**
   * Assign serial numbers to an inventory layer.
   * Validates the count does not exceed layer's original quantity.
   */
  static async assignSerials(params: AssignSerialsParams): Promise<string[]> {
    const { layerId, serials, businessId, tx = prisma } = params;

    // Verify layer exists and belongs to business
    const layer = await tx.inventoryLayer.findFirst({
      where: { id: layerId, businessId },
      select: { id: true, originalQty: true },
    });

    if (!layer) {
      throw new Error(`Layer ${layerId} not found`);
    }

    // Check existing serial count for this layer
    const existingCount = await tx.inventorySerial.count({
      where: { layerId },
    });

    if (existingCount + serials.length > layer.originalQty) {
      throw new Error(
        `Cannot assign ${serials.length} serials — layer has ${layer.originalQty} units, ` +
        `${existingCount} already assigned`
      );
    }

    // Check for duplicate serial numbers within the business
    const serialNumbers = serials.map(s => s.serialNumber);
    const duplicates = await tx.inventorySerial.findMany({
      where: {
        businessId,
        serialNumber: { in: serialNumbers },
      },
      select: { serialNumber: true },
    });

    if (duplicates.length > 0) {
      const dupeNos = duplicates.map((d: any) => d.serialNumber).join(', ');
      throw new Error(`Duplicate serial numbers: ${dupeNos}`);
    }

    // Create serial records
    const createdIds: string[] = [];
    for (const serial of serials) {
      const created = await tx.inventorySerial.create({
        data: {
          layerId,
          serialNumber: serial.serialNumber,
          imei: serial.imei || null,
          status: 'IN_STOCK',
          businessId,
        },
      });
      createdIds.push(created.id);
    }

    return createdIds;
  }

  /**
   * Mark a serial as sold and link to a SaleItem.
   */
  static async consumeSerial(params: ConsumeSerialParams): Promise<void> {
    const { serialNumber, soldToId, saleItemId, businessId, tx = prisma } = params;

    const serial = await tx.inventorySerial.findFirst({
      where: {
        businessId,
        serialNumber,
        status: 'IN_STOCK',
      },
    });

    if (!serial) {
      throw Object.assign(
        new Error(`Serial ${serialNumber} not found or not available`),
        { code: 'SERIAL_NOT_FOUND' }
      );
    }

    await tx.inventorySerial.update({
      where: { id: serial.id },
      data: {
        status: 'SOLD',
        soldToId: soldToId || null,
        saleItemId: saleItemId || null,
      },
    });
  }

  /**
   * Mark a serial as returned (sales return).
   */
  static async returnSerial(params: ReturnSerialParams): Promise<void> {
    const { serialNumber, businessId, tx = prisma } = params;

    const serial = await tx.inventorySerial.findFirst({
      where: {
        businessId,
        serialNumber,
        status: 'SOLD',
      },
    });

    if (!serial) {
      throw Object.assign(
        new Error(`Serial ${serialNumber} not found or not in SOLD status`),
        { code: 'SERIAL_NOT_FOUND' }
      );
    }

    await tx.inventorySerial.update({
      where: { id: serial.id },
      data: {
        status: 'RETURNED',
        soldToId: null,
        saleItemId: null,
      },
    });
  }

  /**
   * Get full lifecycle history of a serial number.
   */
  static async getSerialHistory(serialNumber: string, businessId: string) {
    const serial = await prisma.inventorySerial.findFirst({
      where: { businessId, serialNumber },
      include: {
        layer: {
          select: {
            id: true,
            receiptNo: true,
            receiptDate: true,
            unitCost: true,
            batchNo: true,
            lotNo: true,
            warehouseId: true,
            product: { select: { id: true, name: true, sku: true } },
            warehouse: { select: { id: true, name: true } },
          },
        },
      },
    });

    return serial;
  }

  /**
   * Get all serials assigned to a specific layer.
   */
  static async getSerialsByLayer(layerId: string, businessId: string) {
    return prisma.inventorySerial.findMany({
      where: { layerId, businessId },
      orderBy: { serialNumber: 'asc' },
    });
  }

  /**
   * Search serials across the entire business.
   */
  static async searchSerials(
    businessId: string,
    params: {
      query?: string;
      status?: string;
      productId?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const { query, status, productId, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: any = { businessId };
    if (status) where.status = status;

    if (query) {
      where.OR = [
        { serialNumber: { contains: query, mode: 'insensitive' } },
        { imei: { contains: query, mode: 'insensitive' } },
      ];
    }

    // If filtering by product, need to go through layer
    if (productId) {
      where.layer = { itemId: productId };
    }

    const [serials, total] = await Promise.all([
      prisma.inventorySerial.findMany({
        where,
        include: {
          layer: {
            select: {
              id: true,
              receiptNo: true,
              batchNo: true,
              unitCost: true,
              product: { select: { id: true, name: true, sku: true } },
              warehouse: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inventorySerial.count({ where }),
    ]);

    return {
      data: serials,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Mark a serial as damaged.
   */
  static async markDamaged(params: {
    serialNumber: string;
    businessId: string;
    tx?: any;
  }): Promise<void> {
    const { serialNumber, businessId, tx = prisma } = params;

    const serial = await tx.inventorySerial.findFirst({
      where: {
        businessId,
        serialNumber,
        status: { in: ['IN_STOCK', 'RETURNED'] },
      },
    });

    if (!serial) {
      throw new Error(`Serial ${serialNumber} not found or not available for damage marking`);
    }

    await tx.inventorySerial.update({
      where: { id: serial.id },
      data: { status: 'DAMAGED' },
    });
  }
}
