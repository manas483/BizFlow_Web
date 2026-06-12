import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const loan = await prisma.loanMaster.findFirst({
      where: { id, businessId: session.user.businessId },
      select: { id: true, amount: true, interestRate: true, tenure: true },
    });
    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    const schedule = await prisma.loanSchedule.findMany({
      where: { loanId: id },
      orderBy: { installmentNumber: 'asc' },
    });

    // Compute dynamic stats
    const totalEmi = schedule.reduce((s, row) => s + row.emiAmount, 0);
    const totalPrincipal = schedule.reduce((s, row) => s + row.principalAmount, 0);
    const totalInterest = schedule.reduce((s, row) => s + row.interestAmount, 0);
    const paidCount = schedule.filter(s => s.status === 'PAID').length;
    const overdueCount = schedule.filter(s => s.status === 'PENDING' && new Date(s.dueDate) < new Date()).length;

    return NextResponse.json({
      schedule,
      summary: {
        totalEmi: Math.round(totalEmi * 100) / 100,
        totalPrincipal: Math.round(totalPrincipal * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
        paidInstallments: paidCount,
        overdueInstallments: overdueCount,
        pendingInstallments: schedule.length - paidCount,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
