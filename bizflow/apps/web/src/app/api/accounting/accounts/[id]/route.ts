import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { accountSchema } from '@/shared/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const account = await prisma.account.findFirst({
      where: { id, businessId: session.user.businessId },
      include: {
        children: true,
        parent: { select: { id: true, code: true, name: true } },
        journalLines: {
          include: { journalEntry: { select: { id: true, entryNumber: true, date: true, narration: true, status: true } } },
          orderBy: { journalEntry: { date: 'desc' } },
          take: 50,
        },
      },
    });

    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
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
    const data = accountSchema.partial().parse(body);

    const existing = await prisma.account.findFirst({
      where: { id, businessId: session.user.businessId },
    });
    if (!existing) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    // If code is changing, check for duplicates
    if (data.code && data.code !== existing.code) {
      const dup = await prisma.account.findUnique({
        where: { businessId_code: { businessId: session.user.businessId, code: data.code } },
      });
      if (dup) return NextResponse.json({ error: 'Account code already exists' }, { status: 409 });
    }

    const account = await prisma.account.update({
      where: { id },
      data,
    });

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

    const account = await prisma.account.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { _count: { select: { journalLines: true, children: true } } },
    });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    if (account._count.journalLines > 0) {
      return NextResponse.json({ error: 'Cannot delete account with journal entries' }, { status: 400 });
    }
    if (account._count.children > 0) {
      return NextResponse.json({ error: 'Cannot delete account with sub-accounts' }, { status: 400 });
    }
    if (account.isSystemAccount) {
      return NextResponse.json({ error: 'Cannot delete system account' }, { status: 400 });
    }

    await prisma.account.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
