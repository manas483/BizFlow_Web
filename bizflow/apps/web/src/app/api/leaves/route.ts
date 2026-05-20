import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { z } from 'zod';

const leaveSchema = z.object({
  type: z.enum(['sick', 'casual', 'annual', 'unpaid', 'other']),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
});

// GET — Admin gets all leaves; Employee gets their own leaves
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const isAdmin = session.user.role === 'SUPER_ADMIN';
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // optional filter

    if (isAdmin) {
      // Admin: all leave requests for this business
      const leaves = await prisma.leaveRequest.findMany({
        where: {
          businessId: session.user.businessId,
          ...(status ? { status } : {}),
        },
        include: {
          employee: { select: { id: true, name: true, email: true, role: true, department: true } },
        },
        orderBy: { appliedAt: 'desc' },
      });
      return NextResponse.json(leaves);
    } else {
      // Employee: only their own leave requests
      const employee = await prisma.employee.findFirst({
        where: { userId: session.user.id, businessId: session.user.businessId },
      });
      if (!employee) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }
      const leaves = await prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
          businessId: session.user.businessId,
          ...(status ? { status } : {}),
        },
        orderBy: { appliedAt: 'desc' },
      });
      return NextResponse.json(leaves);
    }
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST — Employee applies for leave
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    // Primary lookup by userId; fallback to email for employees who activated before the userId-fix
    let employee = await prisma.employee.findFirst({
      where: { userId: session.user.id, businessId: session.user.businessId },
      include: { user: { select: { emailVerified: true } } },
    });

    if (!employee) {
      // Fallback: find by email, then backfill userId
      employee = await prisma.employee.findFirst({
        where: { email: session.user.email!, businessId: session.user.businessId },
        include: { user: { select: { emailVerified: true } } },
      });
      if (employee) {
        // Backfill userId so future calls use the fast path
        await prisma.employee.update({ where: { id: employee.id }, data: { userId: session.user.id } });
      }
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found. Please contact your admin.' }, { status: 404 });
    }

    // Auto-heal stale status — if the linked user has verified their email,
    // they are genuinely active even if the DB status wasn't updated yet
    let effectiveStatus = employee.status;
    if (employee.status !== 'active' && employee.user?.emailVerified) {
      await prisma.employee.update({ where: { id: employee.id }, data: { status: 'active' } });
      effectiveStatus = 'active';
    }

    if (effectiveStatus !== 'active') {
      return NextResponse.json({ error: 'Only active employees can apply for leave. Please complete your account setup first.' }, { status: 403 });
    }

    const body = await req.json();
    const data = leaveSchema.parse(body);

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end < start) {
      return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 });
    }

    // Check for overlapping pending/approved leaves
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });
    if (overlap) {
      return NextResponse.json(
        { error: `You already have a ${overlap.status.toLowerCase()} leave request overlapping these dates` },
        { status: 400 }
      );
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        businessId: session.user.businessId,
        type: data.type,
        startDate: start,
        endDate: end,
        reason: data.reason,
      },
    });

    // Notify admin — non-fatal, leave is already saved
    try {
      await prisma.notification.create({
        data: {
          businessId: session.user.businessId,
          type: 'INFO',
          title: 'Leave Request Submitted',
          message: `${employee.name} has applied for ${data.type} leave from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}.`,
          targetRole: 'SUPER_ADMIN',
        },
      });
    } catch (notifErr) {
      console.error('[Leave POST] Notification create failed (non-fatal):', notifErr);
    }

    return NextResponse.json(leave, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Validation Error' }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error('[Leave POST] Unhandled error:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
