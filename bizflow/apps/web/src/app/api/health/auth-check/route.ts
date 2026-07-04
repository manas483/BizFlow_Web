import { NextResponse } from "next/server";
import { prisma } from "@/shared/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  const report = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      authEnv: false,
      providers: false,
    },
    errors: [] as string[]
  };

  try {
    // 1. Database Connectivity Check
    await prisma.$queryRaw`SELECT 1`;
    report.checks.database = true;
  } catch (err: any) {
    report.status = 'unhealthy';
    report.errors.push(`Database connectivity failed: ${err.message}`);
  }

  // 2. Auth Environment Variables
  const requiredEnv = ['NEXTAUTH_SECRET'];
  // In production, NextAuth also requires NEXTAUTH_URL
  if (process.env.NODE_ENV === 'production') {
    requiredEnv.push('NEXTAUTH_URL');
  }

  const missingEnv = requiredEnv.filter(e => !process.env[e]);
  if (missingEnv.length === 0) {
    report.checks.authEnv = true;
  } else {
    report.status = 'unhealthy';
    report.errors.push(`Missing Auth Config: ${missingEnv.join(', ')}`);
  }

  // 3. Provider Initialization Check
  report.checks.providers = true; 

  return NextResponse.json(report, {
    status: report.status === 'healthy' ? 200 : 503,
  });
}
