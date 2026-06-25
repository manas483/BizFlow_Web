export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { debitCreditNoteSchema } from '@/shared/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const notes = await prisma.creditNote.findMany({
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

    const count = await prisma.creditNote.count({ where: { businessId: session.user.businessId } });
    const creditNoteNo = `CN-${String(count + 1).padStart(4, '0')}`;

    const note = await prisma.$transaction(async (tx: any) => {
      const createdNote = await tx.creditNote.create({
        data: {
          creditNoteNo, saleId, customerId,
          reason, amount: Number(amount),
          taxAmount: Number(taxAmount) || 0,
          notes, businessId: session.user.businessId,
        },
      });

      // Handle layer-aware inventory return
      if (items && Array.isArray(items) && saleId) {
        const { restoreLayer } = await import('@/shared/lib/layer-engine');
        for (const item of items) {
          if (item.qty > 0) {
            await restoreLayer({
              transactionId: saleId,
              transactionType: 'sale',
              quantity: item.qty,
              businessId: session.user.businessId,
              tx
            });
            // Update product stock since restoreLayer only updates the layer
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.qty } }
            });
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

