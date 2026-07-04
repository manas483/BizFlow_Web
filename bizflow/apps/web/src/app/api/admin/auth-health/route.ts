import { NextResponse } from 'next/server';
import { requireAuth, withAuth } from '@/shared/lib/api-guard';
import { runAllHealthChecks } from '@/shared/lib/health';
import { withPerf } from '@/shared/lib/telemetry';
import { logger } from '@/shared/lib/logger';

async function handler(req: Request) {
  // Protect the health endpoint: require SUPER_ADMIN in production
  if (process.env.NODE_ENV === 'production') {
    await requireAuth(['SUPER_ADMIN']);
  }

  logger.info({ category: 'HEALTH', event: 'HEALTH_CHECK_REQUESTED', message: 'Auth health check requested' });

  const health = await runAllHealthChecks();

  const status = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { status });
}

export const GET = withPerf(withAuth(handler));
