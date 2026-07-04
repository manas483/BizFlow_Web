import { logger } from './shared/lib/logger';
import { prisma } from './shared/lib/db';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    logger.info({
      category: 'SYSTEM',
      event: 'STARTUP',
      message: 'Initializing BizFlow application',
      nodeVersion: process.version,
    });

    const requiredEnv = [
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
      'DATABASE_URL'
    ];

    const missing = requiredEnv.filter(env => !process.env[env]);

    if (missing.length > 0) {
      logger.error({
        category: 'SYSTEM',
        event: 'ENV_VALIDATION_FAILED',
        missing,
        message: `CRITICAL: Missing required environment variables: ${missing.join(', ')}`
      });
      
      if (missing.includes('NEXTAUTH_SECRET')) {
        throw new Error('FATAL: NEXTAUTH_SECRET is missing. Authentication cannot function. Crashing startup.');
      }
    } else {
      logger.info({
        category: 'SYSTEM',
        event: 'ENV_VALIDATION_PASSED',
        message: 'Environment validation passed'
      });
    }

    // Ping DB lightly
    try {
      const start = performance.now();
      await prisma.$queryRaw`SELECT 1`;
      const durationMs = Math.round(performance.now() - start);
      logger.info({
        category: 'SYSTEM',
        event: 'DB_CONNECTION_SUCCESS',
        durationMs,
        message: 'Database connection established'
      });
    } catch (error: any) {
      logger.warn({
        category: 'SYSTEM',
        event: 'DB_CONNECTION_FAILED',
        error: error.message,
        message: 'Database connection failed at startup. Runtime will retry on demand.'
      });
    }
  }
}
