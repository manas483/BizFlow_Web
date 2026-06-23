export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { saleSchema } from '@/shared/lib/validations';
import { z } from 'zod';
import { extractStateCodeFromGST } from '@/shared/lib/gst-engine';
import { calculateInvoiceTotal } from '@/shared/lib/invoice-engine';
import { adjustStockWithLayers } from '@/shared/lib/stock-engine';
import { postSaleJournal } from '@/shared/lib/auto-journal';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10));
    const skip  = (page - 1) * limit;

    const where = {
      businessId: session.user.businessId,
      ...(search ? {
        OR: [
          { invoiceNo: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } }
        ]
      } : {}),
      ...(status && status.toLowerCase() !== 'all' ? { status: status.toLowerCase() } : {}),
    };

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: { customer: true, items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    return NextResponse.json({ data: sales, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  // A-3 FIX: Retry loop for invoice number collision.
  // If two concurrent transactions generate the same invoice number,
  // the @@unique([businessId, invoiceNo]) constraint will throw a P2002 error.
  // We catch it and retry with the next number (max 3 attempts).
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const validatedData = saleSchema.parse(body);
    const { customerId, items, paid, status, notes, placeOfSupply, reverseCharge, isAggregate, aggregateDate, invoiceDate } = validatedData;

    const result = await prisma.$transaction(async (tx: any) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, businessId: session.user.businessId },
        select: { id: true }
      });
      if (!customer) {
        throw Object.assign(new Error('Customer not found or access denied'), { code: 'BUSINESS_RULE' });
      }

      // 0. Get business settings
      const business = await tx.business.findUnique({
        where: { id: session.user.businessId },
        select: { gstInclusive: true, gstNumber: true, stateCode: true, state: true }
      });
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
      const productMap: Record<string, any> = {};
      const invoiceLines = [];

      for (const item of items) {
        const product = await tx.product.findFirst({ where: { id: item.productId, businessId: session.user.businessId } });
        if (!product) throw new Error(`Product ${item.productId} not found`);
        productMap[item.productId] = product;
        if (product.stock < item.qty) throw new Error(`Insufficient stock for ${product.name}`);
        invoiceLines.push({
          qty: item.qty,
          price: product.sellingPrice,
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

      // 3. Create sale
      const sale = await tx.sale.create({
        data: {
          invoiceNo,
          customerId,
          total,
          paid: paid || 0,
          status: status || (paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid"),
          notes,
          placeOfSupply: placeOfSupply || null,
          reverseCharge: reverseCharge === true,
          isAggregate: isAggregate === true,
          aggregateDate: aggregateDate || null,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
          businessId: session.user.businessId,
          items: {
              create: items.map((item: any) => ({
                productId: item.productId,
                qty: item.qty,
                price: item.price,
                purchasePrice: 0, // Will be updated after layer consumption
                discount: parseFloat(item.discount) || 0,
              hsnCode: item.hsnCode,
              gstRate: parseFloat(item.gstRate) || 0
            }))
          }
        }
      });

      // 4. Stock auto-deduction via Layer-Aware Stock Engine
      let totalSaleCOGS = 0;
      for (const item of items) {
        const layerResult = await adjustStockWithLayers({
          productId: item.productId,
          qty: item.qty,
          type: 'sale',
          businessId: session.user.businessId,
          transactionId: sale.id,
          transactionType: 'sale',
          tx,
        });

        // Update SaleItem with actual COGS from consumed layers
        if (layerResult && layerResult.totalCOGS > 0) {
          const actualUnitCost = layerResult.totalCOGS / item.qty;
          await tx.saleItem.updateMany({
            where: { saleId: sale.id, productId: item.productId },
            data: { purchasePrice: Math.round(actualUnitCost * 10000) / 10000 },
          });
          totalSaleCOGS += layerResult.totalCOGS;
        } else {
          // Fallback to product-level purchasePrice if no layers exist
          const fallbackCost = (productMap[item.productId]?.purchasePrice || 0) * item.qty;
          await tx.saleItem.updateMany({
            where: { saleId: sale.id, productId: item.productId },
            data: { purchasePrice: productMap[item.productId]?.purchasePrice || 0 },
          });
          totalSaleCOGS += fallbackCost;
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

      return { sale, gstBreakdown, totalSaleCOGS };
    });

    // A-4 FIX: Use dynamic import() instead of require() for proper tree-shaking
    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({
      session,
      action: 'CREATE',
      entityType: 'Sale',
      entityId: result.sale.id,
      entityLabel: result.sale.invoiceNo,
    });

    // 8. Auto-post journal entry (fire-and-forget, never blocks)
    const customer = await prisma.customer.findUnique({ where: { id: validatedData.customerId }, select: { name: true } });
    postSaleJournal({
      saleId: result.sale.id,
      invoiceNo: result.sale.invoiceNo,
      customerId: validatedData.customerId,
      customerName: customer?.name ?? 'Customer',
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
