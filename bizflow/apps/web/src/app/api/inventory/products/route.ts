export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { productSchema } from '@/shared/lib/validations';
import { z } from 'zod';
import { InventoryService } from '@/modules/inventory';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const isPicker = searchParams.get('picker') === 'true' || searchParams.get('purpose') === 'product-picker';
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
    const limit = Math.min(isPicker ? 5000 : 100, parseInt(searchParams.get('limit') ?? (isPicker ? '5000' : '25'), 10));

    const result = await InventoryService.getProducts(session.user.businessId, search, category, page, limit, isPicker);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const validatedData = productSchema.parse(body);

    const product = await InventoryService.createProduct(validatedData, session);

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error('POST /api/products error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
