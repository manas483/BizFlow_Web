export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { saleSchema, draftSaleSchema } from '@/shared/lib/validations';
import { z } from 'zod';
import { extractStateCodeFromGST } from '@/shared/lib/gst-engine';
import { calculateInvoiceTotal } from '@/shared/lib/invoice-engine';
import { adjustStockWithLayers } from '@/shared/lib/stock-engine';
import { postSaleJournal } from '@/shared/lib/auto-journal';
import { buildProductSnapshot } from '@/shared/lib/product-snapshot';
import { withPerf, getTimer } from '@/shared/lib/telemetry';
import {
  packToBaseUnit,
  baseToLayerQty,
  updateLooseStock,
  formatLooseStock,
  deriveStockFromBase,
} from '@/shared/lib/loose-utils';

export function computeDueDate(invoiceDate: string | null | undefined, paymentTerms: string | null | undefined, customDueDate: string | null | undefined): Date | null {
  if (paymentTerms === 'custom' && customDueDate) return new Date(customDueDate);
  if (!paymentTerms || paymentTerms === 'immediate') return invoiceDate ? new Date(invoiceDate) : new Date();
  
  const baseDate = invoiceDate ? new Date(invoiceDate) : new Date();
  const days = parseInt(paymentTerms.replace('_days', ''), 10);
  if (isNaN(days)) return baseDate;
  
  baseDate.setDate(baseDate.getDate() + days);
  return baseDate;
}

