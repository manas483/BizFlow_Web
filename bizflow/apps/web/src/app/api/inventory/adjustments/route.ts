export const dynamic = 'force-dynamic';
/**
 * POST /api/inventory/adjustments — Adjust loose-product inventory in base units
 *
 * Supports: spillage, damage, sampling, physical_count, other
 */

import { NextRequest }              from 'next/server';
import { prisma }                   from '@/shared/lib/db';
import { requireAuth, AuthError }   from '@/shared/lib/api-guard';
import { inventoryAdjustmentSchema }from '@/shared/lib/validations';
import { ok, validationError, businessRule, internalError } from '@/shared/lib/response';
import {
  updateLooseStock,
  getPrimaryPackaging,
  baseToLayerQty,
} from '@/shared/lib/loose-utils';
import { adjustStockWithLayers } from '@/shared/lib/stock-engine';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const biz     = session.user.businessId;
    const body    = await req.json();

    const parsed = inventoryAdjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { productId, adjustmentType, baseQty, reason, notes } = parsed.data;

    // Verify product
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId: biz },
      select: {
        id: true, name: true, allowLooseSale: true,
        baseUnit: true, baseStock: true,
      },
    });

    if (!product) return businessRule('Product not found');
    if (!product.allowLooseSale) {
      return businessRule('Inventory adjustments in base units are only available for loose-enabled products');
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const primaryPkg = await getPrimaryPackaging(tx, productId);
      if (!primaryPkg) {
        throw new Error('Product has no primary packaging configured');
      }
      const primaryFactor = primaryPkg.conversionFactor;

      // Calculate delta
      const delta = adjustmentType === 'add' ? baseQty : -baseQty;

      // Update baseStock via write guard
      const newBaseStock = await updateLooseStock(tx, productId, delta, primaryFactor);

      // Create stock movement for audit trail
      const movementSubtype = `adjustment_${reason}`;
      const movementNotes = notes
        ? `${reason}: ${notes}`
        : reason;

      await tx.stockMovement.create({
        data: {
          productId,
          type: adjustmentType === 'add' ? 'IN' : 'OUT',
          quantity: 0, // Not a bag-level movement
          baseQty: delta,
          baseUnit: product.baseUnit,
          movementSubtype,
          notes: movementNotes,
          businessId: biz,
        },
      });

      // For removals, consume from layers (bag-equivalent)
      if (adjustmentType === 'remove') {
        const layerQty = baseToLayerQty(baseQty, primaryFactor);
        await adjustStockWithLayers({
          productId,
          qty: layerQty,
          type: 'manual',
          businessId: biz,
          transactionId: `adj_${Date.now()}`,
          transactionType: 'adjustment',
          tx,
        });
      }

      return { newBaseStock };
    });

    return ok({
      message: `Stock ${adjustmentType === 'add' ? 'increased' : 'decreased'} by ${baseQty} ${product.baseUnit}`,
      newBaseStock: result.newBaseStock,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return err.response;
    if (err.message?.includes('Insufficient stock')) return businessRule(err.message);
    return internalError(err);
  }
}
