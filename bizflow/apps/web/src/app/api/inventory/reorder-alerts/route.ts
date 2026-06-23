export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { getReorderAlerts } from '@/shared/lib/stock-engine';

export async function GET() {
  try {
    const session = await requireAuth();
    const alerts = await getReorderAlerts(session.user.businessId);

    return NextResponse.json({
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

