export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { productSchema } from '@/shared/lib/validations';
import { z } from 'zod';
import { InventoryService } from '@/modules/inventory';
import { withPerf, getTimer } from '@/shared/lib/telemetry';

async function handleGET(req: NextRequest) {
  try {
    const timer = getTimer();

    timer?.phase('auth');
    const session = await requireAuth();

    timer?.phase('parse_params');
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const isPicker = searchParams.get('picker') === 'true' || searchParams.get('purpose') === 'product-picker';
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
    const limit = Math.min(isPicker ? 5000 : 100, parseInt(searchParams.get('limit') ?? (isPicker ? '5000' : '25'), 10));

    timer?.phase('db_query');
    const result = await InventoryService.getProducts(session.user.businessId, search, category, page, limit, isPicker);

    timer?.phase('serialization');
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const timer = getTimer();

    timer?.phase('auth');
    const session = await requireAuth();

    timer?.phase('validation');
    const body = await req.json();
    const validatedData = productSchema.parse(body);

    timer?.phase('db_write');
    const product = await InventoryService.createProduct(validatedData, session);

    timer?.phase('serialization');
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error('POST /api/products error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = withPerf(handleGET);
export const POST = withPerf(handlePOST);
