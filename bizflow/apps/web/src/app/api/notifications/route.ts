import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { z } from 'zod';

const notificationSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.string().default('info'),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userRole = (session.user as any).role as string;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');

    const notifications = await prisma.notification.findMany({
      where: {
        businessId: session.user.businessId,
        // Show notification if:
        //   (a) it has no targetRole (broadcast to everyone), OR
        //   (b) its targetRole matches this user's role exactly
        OR: [
          { targetRole: null },
          { targetRole: userRole },
        ],
        ...(category ? { category } : {}),
        ...(priority ? { priority } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(notifications);
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

    const validatedData = notificationSchema.parse(body);

    const notification = await prisma.notification.create({
      data: {
        ...validatedData,
        businessId: session.user.businessId,
      }
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

