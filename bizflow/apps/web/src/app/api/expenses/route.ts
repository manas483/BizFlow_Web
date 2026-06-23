export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { expenseSchema } from '@/shared/lib/validations';
import { recalculateTransportCosts } from '@/shared/lib/expense-calculations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    const expenses = await prisma.expense.findMany({
      where: {
        businessId: session.user.businessId,
        ...(category && category !== 'All' ? { category } : {}),
      },
      orderBy: { date: 'desc' }
    });

    return NextResponse.json(expenses);
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
    const validatedData = expenseSchema.parse(body);

    const expense = await prisma.expense.create({
      data: {
        ...validatedData,
        date: new Date(validatedData.date),
        businessId: session.user.businessId,
      }
    });

    await recalculateTransportCosts(session.user.businessId);

    // Auto-post journal entry for expense (Dr Expense / Cr Cash)
    const { postExpenseJournal, postCashBookEntry } = await import('@/shared/lib/auto-journal');
    await postExpenseJournal({
      expenseId: expense.id,
      category: expense.category,
      amount: expense.amount,
      note: expense.note || undefined,
      businessId: session.user.businessId,
    });

    // Auto-create cash book PAYMENT entry
    await postCashBookEntry({
      amount: expense.amount,
      type: 'PAYMENT',
      narration: `${expense.category} expense${expense.note ? `: ${expense.note}` : ''}`,
      reference: `EXP:${expense.id}`,
      businessId: session.user.businessId,
      date: new Date(validatedData.date),
    });

    // Auto-create AP entry for purchase-related categories
    const AP_CATEGORIES = ['Purchase', 'Raw Material', 'Supplier Payment', 'Inventory'];
    if (AP_CATEGORIES.includes(expense.category)) {
      await prisma.accountsPayable.create({
        data: {
          supplierName: expense.note || expense.category,
          invoiceRef: `EXP-${expense.id.slice(0, 8)}`,
          amount: expense.amount,
          paidAmount: expense.amount, // Assume paid since it's an expense
          dueDate: new Date(validatedData.date),
          category: expense.category,
          status: 'PAID',
          businessId: session.user.businessId,
        },
      });
    }

    await (prisma as any).userActivity.create({
      data: {
        businessId: session.user.businessId,
        userId: session.user.id ?? "unknown",
        eventType: "expense_added",
        metadata: { expenseId: expense.id, amount: expense.amount, category: expense.category },
      }
    });

    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({
      session,
      action: 'CREATE',
      entityType: 'Expense',
      entityId: expense.id,
      entityLabel: `${expense.category}: ₹${expense.amount}`,
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


