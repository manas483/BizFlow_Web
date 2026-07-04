export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

import { prisma } from '@/shared/lib/db';
import { withTelemetry } from '@/shared/lib/telemetry';

async function handler(req: NextRequest) {
  try {
    // Only SUPER_ADMIN can view telemetry
    await requireAuth(['SUPER_ADMIN']);

    const telemetry = {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      cache: {
        hits: 0,
        misses: 0,
        sets: 0,
        invalidations: 0,
        hitRatio: 0,
      },
      database: {
        status: 'unknown',
      }
    };

    // DB Ping
    try {
      await prisma.$queryRaw`SELECT 1`;
      telemetry.database.status = 'connected';
    } catch (err: any) {
      telemetry.database.status = 'disconnected';
      telemetry.status = 'degraded';
    }

    // Cache metrics are no longer supported via hgetall as CacheProvider is generic
    telemetry.cache = { hits: 0, misses: 0, sets: 0, invalidations: 0, hitRatio: 0 };

    // Determine overall status based on thresholds
    if (telemetry.cache.hitRatio > 0 && telemetry.cache.hitRatio < 60) {
      telemetry.status = 'degraded';
    }

    return NextResponse.json(telemetry, { status: telemetry.status === 'healthy' ? 200 : 503 });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('Telemetry Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = withTelemetry(handler);
