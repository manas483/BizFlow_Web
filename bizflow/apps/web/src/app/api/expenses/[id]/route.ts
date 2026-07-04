import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { expenseSchema } from '@/shared/lib/validations';
import { allocateExpenseToLayers, reverseExpenseAllocation } from '@/shared/lib/expense-calculations';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const expense = await prisma.expense.findFirst({
      where: { id, businessId: session.user.businessId, status: 'ACTIVE' },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json(expense);
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

    const existing = await prisma.expense.findFirst({
      where: { id, businessId: session.user.businessId, status: 'ACTIVE' },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const validatedData = expenseSchema.partial().parse(body);

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...validatedData,
        ...(validatedData.date ? { date: new Date(validatedData.date) } : {}),
      },
    });

    await reverseExpenseAllocation(expense.id, session.user.businessId);
    await allocateExpenseToLayers(expense.id, session.user.businessId);

    const { logAudit, computeChanges } = await import('@/shared/lib/audit');
    const changes = computeChanges(existing as any, expense as any);
    if (changes) {
      await logAudit({
        session,
        action: 'UPDATE',
        entityType: 'Expense',
        entityId: expense.id,
        entityLabel: `${expense.category}: ₹${expense.amount}`,
        changes,
      });
    }

    return NextResponse.json(expense);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const { id } = await params;

    const existing = await prisma.expense.findFirst({
      where: { id, businessId: session.user.businessId, status: 'ACTIVE' },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Void the expense
      await tx.expense.update({
        where: { id },
        data: { status: 'VOIDED' }
      });

      // Reverse Journal Entries
      const { postReversingJournal } = await import('@/shared/lib/auto-journal');
      const journals = await tx.journalEntry.findMany({
        where: { businessId: session.user.businessId, reference: `EXPENSE:${id}` },
        select: { id: true }
      });
      for (const je of journals) {
        await postReversingJournal({
          originalJournalId: je.id,
          reason: 'Expense Voided',
          businessId: session.user.businessId,
          tx
        });
      }

      // Note: if there is a CashBookEntry with reference `EXP:${id}`, it might also need reversal or deletion.
      // Assuming journals cover it or CashBookEntry deletion logic exists, else we can void it.
      await tx.cashBookEntry.deleteMany({
        where: { businessId: session.user.businessId, reference: `EXPENSE:${id}` }
      }).catch(() => {});
    });

    await reverseExpenseAllocation(id, session.user.businessId);

    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({
      session,
      action: 'DELETE',
      entityType: 'Expense',
      entityId: id,
      entityLabel: `${existing.category}: ₹${existing.amount}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

