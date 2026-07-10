export const dynamic = 'force-dynamic';
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
    
    const { saleId, customerId, reason, amount, taxAmount, notes, items } = body;

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
    const debitNoteNo = `DN-${String(count + 1).padStart(4, '0')}`;

    const note = await prisma.$transaction(async (tx: any) => {
      const createdNote = await tx.debitNote.create({
        data: {
          debitNoteNo, saleId, customerId,
          reason, amount: Number(amount),
          taxAmount: Number(taxAmount) || 0,
          notes, businessId: session.user.businessId,
        },
      });

      // Handle layer-aware inventory return
      if (items && Array.isArray(items)) {
        const { reduceLayer } = await import('@/shared/lib/layer-engine');
        for (const item of items) {
          if (item.qty > 0 && item.layerId) {
            await reduceLayer({
              layerId: item.layerId,
              quantity: item.qty,
              transactionId: createdNote.id,
              transactionType: 'purchase_return',
              businessId: session.user.businessId,
              tx
            });
            // Update product stock
            await tx.$executeRaw`UPDATE "Product" SET "stock" = "stock" - ${Math.round(Number(item.qty))}, "baseStock" = COALESCE("baseStock", 0) - ${Number(item.qty)} WHERE id = ${item.productId}`;
          }
        }
      }

      return createdNote;
    });

    return NextResponse.json(note, { status: 201 });
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: e.issues }, { status: 400 });
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

