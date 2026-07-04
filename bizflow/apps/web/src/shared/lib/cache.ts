import { Redis } from '@upstash/redis';
import { logger } from './logger';
import { getTimer } from './telemetry';

// Standard TTLs per the user's request
export const CACHE_TTL = {
  DASHBOARD: 60,           // 60 seconds aggressive cache
  REPORTS: 15 * 60,        // 15 minutes
  PRODUCT_LIST: 30 * 60,   // 30 minutes
  CUSTOMER_LIST: 15 * 60,  // 15 minutes
  SETTINGS: 60 * 60,       // 1 hour
  ATTENDANCE: 15 * 60,     // 15 minutes
  INVENTORY_STATS: 30,     // 30 seconds
};

export const CacheKeys = {
  dashboard: (businessId: string) => `dashboard:${businessId}`,
  product: (businessId: string, id: string) => `product:${businessId}:${id}`,
  productList: (businessId: string) => `productList:${businessId}`,
  customer: (businessId: string, id: string) => `customer:${businessId}:${id}`,
  customerList: (businessId: string) => `customerList:${businessId}`,
  business: (businessId: string) => `business:${businessId}`,
  businessSettings: (businessId: string) => `businessSettings:${businessId}`,
  reports: (businessId: string, reportType: string) => `reports:${businessId}:${reportType}`,
  permissions: (businessId: string, role: string) => `permissions:${businessId}:${role}`,
  roles: (businessId: string) => `roles:${businessId}`,
};

export const CacheMetrics = {
  hit: 0,
  miss: 0,
  expired: 0,
  invalidated: 0,
  set: 0,
  estimatedDbTimeSavedMs: 0,
  currentKeys: 0,
};

interface CacheEnvelope<T> {
  data: T;
  computationTimeMs: number;
}

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

// ── In-Memory Cache (Default) ──────────────────────────────────────────────
class InMemoryCache implements CacheProvider {
  private cache = new Map<string, { value: any; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) {
      // It's a MISS (CacheMetrics.miss handled externally, or we just let it be)
      return null;
    }
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      CacheMetrics.expired++;
      CacheMetrics.currentKeys = this.cache.size;
      return null;
    }
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    CacheMetrics.set++;
    CacheMetrics.currentKeys = this.cache.size;
  }

  async invalidate(pattern: string): Promise<void> {
    let removed = 0;
    if (pattern.includes('*')) {
      const prefix = pattern.replace('*', '');
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          removed++;
        }
      }
    } else {
      if (this.cache.delete(pattern)) {
        removed++;
      }
    }
    CacheMetrics.invalidated += removed;
    CacheMetrics.currentKeys = this.cache.size;
  }
}

// ── Redis Cache (Upstash) ──────────────────────────────────────────────────
class RedisCache implements CacheProvider {
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async get<T>(key: string): Promise<T | null> {
    return this.redis.get<T>(key);
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, { ex: ttlSeconds });
  }

  async invalidate(pattern: string): Promise<void> {
    let removed = 0;
    if (pattern.includes('*')) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        removed = await this.redis.del(...keys);
      }
    } else {
      removed = await this.redis.del(pattern);
    }
    CacheMetrics.invalidated += removed;
  }
}

// ── Provider Selection ─────────────────────────────────────────────────────
const globalForCache = globalThis as unknown as { __cacheProvider?: CacheProvider };

export const CACHE_PROVIDER_NAME = (process.env.USE_REDIS_CACHE === 'true' && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) 
  ? 'Redis' 
  : 'Memory';

if (!globalForCache.__cacheProvider) {
  if (CACHE_PROVIDER_NAME === 'Redis') {
    globalForCache.__cacheProvider = new RedisCache(process.env.UPSTASH_REDIS_REST_URL!, process.env.UPSTASH_REDIS_REST_TOKEN!);
    logger.info('Cache Provider: Redis (Upstash)');
  } else {
    globalForCache.__cacheProvider = new InMemoryCache();
    logger.info('Cache Provider: In-Memory');
  }
}

export const cacheProvider = globalForCache.__cacheProvider;

/**
 * Gets a value from cache or executes the fallback function to compute and store it.
 */
export async function getCachedOrSet<T>(
  key: string,
  ttlSeconds: number,
  fallback: () => Promise<T>
): Promise<T> {
  const startLookup = performance.now();
  const timer = getTimer();
  
  try {
    const cached = await cacheProvider.get<CacheEnvelope<T>>(key);
    const lookupTime = performance.now() - startLookup;
    
    if (cached) {
      CacheMetrics.hit++;
      if (cached.computationTimeMs) {
        CacheMetrics.estimatedDbTimeSavedMs += cached.computationTimeMs;
      }
      logger.debug('Cache HIT', { key, lookupTime: Math.round(lookupTime) });
      timer?.phase('cache_hit');
      return cached.data;
    }
  } catch (err: any) {
    logger.error('Cache GET Error', { key, error: err.message });
  }

  CacheMetrics.miss++;
  const lookupTime = performance.now() - startLookup;
  logger.debug('Cache MISS (Computing...)', { key, lookupTime: Math.round(lookupTime) });
  timer?.phase('cache_miss');

  const computeStart = performance.now();
  const freshData = await fallback();
  const computeTime = performance.now() - computeStart;

  try {
    const envelope: CacheEnvelope<T> = { data: freshData, computationTimeMs: computeTime };
    await cacheProvider.set(key, envelope, ttlSeconds);
  } catch (err: any) {
    logger.error('Cache SET Error', { key, error: err.message });
  }

  return freshData;
}

/**
 * Invalidates cache by pattern or exact key.
 */
export async function invalidateCache(pattern: string) {
  try {
    await cacheProvider.invalidate(pattern);
    logger.info('Cache INVALIDATED', { pattern });
  } catch (err: any) {
    logger.error('Cache INVALIDATE Error', { pattern, error: err.message });
  }
}
