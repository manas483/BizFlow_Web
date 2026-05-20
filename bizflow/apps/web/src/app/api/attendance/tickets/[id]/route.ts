import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { z } from 'zod';

const resolveSchema = z.object({
  status: z.enum(['IN_REVIEW', 'RESOLVED', 'REJECTED']),
  adminNote: z.string().optional(),
  // If resolving, optionally correct the attendance record
  correctedStatus: z.enum(['present', 'absent', 'leave', 'half_day']).optional(),
});

// PATCH — Admin updates ticket status (IN_REVIEW → RESOLVED/REJECTED)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admins can resolve tickets' }, { status: 403 });
    }

    const ticket = await prisma.attendanceTicket.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { employee: true },
    });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    if (ticket.status === 'RESOLVED' || ticket.status === 'REJECTED') {
      return NextResponse.json({ error: `Ticket is already ${ticket.status.toLowerCase()}` }, { status: 400 });
    }

    const body = await req.json();
    const data = resolveSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.attendanceTicket.update({
        where: { id },
        data: {
          status: data.status,
          adminNote: data.adminNote ?? null,
          resolvedBy: ['RESOLVED', 'REJECTED'].includes(data.status) ? session.user.id : null,
          resolvedAt: ['RESOLVED', 'REJECTED'].includes(data.status) ? new Date() : null,
        },
        include: { employee: true },
      });

      // If resolved with a correction, update the attendance record
      if (data.status === 'RESOLVED' && data.correctedStatus) {
        await tx.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: ticket.employeeId, date: ticket.date } },
          update: { status: data.correctedStatus, note: `Corrected via ticket #${id.slice(-6)}` },
          create: {
            employeeId: ticket.employeeId,
            businessId: ticket.businessId,
            date: ticket.date,
            status: data.correctedStatus,
            note: `Corrected via ticket #${id.slice(-6)}`,
          },
        });
      }

      // Notify the employee about status change
      const statusLabel = data.status === 'RESOLVED' ? 'Resolved ✓' : data.status === 'REJECTED' ? 'Rejected' : 'Under Review';
      await tx.notification.create({
        data: {
          businessId: ticket.businessId,
          type: data.status === 'RESOLVED' ? 'SUCCESS' : data.status === 'REJECTED' ? 'WARNING' : 'INFO',
          title: `Attendance Ticket ${statusLabel}`,
          message: data.status === 'RESOLVED'
            ? `Your attendance dispute for ${ticket.date} has been resolved.${data.correctedStatus ? ` Your attendance has been updated to: ${data.correctedStatus}.` : ''}${data.adminNote ? ` Note: ${data.adminNote}` : ''}`
            : data.status === 'IN_REVIEW'
            ? `Your attendance dispute for ${ticket.date} is now under review by the admin.`
            : `Your attendance dispute for ${ticket.date} was rejected.${data.adminNote ? ` Reason: ${data.adminNote}` : ''}`,
          targetRole: result.employee.role,
        },
      });

      // Audit log
      await tx.userActivity.create({
        data: {
          businessId: ticket.businessId,
          userId: session.user.id,
          eventType: 'ATTENDANCE_TICKET_UPDATED',
          metadata: { ticketId: id, status: data.status, employeeName: ticket.employee.name },
        },
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE — Employee cancels an OPEN ticket
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const ticket = await prisma.attendanceTicket.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { employee: true },
    });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    if (ticket.employee.userId !== session.user.id && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (ticket.status !== 'OPEN') {
      return NextResponse.json({ error: 'Only OPEN tickets can be cancelled' }, { status: 400 });
    }

    await prisma.attendanceTicket.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
