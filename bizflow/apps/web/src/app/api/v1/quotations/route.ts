/**
 * GET  /api/v1/quotations   — paginated quotation list
 * POST /api/v1/quotations   — create quotation
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { quotationSchema }        from '@/lib/validations';
import { ok, created, validationError, internalError, parsePagination, buildPagination } from '@/lib/response';
import { z } from 'zod';

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
      const business    = await tx.business.findUnique({ where: { id: session.user.businessId }, select: { gstInclusive: true } });
      const gstInclusive = business?.gstInclusive ?? false;

      let total = 0;
      const productMap: Record<string, any> = {};
      for (const item of items) {
        const product = await tx.product.findFirst({ where: { id: item.productId, businessId: session.user.businessId } });
        if (!product) throw new Error(`Product ${item.productId} not found`);
        productMap[item.productId] = product;
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
            create: items.map((item: any) => ({
              productId:     item.productId,
              qty:           item.qty,
              price:         item.price,
              purchasePrice: productMap[item.productId]?.purchasePrice || 0,
              discount:      parseFloat(item.discount) || 0,
              hsnCode:       item.hsnCode,
              gstRate:       parseFloat(item.gstRate) || 0,
            })),
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
