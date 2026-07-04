export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { perfStore, PERF_BUDGETS } from '@/shared/lib/telemetry';
import { CacheMetrics } from '@/shared/lib/cache';

/**
 * GET /api/health/perf
 *
 * Internal performance dashboard — returns aggregated API metrics.
 * Restricted to SUPER_ADMIN role.
 *
 * Query params:
 *   ?recent=N   — also include the last N raw samples (default: 0)
 *   ?clear=true — clear the sample buffer after reading
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    const { searchParams } = new URL(req.url);
    const recentCount = parseInt(searchParams.get('recent') ?? '0', 10);
    const shouldClear = searchParams.get('clear') === 'true';

    const stats = perfStore.getStats();
    const recent = recentCount > 0 ? perfStore.getRecent(recentCount) : [];

    if (shouldClear) {
      perfStore.clear();
    }

    return NextResponse.json({
      summary: {
        routeCount: stats.length,
        totalSamples: stats.reduce((s, r) => s + r.count, 0),
        overBudgetRoutes: stats.filter(r => r.overBudgetPct > 0).length,
        budgets: PERF_BUDGETS,
      },
      cache: {
        ...CacheMetrics,
        hitRatePct: CacheMetrics.hit + CacheMetrics.miss > 0
          ? Math.round((CacheMetrics.hit / (CacheMetrics.hit + CacheMetrics.miss)) * 100)
          : 0,
      },
      routes: stats,
      ...(recent.length > 0 ? { recent } : {}),
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