async function handleGET(req: NextRequest) {
  try {
    const timer = getTimer();

    timer?.phase('auth');
    const session = await requireAuth();

    timer?.phase('parse_params');
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10));
    const skip  = (page - 1) * limit;

    const workflowState = searchParams.get('workflowState');

    const where = {
      businessId: session.user.businessId,
      ...(search ? {
        OR: [
          { invoiceNo: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } }
        ]
      } : {}),
      ...(status && status.toLowerCase() !== 'all' ? { status: status.toLowerCase() } : {}),
      ...(workflowState ? { workflowState } : { workflowState: { not: 'draft' } }), // Hide drafts by default
    };

    timer?.phase('db_query');
    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        select: {
          id: true,
          invoiceNo: true,
          total: true,
          paid: true,
          status: true,
          workflowState: true,
          createdAt: true,
          dueDate: true,
          invoiceDate: true,
          customer: { select: { id: true, name: true, phone: true } },
          _count: { select: { items: true } }
        },
        orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    timer?.phase('serialization');
    // Map _count.items to items: { length } for backward compatibility with UI
    const mappedSales = sales.map((sale: any) => {
      const { _count, ...rest } = sale;
      return { ...rest, items: { length: _count?.items || 0 } };
    });
    
    return NextResponse.json({ data: mappedSales, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = withPerf(handleGET);


async function handlePOST(req: NextRequest) {
  // ── Phase 2: Draft creation path ──
  // Drafts have ZERO financial impact: no stock, no journals, no customer dues.
  // They use DFT-YYYY-NNNNNN numbering and workflowState='draft'.
  let session: any;
  let body: any;
  const timer = getTimer();
  try {
    timer?.phase('auth');
    session = await requireAuth();
    body = await req.json();

    if (body.isDraft === true) {
      timer?.phase('draft_validation');
      const validated = draftSaleSchema.parse(body);
      const { customerId, items, notes, placeOfSupply, reverseCharge, isAggregate, aggregateDate, invoiceDate, paymentTerms, dueDate, payments } = validated;

      timer?.phase('draft_transaction');
      const result = await prisma.$transaction(async (tx: any) => {
        const productIds = items.map((i: any) => i.productId);
        const { loadProductsForDocument } = require('@/shared/lib/batch-queries');

        const [customer, business, { productMap, missingIds }] = await Promise.all([
          tx.customer.findFirst({
            where: { id: customerId, businessId: session.user.businessId },
            select: { id: true, name: true },
          }),
          tx.business.findUnique({
            where: { id: session.user.businessId },
            select: { gstInclusive: true },
          }),
          loadProductsForDocument(tx, session.user.businessId, productIds)
        ]);

        if (!customer) throw Object.assign(new Error('Customer not found or access denied'), { code: 'BUSINESS_RULE' });
        if (missingIds.length > 0) throw new Error(`Products not found: ${missingIds.join(', ')}`);

        for (const item of items) {
          const product = productMap.get(item.productId);
          if (!product.active) throw new Error(`Product "${product.name}" is archived.`);
        }
        const gstInclusive = business?.gstInclusive ?? false;
        let total = 0;
        items.forEach((item: any) => {
          const effectiveQty = item.saleQty != null ? item.saleQty : item.qty;
          const grossAmt = (effectiveQty * item.price) - (item.discount || 0);
          const rate = item.gstRate || 0;
          if (gstInclusive && rate > 0) { total += grossAmt; }
          else { total += grossAmt + grossAmt * (rate / 100); }
        });

        // Generate DFT- number (never consumes official INV- numbers)
        const year = new Date().getFullYear();
        const dftPrefix = `DFT-${year}-`;
        const lastDraft = await tx.sale.findFirst({
          where: { businessId: session.user.businessId, invoiceNo: { startsWith: dftPrefix } },
          orderBy: { invoiceNo: 'desc' },
          select: { invoiceNo: true },
        });
        let dftNum = 1;
        if (lastDraft) {
          const parts = lastDraft.invoiceNo.split('-');
          const lastNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastNum)) dftNum = lastNum + 1;
        }
        const invoiceNo = `${dftPrefix}${String(dftNum).padStart(6, '0')}`;

        // Compute due date from payment terms
        const computedDueDate = computeDueDate(invoiceDate, paymentTerms, dueDate);

        // Create draft sale (NO stock deduction, NO journals, NO customer dues)
        const sale = await tx.sale.create({
          data: {
            invoiceNo,
            customerId,
            total: Math.round(total * 100) / 100,
            paid: 0,
            status: 'unpaid',
            workflowState: 'draft',
            draftSavedAt: new Date(),
            notes,
            placeOfSupply: placeOfSupply || null,
            reverseCharge: reverseCharge === true,
            isAggregate: isAggregate === true,
            aggregateDate: aggregateDate || null,
            invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
            paymentTerms: paymentTerms || null,
            dueDate: computedDueDate,
            businessId: session.user.businessId,
            items: {
              create: items.map((item: any) => {
                const product = productMap.get(item.productId);
                return {
                  productId: item.productId,
                  qty: item.qty,
                  price: item.price,
                  purchasePrice: 0,
                  discount: parseFloat(item.discount) || 0,
                  hsnCode: item.hsnCode,
                  gstRate: parseFloat(item.gstRate) || 0,
                  originalPrice: item.originalPrice ?? null,
                  priceOverrideReason: item.priceOverrideReason || null,
                  ...buildProductSnapshot(product),
                };
              }),
            },
            // Create split payment records if provided
            ...(payments && payments.length > 0 ? {
              payments: {
                create: payments.map((p: any) => ({
                  paymentMethod: p.paymentMethod,
                  amount: p.amount,
                  reference: p.reference || null,
                  notes: p.notes || null,
                  createdBy: session.user.id,
                })),
              },
            } : {}),
          },
        });

        // Track activity
        await tx.userActivity.create({
          data: {
            businessId: session.user.businessId,
            userId: session.user.id ?? 'unknown',
            eventType: 'draft_created',
            metadata: { saleId: sale.id, itemsCount: items.length },
          },
        });

        return sale;
      }, { maxWait: 10000, timeout: 20000 });

      // Audit log
      const { logAudit } = await import('@/shared/lib/audit');
      await logAudit({ session, action: 'CREATE', entityType: 'DraftInvoice', entityId: result.id, entityLabel: result.invoiceNo });

      return NextResponse.json(result, { status: 201 });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    const KNOWN_PREFIXES = ['Product ', 'Customer '];
    const isBusinessError = KNOWN_PREFIXES.some(p => error.message?.startsWith(p)) || error?.code === 'BUSINESS_RULE';
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: isBusinessError ? 400 : 500 });
  }

  // ── Existing sale creation logic (non-draft) ──
  // A-3 FIX: Retry loop for invoice number collision.
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  try {
    timer?.phase('sale_validation');
    const validatedData = saleSchema.parse(body);
    const { customerId, items, paid, status, notes, placeOfSupply, reverseCharge, isAggregate, aggregateDate, invoiceDate, paymentTerms, dueDate, payments } = validatedData;

    // Check if layer engine tables are migrated (outside transaction to avoid aborting it)
    let layerEngineEnabled = true;
    try {
      // @ts-ignore: Check if InventoryLayer exists
      await prisma.inventoryLayer.findFirst();
    } catch (e) {
      layerEngineEnabled = false;
      console.warn('[Sales] Layer engine tables not migrated. Falling back to simple stock deduction.');
    }

    timer?.phase('sale_transaction');
    const result = await prisma.$transaction(async (tx: any) => {
      const productIds = items.map((i: any) => i.productId);
      const { loadProductsForDocument } = require('@/shared/lib/batch-queries');

      const [customer, business, { productMap, missingIds }] = await Promise.all([
        tx.customer.findFirst({
          where: { id: customerId, businessId: session.user.businessId },
          select: { id: true, name: true }
        }),
        tx.business.findUnique({
          where: { id: session.user.businessId },
          select: { gstInclusive: true, gstNumber: true, stateCode: true, state: true }
        }),
        loadProductsForDocument(tx, session.user.businessId, productIds)
      ]);

      if (!customer) {
        throw Object.assign(new Error('Customer not found or access denied'), { code: 'BUSINESS_RULE' });
      }
      if (missingIds.length > 0) throw Object.assign(new Error(`Products not found: ${missingIds.join(', ')}`), { code: 'BUSINESS_RULE' });

      // 0. Get business settings
      const gstInclusive = business?.gstInclusive ?? false;
      const businessStateCode = business?.stateCode || extractStateCodeFromGST(business?.gstNumber) || null;

      // Resolve place of supply state code
      let placeOfSupplyCode: string | null = null;
      if (placeOfSupply) {
        // placeOfSupply could be a state code ("27") or state name
        placeOfSupplyCode = placeOfSupply.length === 2 && /^\d{2}$/.test(placeOfSupply)
          ? placeOfSupply
          : businessStateCode; // default to same state if not a code
      }

      // 1. Calculate total with Invoice Engine
      
      const invoiceLines = [];
      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product.active) throw new Error(`Product "${product.name}" is archived and cannot be used in new transactions.`);

        if (product.allowLooseSale) {
          // ── Loose-enabled product: check against baseStock ──
          const currentBaseStock = Number(product.baseStock) || 0;
          const packaging = item.packagingId
            ? product.packagingOptions?.find((p: any) => p.id === item.packagingId)
            : null;
          const factor = packaging ? Number(packaging.conversionFactor) : 1;
          const deduction = Number(item.saleQty || item.qty) * factor;
          if (deduction > currentBaseStock) {
            const primaryPkg = product.packagingOptions?.find((p: any) => p.isPurchaseUnit);
            const pFactor = primaryPkg ? Number(primaryPkg.conversionFactor) : 1;
            const display = formatLooseStock(currentBaseStock, pFactor, primaryPkg?.unit || product.unit, product.baseUnit || 'units');
            throw new Error(`Insufficient stock for ${product.name} (have ${display.display})`);
          }
        } else {
          // ── Standard product: existing integer check ──
          if (product.stock < item.qty) throw new Error(`Insufficient stock for ${product.name}`);
        }

        // Use saleQty for invoice total if present, otherwise qty
        const effectiveQty = item.saleQty != null ? item.saleQty : item.qty;
        invoiceLines.push({
          qty: effectiveQty,
          price: item.price,
          discount: item.discount || 0,
          gstRate: item.gstRate || product.gstRate || 0,
        });
      }

      const invoiceResult = calculateInvoiceTotal(
        invoiceLines,
        businessStateCode,
        placeOfSupplyCode,
        gstInclusive,
      );
      const total = invoiceResult.grandTotal;
      // Build gstBreakdown for backward-compatible journal posting
      const gstBreakdown = {
        totalTaxableValue: invoiceResult.totalTaxable,
        totalCgst: invoiceResult.totalCgst,
        totalSgst: invoiceResult.totalSgst,
        totalIgst: invoiceResult.totalIgst,
        totalTax: invoiceResult.totalTax,
        grandTotal: invoiceResult.grandTotal,
        isInterState: invoiceResult.isInterState,
      };

      // 2. Auto-generate invoice number (collision-proof)
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
      const invoiceNo = `${prefix}${String(nextNum).padStart(3, "0")}`;

      const computedDueDate = computeDueDate(invoiceDate, paymentTerms, dueDate);

      // 3. Create sale
      const sale = await tx.sale.create({
        data: {
          invoiceNo,
          customerId,
          total,
          paid: paid || 0,
          status: status || (paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid"),
          workflowState: "posted",
          notes,
          placeOfSupply: placeOfSupply || null,
          reverseCharge: reverseCharge === true,
          isAggregate: isAggregate === true,
          aggregateDate: aggregateDate || null,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
          paymentTerms: paymentTerms || null,
          dueDate: computedDueDate,
          businessId: session.user.businessId,
          items: {
            create: items.map((item: any) => {
              const product = productMap.get(item.productId);
              const effectiveSaleQty = item.saleQty || item.qty;
              return {
                productId: item.productId,
                qty: product.allowLooseSale
                  ? Math.round(Number(effectiveSaleQty))  // Legacy Int — derived
                  : item.qty,
                price: item.price,
                purchasePrice: 0, // Will be updated after layer consumption
                discount: parseFloat(item.discount) || 0,
                hsnCode: item.hsnCode,
                gstRate: parseFloat(item.gstRate) || 0,
                originalPrice: item.originalPrice ?? null,
                priceOverrideReason: item.priceOverrideReason || null,
                // ── Loose Sale Fields ──
                saleQty: product.allowLooseSale ? effectiveSaleQty : item.qty,
                saleUnit: item.saleUnit || product.unit,
                isLoose: item.isLoose ?? false,
                packagingId: item.packagingId ?? null,
                packagingLabel: item.packagingLabel ?? null,
                ...buildProductSnapshot(product),
              };
            })
          },
          ...(payments && payments.length > 0 ? {
            payments: {
              create: payments.map((p: any) => ({
                paymentMethod: p.paymentMethod,
                amount: p.amount,
                reference: p.reference || null,
                notes: p.notes || null,
                createdBy: session.user.id,
              })),
            }
          } : {})
        }
      });

      // 4. Stock auto-deduction via Layer-Aware Stock Engine
      let totalSaleCOGS = 0;
      for (const item of items) {
        const product = productMap.get(item.productId);

        if (product.allowLooseSale) {
          // ── Loose-enabled product: deduct from baseStock, consume layers in bag-equivalent ──
          const packaging = item.packagingId
            ? product.packagingOptions?.find((p: any) => p.id === item.packagingId)
            : null;
          const factor = packaging ? Number(packaging.conversionFactor) : 1;
          const effectiveSaleQty = Number(item.saleQty || item.qty);
          const baseDeduction = effectiveSaleQty * factor;

          // Get primary packaging for layer conversion
          const primaryPkg = product.packagingOptions?.find((p: any) => p.isPurchaseUnit);
          const primaryFactor = primaryPkg ? Number(primaryPkg.conversionFactor) : 1;

          // Track previous baseStock for bag_opened detection
          const previousBaseStock = Number(product.baseStock) || 0;

          // Update baseStock via write guard (also derives Product.stock)
          const newBaseStock = await updateLooseStock(tx, item.productId, -baseDeduction, primaryFactor);

          // Layer consumption in bag-equivalent
          const layerQty = baseToLayerQty(baseDeduction, primaryFactor);

          let layerResult: any = null;
          if (layerEngineEnabled) {
            layerResult = await adjustStockWithLayers({
              productId: item.productId,
              qty: layerQty,
              type: 'sale',
              businessId: session.user.businessId,
              transactionId: sale.id,
              transactionType: 'sale',
              tx,
              skipStockUpdate: true, // We already updated stock via updateLooseStock
              skipMovement: true,    // We create our own base-unit movement records
            });

            if (layerResult && layerResult.totalCOGS > 0) {
              const actualUnitCost = layerResult.totalCOGS / effectiveSaleQty;
              await tx.saleItem.updateMany({
                where: { saleId: sale.id, productId: item.productId },
                data: { purchasePrice: Math.round(actualUnitCost * 10000) / 10000 },
              });
              totalSaleCOGS += layerResult.totalCOGS;
            }
          }

          // Create base-unit stock movement for audit trail
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'OUT',
              quantity: 0,
              baseQty: -baseDeduction,
              baseUnit: product.baseUnit,
              movementSubtype: item.isLoose ? 'loose_sale' : null,
              referenceId: sale.id,
              notes: `Sale ${sale.invoiceNo}: ${effectiveSaleQty} ${item.saleUnit || product.baseUnit}`,
              businessId: session.user.businessId,
            },
          });

          // Detect "bag opened" event for audit trail via exact layer tracking
          if (layerEngineEnabled && layerResult) {
            const openedLayers = layerResult.consumptions.filter((c: any) => c.openedNewBag);
            for (const c of openedLayers) {
              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  type: 'OUT',
                  quantity: 0,
                  baseQty: 0,
                  baseUnit: product.baseUnit,
                  movementSubtype: 'bag_opened',
                  referenceId: sale.id,
                  notes: `Bag opened (Layer: ${c.layerId})`,
                  businessId: session.user.businessId,
                },
              });
            }
          }

          // Emit LOOSE_SALE_COMPLETED event
          await tx.userActivity.create({
            data: {
              businessId: session.user.businessId,
              userId: session.user.id ?? 'unknown',
              eventType: 'LOOSE_SALE_COMPLETED',
              metadata: { 
                saleId: sale.id,
                productId: item.productId,
                packagingId: item.packagingId || null,
                baseUnitsSold: baseDeduction,
                displayQuantity: `${effectiveSaleQty} ${item.saleUnit || product.baseUnit}`,
                conversionFactor: factor,
                layerIdsConsumed: layerResult?.consumptions.map((c: any) => c.layerId) || [],
                costingMethod: 'LAYER', 
              },
            }
          });

        } else {
          // ── Standard product: existing flow (unchanged) ──
          if (layerEngineEnabled) {
            const layerResult = await adjustStockWithLayers({
              productId: item.productId,
              qty: item.qty,
              type: 'sale',
              businessId: session.user.businessId,
              transactionId: sale.id,
              transactionType: 'sale',
              tx,
            });

            if (layerResult && layerResult.totalCOGS > 0) {
              const actualUnitCost = layerResult.totalCOGS / item.qty;
              await tx.saleItem.updateMany({
                where: { saleId: sale.id, productId: item.productId },
                data: { purchasePrice: Math.round(actualUnitCost * 10000) / 10000 },
              });
              totalSaleCOGS += layerResult.totalCOGS;
            } else {
              const fallbackCost = (productMap.get(item.productId)?.purchasePrice || 0) * item.qty;
              totalSaleCOGS += fallbackCost;
              await tx.saleItem.updateMany({
                where: { saleId: sale.id, productId: item.productId },
                data: { purchasePrice: productMap.get(item.productId)?.purchasePrice || 0 },
              });
            }
          } else {
            await tx.$executeRaw`UPDATE "Product" SET "stock" = "stock" - ${Math.round(Number(item.qty))}, "baseStock" = COALESCE("baseStock", 0) - ${Number(item.qty)} WHERE id = ${item.productId}`;
            const fallbackCost = (productMap.get(item.productId)?.purchasePrice || 0) * item.qty;
            await tx.saleItem.updateMany({
              where: { saleId: sale.id, productId: item.productId },
              data: { purchasePrice: productMap.get(item.productId)?.purchasePrice || 0 },
            });
            totalSaleCOGS += fallbackCost;
          }
        }
      }

      // 5. Update customer dues and totalPurchases
      await tx.customer.update({
        where: { id: customerId },
        data: {
          totalPurchases: { increment: total },
          dues: { increment: total - (paid || 0) }
        }
      });

      // 6. Track user activity for ML Engine
      await tx.userActivity.create({
        data: {
          businessId: session.user.businessId,
          userId: session.user.id ?? "unknown",
          eventType: "sale_created",
          metadata: { saleId: sale.id, total, itemsCount: items.length },
        }
      });

      // 7. Auto-create Cash Book entry for cash received
      if ((paid || 0) > 0) {
        const { postCashBookEntry } = await import('@/shared/lib/auto-journal');
        await postCashBookEntry({
          amount: paid || 0,
          type: 'RECEIPT',
          narration: `Cash received for Invoice ${invoiceNo}`,
          reference: invoiceNo,
          businessId: session.user.businessId,
          date: invoiceDate ? new Date(invoiceDate) : new Date(),
          tx,
        });
      }

      return { sale, gstBreakdown, totalSaleCOGS, customerName: customer.name };
    }, { maxWait: 10000, timeout: 20000 });

    timer?.phase('post_transaction');
    // A-4 FIX: Use dynamic import() instead of require() for proper tree-shaking
    const { logAudit } = await import('@/shared/lib/audit');
    logAudit({
      session,
      action: 'CREATE',
      entityType: 'Sale',
      entityId: result.sale.id,
      entityLabel: result.sale.invoiceNo,
    }).catch(console.error);

    // 8. Auto-post journal entry (fire-and-forget, never blocks)
    postSaleJournal({
      saleId: result.sale.id,
      invoiceNo: result.sale.invoiceNo,
      customerId: validatedData.customerId,
      customerName: result.customerName ?? 'Customer',
      total: result.sale.total,
      taxableValue: result.gstBreakdown.totalTaxableValue,
      cgst: result.gstBreakdown.totalCgst,
      sgst: result.gstBreakdown.totalSgst,
      igst: result.gstBreakdown.totalIgst,
      businessId: session.user.businessId,
    }).catch(err => console.error('[AutoJournal] Sale journal failed:', err));

    // 9. Auto-post COGS journal entry (fire-and-forget)
    if (result.totalSaleCOGS > 0) {
      const { postCOGSJournal } = await import('@/shared/lib/auto-journal');
      postCOGSJournal({
        saleId: result.sale.id,
        invoiceNo: result.sale.invoiceNo,
        cogsAmount: result.totalSaleCOGS,
        businessId: session.user.businessId,
      }).catch(err => console.error('[AutoJournal] COGS journal failed:', err));
    }

    const { invalidateCache } = await import('@/shared/lib/cache');
    await invalidateCache(`reports:${session.user.businessId}:*`);
    await invalidateCache(`dashboard:${session.user.businessId}`);

    return NextResponse.json(result.sale, { status: 201 });
  } catch (error: any) {
    // A-3 FIX: Retry on unique constraint violation (invoice number collision)
    if (error?.code === 'P2002' && attempt < MAX_RETRIES - 1) {
      console.warn(`[Sales] Invoice collision on attempt ${attempt + 1}, retrying...`);
      continue;
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error("Sale Creation Error:", error?.message, "Code:", error?.code);
    // C-5 FIX: Only expose known business-rule errors to the client.
    // Internal errors (DB, Prisma, network) must never leak to the response.
    const KNOWN_PREFIXES = ['Insufficient stock', 'Insufficient layer stock', 'Product ', 'Customer '];
    const isBusinessError = KNOWN_PREFIXES.some(p => error.message?.startsWith(p))
      || error?.code === 'BUSINESS_RULE'
      || error?.code === 'INSUFFICIENT_LAYER_STOCK';
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: isBusinessError ? 400 : 500 }
    );
  }
  } // end retry loop
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

export const POST = withPerf(handlePOST);
