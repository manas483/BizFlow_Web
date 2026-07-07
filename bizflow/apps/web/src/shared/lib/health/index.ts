import { prisma } from '../db';
import { logger } from '../logger';

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  message?: string;
  error?: string;
}

export interface LooseStockIntegrityResult {
  status: 'ok' | 'degraded';
  checkedProducts: number;
  violations: Array<{
    productId: string;
    productName: string;
    issue: string;
    details: Record<string, unknown>;
  }>;
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

/**
 * Loose Stock Integrity Check.
 *
 * For every loose-sale-enabled product in the database this check verifies:
 *
 *  1. baseStock >= 0 and stock >= 0  (no negative quantities)
 *  2. stock == floor(baseStock / primaryConversionFactor)
 *     (derived cache is consistent with the single source of truth)
 *  3. sum(InventoryLayer.remainingQty) ≈ baseStock / primaryConversionFactor
 *     within a small tolerance (handles float arithmetic drift)
 *  4. At least one ProductPackaging row is defined (isPurchaseUnit = true)
 *
 * Returns a structured report — the caller decides whether violations are
 * 'degraded' or 'down' based on the presence of violations.
 */
export async function checkLooseStockIntegrity(): Promise<LooseStockIntegrityResult> {
  const violations: LooseStockIntegrityResult['violations'] = [];

  // Load all loose-sale products with their packaging options and active layers
  const products = await prisma.product.findMany({
    where: { allowLooseSale: true },
    select: {
      id: true,
      name: true,
      stock: true,
      baseStock: true,
      baseUnit: true,
      packagingOptions: {
        where: { active: true },
        select: {
          id: true,
          label: true,
          conversionFactor: true,
          isPurchaseUnit: true,
        },
      },
    },
  });

  for (const product of products) {
    const baseStock = Number(product.baseStock) ?? 0;
    const stock = Number(product.stock) ?? 0;

    // ── 1. Non-negative check ──────────────────────────────────────────────
    if (baseStock < 0) {
      violations.push({
        productId: product.id,
        productName: product.name,
        issue: 'NEGATIVE_BASE_STOCK',
        details: { baseStock },
      });
    }
    if (stock < 0) {
      violations.push({
        productId: product.id,
        productName: product.name,
        issue: 'NEGATIVE_STOCK',
        details: { stock },
      });
    }

    // ── 2. Derived cache consistency ───────────────────────────────────────
    const primaryPkg = product.packagingOptions.find((p: any) => p.isPurchaseUnit);
    if (primaryPkg) {
      const primaryFactor = Number(primaryPkg.conversionFactor);
      if (primaryFactor > 0) {
        const expectedStock = Math.floor(baseStock / primaryFactor);
        if (stock !== expectedStock) {
          violations.push({
            productId: product.id,
            productName: product.name,
            issue: 'STOCK_CACHE_MISMATCH',
            details: {
              stock,
              expectedStock,
              baseStock,
              primaryFactor,
            },
          });
        }

        // ── 3. Layer sum vs baseStock ────────────────────────────────────────
        const layers = await prisma.inventoryLayer.findMany({
          where: { itemId: product.id, status: 'ACTIVE', remainingQty: { gt: 0 } },
          select: { remainingQty: true, quantity: true },
        });

        if (layers.length > 0) {
          const layerBagSum = layers.reduce((sum: number, l: any) => sum + Number(l.remainingQty), 0);
          // Convert layer bags → base units for comparison
          const layerBaseSum = layerBagSum * primaryFactor;
          // Allow ±0.01 tolerance for floating-point drift
          const TOLERANCE = 0.01;
          if (Math.abs(layerBaseSum - baseStock) > TOLERANCE) {
            violations.push({
              productId: product.id,
              productName: product.name,
              issue: 'LAYER_SUM_MISMATCH',
              details: {
                baseStock,
                layerBaseSum: Math.round(layerBaseSum * 10000) / 10000,
                delta: Math.round((layerBaseSum - baseStock) * 10000) / 10000,
                layerCount: layers.length,
              },
            });
          }
        }
      }
    }

    // ── 4. Must have at least one active packaging definition ─────────────
    if (product.packagingOptions.length === 0) {
      violations.push({
        productId: product.id,
        productName: product.name,
        issue: 'NO_PACKAGING_DEFINED',
        details: {},
      });
    } else if (!product.packagingOptions.some((p: any) => p.isPurchaseUnit)) {
      violations.push({
        productId: product.id,
        productName: product.name,
        issue: 'NO_PRIMARY_PACKAGING',
        details: {
          packagingCount: product.packagingOptions.length,
        },
      });
    }
  }

  return {
    status: violations.length === 0 ? 'ok' : 'degraded',
    checkedProducts: products.length,
    violations,
  };
}

export async function runAllHealthChecks() {
  const [db, env, users, looseStock] = await Promise.all([
    checkDatabaseHealth(),
    checkEnvironmentHealth(),
    checkUserTableHealth(),
    checkLooseStockIntegrity().catch((err: any) => ({
      status: 'degraded' as const,
      checkedProducts: 0,
      violations: [{ productId: 'N/A', productName: 'N/A', issue: 'HEALTH_CHECK_FAILED', details: { error: err.message } }],
    })),
  ]);

  const coreChecks = [db, env, users];
  const isDown = coreChecks.some(check => check.status === 'down');
  const isDegraded = coreChecks.some(check => check.status === 'degraded') || looseStock.status === 'degraded';

  const overallStatus = isDown ? 'down' : isDegraded ? 'degraded' : 'ok';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    components: {
      database: db,
      environment: env,
      userTable: users,
      looseStockIntegrity: {
        status: looseStock.status,
        checkedProducts: looseStock.checkedProducts,
        violationCount: looseStock.violations.length,
        violations: looseStock.violations,
      },
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
