import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Required for Node.js: provide a WebSocket implementation for the Neon driver
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma_v4: PrismaClient | undefined;
};

function createPrismaClient() {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  // Remove any quotes, whitespace, or carriage returns
  connectionString = connectionString.replace(/^"|"$/g, '').trim();

  // Use WebSocket adapter which supports both simple queries AND interactive transactions
  const adapter = new PrismaNeon({ connectionString });

  const prismaBase = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Phase 4 + Phase 0: Enhanced query monitoring with route context
  const { logger, requestContext } = require('./logger');

  return prismaBase.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          const { requestContext } = require('./logger');
          const ctx = requestContext.getStore();
          
          // Request-level memoization for frequent lookup tables
          const isCacheable = operation === 'findUnique' || operation === 'findFirst';
          const cacheableModels = ['Business', 'User', 'AutomationSettings'];
          let cacheKey: string | null = null;
          
          if (ctx && isCacheable && model && cacheableModels.includes(model)) {
            if (!ctx._queryCache) ctx._queryCache = new Map();
            cacheKey = `${model}:${operation}:${JSON.stringify(args)}`;
            if (ctx._queryCache.has(cacheKey)) {
              return ctx._queryCache.get(cacheKey);
            }
          }

          const start = performance.now();
          const result = await query(args);
          const duration = performance.now() - start;
          const durationMs = Math.round(duration);

          if (cacheKey && ctx && ctx._queryCache) {
            ctx._queryCache.set(cacheKey, result);
          }
          
          const route = ctx?.route ?? 'unknown';
          const requestId = ctx?.requestId ?? undefined;
          const userId = ctx?.userId ?? undefined;
          const businessId = ctx?.businessId ?? undefined;

          // Event-driven cache invalidation
          if (operation === 'create' || operation === 'update' || operation === 'delete') {
            const dashboardTriggers = ['Sale', 'Expense', 'Customer', 'Purchase', 'Product', 'StockMovement', 'InventoryLayer', 'SaleItem', 'PurchaseItem'];
            if (dashboardTriggers.includes(model ?? '')) {
              const { CacheInvalidation } = require('./cache-invalidator');
              const bId = businessId || (args as any)?.data?.businessId;
              if (bId) {
                switch (model) {
                  case 'Sale':
                  case 'SaleItem':
                    CacheInvalidation.invalidateSale(bId).catch(console.error);
                    break;
                  case 'Purchase':
                  case 'PurchaseItem':
                    CacheInvalidation.invalidatePurchase(bId).catch(console.error);
                    break;
                  case 'Product':
                    CacheInvalidation.invalidateProduct(bId, (args as any)?.where?.id).catch(console.error);
                    break;
                  case 'Customer':
                    CacheInvalidation.invalidateCustomer(bId, (args as any)?.where?.id).catch(console.error);
                    break;
                  case 'Expense':
                    CacheInvalidation.invalidateExpense(bId).catch(console.error);
                    break;
                  case 'StockMovement':
                  case 'InventoryLayer':
                    CacheInvalidation.invalidateInventory(bId).catch(console.error);
                    break;
                  default:
                    CacheInvalidation.invalidateDashboard(bId).catch(console.error);
                }
              }
            }
          }
          
          const rowsReturned = Array.isArray(result) ? result.length : (result ? 1 : 0);

          const logData = { 
            category: 'DB',
            model, 
            operation, 
            durationMs, 
            rowsReturned,
            route, 
            requestId,
            userId,
            businessId
          };
          
          require('./db-metrics').dbMetricsStore.recordQuery(requestId, route, model, operation, durationMs, args);

          if (durationMs > 100) {
            require('./slow-query-buffer').slowQueryBuffer.add({
              timestamp: new Date().toISOString(),
              reqId: requestId,
              userId: userId,
              businessId: businessId,
              model,
              operation,
              durationMs,
              rowsReturned,
              route,
            });
          }

          if (durationMs > 500) {
            logger.error({ ...logData, event: 'DB_SLOW_QUERY_ERROR', message: `Very slow query on ${model}.${operation} (${durationMs}ms)` });
          } else if (durationMs > 250) {
            logger.warn({ ...logData, event: 'DB_SLOW_QUERY_WARN', message: `Slow query on ${model}.${operation} (${durationMs}ms)` });
          } else if (durationMs > 100) {
            logger.info({ ...logData, event: 'DB_SLOW_QUERY_INFO', message: `Sub-optimal query on ${model}.${operation} (${durationMs}ms)` });
          }
          
          return result;
        },
      },
      product: {
        async update({ args, query }) {
          const data = args.data as any;
          const isUpdatingStock = data.stock !== undefined;
          const isUpdatingBaseStock = data.baseStock !== undefined;
          // If the update itself is setting allowLooseSale, the caller is
          // the inventory service managing loose-sale lifecycle — allow it.
          const isSettingLooseFlag = data.allowLooseSale !== undefined;

          if (isUpdatingStock && !isUpdatingBaseStock && !isSettingLooseFlag) {
            const current = await prismaBase.product.findUnique({
              where: args.where,
              select: { allowLooseSale: true },
            });
            if (current?.allowLooseSale) {
              throw new Error("Direct modification of 'stock' on loose-enabled products is forbidden. Use updateLooseStock() instead.");
            }
          }
          return query(args);
        },
        async updateMany({ args, query }) {
          const data = args.data as any;
          const isUpdatingStock = data?.stock !== undefined;
          const isUpdatingBaseStock = data?.baseStock !== undefined;
          const isSettingLooseFlag = data?.allowLooseSale !== undefined;

          if (isUpdatingStock && !isUpdatingBaseStock && !isSettingLooseFlag) {
            const products = await prismaBase.product.findMany({
              where: args.where,
              select: { allowLooseSale: true },
            });
            if (products.some((p: any) => p.allowLooseSale)) {
              throw new Error("Direct modification of 'stock' on loose-enabled products is forbidden. Use updateLooseStock() instead.");
            }
          }
          return query(args);
        }
      }
    },
  }) as unknown as PrismaClient; // Cast required because global type expects PrismaClient
}

export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    if (prop === '__esModule' || prop === 'then' || prop === 'default' || typeof prop === 'symbol') {
      return Reflect.get(target, prop);
    }
    if (!globalForPrisma.prisma_v4) {
      globalForPrisma.prisma_v4 = createPrismaClient();
    }
    return Reflect.get(globalForPrisma.prisma_v4, prop);
  }
});

