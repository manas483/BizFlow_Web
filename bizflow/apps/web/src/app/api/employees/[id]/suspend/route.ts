import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admins can suspend employees' }, { status: 403 });
    }

    const employee = await prisma.employee.findFirst({
      where: { id, businessId: session.user.businessId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Toggle between suspended and active
    const newStatus = employee.status === 'suspended' ? 'active' : 'suspended';

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: { status: newStatus },
      });

      // Audit log
      await tx.userActivity.create({
        data: {
          businessId: session.user.businessId,
          userId: session.user.id,
          eventType: newStatus === 'suspended' ? 'EMPLOYEE_SUSPENDED' : 'EMPLOYEE_REACTIVATED',
          metadata: {
            employeeId: employee.id,
            employeeName: employee.name,
            previousStatus: employee.status,
            newStatus,
          },
        },
      });

      // Notification — admin only
      await tx.notification.create({
        data: {
          businessId: session.user.businessId,
          type: newStatus === 'suspended' ? 'WARNING' : 'INFO',
          title: newStatus === 'suspended' ? 'Employee Suspended' : 'Employee Reactivated',
          message: `${employee.name}'s account has been ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}.`,
          targetRole: 'SUPER_ADMIN',
        },
      });
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
