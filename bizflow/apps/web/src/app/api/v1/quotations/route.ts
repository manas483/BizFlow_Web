export const dynamic = 'force-dynamic';
/**
 * GET  /api/v1/quotations   — paginated quotation list
 * POST /api/v1/quotations   — create quotation
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { quotationSchema }        from '@/shared/lib/validations';
import { ok, created, validationError, internalError, parsePagination, buildPagination } from '@/shared/lib/response';
import { z } from 'zod';
import { buildProductSnapshot } from '@/shared/lib/product-snapshot';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const sp      = new URL(req.url).searchParams;
    const { page, limit, skip, sortBy, sortDir } = parsePagination(sp);
    const search = sp.get('search') ?? '';

    const where: any = {
      businessId: session.user.businessId,
      ...(search ? {
        OR: [
          { quotationNo: { contains: search, mode: 'insensitive' as const } },
          { customer:    { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      } : {}),
    };

    const allowedSort = ['quotationNo', 'total', 'createdAt', 'validUntil'];
    const orderField  = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include:  { customer: true, items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
        orderBy:  { [orderField]: sortDir },
        skip,
        take: limit,
      }),
      prisma.quotation.count({ where }),
    ]);

    return ok(data, { pagination: buildPagination(total, page, limit) });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const parsed  = quotationSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);
    const { customerId, items, notes, placeOfSupply, reverseCharge, validUntil } = parsed.data;

    const result = await prisma.$transaction(async (tx: any) => {
      const productIds = items.map((i: any) => i.productId);
      const { loadProductsForDocument } = require('@/shared/lib/batch-queries');

      const [customer, business, { productMap, missingIds }] = await Promise.all([
        tx.customer.findFirst({
          where: { id: customerId, businessId: session.user.businessId },
          select: { id: true }
        }),
        tx.business.findUnique({ where: { id: session.user.businessId }, select: { gstInclusive: true } }),
        loadProductsForDocument(tx, session.user.businessId, productIds)
      ]);

      if (!customer) throw new Error('Customer not found or access denied');
      if (missingIds.length > 0) throw new Error(`Products not found: ${missingIds.join(', ')}`);

      const gstInclusive = business?.gstInclusive ?? false;

      let total = 0;
      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product.active) throw new Error(`Product "${product.name}" is archived and cannot be used in new transactions.`);
        
        const amount = (product.sellingPrice * item.qty) - (item.discount || 0);
        const rate   = item.gstRate || product.gstRate || 0;
        total += gstInclusive && rate > 0 ? amount : amount + amount * (rate / 100);
      }

      const year   = new Date().getFullYear();
      const prefix = `QTN-${year}-`;
      const last   = await tx.quotation.findFirst({ where: { businessId: session.user.businessId, quotationNo: { startsWith: prefix } }, orderBy: { quotationNo: 'desc' }, select: { quotationNo: true } });
      const nextNum = last ? (parseInt(last.quotationNo.split('-').at(-1)!, 10) || 0) + 1 : 1;
      const quotationNo = `${prefix}${String(nextNum).padStart(3, '0')}`;

      const quotation = await tx.quotation.create({
        data: {
          quotationNo, customerId, total, notes,
          placeOfSupply: placeOfSupply || null,
          reverseCharge: reverseCharge === true,
          validUntil:    validUntil ? new Date(validUntil) : null,
          businessId:    session.user.businessId,
          items: {
            create: items.map((item: any) => {
              const product = productMap.get(item.productId);
              return {
                productId:     item.productId,
                qty:           item.qty,
                price:         item.price,
                purchasePrice: productMap.get(item.productId)?.purchasePrice || 0,
                discount:      parseFloat(item.discount) || 0,
                hsnCode:       item.hsnCode,
                gstRate:       parseFloat(item.gstRate) || 0,
                ...buildProductSnapshot(product),
              };
            }),
          },
        },
        include: { customer: true, items: true },
      });

      await tx.userActivity.create({ data: { businessId: session.user.businessId, userId: session.user.id, eventType: 'quotation_created', metadata: { quotationId: quotation.id, total } } });
      return quotation;
    });

    return created(result);
  } catch (e: any) {
    if (e instanceof AuthError) return e.response;
    if (e instanceof z.ZodError) return validationError(e.issues);
    console.error(e);
    return internalError(e.message);
  }
}
