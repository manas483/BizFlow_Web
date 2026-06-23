export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';

/**
 * GET /api/inventory/bom
 *
 * List Bills of Material with pagination.
 * Query params: finishedItemId, status, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);

    const finishedItemId = searchParams.get('finishedItemId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10));
    const skip = (page - 1) * limit;

    const where: any = { businessId: session.user.businessId };
    if (finishedItemId) where.finishedItemId = finishedItemId;
    if (status) where.status = status;

    const [boms, total] = await Promise.all([
      prisma.billOfMaterial.findMany({
        where,
        include: {
          components: {
            include: {
              // Include basic product info for each component
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.billOfMaterial.count({ where }),
    ]);

    return NextResponse.json({
      data: boms,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[BOM API] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/inventory/bom
 *
 * Create a new Bill of Material.
 *
 * Body: {
 *   finishedItemId: string,
 *   name: string,
 *   outputQty?: number,
 *   laborCost?: number,
 *   overheadCost?: number,
 *   overheadType?: "fixed" | "percentage",
 *   notes?: string,
 *   components: Array<{ productId: string, quantity: number, unit?: string, notes?: string }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const {
      finishedItemId,
      name,
      outputQty = 1,
      laborCost = 0,
      overheadCost = 0,
      overheadType = 'fixed',
      notes,
      components,
    } = body;

    // Validate required fields
    if (!finishedItemId || !name || !components || components.length === 0) {
      return NextResponse.json(
        { error: 'finishedItemId, name, and at least one component are required' },
        { status: 400 }
      );
    }

    // Verify finished product exists
    const finishedProduct = await prisma.product.findFirst({
      where: { id: finishedItemId, businessId: session.user.businessId },
      select: { id: true, name: true },
    });
    if (!finishedProduct) {
      return NextResponse.json({ error: 'Finished product not found' }, { status: 404 });
    }

    // Verify all component products exist
    const componentIds = components.map((c: any) => c.productId);
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: componentIds }, businessId: session.user.businessId },
      select: { id: true },
    });
    if (existingProducts.length !== componentIds.length) {
      return NextResponse.json({ error: 'One or more component products not found' }, { status: 404 });
    }

    // Prevent self-reference
    if (componentIds.includes(finishedItemId)) {
      return NextResponse.json(
        { error: 'Finished product cannot be its own component' },
        { status: 400 }
      );
    }

    // Generate BOM number
    const { generateNextNumber } = await import('@/shared/lib/accounting-utils');
    const lastBom = await prisma.billOfMaterial.findFirst({
      where: { businessId: session.user.businessId },
      orderBy: { createdAt: 'desc' },
      select: { bomNo: true },
    });
    const bomNo = generateNextNumber('BOM', lastBom?.bomNo ?? null);

    // Create BOM with components
    const bom = await prisma.billOfMaterial.create({
      data: {
        bomNo,
        name,
        finishedItemId,
        outputQty,
        laborCost,
        overheadCost,
        overheadType,
        status: 'ACTIVE',
        notes: notes || null,
        businessId: session.user.businessId,
        components: {
          create: components.map((c: any) => ({
            productId: c.productId,
            quantity: c.quantity,
            unit: c.unit || null,
            notes: c.notes || null,
          })),
        },
      },
      include: {
        components: true,
      },
    });

    // Audit log
    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({
      session,
      action: 'CREATE',
      entityType: 'BillOfMaterial',
      entityId: bom.id,
      entityLabel: `${bom.bomNo}: ${name} (${finishedProduct.name})`,
    });

    return NextResponse.json(bom, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[BOM API] POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

