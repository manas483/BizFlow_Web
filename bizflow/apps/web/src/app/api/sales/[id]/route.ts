import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { saleSchema } from '@/shared/lib/validations';
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
      include: { items: true }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    // If items are provided, this is a full edit. Otherwise, just a partial update (e.g. payment)
    const isFullEdit = Array.isArray(body.items);

    if (!isFullEdit) {
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
        if (paid !== undefined && existing.customerId) {
          const oldDueContrib = existing.total - existing.paid;
          const newDueContrib = existing.total - paid;
          const dueDiff = newDueContrib - oldDueContrib;
          if (dueDiff !== 0) {
            await tx.customer.update({
              where: { id: existing.customerId },
              data: { dues: { increment: dueDiff } }
            });
          }

          // Auto-create Cash Book entry and Payment Journal for new payment received
          const paymentDiff = paid - existing.paid;
          if (paymentDiff > 0) {
            const { postCashBookEntry, postPaymentJournal } = await import('@/shared/lib/auto-journal');
            await postCashBookEntry({
              amount: paymentDiff,
              type: 'RECEIPT',
              narration: `Payment received for Invoice ${existing.invoiceNo}`,
              reference: existing.invoiceNo,
              businessId: session.user.businessId,
              date: new Date(),
              tx,
            });
            await postPaymentJournal({
              paymentId: `${id}-pay-${Date.now()}`,
              customerId: existing.customerId,
              customerName: updated.customer?.name ?? 'Customer',
              amount: paymentDiff,
              paymentMethod: 'cash',
              businessId: session.user.businessId,
              tx,
            });
          }
        }
        return updated;
      });
      return NextResponse.json(sale);
    }

    // --- FULL EDIT LOGIC ---
    const validatedData = saleSchema.parse(body);
    
    // Calculate new total
    let newSubtotal = 0;
    let newTotalGst = 0;
    const business = await prisma.business.findUnique({ where: { id: session.user.businessId } });
    const gstInclusive = business?.gstInclusive ?? false;

    validatedData.items.forEach(item => {
      const grossAmt = (item.qty * item.price) - (item.discount || 0);
      const rate = item.gstRate || 0;
      if (gstInclusive && rate > 0) {
        const base = grossAmt / (1 + rate / 100);
        newSubtotal += base;
        newTotalGst += grossAmt - base;
      } else {
        newSubtotal += grossAmt;
        newTotalGst += grossAmt * (rate / 100);
      }
    });
    const newTotal = newSubtotal + newTotalGst;
    
    const sale = await prisma.$transaction(async (tx: any) => {
      // 0. Reverse existing journal entries for this sale to prevent duplicates
      const relatedJournals = await tx.journalEntry.findMany({
        where: { businessId: session.user.businessId, reference: `SALE:${id}` },
        select: { id: true, status: true },
      });
      for (const je of relatedJournals) {
        if (je.status !== 'REVERSED') {
          await tx.journalEntry.update({
            where: { id: je.id },
            data: { status: 'REVERSED' },
          });
        }
      }

      // 1. Revert stock for all OLD items
      for (const item of existing.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } }
        });
      }

      // 2. Delete OLD items
      await tx.saleItem.deleteMany({ where: { saleId: id } });

      // 3. Deduct stock for NEW items
      for (const item of validatedData.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.qty } }
        });
      }

      // 4. Determine status based on payment
      let status = 'unpaid';
      if (validatedData.paid >= newTotal) status = 'paid';
      else if (validatedData.paid > 0) status = 'partial';

      // 5. Update Sale record
      const updated = await tx.sale.update({
        where: { id },
        data: {
          customerId: validatedData.customerId,
          total: newTotal,
          paid: validatedData.paid,
          status,
          notes: validatedData.notes,
          placeOfSupply: validatedData.placeOfSupply,
          reverseCharge: validatedData.reverseCharge,
          isAggregate: validatedData.isAggregate,
          aggregateDate: validatedData.aggregateDate ? new Date(validatedData.aggregateDate) : null,
          invoiceDate: validatedData.invoiceDate ? new Date(validatedData.invoiceDate) : null,
          items: {
            create: validatedData.items.map(item => ({
              productId: item.productId,
              qty: item.qty,
              price: item.price,
              discount: item.discount,
              hsnCode: item.hsnCode,
              gstRate: item.gstRate,
            }))
          }
        },
        include: { customer: true, items: { include: { product: true } } }
      });

      // 6. Update Customer balances (revert old, apply new)
      if (existing.customerId) {
        // Revert old
        await tx.customer.update({
          where: { id: existing.customerId },
          data: {
            totalPurchases: { decrement: existing.total },
            dues: { decrement: existing.total - existing.paid }
          }
        });
      }
      
      // Apply new
      await tx.customer.update({
        where: { id: validatedData.customerId },
        data: {
          totalPurchases: { increment: newTotal },
          dues: { increment: newTotal - validatedData.paid }
        }
      });

      return updated;
    });

    // 7. Fire new journal entry for the updated sale (after transaction commits)
    const { postSaleJournal } = await import('@/shared/lib/auto-journal');
    const { extractStateCodeFromGST } = await import('@/shared/lib/gst-engine');
    const { calculateInvoiceTotal } = await import('@/shared/lib/invoice-engine');
    const businessInfo = await prisma.business.findUnique({
      where: { id: session.user.businessId },
      select: { gstNumber: true, stateCode: true, gstInclusive: true },
    });
    const businessStateCode = businessInfo?.stateCode || extractStateCodeFromGST(businessInfo?.gstNumber) || null;
    const invoiceLines = validatedData.items.map(item => ({
      qty: item.qty,
      price: item.price,
      discount: item.discount || 0,
      gstRate: item.gstRate || 0,
    }));
    const invoiceResult = calculateInvoiceTotal(
      invoiceLines,
      businessStateCode,
      validatedData.placeOfSupply || null,
      businessInfo?.gstInclusive ?? false,
    );
    postSaleJournal({
      saleId: id,
      invoiceNo: sale.invoiceNo,
      customerId: validatedData.customerId,
      customerName: sale.customer?.name ?? 'Customer',
      total: newTotal,
      taxableValue: invoiceResult.totalTaxable,
      cgst: invoiceResult.totalCgst,
      sgst: invoiceResult.totalSgst,
      igst: invoiceResult.totalIgst,
      businessId: session.user.businessId,
    }).catch(err => console.error('[AutoJournal] Sale edit re-post failed:', err));

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

      // Reverse associated journal entries (auto-journal creates with reference 'SALE:{id}')
      const relatedJournals = await tx.journalEntry.findMany({
        where: { businessId: session.user.businessId, reference: `SALE:${id}` },
        select: { id: true, status: true },
      });
      for (const je of relatedJournals) {
        if (je.status !== 'REVERSED') {
          await tx.journalEntry.update({
            where: { id: je.id },
            data: { status: 'REVERSED' },
          });
        }
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

