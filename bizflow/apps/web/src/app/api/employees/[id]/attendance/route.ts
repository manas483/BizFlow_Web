import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { z } from 'zod';

const attendanceSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['present', 'absent', 'half-day', 'leave']),
  note: z.string().max(200).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const validatedData = attendanceSchema.parse(body);
    const { date, status, note } = validatedData;

    const employee = await prisma.employee.findFirst({
      where: { id, businessId: session.user.businessId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Create or update attendance record for the specific date
    const record = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: id,
          date: date,
        },
      },
      update: {
        status,
        note,
      },
      create: {
        employeeId: id,
        date,
        status,
        note,
        businessId: session.user.businessId,
      },
    });

    // Recalculate average attendance
    const allRecords = await prisma.attendanceRecord.findMany({
      where: { employeeId: id },
    });

    const totalDays = allRecords.length;
    let presentDays = 0;

    allRecords.forEach(r => {
      if (r.status === 'present') presentDays += 1;
      else if (r.status === 'half-day') presentDays += 0.5;
    });

    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

    await prisma.employee.update({
      where: { id },
      data: { attendance: attendancePercentage },
    });

    return NextResponse.json({ success: true, record, newAttendance: attendancePercentage });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const records = await prisma.attendanceRecord.findMany({
      where: { employeeId: id, businessId: session.user.businessId },
      orderBy: { date: 'desc' },
      take: 30, // Get last 30 records
    });

    return NextResponse.json(records);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

