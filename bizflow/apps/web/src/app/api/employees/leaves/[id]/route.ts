import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { z } from 'zod';

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  adminNote: z.string().optional(),
});

// PATCH — Admin approves or rejects a leave request
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admins can review leave requests' }, { status: 403 });
    }

    const leave = await prisma.leaveRequest.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { employee: true },
    });

    if (!leave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    if (leave.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Leave is already ${leave.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = reviewSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: data.status,
          adminNote: data.adminNote || null,
          reviewedAt: new Date(),
          reviewedBy: session.user.id,
        },
        include: { employee: true },
      });

      // If approved, mark attendance as leave for each day in range
      if (data.status === 'APPROVED') {
        const days: string[] = [];
        const cur = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        while (cur <= end) {
          // Skip weekends (0=Sun, 6=Sat)
          const day = cur.getDay();
          if (day !== 0 && day !== 6) {
            days.push(cur.toISOString().split('T')[0]);
          }
          cur.setDate(cur.getDate() + 1);
        }

        for (const date of days) {
          await tx.attendanceRecord.upsert({
            where: { employeeId_date: { employeeId: leave.employeeId, date } },
            update: { status: 'leave', note: `${leave.type} leave approved` },
            create: {
              employeeId: leave.employeeId,
              businessId: leave.businessId,
              date,
              status: 'leave',
              note: `${leave.type} leave approved`,
            },
          });
        }
      }

      // Notify the employee
      await tx.notification.create({
        data: {
          businessId: leave.businessId,
          type: data.status === 'APPROVED' ? 'SUCCESS' : 'WARNING',
          title: `Leave Request ${data.status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
          message: data.status === 'APPROVED'
            ? `Your ${leave.type} leave request (${new Date(leave.startDate).toLocaleDateString()} – ${new Date(leave.endDate).toLocaleDateString()}) has been approved.`
            : `Your ${leave.type} leave request was rejected.${data.adminNote ? ` Reason: ${data.adminNote}` : ''}`,
          targetRole: result.employee.role,
        },
      });

      // Audit log
      await tx.userActivity.create({
        data: {
          businessId: leave.businessId,
          userId: session.user.id,
          eventType: data.status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
          metadata: { leaveId: id, employeeName: leave.employee.name, type: leave.type },
        },
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE — Employee cancels a pending leave
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const leave = await prisma.leaveRequest.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { employee: true },
    });

    if (!leave) return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    if (leave.employee.userId !== session.user.id && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (leave.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 400 });
    }

    await prisma.leaveRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
