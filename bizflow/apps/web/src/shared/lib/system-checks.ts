import { prisma } from '@/shared/lib/db';

export type PreflightReport = {
  success: boolean;
  timestamp: string;
  checks: {
    name: string;
    passed: boolean;
    error?: string;
  }[];
};

export async function runSystemPreflightChecks(): Promise<PreflightReport> {
  const report: PreflightReport = {
    success: true,
    timestamp: new Date().toISOString(),
    checks: [],
  };

  const addCheck = (name: string, passed: boolean, error?: string) => {
    report.checks.push({ name, passed, error });
    if (!passed) report.success = false;
  };

  try {
    // 1. DB Connectivity
    await prisma.$queryRaw`SELECT 1`;
    addCheck('Database Connectivity', true);

    // 2. Schema Integrity (Querying core tables)
    try {
      await Promise.all([
        prisma.business.findFirst(),
        prisma.user.findFirst(),
        prisma.product.findFirst(),
        prisma.sale.findFirst(),
      ]);
      addCheck('Schema Integrity', true);
    } catch (e: any) {
      addCheck('Schema Integrity', false, e.message);
    }

    // 3. Environment Variables
    const requiredEnv = ['DATABASE_URL', 'NEXTAUTH_SECRET'];
    const missingEnv = requiredEnv.filter(e => !process.env[e]);
    if (missingEnv.length > 0) {
      addCheck('Environment Configuration', false, `Missing: ${missingEnv.join(', ')}`);
    } else {
      addCheck('Environment Configuration', true);
    }

  } catch (error: any) {
    addCheck('System Core', false, error.message);
  }

  return report;
}
