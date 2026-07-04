import { prisma } from '../db';
import { logger } from '../logger';

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  message?: string;
  error?: string;
}

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const start = performance.now();
  try {
    // Read-only, lightweight query
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - start);
    return { status: 'ok', latencyMs };
  } catch (error: any) {
    logger.error({ category: 'HEALTH', event: 'DB_HEALTH_FAILED', error: error.message });
    return { status: 'down', message: 'Database connection failed', error: error.message };
  }
}

export async function checkEnvironmentHealth(): Promise<HealthCheckResult> {
  const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    return { 
      status: 'down', 
      message: 'Missing required environment variables', 
      error: `Missing: ${missing.join(', ')}` 
    };
  }
  return { status: 'ok' };
}

export async function checkUserTableHealth(): Promise<HealthCheckResult> {
  const start = performance.now();
  try {
    // Check if we can at least count users without crashing
    const count = await prisma.user.count({ take: 1 });
    const latencyMs = Math.round(performance.now() - start);
    return { status: 'ok', latencyMs, message: `User table accessible` };
  } catch (error: any) {
    logger.error({ category: 'HEALTH', event: 'USER_TABLE_HEALTH_FAILED', error: error.message });
    return { status: 'down', message: 'Failed to access user table', error: error.message };
  }
}

export async function runAllHealthChecks() {
  const [db, env, users] = await Promise.all([
    checkDatabaseHealth(),
    checkEnvironmentHealth(),
    checkUserTableHealth(),
  ]);

  const isDown = [db, env, users].some(check => check.status === 'down');
  const isDegraded = [db, env, users].some(check => check.status === 'degraded');

  const overallStatus = isDown ? 'down' : isDegraded ? 'degraded' : 'ok';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    components: {
      database: db,
      environment: env,
      userTable: users,
    },
    system: {
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
      commit: process.env.GIT_COMMIT_SHA || 'unknown',
    },
    authFailures: require('../auth-buffer').authFailureBuffer.get(),
    slowQueries: require('../slow-query-buffer').slowQueryBuffer.get(),
    apiMetrics: require('../telemetry').perfStore.getStats(),
    dbMetrics: require('../db-metrics').dbMetricsStore.getTopConsumers(15),
    nPlusOneWarnings: require('../db-metrics').dbMetricsStore.getNPlusOneWarnings()
  };
}
