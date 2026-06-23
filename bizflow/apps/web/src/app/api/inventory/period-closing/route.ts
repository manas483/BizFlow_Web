export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';
import {
  closeInventoryPeriod,
  lockPeriod,
  reopenPeriod,
  getPeriodClosings,
  isPeriodLocked,
} from '@/shared/lib/period-closing';

/**
 * GET /api/inventory/period-closing
 *
 * List period closings or check if a date is locked.
 * Query params: checkDate (ISO date to check lock status), page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);

    // If checkDate provided, check if that date is in a locked period
    const checkDate = searchParams.get('checkDate');
    if (checkDate) {
      const result = await isPeriodLocked(
        new Date(checkDate),
        session.user.businessId
      );
      return NextResponse.json(result);
    }

    // List all period closings
    const result = await getPeriodClosings(
      session.user.businessId,
      {
        page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10)),
        limit: Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10)),
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[PeriodClosing API] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/inventory/period-closing
 *
 * Close, lock, or reopen an inventory period.
 *
 * Body: {
 *   action: "close" | "lock" | "reopen",
 *   period: string,           // e.g. "2026-03", "2026-Q1"
 *   closingDate?: string      // ISO date, only for "close"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, period, closingDate } = body;

    if (!action || !['close', 'lock', 'reopen'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be one of: close, lock, reopen' },
        { status: 400 }
      );
    }

    if (!period) {
      return NextResponse.json(
        { error: 'period is required (e.g. "2026-03" or "2026-Q1")' },
        { status: 400 }
      );
    }

    // Reopen requires SUPER_ADMIN
    const allowedRoles = action === 'reopen' ? ['SUPER_ADMIN'] : undefined;
    const session = await requireAuth(allowedRoles);

    let result;

    switch (action) {
      case 'close': {
        result = await prisma.$transaction(async (tx: any) => {
          return closeInventoryPeriod({
            period,
            closingDate: closingDate ? new Date(closingDate) : undefined,
            closedBy: session.user.id,
            businessId: session.user.businessId,
            tx,
          });
        });

        // Audit log
        const { logAudit } = await import('@/shared/lib/audit');
        await logAudit({
          session,
          action: 'CREATE',
          entityType: 'InventoryPeriodClosing',
          entityId: result.id,
          entityLabel: `Period ${period} CLOSED — ${result.totalItems} items, ₹${Math.round(result.totalValue * 100) / 100}`,
        });

        return NextResponse.json({
          ...result,
          message: `Period ${period} closed successfully`,
        }, { status: 201 });
      }

      case 'lock': {
        await prisma.$transaction(async (tx: any) => {
          await lockPeriod(period, session.user.businessId, tx);
        });

        const { logAudit: logAudit2 } = await import('@/shared/lib/audit');
        await logAudit2({
          session,
          action: 'UPDATE',
          entityType: 'InventoryPeriodClosing',
          entityId: period,
          entityLabel: `Period ${period} LOCKED`,
        });

        return NextResponse.json({
          period,
          status: 'LOCKED',
          message: `Period ${period} locked — no further modifications allowed`,
        });
      }

      case 'reopen': {
        await prisma.$transaction(async (tx: any) => {
          await reopenPeriod(period, session.user.businessId, tx);
        });

        const { logAudit: logAudit3 } = await import('@/shared/lib/audit');
        await logAudit3({
          session,
          action: 'UPDATE',
          entityType: 'InventoryPeriodClosing',
          entityId: period,
          entityLabel: `Period ${period} REOPENED by SUPER_ADMIN`,
        });

        return NextResponse.json({
          period,
          status: 'OPEN',
          message: `Period ${period} reopened`,
        });
      }
    }
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('[PeriodClosing API] POST error:', error);

    const isBusinessError = error.message?.includes('already') ||
      error.message?.includes('not found') || error.message?.includes('Invalid period') ||
      error.message?.includes('must be');
    return NextResponse.json(
      { error: isBusinessError ? error.message : 'Internal Server Error' },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}

