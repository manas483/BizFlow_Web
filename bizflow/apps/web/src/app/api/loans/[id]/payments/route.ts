import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { loanPaymentSchema } from '@/shared/lib/validations';
import { generateNextNumber } from '@/shared/lib/accounting-utils';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const loan = await prisma.loanMaster.findFirst({
      where: { id, businessId: session.user.businessId },
      select: { id: true },
    });
    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    const payments = await prisma.loanPayment.findMany({
      where: { loanId: id },
      orderBy: { paymentDate: 'desc' },
    });

    return NextResponse.json(payments);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const data = loanPaymentSchema.parse(body);

    const loan = await prisma.loanMaster.findFirst({
      where: { id, businessId: session.user.businessId },
      include: {
        schedule: { where: { status: { in: ['PENDING', 'OVERDUE'] } }, orderBy: { installmentNumber: 'asc' }, take: 1 },
      },
    });
    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    if (loan.status !== 'ACTIVE' && loan.status !== 'OVERDUE') {
      return NextResponse.json({ error: 'Loan is not in an active or overdue state' }, { status: 400 });
    }

    // Find the next pending installment to allocate payment
    const nextInstallment = loan.schedule[0];
    let principalPaid = 0;
    let interestPaid = 0;

    if (nextInstallment) {
      // Allocate: interest first, then principal (standard amortization)
      interestPaid = Math.min(data.amount, nextInstallment.interestAmount);
      principalPaid = Math.min(data.amount - interestPaid, nextInstallment.principalAmount);

      // Update the schedule installment status
      await prisma.loanSchedule.update({
        where: { id: nextInstallment.id },
        data: {
          status: data.amount >= nextInstallment.emiAmount ? 'PAID' : 'PARTIALLY_PAID',
          paidDate: new Date(data.paymentDate),
          paidAmount: data.amount,
        },
      });
    } else {
      // No schedule entry — treat as prepayment
      principalPaid = data.amount;
    }

    // Record the payment
    const payment = await prisma.loanPayment.create({
      data: {
        loanId: id,
        paymentDate: new Date(data.paymentDate),
        amount: data.amount,
        principalPaid,
        interestPaid,
        paymentType: data.paymentType,
        reference: data.reference,
        notes: data.notes,
      },
    });

    // Update outstanding balance dynamically
    const newOutstanding = Math.max(0, (loan.outstandingBalance ?? loan.amount) - principalPaid);
    const updateData: any = { outstandingBalance: Math.round(newOutstanding * 100) / 100 };

    // Auto-close loan if fully paid
    if (newOutstanding <= 0.01) {
      updateData.status = 'CLOSED';
    }

    await prisma.loanMaster.update({
      where: { id },
      data: updateData,
    });

    // Auto-create Journal Entry for the transaction
    try {
      const accounts = await prisma.account.findMany({
        where: { businessId: session.user.businessId, isActive: true },
      });

      // Find Liability account
      const liabilityAccount = accounts.find(a => 
        a.accountType === 'LIABILITY' && 
        (a.name.toLowerCase().includes('loan') || a.name.toLowerCase().includes('liability') || a.code === '2100')
      );

      // Find Expense account (for Interest)
      const expenseAccount = accounts.find(a => 
        a.accountType === 'EXPENSE' && 
        (a.name.toLowerCase().includes('interest') || a.code === '5100')
      );

      // Find Bank/Cash account (Asset)
      const bankAccount = accounts.find(a => 
        a.accountType === 'ASSET' && 
        (a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash') || a.code === '1000')
      );

      if (liabilityAccount && expenseAccount && bankAccount && (principalPaid > 0 || interestPaid > 0)) {
        const lastEntry = await prisma.journalEntry.findFirst({
          where: { businessId: session.user.businessId },
          orderBy: { createdAt: 'desc' },
          select: { entryNumber: true },
        });
        const entryNumber = generateNextNumber('JE', lastEntry?.entryNumber ?? null);

        const lines = [];

        // Debit Loan Liability (Principal portion)
        if (principalPaid > 0) {
          lines.push({
            accountId: liabilityAccount.id,
            debit: principalPaid,
            credit: 0,
            narration: `Principal portion of repayment for Loan ${loan.loanNumber}`,
          });
        }

        // Debit Interest Expense (Interest portion)
        if (interestPaid > 0) {
          lines.push({
            accountId: expenseAccount.id,
            debit: interestPaid,
            credit: 0,
            narration: `Interest portion of repayment for Loan ${loan.loanNumber}`,
          });
        }

        // Credit Cash/Bank (Total Payment Amount)
        lines.push({
          accountId: bankAccount.id,
          debit: 0,
          credit: data.amount,
          narration: `Total repayment amount for Loan ${loan.loanNumber}`,
        });

        await prisma.journalEntry.create({
          data: {
            entryNumber,
            date: new Date(data.paymentDate),
            narration: `Auto-generated entry for payment on Loan ${loan.loanNumber}`,
            reference: data.reference ?? loan.loanNumber,
            status: 'POSTED',
            totalAmount: data.amount,
            businessId: session.user.businessId,
            lines: {
              create: lines,
            },
          },
        });
      } else {
        console.warn(`Could not auto-create Journal Entry for Loan Payment: missing accounts. ` +
          `Liability: ${!!liabilityAccount}, Expense: ${!!expenseAccount}, Bank: ${!!bankAccount}`);
      }
    } catch (jeError) {
      console.error('Failed to auto-create Journal Entry for loan payment:', jeError);
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
