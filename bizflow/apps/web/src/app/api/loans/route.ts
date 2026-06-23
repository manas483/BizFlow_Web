export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { loanMasterSchema } from '@/shared/lib/validations';
import { generateNextNumber, generateEMISchedule } from '@/shared/lib/accounting-utils';
import { z } from 'zod';export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const loanType = searchParams.get('loanType');
    const lender = searchParams.get('lender');

    // Fetch all loans to calculate global summary metrics
    const allLoans = await prisma.loanMaster.findMany({
      where: { businessId: session.user.businessId },
      include: {
        schedule: { orderBy: { installmentNumber: 'asc' } },
      },
    });

    // Compute dynamic dashboard summary from actual data
    const now = new Date();
    let totalDisbursed = 0;
    let totalOutstanding = 0;
    let activeLoans = 0;
    let overdueLoans = 0;
    let overdueAmount = 0;
    let monthlyEmiDue = 0;
    let minNextEmiDate: Date | null = null;

    allLoans.forEach(l => {
      totalDisbursed += l.amount;

      if (l.status !== 'CLOSED' && l.status !== 'FORECLOSED') {
        totalOutstanding += (l.outstandingBalance ?? l.amount);

        if (l.status === 'ACTIVE') {
          activeLoans++;
        }

        let hasOverdueInstallment = false;
        l.schedule.forEach(inst => {
          if (inst.status !== 'PAID') {
            if (inst.dueDate < now) {
              const unpaid = inst.emiAmount - (inst.paidAmount ?? 0);
              if (unpaid > 0) {
                overdueAmount += unpaid;
                hasOverdueInstallment = true;
              }
            }
          }
        });

        if (l.status === 'OVERDUE' || hasOverdueInstallment) {
          overdueLoans++;
        }

        // Next upcoming installment
        const nextPending = l.schedule.find(inst => inst.status !== 'PAID');
        if (nextPending) {
          monthlyEmiDue += nextPending.emiAmount;
          if (!minNextEmiDate || nextPending.dueDate < (minNextEmiDate as Date)) {
            minNextEmiDate = nextPending.dueDate;
          }
        }
      }
    });

    // Fetch filtered loans for table display
    const loans = await prisma.loanMaster.findMany({
      where: {
        businessId: session.user.businessId,
        ...(status ? { status: status as any } : {}),
        ...(loanType ? { loanType: loanType as any } : {}),
        ...(lender ? { lender: { contains: lender, mode: 'insensitive' } } : {}),
      },
      include: {
        _count: { select: { payments: true, schedule: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      loans,
      summary: {
        totalDisbursed: Math.round(totalDisbursed * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        activeLoans,
        overdueLoans,
        overdueAmount: Math.round(overdueAmount * 100) / 100,
        monthlyEmiDue: Math.round(monthlyEmiDue * 100) / 100,
        nextEmiDue: minNextEmiDate ? (minNextEmiDate as Date).toISOString() : null,
        totalLoans: allLoans.length,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const data = loanMasterSchema.parse(body);

    // Generate loan number dynamically
    const lastLoan = await prisma.loanMaster.findFirst({
      where: { businessId: session.user.businessId },
      orderBy: { createdAt: 'desc' },
      select: { loanNumber: true },
    });
    const loanNumber = generateNextNumber('LOAN', lastLoan?.loanNumber ?? null);

    // Compute EMI schedule dynamically from provided parameters
    const startDate = new Date(data.startDate);
    const { emiAmount, totalInterest, totalPayable, schedule } = generateEMISchedule(
      data.amount,
      data.interestRate,
      data.tenure,
      startDate
    );

    // Compute end date from schedule
    const endDate = schedule.length > 0 ? schedule[schedule.length - 1].dueDate : startDate;

    const loan = await prisma.loanMaster.create({
      data: {
        loanNumber,
        borrowerName: data.borrowerName,
        loanType: data.loanType as any,
        amount: data.amount,
        interestRate: data.interestRate,
        tenure: data.tenure,
        startDate,
        endDate,
        emiAmount,
        totalInterest,
        totalPayable,
        outstandingBalance: data.amount,
        lender: data.lender,
        purpose: data.purpose,
        notes: data.notes,
        businessId: session.user.businessId,
        schedule: {
          create: schedule.map(row => ({
            installmentNumber: row.installmentNumber,
            dueDate: row.dueDate,
            emiAmount: row.emiAmount,
            principalAmount: row.principalAmount,
            interestAmount: row.interestAmount,
            openingBalance: row.openingBalance,
            closingBalance: row.closingBalance,
          })),
        },
      },
      include: {
        schedule: { orderBy: { installmentNumber: 'asc' } },
        _count: { select: { payments: true } },
      },
    });

    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

