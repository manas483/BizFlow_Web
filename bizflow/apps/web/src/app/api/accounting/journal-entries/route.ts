import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { journalEntrySchema } from '@/shared/lib/validations';
import { generateNextNumber } from '@/shared/lib/accounting-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const entries = await prisma.journalEntry.findMany({
      where: {
        businessId: session.user.businessId,
        ...(status ? { status: status as any } : {}),
        ...(from || to ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        } : {}),
      },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true, accountType: true } } },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(entries);
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
    const data = journalEntrySchema.parse(body);

    // Generate next entry number dynamically
    const lastEntry = await prisma.journalEntry.findFirst({
      where: { businessId: session.user.businessId },
      orderBy: { createdAt: 'desc' },
      select: { entryNumber: true },
    });
    const entryNumber = generateNextNumber('JE', lastEntry?.entryNumber ?? null);

    const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0);

    const entry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        date: new Date(data.date),
        narration: data.narration,
        reference: data.reference,
        totalAmount: totalDebit,
        businessId: session.user.businessId,
        lines: {
          create: data.lines.map(line => ({
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            narration: line.narration,
          })),
        },
      },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true, accountType: true } } },
        },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
