import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { generateInsights } from '@/shared/lib/gemini';
import { prisma } from '@/shared/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const businessId = session.user.businessId;

    // Check if AI insights is enabled
    const settings = await prisma.automationSettings.findUnique({
      where: { businessId },
      select: { aiInsights: true },
    });

    if (!settings?.aiInsights) {
      return NextResponse.json(
        { error: 'AI Insights is disabled. Enable it in Settings → Automation.' },
        { status: 403 }
      );
    }

    const insights = await generateInsights(businessId);
    return NextResponse.json(insights);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[AI Insights]', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
