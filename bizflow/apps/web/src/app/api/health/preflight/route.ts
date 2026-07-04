import { NextResponse } from 'next/server';
import { runSystemPreflightChecks } from '@/shared/lib/system-checks';

export async function GET(request: Request) {
  // Only allow in development/CI or with a specific health check token
  const authHeader = request.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const report = await runSystemPreflightChecks();

  return NextResponse.json(report, {
    status: report.success ? 200 : 503,
  });
}
