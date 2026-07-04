import { cacheProvider as cache } from './cache';
import { logger } from './logger';

export type FeatureFlag = 
  | 'NEW_REPORTS_V2'
  | 'ADVANCED_AI_FORECAST'
  | 'BETA_INVOICE_OCR'
  | 'EXPERIMENTAL_SYNC';

/**
 * Checks if a feature flag is enabled.
 * 
 * Hybrid Strategy:
 * 1. Checks environment variables first (e.g. FEATURE_NEW_REPORTS_V2=true)
 * 2. Falls back to Redis if available: feature-flag:NEW_REPORTS_V2:global or feature-flag:NEW_REPORTS_V2:{businessId}
 * 3. Defaults to false.
 */
export async function isFeatureEnabled(flag: FeatureFlag, businessId?: string): Promise<boolean> {
  // 1. Environment Variable check
  const envKey = `FEATURE_${flag}`;
  if (process.env[envKey] === 'true' || process.env[envKey] === '1') {
    return true;
  }
  if (process.env[envKey] === 'false' || process.env[envKey] === '0') {
    return false; // Explicitly disabled in ENV
  }

  // 2. Cache check
  if (cache) {
    try {
      if (businessId) {
        const businessFlag = await cache.get<boolean>(`feature-flag:${flag}:${businessId}`);
        if (businessFlag !== null) return businessFlag;
      }
      
      const globalFlag = await cache.get<boolean>(`feature-flag:${flag}:global`);
      if (globalFlag !== null) return globalFlag;
    } catch (err: any) {
      logger.error('Feature Flag Cache Error', { flag, error: err.message });
    }
  }

  // 3. Default state
  return false;
}
