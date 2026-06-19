import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { expenseSchema } from '@/shared/lib/validations';
import { recalculateTransportCosts } from '@/shared/lib/expense-calculations';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const expense = await prisma.expense.findFirst({
      where: { id, businessId: session.user.businessId },
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
      where: { id, businessId: session.user.businessId },
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

    await recalculateTransportCosts(session.user.businessId);

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
      where: { id, businessId: session.user.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await prisma.expense.delete({ where: { id } });

    await recalculateTransportCosts(session.user.businessId);

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

