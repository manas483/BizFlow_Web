import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { debitCreditNoteSchema } from '@/shared/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const notes = await prisma.debitNote.findMany({
      where: { businessId: session.user.businessId },
      include: { customer: true, sale: { select: { invoiceNo: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(notes);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const validatedData = debitCreditNoteSchema.parse(body);
    const { saleId, customerId, reason, amount, taxAmount, notes } = validatedData;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: session.user.businessId },
      select: { id: true }
    });
    if (!customer) return NextResponse.json({ error: 'Customer not found or access denied' }, { status: 403 });

    if (saleId) {
      const sale = await prisma.sale.findFirst({
        where: { id: saleId, businessId: session.user.businessId },
        select: { id: true }
      });
      if (!sale) return NextResponse.json({ error: 'Sale not found or access denied' }, { status: 403 });
    }

    const count = await prisma.debitNote.count({ where: { businessId: session.user.businessId } });
    const debitNoteNo = `DN-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const note = await prisma.debitNote.create({
      data: {
        debitNoteNo, saleId, customerId,
        reason, amount: Number(amount),
        taxAmount: Number(taxAmount) || 0,
        notes, businessId: session.user.businessId,
      },
    });
    return NextResponse.json(note, { status: 201 });
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: e.issues }, { status: 400 });
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

