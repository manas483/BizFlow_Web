import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { generateNextNumber } from '@/shared/lib/accounting-utils';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const rateParam = searchParams.get('chargesPercent');
    const chargesPercent = rateParam ? parseFloat(rateParam) : 2.0;

    const loan = await prisma.loanMaster.findFirst({
      where: { id, businessId: session.user.businessId },
    });
    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    const outstandingPrincipal = loan.outstandingBalance ?? loan.amount;
    const chargesAmount = Math.round((outstandingPrincipal * (chargesPercent / 100)) * 100) / 100;
    const finalSettlementAmount = Math.round((outstandingPrincipal + chargesAmount) * 100) / 100;

    return NextResponse.json({
      outstandingPrincipal,
      chargesPercent,
      chargesAmount,
      finalSettlementAmount,
    });
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
    const chargesPercent = body.chargesPercent !== undefined ? parseFloat(body.chargesPercent) : 2.0;
    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
    const reference = body.reference || '';
    const notes = body.notes || '';

    const loan = await prisma.loanMaster.findFirst({
      where: { id, businessId: session.user.businessId },
    });
    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    if (loan.status === 'CLOSED' || loan.status === 'FORECLOSED') {
      return NextResponse.json({ error: 'Loan is already closed or foreclosed' }, { status: 400 });
    }

    const outstandingPrincipal = loan.outstandingBalance ?? loan.amount;
    const chargesAmount = Math.round((outstandingPrincipal * (chargesPercent / 100)) * 100) / 100;
    const finalSettlementAmount = Math.round((outstandingPrincipal + chargesAmount) * 100) / 100;

    // Use a transaction to foreclose loan
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update loan master status
      const updatedLoan = await tx.loanMaster.update({
        where: { id },
        data: {
          status: 'FORECLOSED',
          outstandingBalance: 0,
        },
      });

      // 2. Record closure payment
      const payment = await tx.loanPayment.create({
        data: {
          loanId: id,
          paymentDate,
          amount: finalSettlementAmount,
          principalPaid: outstandingPrincipal,
          interestPaid: chargesAmount, // pre-closure charges counted as interest/fees
          paymentType: 'CLOSURE',
          reference,
          notes: notes || `Foreclosed with ${chargesPercent}% charge.`,
        },
      });

      // 3. Mark all outstanding schedule records as PAID
      await tx.loanSchedule.updateMany({
        where: {
          loanId: id,
          status: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] },
        },
        data: {
          status: 'PAID',
          paidDate: paymentDate,
          paidAmount: 0, // fully settled via foreclosure
        },
      });

      return { updatedLoan, payment };
    });

    // 4. Auto-create Journal Entry for foreclosure
    try {
      const accounts = await prisma.account.findMany({
        where: { businessId: session.user.businessId, isActive: true },
      });

      // Find Liability account
      const liabilityAccount = accounts.find(a => 
        a.accountType === 'LIABILITY' && 
        (a.name.toLowerCase().includes('loan') || a.name.toLowerCase().includes('liability') || a.code === '2100')
      );

      // Find Expense account (we can post pre-closure charges to Interest Expense or General Expense)
      const expenseAccount = accounts.find(a => 
        a.accountType === 'EXPENSE' && 
        (a.name.toLowerCase().includes('interest') || a.name.toLowerCase().includes('charges') || a.code === '5100')
      );

      // Find Bank/Cash account (Asset)
      const bankAccount = accounts.find(a => 
        a.accountType === 'ASSET' && 
        (a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash') || a.code === '1000')
      );

      if (liabilityAccount && expenseAccount && bankAccount) {
        const lastEntry = await prisma.journalEntry.findFirst({
          where: { businessId: session.user.businessId },
          orderBy: { createdAt: 'desc' },
          select: { entryNumber: true },
        });
        const entryNumber = generateNextNumber('JE', lastEntry?.entryNumber ?? null);

        const lines = [];

        // Debit Loan Liability (outstanding principal)
        if (outstandingPrincipal > 0) {
          lines.push({
            accountId: liabilityAccount.id,
            debit: outstandingPrincipal,
            credit: 0,
            narration: `Principal settlement for Foreclosure on Loan ${loan.loanNumber}`,
          });
        }

        // Debit Prepayment charges / fees (charges amount)
        if (chargesAmount > 0) {
          lines.push({
            accountId: expenseAccount.id,
            debit: chargesAmount,
            credit: 0,
            narration: `Prepayment charges (${chargesPercent}%) for Foreclosure on Loan ${loan.loanNumber}`,
          });
        }

        // Credit Cash/Bank (total settlement amount)
        lines.push({
          accountId: bankAccount.id,
          debit: 0,
          credit: finalSettlementAmount,
          narration: `Total settlement amount for Foreclosure on Loan ${loan.loanNumber}`,
        });

        await prisma.journalEntry.create({
          data: {
            entryNumber,
            date: paymentDate,
            narration: `Auto-generated entry for foreclosure on Loan ${loan.loanNumber}`,
            reference: reference || loan.loanNumber,
            status: 'POSTED',
            totalAmount: finalSettlementAmount,
            businessId: session.user.businessId,
            lines: {
              create: lines,
            },
          },
        });
      }
    } catch (jeError) {
      console.error('Failed to auto-create Journal Entry for loan foreclosure:', jeError);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
