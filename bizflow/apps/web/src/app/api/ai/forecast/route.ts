import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { generateForecast } from '@/shared/lib/gemini';
import { prisma } from '@/shared/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const businessId = session.user.businessId;

    // Check if AI forecasting is enabled
    const settings = await prisma.automationSettings.findUnique({
      where: { businessId },
      select: { aiForecast: true },
    });

    if (!settings?.aiForecast) {
      return NextResponse.json(
        { error: 'AI Forecasting is disabled. Enable it in Settings → Automation.' },
        { status: 403 }
      );
    }

    const forecast = await generateForecast(businessId);
    return NextResponse.json(forecast);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[AI Forecast]', error);
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 });
  }
}
