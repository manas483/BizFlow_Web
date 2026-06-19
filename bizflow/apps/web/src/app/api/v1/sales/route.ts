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
    };

    const allowedSort = ['invoiceNo', 'total', 'paid', 'createdAt', 'status'];
    const orderField  = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        // summary mode returns only list-view fields — no nested items data
        include: summary
          ? { customer: { select: { id: true, name: true, phone: true } } }
          : { customer: true, items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
        orderBy: { [orderField]: sortDir },
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
      const customer = await tx.customer.findFirst({
        where: { id: customerId, businessId: biz },
        select: { id: true }
      });
      if (!customer) throw Object.assign(new Error('Customer not found or access denied'), { code: 'BUSINESS_RULE' });

      const business     = await tx.business.findUnique({ where: { id: biz }, select: { gstInclusive: true, gstNumber: true, stateCode: true } });
      const gstInclusive = business?.gstInclusive ?? false;
      const businessStateCode = business?.stateCode || extractStateCodeFromGST(business?.gstNumber) || null;

      // Resolve place of supply state code
      let placeOfSupplyCode: string | null = null;
      if (placeOfSupply) {
        placeOfSupplyCode = placeOfSupply.length === 2 && /^\d{2}$/.test(placeOfSupply)
          ? placeOfSupply
          : businessStateCode;
      }

      const productMap: Record<string, any> = {};
      const invoiceLines = [];

      for (const item of items) {
        const product = await tx.product.findFirst({ where: { id: item.productId, businessId: biz } });
        if (!product) throw new Error(`Product ${item.productId} not found`);
        if (product.stock < item.qty) throw Object.assign(new Error(`Insufficient stock for "${product.name}"`), { code: 'BUSINESS_RULE' });
        productMap[item.productId] = product;
        invoiceLines.push({
          qty: item.qty,
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

      const enriched = items.map((item: any) => ({ ...item, purchasePrice: productMap[item.productId]?.purchasePrice || 0 }));

      // Deduct stock for each item
      for (const item of items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.qty } } });
      }

      const sale = await tx.sale.create({
        data: {
          invoiceNo, customerId, total, paid: paidAmt, status: saleStatus,
          placeOfSupply, reverseCharge: reverseCharge === true, notes,
          businessId: biz,
          items: { create: enriched.map((i: any) => ({ productId: i.productId, qty: i.qty, price: i.price, purchasePrice: i.purchasePrice, discount: parseFloat(i.discount) || 0, hsnCode: i.hsnCode, gstRate: parseFloat(i.gstRate) || 0 })) },
        },
        include: { customer: true, items: true },
      });

      if (paidAmt < total) {
        await tx.customer.update({ where: { id: customerId }, data: { dues: { increment: total - paidAmt } } });
      }

      await tx.userActivity.create({ data: { businessId: biz, userId: session.user.id, eventType: 'sale_created', metadata: { saleId: sale.id, invoiceNo, total } } });
      return sale;
    });

    return created(result);
  } catch (e: any) {
    if (e instanceof AuthError) return e.response;
    if (e instanceof z.ZodError) return validationError(e.issues);
    if (e?.code === 'BUSINESS_RULE') return businessRule(e.message);
    console.error(e);
    return internalError(e.message);
  }
}
