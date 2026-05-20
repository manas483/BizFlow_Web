import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { z } from 'zod';

const ticketSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  expectedStatus: z.enum(['present', 'absent', 'leave', 'half_day']),
  issue: z.string().min(10, 'Please describe the issue in at least 10 characters'),
});

// GET — Employee: own tickets | Admin: all business tickets
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const isAdmin = session.user.role === 'SUPER_ADMIN';

    if (isAdmin) {
      const tickets = await prisma.attendanceTicket.findMany({
        where: { businessId: session.user.businessId },
        include: {
          employee: { select: { id: true, name: true, email: true, department: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(tickets);
    }

    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id, businessId: session.user.businessId },
    });
    if (!employee) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });

    const tickets = await prisma.attendanceTicket.findMany({
      where: { employeeId: employee.id, businessId: session.user.businessId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(tickets);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST — Employee raises a ticket for a specific date
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id, businessId: session.user.businessId },
    });
    if (!employee) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    if (employee.status !== 'active') return NextResponse.json({ error: 'Only active employees can raise tickets' }, { status: 403 });

    const body = await req.json();
    const data = ticketSchema.parse(body);

    // Check if a ticket already exists for this date
    const existing = await prisma.attendanceTicket.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: data.date } },
    });
    if (existing) {
      return NextResponse.json({ error: `A ticket already exists for ${data.date} (Status: ${existing.status})` }, { status: 400 });
    }

    // Get what's currently recorded for this date
    const record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: data.date } },
    });

    const ticket = await prisma.attendanceTicket.create({
      data: {
        employeeId: employee.id,
        businessId: session.user.businessId,
        date: data.date,
        recordedStatus: record?.status ?? null,
        expectedStatus: data.expectedStatus,
        issue: data.issue,
      },
    });

    // Notify admin
    await prisma.notification.create({
      data: {
        businessId: session.user.businessId,
        type: 'WARNING',
        title: 'Attendance Dispute Raised',
        message: `${employee.name} raised an attendance dispute for ${data.date}. Recorded: ${record?.status ?? 'none'}, Expected: ${data.expectedStatus}.`,
        targetRole: 'SUPER_ADMIN',
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
