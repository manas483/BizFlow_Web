export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { SerialService } from '@/modules/inventory';

/**
 * GET /api/inventory/serials
 *
 * Search and list serial numbers across the business.
 * Query params: query, status, productId, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);

    const result = await SerialService.searchSerials(
      session.user.businessId,
      {
        query: searchParams.get('query') || undefined,
        status: searchParams.get('status') || undefined,
        productId: searchParams.get('productId') || undefined,
        page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10)),
        limit: Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10)),
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[Serials API] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/inventory/serials
 *
 * Assign serial numbers to an inventory layer.
 *
 * Body: {
 *   layerId: string,
 *   serials: Array<{ serialNumber: string, imei?: string }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const { layerId, serials } = body;

    if (!layerId || !serials || !Array.isArray(serials) || serials.length === 0) {
      return NextResponse.json(
        { error: 'layerId and at least one serial are required' },
        { status: 400 }
      );
    }

    // Validate each serial has a serialNumber
    for (const serial of serials) {
      if (!serial.serialNumber || typeof serial.serialNumber !== 'string') {
        return NextResponse.json(
          { error: 'Each serial must have a non-empty serialNumber' },
          { status: 400 }
        );
      }
    }

    const createdIds = await SerialService.assignSerials({
      layerId,
      serials,
      businessId: session.user.businessId,
    });

    // Audit log
    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({
      session,
      action: 'CREATE',
      entityType: 'InventorySerial',
      entityId: layerId,
      entityLabel: `${serials.length} serials assigned to layer ${layerId.slice(0, 8)}`,
    });

    return NextResponse.json({
      assignedIds: createdIds,
      count: createdIds.length,
      message: `${createdIds.length} serial(s) assigned successfully`,
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('[Serials API] POST error:', error);

    const isBusinessError = error.message?.includes('Duplicate') ||
      error.message?.includes('Cannot assign') || error.message?.includes('not found');
    return NextResponse.json(
      { error: isBusinessError ? error.message : 'Internal Server Error' },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}

/**
 * PATCH /api/inventory/serials
 *
 * Update serial status (consume, return, damage).
 *
 * Body: {
 *   serialNumber: string,
 *   action: "sell" | "return" | "damage",
 *   soldToId?: string,
 *   saleItemId?: string
 * }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const { serialNumber, action, soldToId, saleItemId } = body;

    if (!serialNumber || !action) {
      return NextResponse.json(
        { error: 'serialNumber and action are required' },
        { status: 400 }
      );
    }

    const validActions = ['sell', 'return', 'damage'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    switch (action) {
      case 'sell':
        await SerialService.consumeSerial({
          serialNumber,
          soldToId,
          saleItemId,
          businessId: session.user.businessId,
        });
        break;
      case 'return':
        await SerialService.returnSerial({
          serialNumber,
          businessId: session.user.businessId,
        });
        break;
      case 'damage':
        await SerialService.markDamaged({
          serialNumber,
          businessId: session.user.businessId,
        });
        break;
    }

    // Audit log
    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({
      session,
      action: 'UPDATE',
      entityType: 'InventorySerial',
      entityId: serialNumber,
      entityLabel: `Serial ${serialNumber}: ${action}`,
    });

    return NextResponse.json({
      serialNumber,
      action,
      message: `Serial ${serialNumber} marked as ${action === 'sell' ? 'sold' : action === 'return' ? 'returned' : 'damaged'}`,
    });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('[Serials API] PATCH error:', error);

    const isBusinessError = error.code === 'SERIAL_NOT_FOUND' ||
      error.message?.includes('not found') || error.message?.includes('not available');
    return NextResponse.json(
      { error: isBusinessError ? error.message : 'Internal Server Error' },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}

