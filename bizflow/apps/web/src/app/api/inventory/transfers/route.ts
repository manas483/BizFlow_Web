export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';
import { transferStock } from '@/shared/lib/transfer-engine';

/**
 * POST /api/inventory/transfers
 *
 * Execute a warehouse-to-warehouse stock transfer.
 *
 * Body: {
 *   productId: string,
 *   qty: number,
 *   sourceWarehouseId: string,
 *   destWarehouseId: string,
 *   transferCosts?: Array<{ expenseType: string, amount: number, remarks?: string }>,
 *   batchNo?: string,
 *   notes?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const {
      productId,
      qty,
      sourceWarehouseId,
      destWarehouseId,
      transferCosts,
      batchNo,
      notes,
    } = body;

    // Validate required fields
    if (!productId || !qty || qty <= 0 || !sourceWarehouseId || !destWarehouseId) {
      return NextResponse.json(
        { error: 'productId, qty (> 0), sourceWarehouseId, and destWarehouseId are required' },
        { status: 400 }
      );
    }

    // Verify product exists and belongs to business
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId: session.user.businessId },
      select: { id: true, name: true },
    });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Verify warehouses exist and belong to business
    const [sourceWH, destWH] = await Promise.all([
      prisma.warehouse.findFirst({
        where: { id: sourceWarehouseId, businessId: session.user.businessId },
        select: { id: true, name: true },
      }),
      prisma.warehouse.findFirst({
        where: { id: destWarehouseId, businessId: session.user.businessId },
        select: { id: true, name: true },
      }),
    ]);

    if (!sourceWH) return NextResponse.json({ error: 'Source warehouse not found' }, { status: 404 });
    if (!destWH) return NextResponse.json({ error: 'Destination warehouse not found' }, { status: 404 });

    // Execute transfer within a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      return transferStock({
        productId,
        qty,
        sourceWarehouseId,
        destWarehouseId,
        transferCosts,
        batchNo,
        notes,
        businessId: session.user.businessId,
        tx,
      });
    });

    // Audit log
    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({
      session,
      action: 'CREATE',
      entityType: 'InventoryTransfer',
      entityId: result.transferId,
      entityLabel: `${product.name}: ${sourceWH.name} → ${destWH.name} (${qty} units)`,
    });

    return NextResponse.json({
      transferId: result.transferId,
      sourceConsumptions: result.sourceConsumptions,
      destinationLayerIds: result.destinationLayerIds,
      message: `Transferred ${qty} units from ${sourceWH.name} to ${destWH.name}`,
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('[Transfers API] POST error:', error);

    const isBusinessError = error.code === 'INSUFFICIENT_LAYER_STOCK' ||
      error.message?.includes('same');
    return NextResponse.json(
      { error: isBusinessError ? error.message : 'Internal Server Error' },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}

/**
 * GET /api/inventory/transfers
 *
 * Get transfer history (stock movements of type TRANSFER).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10));
    const skip = (page - 1) * limit;

    const where: any = {
      businessId: session.user.businessId,
      type: 'TRANSFER',
    };
    if (productId) where.productId = productId;

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return NextResponse.json({
      data: movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[Transfers API] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

