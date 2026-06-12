import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { loanMasterSchema } from '@/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const loan = await prisma.loanMaster.findFirst({
      where: { id, businessId: session.user.businessId },
      include: {
        schedule: { orderBy: { installmentNumber: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });

    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    // Compute dynamic stats from actual data
    const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);
    const paidInstallments = loan.schedule.filter(s => s.status === 'PAID').length;
    const overdueInstallments = loan.schedule.filter(s => s.status === 'OVERDUE' || (s.status === 'PENDING' && new Date(s.dueDate) < new Date())).length;
    const nextEmi = loan.schedule.find(s => s.status === 'PENDING' && new Date(s.dueDate) >= new Date());

    return NextResponse.json({
      ...loan,
      stats: {
        totalPaid: Math.round(totalPaid * 100) / 100,
        paidInstallments,
        overdueInstallments,
        remainingInstallments: loan.tenure - paidInstallments,
        nextEmi: nextEmi ?? null,
        completionPercentage: Math.round((paidInstallments / loan.tenure) * 100),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.loanMaster.findFirst({
      where: { id, businessId: session.user.businessId },
    });
    if (!existing) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    // Only allow status and notes updates on active loans
    const updateData: any = {};
    if (body.status) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const loan = await prisma.loanMaster.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { payments: true, schedule: true } } },
    });

    return NextResponse.json(loan);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const loan = await prisma.loanMaster.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { _count: { select: { payments: true } } },
    });
    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    if (loan._count.payments > 0) {
      return NextResponse.json({ error: 'Cannot delete loan with recorded payments' }, { status: 400 });
    }

    await prisma.loanMaster.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
