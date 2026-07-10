export const dynamic = 'force-dynamic';
/**
 * GET  /api/v1/sales        — paginated sales list  (?summary=true for lightweight mobile list)
 * POST /api/v1/sales        — create sale (invoice)
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { saleSchema }             from '@/shared/lib/validations';
import { ok, created, validationError, businessRule, internalError, parsePagination, buildPagination } from '@/shared/lib/response';
import { extractStateCodeFromGST } from '@/shared/lib/gst-engine';
import { calculateInvoiceTotal } from '@/shared/lib/invoice-engine';
import { z } from 'zod';
import { buildProductSnapshot } from '@/shared/lib/product-snapshot';
import { invalidateCache } from '@/shared/lib/cache';
import {
  updateLooseStock,
  formatLooseStock,
} from '@/shared/lib/loose-utils';

export async function GET(req: NextRequest) {
  try {
    const session  = await requireAuth();
    const biz      = session.user.businessId;
    const sp       = new URL(req.url).searchParams;
    const { page, limit, skip, sortBy, sortDir } = parsePagination(sp);
    const search   = sp.get('search')   ?? '';
    const status   = sp.get('status')   ?? '';
    const from     = sp.get('from');
    const to       = sp.get('to');
    const summary  = sp.get('summary')  === 'true'; // lightweight mode for mobile list view

    const where: any = {
      businessId: biz,
      ...(search ? { OR: [{ invoiceNo: { contains: search, mode: 'insensitive' as const } }, { customer: { name: { contains: search, mode: 'insensitive' as const } } }] } : {}),
      ...(status ? { status } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + 'T23:59:59') } : {}) } } : {}),
      workflowState: { notIn: ['voided', 'draft'] },
    };

    const allowedSort = ['invoiceNo', 'total', 'paid', 'createdAt', 'status', 'invoiceDate'];
    const orderField  = allowedSort.includes(sortBy) ? sortBy : 'invoiceDate';

    const [data, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        // summary mode returns only list-view fields — no nested items data
        include: summary
          ? { customer: { select: { id: true, name: true, phone: true } } }
          : { customer: true, items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
        orderBy: [
          { [orderField]: sortDir },
          ...(orderField !== 'createdAt' ? [{ createdAt: sortDir }] : [])
        ],
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    return ok(data, {
      pagination: buildPagination(total, page, limit),
      meta: { summaryMode: summary },
    });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const biz     = session.user.businessId;
    const parsed  = saleSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);

    const { customerId, items, paid, placeOfSupply, reverseCharge, notes } = parsed.data;

    const result = await prisma.$transaction(async (tx: any) => {
      const productIds = items.map((i: any) => i.productId);
      
      const { loadProductsForDocument } = require('@/shared/lib/batch-queries');
      const [customer, business, { productMap, missingIds }] = await Promise.all([
        tx.customer.findFirst({
          where: { id: customerId, businessId: biz },
          select: { id: true }
        }),
        tx.business.findUnique({ where: { id: biz }, select: { gstInclusive: true, gstNumber: true, stateCode: true } }),
        loadProductsForDocument(tx, biz, productIds)
      ]);

      if (!customer) throw Object.assign(new Error('Customer not found or access denied'), { code: 'BUSINESS_RULE' });
      if (missingIds.length > 0) throw Object.assign(new Error(`Products not found: ${missingIds.join(', ')}`), { code: 'BUSINESS_RULE' });

      const gstInclusive = business?.gstInclusive ?? false;
      const businessStateCode = business?.stateCode || extractStateCodeFromGST(business?.gstNumber) || null;

      // Resolve place of supply state code
      let placeOfSupplyCode: string | null = null;
      if (placeOfSupply) {
        placeOfSupplyCode = placeOfSupply.length === 2 && /^\d{2}$/.test(placeOfSupply)
          ? placeOfSupply
          : businessStateCode;
      }

      const invoiceLines = [];

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product.active) throw Object.assign(new Error(`Product "${product.name}" is archived and cannot be used in new transactions.`), { code: 'BUSINESS_RULE' });

        if (product.allowLooseSale) {
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
            throw Object.assign(new Error(`Insufficient stock for "${product.name}" (have ${display.display})`), { code: 'BUSINESS_RULE' });
          }
        } else {
          if (product.stock < item.qty) throw Object.assign(new Error(`Insufficient stock for "${product.name}"`), { code: 'BUSINESS_RULE' });
        }

        const effectiveQty = item.saleQty || item.qty;
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

      const year   = new Date().getFullYear();
      const prefix = `INV-${year}-`;
      const last   = await tx.sale.findFirst({ where: { businessId: biz, invoiceNo: { startsWith: prefix } }, orderBy: { invoiceNo: 'desc' }, select: { invoiceNo: true } });
      const nextNum   = last ? (parseInt(last.invoiceNo.split('-').at(-1)!, 10) || 0) + 1 : 1;
      const invoiceNo = `${prefix}${String(nextNum).padStart(4, '0')}`;

      const paidAmt  = typeof paid === 'number' ? paid : parseFloat(String(paid)) || 0;
      const saleStatus = paidAmt >= total ? 'PAID' : paidAmt > 0 ? 'PARTIAL' : 'UNPAID';

      const enriched = items.map((item: any) => ({ ...item, purchasePrice: productMap.get(item.productId)?.purchasePrice || 0 }));

      // Deduct stock for each item
      for (const item of items) {
        const product = productMap.get(item.productId);
        if (product.allowLooseSale) {
          const packaging = item.packagingId
            ? product.packagingOptions?.find((p: any) => p.id === item.packagingId)
            : null;
          const factor = packaging ? Number(packaging.conversionFactor) : 1;
          const effectiveSaleQty = Number(item.saleQty || item.qty);
          const baseDeduction = effectiveSaleQty * factor;
          const primaryPkg = product.packagingOptions?.find((p: any) => p.isPurchaseUnit);
          const primaryFactor = primaryPkg ? Number(primaryPkg.conversionFactor) : 1;
          await updateLooseStock(tx, item.productId, -baseDeduction, primaryFactor);
        } else {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.qty } } });
        }
      }

      const sale = await tx.sale.create({
        data: {
          invoiceNo, customerId, total, paid: paidAmt, status: saleStatus,
          placeOfSupply, reverseCharge: reverseCharge === true, notes,
          businessId: biz,
          items: {
            create: enriched.map((i: any) => {
              const product = productMap.get(i.productId);
              const effectiveSaleQty = i.saleQty || i.qty;
              return {
                productId: i.productId,
                qty: product.allowLooseSale ? Math.round(Number(effectiveSaleQty)) : i.qty,
                price: i.price,
                purchasePrice: i.purchasePrice,
                discount: parseFloat(i.discount) || 0,
                hsnCode: i.hsnCode,
                gstRate: parseFloat(i.gstRate) || 0,
                // Loose sale fields
                saleQty: product.allowLooseSale ? effectiveSaleQty : i.qty,
                saleUnit: i.saleUnit || product.unit,
                isLoose: i.isLoose ?? false,
                packagingId: i.packagingId ?? null,
                packagingLabel: i.packagingLabel ?? null,
                ...buildProductSnapshot(product),
              };
            })
          },
        },
        include: { customer: true, items: true },
      });

      if (paidAmt < total) {
        await tx.customer.update({ where: { id: customerId }, data: { dues: { increment: total - paidAmt } } });
      }

      await tx.userActivity.create({ data: { businessId: biz, userId: session.user.id, eventType: 'sale_created', metadata: { saleId: sale.id, invoiceNo, total } } });
      return sale;
    });

    // Invalidate dashboard and reports caches
    await Promise.all([
      invalidateCache(`dashboard:${biz}`),
      invalidateCache(`reports:${biz}:*`)
    ]).catch(console.error);

    return created(result);
  } catch (e: any) {
    if (e instanceof AuthError) return e.response;
    if (e instanceof z.ZodError) return validationError(e.issues);
    if (e?.code === 'BUSINESS_RULE') return businessRule(e.message);
    console.error(e);
    return internalError(e.message);
  }
}

