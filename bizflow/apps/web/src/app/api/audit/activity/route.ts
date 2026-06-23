export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { requireAuth, withAuth, AuthError } from "@/shared/lib/api-guard";
import { prisma } from "@/shared/lib/db";

export const POST = withAuth(async (req: Request) => {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { eventType, metadata } = body;

    if (!eventType) {
      return NextResponse.json({ error: 'eventType required' }, { status: 400 });
    }

    await (prisma as any).userActivity.create({
      data: {
        businessId: session.user.businessId,
        userId: session.user.id ?? "unknown",
        eventType,
        metadata: metadata ?? {},
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) throw error;
    // Silently fail — activity tracking must never break the app
    return NextResponse.json({ success: false });
  }
});

export const GET = withAuth(async (req: Request) => {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);

    const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
    const userId = searchParams.get('userId');
    const eventType = searchParams.get('eventType');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: any = {
      businessId: session.user.businessId,
      ...(userId ? { userId } : {}),
      ...(eventType ? { eventType } : {}),
      ...((dateFrom || dateTo) ? {
        createdAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        }
      } : {}),
    };

    const [activities, total] = await Promise.all([
      (prisma as any).userActivity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (prisma as any).userActivity.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: activities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof AuthError) throw error;
    console.error('GET /api/activity error:', error);
    return NextResponse.json({
      success: false,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    });
  }
});

