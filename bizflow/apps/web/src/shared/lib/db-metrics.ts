export interface QueryFingerprintStat {
  fingerprint: string;
  model: string;
  operation: string;
  count: number;
  totalDurationMs: number;
  avgDurationMs: number;
  nPlusOneTriggers: number;
  impactScore: number;
  baselineAvgMs: number;
  recentAvgMs: number;
  regressionPct: number;
}

export interface NPlusOneWarning {
  reqId: string;
  fingerprint: string;
  count: number;
  durationMs: number;
  timestamp: string;
}

// Weights for Business Impact Scoring
const ROUTE_WEIGHTS: Record<string, number> = {
  '/api/sales': 10,
  '/api/dashboard/stats': 6,
  '/api/inventory/products': 5,
  '/api/reports': 3,
  '/api/settings': 1,
  'default': 5
};

function getRouteWeight(route: string): number {
  for (const [prefix, weight] of Object.entries(ROUTE_WEIGHTS)) {
    if (prefix !== 'default' && route.startsWith(prefix)) return weight;
  }
  return ROUTE_WEIGHTS['default'];
}

const g = globalThis as any;

class DbMetricsStore {
  // Aggregated stats by fingerprint
  private queryStats = new Map<string, QueryFingerprintStat>();
  
  // Track queries per request to detect N+1
  private requestQueryCounts = new Map<string, Map<string, number>>();
  private nPlusOneWarnings: NPlusOneWarning[] = [];

  recordQuery(reqId: string | undefined, route: string | undefined, model: string, operation: string, durationMs: number, args: any) {
    const fingerprint = `${model}.${operation}`;

    let stat = this.queryStats.get(fingerprint);
    if (!stat) {
      stat = { 
        fingerprint, model, operation, count: 0, totalDurationMs: 0, avgDurationMs: 0, nPlusOneTriggers: 0,
        impactScore: 0, baselineAvgMs: durationMs, recentAvgMs: durationMs, regressionPct: 0
      };
      this.queryStats.set(fingerprint, stat);
    }
    
    stat.count++;
    stat.totalDurationMs += durationMs;
    stat.avgDurationMs = Math.round(stat.totalDurationMs / stat.count);

    // Business Impact Score
    const weight = getRouteWeight(route || 'unknown');
    // We add to impact score incrementally so different routes using the same query contribute their respective weights
    stat.impactScore += (durationMs * weight);

    // Rolling Baseline (Regression Detection)
    // First 50 queries establish the baseline
    if (stat.count <= 50) {
      stat.baselineAvgMs = stat.avgDurationMs;
    } else {
      // Exponential moving average for recent queries
      stat.recentAvgMs = Math.round((stat.recentAvgMs * 0.9) + (durationMs * 0.1));
      
      if (stat.baselineAvgMs > 0 && stat.recentAvgMs > stat.baselineAvgMs) {
        stat.regressionPct = Math.round(((stat.recentAvgMs - stat.baselineAvgMs) / stat.baselineAvgMs) * 100);
      } else {
        stat.regressionPct = 0;
      }
    }

    if (reqId) {
      let reqCounts = this.requestQueryCounts.get(reqId);
      if (!reqCounts) {
        reqCounts = new Map();
        this.requestQueryCounts.set(reqId, reqCounts);
      }
      
      const currentCount = (reqCounts.get(fingerprint) || 0) + 1;
      reqCounts.set(fingerprint, currentCount);

      if (currentCount === 10) {
        stat.nPlusOneTriggers++;
        this.nPlusOneWarnings.unshift({
          reqId, fingerprint, count: currentCount, durationMs, timestamp: new Date().toISOString()
        });
        if (this.nPlusOneWarnings.length > 50) this.nPlusOneWarnings.pop();
      }
    }
  }

  clearRequest(reqId: string) {
    this.requestQueryCounts.delete(reqId);
  }

  getTotalQueriesForRequest(reqId: string): number {
    const reqCounts = this.requestQueryCounts.get(reqId);
    if (!reqCounts) return 0;
    let total = 0;
    for (const count of reqCounts.values()) total += count;
    return total;
  }

  getTopConsumers(limit = 20): QueryFingerprintStat[] {
    return Array.from(this.queryStats.values())
      .sort((a, b) => b.impactScore - a.impactScore) // Sort by Impact Score instead of just Total Time
      .slice(0, limit);
  }

  getNPlusOneWarnings(): NPlusOneWarning[] {
    return [...this.nPlusOneWarnings];
  }
}

if (!g.__dbMetricsStore) {
  g.__dbMetricsStore = new DbMetricsStore();
}

export const dbMetricsStore: DbMetricsStore = g.__dbMetricsStore;
