import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { bankAccountSchema } from '@/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const account = await prisma.bankAccount.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { _count: { select: { bankBookEntries: true, reconciliations: true } } },
    });
    if (!account) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    return NextResponse.json(account);
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
    const data = bankAccountSchema.partial().parse(body);

    const existing = await prisma.bankAccount.findFirst({
      where: { id, businessId: session.user.businessId },
    });
    if (!existing) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });

    const account = await prisma.bankAccount.update({ where: { id }, data });
    return NextResponse.json(account);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const account = await prisma.bankAccount.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { _count: { select: { bankBookEntries: true } } },
    });
    if (!account) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    if (account._count.bankBookEntries > 0) {
      return NextResponse.json({ error: 'Cannot delete bank account with transactions' }, { status: 400 });
    }

    await prisma.bankAccount.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
