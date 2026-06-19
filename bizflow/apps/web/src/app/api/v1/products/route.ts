/**
 * GET  /api/v1/products        — paginated product list
 * POST /api/v1/products        — create product
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { productSchema }          from '@/shared/lib/validations';
import { ok, created, validationError, internalError, notFound, parsePagination, buildPagination } from '@/shared/lib/response';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const sp      = new URL(req.url).searchParams;

    // ── Barcode / SKU direct lookup (bypasses pagination) ──────────────────────
    const sku = sp.get('sku') ?? sp.get('barcode') ?? '';
    if (sku) {
      const product = await prisma.product.findFirst({
        where: { sku: { equals: sku, mode: 'insensitive' }, businessId: session.user.businessId },
      });
      return product ? ok(product) : notFound(`No product found with SKU "${sku}"`);
    }

    const { page, limit, skip, sortBy, sortDir } = parsePagination(sp);
    const search   = sp.get('search') ?? '';
    const category = sp.get('category') ?? '';
    const lowStock = sp.get('lowStock') === 'true';

    const where: any = {
      businessId: session.user.businessId,
      ...(search   ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(category ? { category } : {}),
    };
    if (lowStock) where.stock = { lte: prisma.product.fields.minStock };

    const allowedSort = ['name', 'stock', 'sellingPrice', 'purchasePrice', 'createdAt', 'category'];
    const orderField  = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy: { [orderField]: sortDir }, skip, take: limit }),
      prisma.product.count({ where }),
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
    const body    = await req.json();
    const parsed  = productSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues);

    const { purchaseDate, ...rest } = parsed.data;
    const product = await prisma.product.create({
      data: {
        ...rest,
        ...(purchaseDate ? { purchaseDate: new Date(purchaseDate) } : {}),
        businessId: session.user.businessId,
      },
    });

    await prisma.userActivity.create({
      data: { businessId: session.user.businessId, userId: session.user.id, eventType: 'product_add', metadata: { productId: product.id } },
    });

    return created(product);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    if (e instanceof z.ZodError) return validationError(e.issues);
    console.error(e);
    return internalError();
  }
}
