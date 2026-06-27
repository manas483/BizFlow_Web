export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'connected', ts: new Date() });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({ status: 'error', db: 'disconnected' }, { status: 503 });
  }
}



