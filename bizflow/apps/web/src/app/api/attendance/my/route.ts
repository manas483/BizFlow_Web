import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';

// GET — Employee's own attendance records for a given month (default: current month)
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // YYYY-MM format

    let employee = await prisma.employee.findFirst({
      where: { userId: session.user.id, businessId: session.user.businessId },
    });

    if (!employee) {
      employee = await prisma.employee.findFirst({
        where: { email: session.user.email!, businessId: session.user.businessId },
      });
      if (employee) {
        await prisma.employee.update({ where: { id: employee.id }, data: { userId: session.user.id } });
      }
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    // Build date range filter
    let dateFilter: { gte: string; lte: string } | undefined;
    if (month) {
      const [year, m] = month.split('-').map(Number);
      const start = `${year}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      const end = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      dateFilter = { gte: start, lte: end };
    }

    const records = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: employee.id,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      orderBy: { date: 'asc' },
    });

    // Summary stats
    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const leave = records.filter((r) => r.status === 'leave').length;
    const halfDay = records.filter((r) => r.status === 'half_day').length;

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: employee.name,
        department: employee.department,
        joinDate: employee.joinDate,
        attendance: employee.attendance,
      },
      records,
      summary: { present, absent, leave, halfDay, total: records.length },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
