import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { saleSchema, draftSaleSchema } from '@/shared/lib/validations';
import { z } from 'zod';
import { buildProductSnapshot } from '@/shared/lib/product-snapshot';
import { computeDueDate } from '../route'; // Import from parent route

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const sale = await prisma.sale.findFirst({
      where: { id, businessId: session.user.businessId },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
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
      include: { items: true, payments: true }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    if (typeof body.version === 'number' && existing.version !== body.version) {
      return NextResponse.json({
        success: false,
        code: "SALE_CONFLICT",
        error: {
          code: "SALE_CONFLICT",
          message: `This sale was modified by another user. Current version in database is ${existing.version}. Please refresh and try again.`,
          meta: { currentVersion: existing.version, id: existing.id }
        }
      }, { status: 409 });
    }

    const business = await prisma.business.findUnique({ where: { id: session.user.businessId } });
    const gstInclusive = business?.gstInclusive ?? false;

    // ── CASE 1: Editing a Draft (No accounting impact) ──
    if (existing.workflowState === 'draft' && body.isDraft === true) {
      const validatedData = draftSaleSchema.parse(body);
      const computedDueDate = computeDueDate(validatedData.invoiceDate, validatedData.paymentTerms, validatedData.dueDate);
      
      let newTotal = 0;
      body.items.forEach((item: any) => {
        const effectiveQty = item.saleQty != null ? item.saleQty : item.qty;
        const grossAmt = (effectiveQty * item.price) - (item.discount || 0);
        const rate = item.gstRate || 0;
        if (gstInclusive && rate > 0) newTotal += grossAmt;
        else newTotal += grossAmt + (grossAmt * (rate / 100));
      });

      const updated = await prisma.$transaction(async (tx: any) => {
        // Delete old items and payments
        await tx.saleItem.deleteMany({ where: { saleId: id } });
        await tx.salePayment.deleteMany({ where: { saleId: id } });

        // Update sale and insert new ones
        return tx.sale.update({
          where: { id },
          data: {
            customerId: validatedData.customerId,
            total: Math.round(newTotal * 100) / 100,
            notes: validatedData.notes,
            placeOfSupply: validatedData.placeOfSupply,
            reverseCharge: validatedData.reverseCharge,
            isAggregate: validatedData.isAggregate,
            aggregateDate: validatedData.aggregateDate ? new Date(validatedData.aggregateDate) : null,
            invoiceDate: validatedData.invoiceDate ? new Date(validatedData.invoiceDate) : null,
            paymentTerms: validatedData.paymentTerms,
            dueDate: computedDueDate,
            draftSavedAt: new Date(),
            version: { increment: 1 },
            items: {
              create: validatedData.items.map(item => ({
                productId: item.productId,
                qty: item.qty,
                price: item.price,
                purchasePrice: 0,
                discount: item.discount,
                hsnCode: item.hsnCode,
                gstRate: item.gstRate,
                originalPrice: item.originalPrice ?? null,
                priceOverrideReason: item.priceOverrideReason || null,
              }))
            },
            ...(validatedData.payments && validatedData.payments.length > 0 ? {
              payments: {
                create: validatedData.payments.map((p: any) => ({
                  paymentMethod: p.paymentMethod,
                  amount: p.amount,
                  reference: p.reference || null,
                  notes: p.notes || null,
                  createdBy: session.user.id,
                }))
              }
            } : {})
          },
          include: { customer: true, items: { include: { product: true } }, payments: true }
        });
      });
      return NextResponse.json(updated);
    }

    // ── CASE 2: Confirming a Draft (Full accounting impact) ──
    if (existing.workflowState === 'draft' && body.isDraft === false) {
      const validatedData = saleSchema.parse(body);
      const computedDueDate = computeDueDate(validatedData.invoiceDate, validatedData.paymentTerms, validatedData.dueDate);
      
      let newSubtotal = 0;
      let newTotalGst = 0;
      validatedData.items.forEach(item => {
        const effectiveQty = item.saleQty != null ? item.saleQty : item.qty;
        const grossAmt = (effectiveQty * item.price) - (item.discount || 0);
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

      const { extractStateCodeFromGST } = await import('@/shared/lib/gst-engine');
      const { calculateInvoiceTotal } = await import('@/shared/lib/invoice-engine');
      const { adjustStockWithLayers } = await import('@/shared/lib/stock-engine');

      const businessStateCode = business?.stateCode || extractStateCodeFromGST(business?.gstNumber) || null;
      const invoiceLines = validatedData.items.map(item => ({
        qty: item.saleQty != null ? item.saleQty : item.qty,
        price: item.price,
        discount: item.discount || 0,
        gstRate: item.gstRate || 0,
      }));
      const invoiceResult = calculateInvoiceTotal(
        invoiceLines,
        businessStateCode,
        validatedData.placeOfSupply || null,
        business?.gstInclusive ?? false,
      );

      // Check layer engine availability
      let layerEngineEnabled = true;
      try {
        await prisma.inventoryLayer.count();
      } catch (e) {
        layerEngineEnabled = false;
      }

      const confirmedSale = await prisma.$transaction(async (tx: any) => {
        // Generate new official invoice number
        const year = new Date().getFullYear();
        const prefix = `INV-${year}-`;
        const lastSale = await tx.sale.findFirst({
          where: { businessId: session.user.businessId, invoiceNo: { startsWith: prefix } },
          orderBy: { invoiceNo: 'desc' },
          select: { invoiceNo: true }
        });
        let nextNum = 1;
        if (lastSale) {
          const parts = lastSale.invoiceNo.split('-');
          const lastNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastNum)) nextNum = lastNum + 1;
        }
        const newInvoiceNo = `${prefix}${String(nextNum).padStart(3, "0")}`;

        // Calculate paid amount from payments array if present, else body.paid
        let computedPaid = validatedData.paid || 0;
        if (validatedData.payments && validatedData.payments.length > 0) {
          computedPaid = validatedData.payments.reduce((sum, p) => sum + p.amount, 0);
        }

        // Determine status
        let status = 'unpaid';
        if (computedPaid >= newTotal) status = 'paid';
        else if (computedPaid > 0) status = 'partial';

        // Delete old draft items and payments
        await tx.saleItem.deleteMany({ where: { saleId: id } });
        await tx.salePayment.deleteMany({ where: { saleId: id } });

        // Build product maps
        const productMap: Record<string, any> = {};
        for (const item of validatedData.items) {
          const product = await tx.product.findFirst({ where: { id: item.productId, businessId: session.user.businessId } });
          if (!product) throw new Error(`Product ${item.productId} not found`);
          productMap[item.productId] = product;
        }

        let finalWorkflowState = 'posted';
        let approvalReason = null;
        
        for (const item of validatedData.items) {
          if (item.originalPrice != null && item.originalPrice > 0) {
            const overridePercent = ((item.originalPrice - item.price) / item.originalPrice) * 100;
            if (overridePercent > 10) {
              finalWorkflowState = 'awaiting_approval';
              approvalReason = `Price override > 10% on ${productMap[item.productId]?.name || 'item'}`;
              break;
            }
          }
          if (item.discount > 10) {
            finalWorkflowState = 'awaiting_approval';
            approvalReason = `Discount > 10% on ${productMap[item.productId]?.name || 'item'}`;
            break;
          }
        }

        const sale = await tx.sale.update({
          where: { id },
          data: {
            invoiceNo: newInvoiceNo,
            customerId: validatedData.customerId,
            total: newTotal,
            paid: computedPaid,
            status,
            workflowState: finalWorkflowState,
            approvalReason: approvalReason,
            confirmedAt: finalWorkflowState === 'posted' ? new Date() : null,
            confirmedBy: finalWorkflowState === 'posted' ? session.user.id : null,
            notes: validatedData.notes,
            placeOfSupply: validatedData.placeOfSupply,
            reverseCharge: validatedData.reverseCharge,
            isAggregate: validatedData.isAggregate,
            aggregateDate: validatedData.aggregateDate ? new Date(validatedData.aggregateDate) : null,
            invoiceDate: validatedData.invoiceDate ? new Date(validatedData.invoiceDate) : null,
            paymentTerms: validatedData.paymentTerms,
            dueDate: computedDueDate,
            version: { increment: 1 },
            items: {
              create: validatedData.items.map(item => {
                const product = productMap[item.productId] || { allowLooseSale: false, unit: 'units' };
                const effectiveSaleQty = item.saleQty != null ? item.saleQty : item.qty;
                return {
                  productId: item.productId,
                  qty: product.allowLooseSale ? Math.round(Number(effectiveSaleQty)) : Math.round(Number(item.qty)),
                  price: item.price,
                  purchasePrice: 0, // Will update below
                  discount: item.discount,
                  hsnCode: item.hsnCode,
                  gstRate: item.gstRate,
                  originalPrice: item.originalPrice ?? null,
                  priceOverrideReason: item.priceOverrideReason || null,
                  saleQty: product.allowLooseSale ? effectiveSaleQty : item.qty,
                  saleUnit: item.saleUnit || product.unit,
                  isLoose: item.isLoose ?? false,
                  packagingId: item.packagingId ?? null,
                  packagingLabel: item.packagingLabel ?? null,
                  ...buildProductSnapshot(product),
                };
              })
            },
            ...(validatedData.payments && validatedData.payments.length > 0 ? {
              payments: {
                create: validatedData.payments.map((p: any) => ({
                  paymentMethod: p.paymentMethod,
                  amount: p.amount,
                  reference: p.reference || null,
                  notes: p.notes || null,
                  createdBy: session.user.id,
                }))
              }
            } : {})
          },
          include: { customer: true, items: { include: { product: true } }, payments: true }
        });

        if (finalWorkflowState === 'posted') {
          // Deduct stock for all items
          let totalSaleCOGS = 0;
          for (const item of sale.items) {
            if (layerEngineEnabled) {
              const consumption = await adjustStockWithLayers({
                tx,
                productId: item.productId,
                businessId: session.user.businessId,
                qty: item.qty,
                type: 'sale',
                transactionId: sale.id,
                transactionType: `SALE:${sale.id}`
              });
              const cogs = consumption?.totalCOGS || 0;
              totalSaleCOGS += cogs;
            await tx.saleItem.update({
              where: { id: item.id },
              data: { purchasePrice: item.qty > 0 ? cogs / item.qty : 0 },
            });
          } else {
            // Basic stock deduction
            await tx.$executeRaw`UPDATE "Product" SET "stock" = "stock" - ${Math.round(Number(item.qty))}, "baseStock" = COALESCE("baseStock", 0) - ${Number(item.qty)} WHERE id = ${item.productId}`;
          }
        }

        // Add Customer Dues
        await tx.customer.update({
          where: { id: validatedData.customerId },
          data: {
            totalPurchases: { increment: newTotal },
            dues: { increment: newTotal - computedPaid }
          }
        });

        // Cash Book Entries
        const { postCashBookEntry, postPaymentJournal } = await import('@/shared/lib/auto-journal');
        if (computedPaid > 0) {
          if (validatedData.payments && validatedData.payments.length > 0) {
            for (const payment of validatedData.payments) {
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
                paymentMethod: payment.paymentMethod === 'cash' ? 'cash' : 'bank',
                businessId: session.user.businessId,
                tx,
              });
            }
          } else {
            await postCashBookEntry({
              amount: computedPaid,
              type: 'RECEIPT',
              narration: `Payment received for Invoice ${sale.invoiceNo}`,
              reference: sale.invoiceNo,
              businessId: session.user.businessId,
              date: new Date(),
              tx,
            });
            await postPaymentJournal({
              paymentId: `${sale.id}-pay-${Date.now()}`,
              customerId: validatedData.customerId,
              customerName: sale.customer?.name ?? 'Customer',
              amount: computedPaid,
              paymentMethod: 'cash',
              businessId: session.user.businessId,
              tx,
            });
          }
        }

        // Post main sale journal
        const { postSaleJournal } = await import('@/shared/lib/auto-journal');
        await postSaleJournal({
          saleId: sale.id,
          invoiceNo: sale.invoiceNo,
          customerId: validatedData.customerId,
          customerName: sale.customer?.name ?? 'Customer',
          total: newTotal,
          taxableValue: invoiceResult.totalTaxable,
          cgst: invoiceResult.totalCgst,
          sgst: invoiceResult.totalSgst,
          igst: invoiceResult.totalIgst,
          businessId: session.user.businessId,
          tx,
        });

        }

        return sale;
      });

      const { logAudit } = await import('@/shared/lib/audit');
      await logAudit({ session, action: 'UPDATE', entityType: 'Sale', entityId: id, entityLabel: `Confirmed Draft -> ${confirmedSale.invoiceNo}` });

      return NextResponse.json(confirmedSale);
    }

    // ── CASE 3: Full Edit of a Posted Sale (Existing Logic) ──
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
            version: { increment: 1 },
          },
          include: { customer: true, items: { include: { product: true } } }
        });

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

    const validatedData = saleSchema.parse(body);
    let newSubtotal = 0;
    let newTotalGst = 0;
    validatedData.items.forEach(item => {
      const effectiveQty = item.saleQty != null ? item.saleQty : item.qty;
      const grossAmt = (effectiveQty * item.price) - (item.discount || 0);
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

    const productIds = validatedData.items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { packagingOptions: true }
    });
    const productMap = new Map(products.map(p => [p.id, p]));
    
    const sale = await prisma.$transaction(async (tx: any) => {
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

      for (const item of existing.items) {
        await tx.$executeRaw`UPDATE "Product" SET "stock" = "stock" + ${Math.round(Number(item.qty))}, "baseStock" = COALESCE("baseStock", 0) + ${Number(item.qty)} WHERE id = ${item.productId}`;
      }

      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.salePayment.deleteMany({ where: { saleId: id } });

      for (const item of validatedData.items) {
        await tx.$executeRaw`UPDATE "Product" SET "stock" = "stock" - ${Math.round(Number(item.qty))}, "baseStock" = COALESCE("baseStock", 0) - ${Number(item.qty)} WHERE id = ${item.productId}`;
      }

      let status = 'unpaid';
      if (validatedData.paid >= newTotal) status = 'paid';
      else if (validatedData.paid > 0) status = 'partial';

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
          version: { increment: 1 },
          items: {
            create: validatedData.items.map(item => {
              const product = productMap.get(item.productId) || { allowLooseSale: false, unit: 'units' };
              const effectiveSaleQty = item.saleQty != null ? item.saleQty : item.qty;
              return {
                productId: item.productId,
                qty: product.allowLooseSale ? Math.round(Number(effectiveSaleQty)) : Math.round(Number(item.qty)),
                price: item.price,
                discount: item.discount,
                hsnCode: item.hsnCode,
                gstRate: item.gstRate,
                saleQty: product.allowLooseSale ? effectiveSaleQty : item.qty,
                saleUnit: item.saleUnit || product.unit,
                isLoose: item.isLoose ?? false,
                packagingId: item.packagingId ?? null,
                packagingLabel: item.packagingLabel ?? null,
              };
            })
          }
        },
        include: { customer: true, items: { include: { product: true } } }
      });

      if (existing.customerId) {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: {
            totalPurchases: { decrement: existing.total },
            dues: { decrement: existing.total - existing.paid }
          }
        });
      }
      
      await tx.customer.update({
        where: { id: validatedData.customerId },
        data: {
          totalPurchases: { increment: newTotal },
          dues: { increment: newTotal - validatedData.paid }
        }
      });

      return updated;
    });

    const { postSaleJournal } = await import('@/shared/lib/auto-journal');
    const { extractStateCodeFromGST } = await import('@/shared/lib/gst-engine');
    const { calculateInvoiceTotal } = await import('@/shared/lib/invoice-engine');
    
    const businessStateCode = business?.stateCode || extractStateCodeFromGST(business?.gstNumber) || null;
    const invoiceLines = validatedData.items.map(item => ({
      qty: item.saleQty != null ? item.saleQty : item.qty,
      price: item.price,
      discount: item.discount || 0,
      gstRate: item.gstRate || 0,
    }));
    const invoiceResult = calculateInvoiceTotal(
      invoiceLines,
      businessStateCode,
      validatedData.placeOfSupply || null,
      business?.gstInclusive ?? false,
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
      if (existing.workflowState !== 'draft') {
        for (const item of existing.items) {
          await tx.$executeRaw`UPDATE "Product" SET "stock" = "stock" + ${Math.round(Number(item.qty))}, "baseStock" = COALESCE("baseStock", 0) + ${Number(item.qty)} WHERE id = ${item.productId}`;
        }

        if (existing.customerId) {
          await tx.customer.update({
            where: { id: existing.customerId },
            data: {
              totalPurchases: { decrement: existing.total },
              dues: { decrement: existing.total - existing.paid }
            }
          });
        }

        const { postReversingJournal } = await import('@/shared/lib/auto-journal');
        const relatedJournals = await tx.journalEntry.findMany({
          where: { businessId: session.user.businessId, reference: `SALE:${id}` },
          select: { id: true, status: true },
        });
        for (const je of relatedJournals) {
          if (je.status !== 'REVERSED') {
            await postReversingJournal({
              originalJournalId: je.id,
              reason: 'Sale Voided',
              businessId: session.user.businessId,
              tx
            });
          }
        }

        // Void the sale instead of hard-deleting it
        await tx.sale.update({
          where: { id },
          data: { workflowState: 'voided' }
        });
      } else {
        // Safe to hard-delete drafts since they haven't impacted ledgers
        await tx.saleItem.deleteMany({ where: { saleId: id } });
        await tx.salePayment.deleteMany({ where: { saleId: id } });
        await tx.sale.delete({ where: { id } });
      }
    });

    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({ session, action: 'DELETE', entityType: existing.workflowState === 'draft' ? 'DraftInvoice' : 'Sale', entityId: id, entityLabel: existing.invoiceNo });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error("Delete Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
