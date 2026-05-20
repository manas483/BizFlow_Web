/**
 * PATCH  /api/v1/leaves/[id]   — admin reviews leave (APPROVE / REJECT)
 * DELETE /api/v1/leaves/[id]   — employee cancels pending leave
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { ok, deleted, notFound, forbidden, businessRule, validationError, internalError } from '@/lib/response';
import { z } from 'zod';

const reviewSchema = z.object({
  status:    z.enum(['APPROVED', 'REJECTED']),
  adminNote: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    const { id }  = await params;

    const leave = await prisma.leaveRequest.findFirst({
      where:   { id, businessId: session.user.businessId },
      include: { employee: true },
    });
    if (!leave) return notFound('Leave request not found');
    if (leave.status !== 'PENDING') return businessRule(`Leave is already ${leave.status.toLowerCase()}`);

    const parsed = reviewSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);
    const { status, adminNote } = parsed.data;

    const updated = await prisma.$transaction(async (tx: any) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data:  { status, adminNote: adminNote || null, reviewedAt: new Date(), reviewedBy: session.user.id },
        include: { employee: true },
      });

      if (status === 'APPROVED') {
        const days: string[] = [];
        const cur = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        while (cur <= end) {
          const day = cur.getDay();
          if (day !== 0 && day !== 6) days.push(cur.toISOString().split('T')[0]);
          cur.setDate(cur.getDate() + 1);
        }
        for (const date of days) {
          await tx.attendanceRecord.upsert({
            where:  { employeeId_date: { employeeId: leave.employeeId, date } },
            update: { status: 'leave', note: `${leave.type} leave approved` },
            create: { employeeId: leave.employeeId, businessId: leave.businessId, date, status: 'leave', note: `${leave.type} leave approved` },
          });
        }
      }

      // Notify the employee individually (userId targeting)
      await tx.notification.create({
        data: {
          businessId: leave.businessId,
          type:       status === 'APPROVED' ? 'SUCCESS' : 'WARNING',
          title:      `Leave ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
          message:    status === 'APPROVED'
            ? `Your ${leave.type} leave (${new Date(leave.startDate).toLocaleDateString()} – ${new Date(leave.endDate).toLocaleDateString()}) has been approved.`
            : `Your ${leave.type} leave request was rejected.${adminNote ? ` Reason: ${adminNote}` : ''}`,
          targetRole: result.employee.role,
          userId:     result.employee.userId ?? undefined,  // individual targeting for FCM
        },
      });

      await tx.userActivity.create({
        data: { businessId: leave.businessId, userId: session.user.id, eventType: status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED', metadata: { leaveId: id, employeeName: leave.employee.name, type: leave.type } },
      });
      return result;
    });

    return ok(updated, { message: `Leave ${status.toLowerCase()}` });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id }  = await params;
    const leave   = await prisma.leaveRequest.findFirst({ where: { id, businessId: session.user.businessId }, include: { employee: true } });
    if (!leave) return notFound('Leave request not found');

    if (leave.employee.userId !== session.user.id && session.user.role !== 'SUPER_ADMIN') {
      return forbidden('You can only cancel your own leave requests');
    }
    if (leave.status !== 'PENDING') return businessRule('Only pending requests can be cancelled');

    await prisma.leaveRequest.delete({ where: { id } });
    return deleted(id);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}
