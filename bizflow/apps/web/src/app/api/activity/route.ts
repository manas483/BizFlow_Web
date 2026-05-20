import { NextResponse } from "next/server";
import { requireAuth, withAuth, AuthError } from "@/lib/api-guard";
import { prisma } from "@/lib/db";

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

export const GET = withAuth(async () => {
  try {
    const session = await requireAuth();

    const activities = await (prisma as any).userActivity.findMany({
      where: { businessId: session.user.businessId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(activities);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    return NextResponse.json([]);
  }
});
