import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Only allow secure invocations, normally checked via a cron secret in production
    // e.g. if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) return ...
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Delete AuthDiagnosticLog entries older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await prisma.authDiagnosticLog.deleteMany({
      where: {
        createdAt: {
          lt: ninetyDaysAgo,
        },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Cleaned up ${result.count} auth logs older than 90 days.`,
    });
  } catch (error: any) {
    console.error('Cleanup auth logs failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
