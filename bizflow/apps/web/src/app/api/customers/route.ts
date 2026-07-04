export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { customerSchema } from '@/shared/lib/validations';
import { z } from 'zod';
import { withPerf, getTimer } from '@/shared/lib/telemetry';

async function handleGET(req: NextRequest) {
  try {
    const timer = getTimer();

    timer?.phase('auth');
    const session = await requireAuth();

    timer?.phase('parse_params');
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10));
    const skip  = (page - 1) * limit;

    const where = {
      businessId: session.user.businessId,
      deletedAt: null,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } }
        ]
      } : {}),
    };

    timer?.phase('db_query');
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: { select: { sales: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    timer?.phase('db_aggregation');
    // Compute exact purchase amounts from actual sales data
    const customerIds = customers.map((c: any) => c.id);
    const salesAggregates = customerIds.length > 0
      ? await prisma.sale.groupBy({
          by: ['customerId'],
          where: { customerId: { in: customerIds } },
          _sum: { total: true },
        })
      : [];

    timer?.phase('enrichment');
    const salesMap = new Map(salesAggregates.map((a: any) => [a.customerId, a._sum.total || 0]));

    const enrichedCustomers = customers.map((c: any) => ({
      ...c,
      purchaseCount: c._count?.sales || 0,
      computedTotalPurchases: salesMap.get(c.id) || 0,
    }));

    timer?.phase('serialization');
    return NextResponse.json({ data: enrichedCustomers, total, page, limit, totalPages: Math.ceil(total / limit) });
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
    const validatedData = customerSchema.parse(body);

    timer?.phase('db_write');
    const customer = await prisma.customer.create({
      data: {
        ...validatedData,
        phone: validatedData.phone || '',
        status: 'active',
        businessId: session.user.businessId,
      }
    });

    timer?.phase('audit');
    const { logAudit } = await import('@/shared/lib/audit');
    await Promise.all([
      (prisma as any).userActivity.create({
        data: {
          businessId: session.user.businessId,
          userId: session.user.id ?? "unknown",
          eventType: "customer_added",
          metadata: { customerId: customer.id },
        }
      }),
      logAudit({
        session,
        action: 'CREATE',
        entityType: 'Customer',
        entityId: customer.id,
        entityLabel: customer.name,
      })
    ]);

    timer?.phase('serialization');
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error('POST /api/customers error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = withPerf(handleGET);
export const POST = withPerf(handlePOST);
