export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';
import { executeProduction } from '@/shared/lib/production-engine';
import { postProductionJournal } from '@/shared/lib/auto-journal';

/**
 * POST /api/inventory/production
 *
 * Execute a production run from a Bill of Material.
 *
 * Body: {
 *   bomId: string,
 *   outputQty: number,
 *   warehouseId: string,
 *   additionalCosts?: Array<{ expenseType: string, amount: number, remarks?: string }>,
 *   batchNo?: string,
 *   lotNo?: string,
 *   mfgDate?: string (ISO),
 *   expiryDate?: string (ISO),
 *   notes?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const {
      bomId,
      outputQty,
      warehouseId,
      additionalCosts,
      batchNo,
      lotNo,
      mfgDate,
      expiryDate,
      notes,
    } = body;

    // Validate required fields
    if (!bomId || !outputQty || outputQty <= 0 || !warehouseId) {
      return NextResponse.json(
        { error: 'bomId, outputQty (> 0), and warehouseId are required' },
        { status: 400 }
      );
    }

    // Verify BOM exists
    const bom = await prisma.billOfMaterial.findFirst({
      where: { id: bomId, businessId: session.user.businessId, status: 'ACTIVE' },
      select: { id: true, name: true, finishedItemId: true },
    });
    if (!bom) {
      return NextResponse.json({ error: 'BOM not found or not active' }, { status: 404 });
    }

    // Verify warehouse exists
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, businessId: session.user.businessId },
      select: { id: true, name: true },
    });
    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    // Get finished product name for audit
    const finishedProduct = await prisma.product.findFirst({
      where: { id: bom.finishedItemId, businessId: session.user.businessId },
      select: { name: true },
    });

    // Execute production within a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const prodResult = await executeProduction({
        bomId,
        outputQty,
        warehouseId,
        additionalCosts,
        batchNo,
        lotNo,
        mfgDate: mfgDate ? new Date(mfgDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        notes,
        businessId: session.user.businessId,
        tx,
      });

      // Post production journal
      await postProductionJournal({
        productionId: prodResult.productionId,
        finishedProductName: finishedProduct?.name || 'Unknown',
        totalCost: prodResult.totalCost,
        materialCost: prodResult.totalMaterialCost,
        laborCost: prodResult.laborCost,
        overheadCost: prodResult.overheadCost,
        additionalCost: prodResult.additionalCost,
        businessId: session.user.businessId,
        tx,
      });

      return prodResult;
    });

    // Audit log
    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({
      session,
      action: 'CREATE',
      entityType: 'Production',
      entityId: result.productionId,
      entityLabel: `${bom.name}: ${outputQty} units @ ${warehouse.name}`,
    });

    return NextResponse.json({
      productionId: result.productionId,
      finishedLayerId: result.finishedLayerId,
      totalCost: result.totalCost,
      materialCost: result.totalMaterialCost,
      laborCost: result.laborCost,
      overheadCost: result.overheadCost,
      additionalCost: result.additionalCost,
      componentsConsumed: result.componentConsumptions.length,
      message: `Produced ${outputQty} units of ${finishedProduct?.name || bom.name}`,
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('[Production API] POST error:', error);

    const isBusinessError = error.code === 'INSUFFICIENT_LAYER_STOCK' ||
      error.message?.includes('not found') || error.message?.includes('not active');
    return NextResponse.json(
      { error: isBusinessError ? error.message : 'Internal Server Error' },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}

/**
 * GET /api/inventory/production
 *
 * Get production history (stock movements of type production).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10));
    const skip = (page - 1) * limit;

    // Query layer consumptions of type 'production'
    const where: any = {
      businessId: session.user.businessId,
      transactionType: 'production',
    };
    if (productId) {
      where.layer = { itemId: productId };
    }

    const [consumptions, total] = await Promise.all([
      prisma.inventoryLayerConsumption.findMany({
        where,
        include: {
          layer: {
            select: {
              id: true,
              receiptNo: true,
              batchNo: true,
              product: { select: { id: true, name: true, sku: true } },
              warehouse: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inventoryLayerConsumption.count({ where }),
    ]);

    return NextResponse.json({
      data: consumptions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[Production API] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

