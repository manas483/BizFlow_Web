import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { generateForecast, generateInsights } from '@/shared/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * AI Refresh Cron Job — runs daily at 6 AM IST.
 * Pre-generates forecasts and insights for all businesses with AI enabled.
 * Protected by CRON_SECRET.
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    // Find all businesses with AI features enabled
    const settings = await prisma.automationSettings.findMany({
      where: {
        OR: [
          { aiForecast: true },
          { aiInsights: true },
        ],
      },
      select: { businessId: true, aiForecast: true, aiInsights: true },
    });

    const results: Array<{ businessId: string; forecast: boolean; insights: boolean; error?: string }> = [];

    for (const s of settings) {
      try {
        let forecastDone = false;
        let insightsDone = false;

        if (s.aiForecast) {
          await generateForecast(s.businessId);
          forecastDone = true;
        }

        if (s.aiInsights) {
          await generateInsights(s.businessId);
          insightsDone = true;
        }

        results.push({ businessId: s.businessId, forecast: forecastDone, insights: insightsDone });
      } catch (err: any) {
        console.error(`[cron/ai-refresh] Failed for business ${s.businessId}:`, err.message);
        results.push({ businessId: s.businessId, forecast: false, insights: false, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('[cron/ai-refresh] Fatal error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
