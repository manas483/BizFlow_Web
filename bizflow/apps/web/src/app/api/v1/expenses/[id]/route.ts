/**
 * GET    /api/v1/expenses/[id]
 * PUT    /api/v1/expenses/[id]
 * DELETE /api/v1/expenses/[id]
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { expenseSchema }          from '@/shared/lib/validations';
import { ok, deleted, notFound, validationError, internalError } from '@/shared/lib/response';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id }  = await params;
    const expense = await prisma.expense.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!expense) return notFound('Expense not found');
    return ok(expense);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id }  = await params;
    const exists  = await prisma.expense.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Expense not found');

    const parsed = expenseSchema.partial().safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);

    const expense = await prisma.expense.update({
      where: { id },
      data:  { ...parsed.data, ...(parsed.data.date ? { date: new Date(parsed.data.date) } : {}) },
    });
    return ok(expense, { message: 'Expense updated' });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const { id }  = await params;
    const exists  = await prisma.expense.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Expense not found');
    await prisma.expense.delete({ where: { id } });
    return deleted(id);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}
