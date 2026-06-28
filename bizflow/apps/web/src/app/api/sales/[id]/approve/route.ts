import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { z } from 'zod';
import { adjustStockWithLayers } from '@/shared/lib/stock-engine';
import { calculateInvoiceTotal } from '@/shared/lib/invoice-engine';

const approveSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action } = approveSchema.parse(body);

    const existing = await prisma.sale.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { items: { include: { product: true } }, payments: true, customer: true }
    });

    if (!existing) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    if (existing.workflowState !== 'awaiting_approval') {
      return NextResponse.json({ error: 'Sale is not awaiting approval' }, { status: 400 });
    }

    if (action === 'reject') {
      const rejected = await prisma.sale.update({
        where: { id },
        data: { workflowState: 'rejected', approvedAt: new Date(), approvedBy: session.user.id }
      });
      const { logAudit } = await import('@/shared/lib/audit');
      await logAudit({ session, action: 'UPDATE', entityType: 'Sale', entityId: id, entityLabel: `Rejected Sale ${existing.invoiceNo}` });
      return NextResponse.json(rejected);
    }

    // Action is APPROVE
    let layerEngineEnabled = true;
    try {
      await prisma.inventoryLayer.count();
    } catch (e) {
      layerEngineEnabled = false;
    }

    const approvedSale = await prisma.$transaction(async (tx: any) => {
      const sale = await tx.sale.update({
        where: { id },
        data: {
          workflowState: 'posted',
          approvedAt: new Date(),
          approvedBy: session.user.id,
          confirmedAt: new Date(),
          confirmedBy: session.user.id,
        },
        include: { items: { include: { product: true } }, payments: true, customer: true }
      });

      // Deduct stock for all items
      let totalSaleCOGS = 0;
      for (const item of sale.items) {
        if (layerEngineEnabled) {
          const consumption = await adjustStockWithLayers({
            tx,
            productId: item.productId,
            businessId: session.user.businessId,
            qty: -item.qty,
            type: 'out',
            transactionId: sale.id,
            transactionType: 'sale'
          });
          const cogs = consumption?.totalCost || 0;
          totalSaleCOGS += cogs;
          await tx.saleItem.update({
            where: { id: item.id },
            data: { purchasePrice: item.qty > 0 ? cogs / item.qty : 0 },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.qty } }
          });
        }
      }

      // Add Customer Dues
      await tx.customer.update({
        where: { id: sale.customerId },
        data: {
          totalPurchases: { increment: sale.total },
          dues: { increment: sale.total - sale.paid }
        }
      });

      // Cash Book Entries
      const { postCashBookEntry, postPaymentJournal } = await import('@/shared/lib/auto-journal');
      if (sale.paid > 0) {
        if (sale.payments && sale.payments.length > 0) {
          for (const payment of sale.payments) {
            await postCashBookEntry({
              amount: payment.amount,
              type: 'RECEIPT',
              narration: `${payment.paymentMethod.toUpperCase()} Payment received for Invoice ${sale.invoiceNo}`,
              reference: sale.invoiceNo,
              businessId: session.user.businessId,
              date: new Date(),
              tx,
            });
            await postPaymentJournal({
              paymentId: `${sale.id}-pay-${Date.now()}-${payment.paymentMethod}`,
              customerId: sale.customerId,
              customerName: sale.customer?.name ?? 'Customer',
              amount: payment.amount,
              paymentMethod: payment.paymentMethod,
              businessId: session.user.businessId,
              tx,
            });
          }
        } else {
          await postCashBookEntry({
            amount: sale.paid,
            type: 'RECEIPT',
            narration: `Payment received for Invoice ${sale.invoiceNo}`,
            reference: sale.invoiceNo,
            businessId: session.user.businessId,
            date: new Date(),
            tx,
          });
          await postPaymentJournal({
            paymentId: `${sale.id}-pay-${Date.now()}`,
            customerId: sale.customerId,
            customerName: sale.customer?.name ?? 'Customer',
            amount: sale.paid,
            paymentMethod: 'cash',
            businessId: session.user.businessId,
            tx,
          });
        }
      }

      // Re-calculate taxes for journal
      const business = await tx.business.findUnique({ where: { id: session.user.businessId } });
      const businessStateCode = business?.gstNumber ? business.gstNumber.substring(0, 2) : '27';
      const invoiceLines = sale.items.map((i: any) => ({
        price: i.price, qty: i.qty, discount: i.discount, gstRate: i.gstRate
      }));
      const invoiceResult = calculateInvoiceTotal(
        invoiceLines,
        businessStateCode,
        sale.placeOfSupply || null,
        business?.gstInclusive ?? false,
      );

      // Post main sale journal
      const { postSaleJournal } = await import('@/shared/lib/auto-journal');
      await postSaleJournal({
        saleId: sale.id,
        invoiceNo: sale.invoiceNo,
        customerId: sale.customerId,
        customerName: sale.customer?.name ?? 'Customer',
        total: sale.total,
        taxableValue: invoiceResult.totalTaxable,
        cgst: invoiceResult.totalCgst,
        sgst: invoiceResult.totalSgst,
        igst: invoiceResult.totalIgst,
        businessId: session.user.businessId,
        tx,
      });

      return sale;
    });

    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({ session, action: 'UPDATE', entityType: 'Sale', entityId: id, entityLabel: `Approved Sale ${existing.invoiceNo}` });

    return NextResponse.json(approvedSale);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
