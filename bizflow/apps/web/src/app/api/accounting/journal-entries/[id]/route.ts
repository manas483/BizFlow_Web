import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const entry = await prisma.journalEntry.findFirst({
      where: { id, businessId: session.user.businessId },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true, accountType: true } } },
        },
      },
    });

    if (!entry) return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    return NextResponse.json(entry);
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

    const existing = await prisma.journalEntry.findFirst({
      where: { id, businessId: session.user.businessId },
    });
    if (!existing) return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });

    if (body.action === 'post') {
      if (existing.status !== 'DRAFT') {
        return NextResponse.json({ error: 'Only draft entries can be posted' }, { status: 400 });
      }
      const entry = await prisma.journalEntry.update({
        where: { id },
        data: { status: 'POSTED' },
        include: { lines: { include: { account: true } } },
      });
      return NextResponse.json(entry);
    }

    if (body.action === 'reverse') {
      if (existing.status !== 'POSTED') {
        return NextResponse.json({ error: 'Only posted entries can be reversed' }, { status: 400 });
      }
      const entry = await prisma.journalEntry.update({
        where: { id },
        data: { status: 'REVERSED' },
        include: { lines: { include: { account: true } } },
      });
      return NextResponse.json(entry);
    }

    // Standard update for draft entries
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Only draft entries can be edited' }, { status: 400 });
    }

    const entry = await prisma.journalEntry.update({
      where: { id },
      data: {
        narration: body.narration ?? existing.narration,
        reference: body.reference ?? existing.reference,
        date: body.date ? new Date(body.date) : existing.date,
      },
      include: { lines: { include: { account: true } } },
    });

    return NextResponse.json(entry);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const entry = await prisma.journalEntry.findFirst({
      where: { id, businessId: session.user.businessId },
    });
    if (!entry) return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });

    if (entry.status === 'POSTED') {
      return NextResponse.json({ error: 'Cannot delete posted entries. Reverse them first.' }, { status: 400 });
    }

    await prisma.journalEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
