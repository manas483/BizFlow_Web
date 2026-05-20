import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { saleSchema } from '@/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const sale = await prisma.sale.findFirst({
      where: { id, businessId: session.user.businessId },
      include: {
        customer: true,
        items: { include: { product: true } }
      }
    });

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    return NextResponse.json(sale);
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

    const existing = await prisma.sale.findFirst({
      where: { id, businessId: session.user.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    // Allow updating paid amount and status only (items are immutable after creation)
    const validatedData = saleSchema.partial().parse(body);
    const { paid, status, notes } = validatedData;

    const sale = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.sale.update({
        where: { id },
        data: {
          ...(paid !== undefined ? { paid } : {}),
          ...(status ? { status } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
        include: { customer: true, items: { include: { product: true } } }
      });

      // Recalculate customer dues if payment changed
      if (paid !== undefined) {
        const oldDueContrib = existing.total - existing.paid;
        const newDueContrib = existing.total - paid;
        const dueDiff = newDueContrib - oldDueContrib;
        if (dueDiff !== 0) {
          await tx.customer.update({
            where: { id: existing.customerId },
            data: { dues: { increment: dueDiff } }
          });
        }
      }

      return updated;
    });

    return NextResponse.json(sale);
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

    const existing = await prisma.sale.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { items: true }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx: any) => {
      // Restore stock for each sale item
      for (const item of existing.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } }
        });
      }

      // Reverse customer totals if attached to a customer
      if (existing.customerId) {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: {
            totalPurchases: { decrement: existing.total },
            dues: { decrement: existing.total - existing.paid }
          }
        });
      }

      // Delete sale items first, then sale
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.sale.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error("Delete Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

