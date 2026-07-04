export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { z } from 'zod';
import { withPerf, getTimer } from '@/shared/lib/telemetry';

const automationSettingsSchema = z.object({
  autoGst: z.boolean().optional(),
  autoJournal: z.boolean().optional(),
  autoStockUpdate: z.boolean().optional(),
  autoReorderAlert: z.boolean().optional(),
  aiForecast: z.boolean().optional(),
  aiInsights: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  whatsappButton: z.boolean().optional(),
});

/**
 * GET — return current automation settings for the business.
 * Creates defaults if none exist (upsert pattern).
 */
async function handleGET(_req: NextRequest) {
  try {
    const timer = getTimer();

    timer?.phase('auth');
    const session = await requireAuth();

    timer?.phase('db_query');
    const settings = await prisma.automationSettings.upsert({
      where: { businessId: session.user.businessId },
      update: {},
      create: { businessId: session.user.businessId },
    });

    timer?.phase('serialization');
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PUT — update automation settings. Super Admin only.
 */
async function handlePUT(req: NextRequest) {
  try {
    const timer = getTimer();

    timer?.phase('auth');
    const session = await requireAuth();

    // Only SUPER_ADMIN can modify automation settings
    const userRole = (session.user as any).role as string;
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can modify automation settings' }, { status: 403 });
    }

    timer?.phase('validation');
    const body = await req.json();
    const data = automationSettingsSchema.parse(body);

    timer?.phase('db_write');
    const settings = await prisma.automationSettings.upsert({
      where: { businessId: session.user.businessId },
      update: data,
      create: {
        businessId: session.user.businessId,
        ...data,
      },
    });

    timer?.phase('audit');
    // Log the change for audit trail
    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({
      session,
      action: 'UPDATE',
      entityType: 'AutomationSettings',
      entityId: settings.id,
      entityLabel: 'Automation Settings',
      changes: data as any,
    });

    timer?.phase('serialization');
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    }
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = withPerf(handleGET);
export const PUT = withPerf(handlePUT);
