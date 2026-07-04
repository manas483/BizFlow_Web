import { NextRequest, NextResponse } from 'next/server';
import { requestContext, logger, LogContext } from './logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Performance Budgets — measurable targets per operation
// ═══════════════════════════════════════════════════════════════════════════════

export const PERF_BUDGETS: Record<string, number> = {
  '/api/inventory/products':       300,
  '/api/sales':                    300,
  '/api/customers':                200,
  '/api/dashboard/stats':          500,
  '/api/expenses':                 300,
  '/api/employees':                200,
  '/api/accounting':               500,
  '/api/settings/automation':      100,
  // Write operations
  'POST /api/sales':               800,
  'POST /api/customers':           300,
  'POST /api/inventory/products':  500,
  // Auth
  'auth':                           50,
  // Default
  'default':                      1000,
};

export const QUERY_BUDGETS: Record<string, number> = {
  'POST /api/sales':               10,
  'POST /api/v1/sales':            10,
  '/api/dashboard/stats':          15,
  '/api/reports':                  20,
  '/api/inventory/products':       10,
  'default':                       20,
};

// ═══════════════════════════════════════════════════════════════════════════════
// RequestTimer — phase-level timing for API handlers
// ═══════════════════════════════════════════════════════════════════════════════

export interface PhaseEntry {
  name: string;
  durationMs: number;
}

export interface TimerSummary {
  phases: PhaseEntry[];
  totalMs: number;
  slowest: PhaseEntry;
}

/**
 * Lightweight timer for measuring individual phases within an API handler.
 *
 * Usage:
 *   const timer = new RequestTimer();
 *   timer.phase('auth');
 *   await requireAuth();
 *   timer.phase('db_query');
 *   const data = await prisma.product.findMany(...);
 *   timer.phase('serialization');
 *   const json = JSON.stringify(data);
 *   timer.end();
 *   const summary = timer.summary();
 */
export class RequestTimer {
  private phases: PhaseEntry[] = [];
  private current?: { name: string; start: number };
  private readonly startTime: number;

  constructor() {
    this.startTime = performance.now();
  }

  /** Start a new phase (automatically closes the previous one). */
  phase(name: string): this {
    this.end();
    this.current = { name, start: performance.now() };
    return this;
  }

  /** Close the current phase. */
  end(): this {
    if (this.current) {
      this.phases.push({
        name: this.current.name,
        durationMs: Math.round(performance.now() - this.current.start),
      });
      this.current = undefined;
    }
    return this;
  }

  /** Return all recorded phases and a summary. */
  summary(): TimerSummary {
    this.end();
    const totalMs = Math.round(performance.now() - this.startTime);
    const slowest = this.phases.length > 0
      ? this.phases.reduce((a, b) => (a.durationMs > b.durationMs ? a : b))
      : { name: 'none', durationMs: 0 };
    return { phases: this.phases, totalMs, slowest };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PerfStore — in-memory ring buffer for per-route performance metrics
// ═══════════════════════════════════════════════════════════════════════════════

export interface PerfSample {
  route: string;
  method: string;
  status: number;
  totalMs: number;
  phases: PhaseEntry[];
  slowestPhase: string;
  budgetMs: number;
  overBudget: boolean;
  queryCount: number;
  timestamp: number;
}

export interface RouteStats {
  route: string;
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  minMs: number;
  overBudgetCount: number;
  overBudgetPct: number;
  budgetMs: number;
  avgQueries: number;
  topSlowPhases: Record<string, number>; // phase name → average ms
}

const MAX_SAMPLES = 500; // Hard cap to prevent unbounded memory

class PerfStoreImpl {
  private samples: PerfSample[] = [];

  record(sample: PerfSample) {
    this.samples.push(sample);
    // Ring buffer: evict oldest when full
    if (this.samples.length > MAX_SAMPLES) {
      this.samples = this.samples.slice(-MAX_SAMPLES);
    }
  }

  /** Get aggregated stats per route. */
  getStats(): RouteStats[] {
    const byRoute = new Map<string, PerfSample[]>();
    for (const s of this.samples) {
      const key = `${s.method} ${s.route}`;
      if (!byRoute.has(key)) byRoute.set(key, []);
      byRoute.get(key)!.push(s);
    }

    const stats: RouteStats[] = [];
    for (const [route, routeSamples] of byRoute) {
      const durations = routeSamples.map(s => s.totalMs).sort((a, b) => a - b);
      const queryCounts = routeSamples.map(s => s.queryCount || 0);
      const count = durations.length;
      const avgMs = Math.round(durations.reduce((a, b) => a + b, 0) / count);
      const p95Ms = durations[Math.floor(count * 0.95)] ?? durations[count - 1];
      const maxMs = durations[count - 1];
      const minMs = durations[0];
      const overBudgetCount = routeSamples.filter(s => s.overBudget).length;
      const budgetMs = routeSamples[0]?.budgetMs ?? PERF_BUDGETS['default'];
      const avgQueries = Math.round(queryCounts.reduce((a, b) => a + b, 0) / count);

      // Aggregate phase timings
      const phaseAccum: Record<string, { total: number; count: number }> = {};
      for (const sample of routeSamples) {
        for (const phase of sample.phases) {
          if (!phaseAccum[phase.name]) phaseAccum[phase.name] = { total: 0, count: 0 };
          phaseAccum[phase.name].total += phase.durationMs;
          phaseAccum[phase.name].count += 1;
        }
      }
      const topSlowPhases: Record<string, number> = {};
      for (const [name, acc] of Object.entries(phaseAccum)) {
        topSlowPhases[name] = Math.round(acc.total / acc.count);
      }

      stats.push({
        route,
        count,
        avgMs,
        p95Ms,
        maxMs,
        minMs,
        overBudgetCount,
        overBudgetPct: Math.round((overBudgetCount / count) * 100),
        budgetMs,
        avgQueries,
        topSlowPhases,
      });
    }

    return stats.sort((a, b) => b.avgMs - a.avgMs); // Slowest first
  }

  /** Get raw samples (most recent N). */
  getRecent(n: number = 50): PerfSample[] {
    return this.samples.slice(-n);
  }

  /** Clear all collected samples. */
  clear() {
    this.samples = [];
  }
}

// Singleton (survives hot-reloads in dev via globalThis)
const globalForPerf = globalThis as unknown as { __perfStore?: PerfStoreImpl };
if (!globalForPerf.__perfStore) {
  globalForPerf.__perfStore = new PerfStoreImpl();
}
export const perfStore = globalForPerf.__perfStore;

// ═══════════════════════════════════════════════════════════════════════════════
// withPerf — universal API wrapper with phase timing + budget enforcement
// ═══════════════════════════════════════════════════════════════════════════════

function getBudget(method: string, route: string): number {
  // Try method-specific budget first (e.g., "POST /api/sales")
  const methodKey = `${method} ${route}`;
  if (PERF_BUDGETS[methodKey]) return PERF_BUDGETS[methodKey];
  // Try route-only budget
  if (PERF_BUDGETS[route]) return PERF_BUDGETS[route];
  // Try prefix matching (e.g., "/api/accounting" matches "/api/accounting/journal-entries")
  for (const [prefix, budget] of Object.entries(PERF_BUDGETS)) {
    if (prefix.startsWith('/') && route.startsWith(prefix)) return budget;
  }
  return PERF_BUDGETS['default'];
}

function getQueryBudget(method: string, route: string): number {
  const methodKey = `${method} ${route}`;
  if (QUERY_BUDGETS[methodKey]) return QUERY_BUDGETS[methodKey];
  if (QUERY_BUDGETS[route]) return QUERY_BUDGETS[route];
  for (const [prefix, budget] of Object.entries(QUERY_BUDGETS)) {
    if (prefix.startsWith('/') && route.startsWith(prefix)) return budget;
  }
  return QUERY_BUDGETS['default'];
}

/**
 * withPerf(handler)
 *
 * Universal performance wrapper for Next.js API route handlers.
 * - Creates an AsyncLocalStorage context with a RequestTimer
 * - Records the request into PerfStore
 * - Logs slow requests with phase breakdown
 * - Checks performance budgets
 *
 * The handler receives a `RequestTimer` via the context store so internal
 * code (like requireAuth) can add their own phases.
 */
export function withPerf(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse> | NextResponse
) {
  return async (req: NextRequest, ...args: any[]) => {
    const timer = new RequestTimer();
    const requestId = crypto.randomUUID();
    const route = req.nextUrl.pathname;
    const method = req.method;

    const context: LogContext = { requestId, route, method, _timer: timer };

    return requestContext.run(context, async () => {
      let status = 500;
      try {
        const response = await handler(req, ...args);
        status = response.status;
        return response;
      } catch (error: any) {
        const summary = timer.summary();
        logger.error('API Error', {
          method,
          duration: summary.totalMs,
          phases: summary.phases,
          error: error.message,
        });
        throw error;
      } finally {
        const summary = timer.summary();
        const budgetMs = getBudget(method, route);
        const overBudget = summary.totalMs > budgetMs;
        const totalQueries = require('./db-metrics').dbMetricsStore.getTotalQueriesForRequest(requestId);
        const queryBudget = getQueryBudget(method, route);

        // Record to PerfStore
        perfStore.record({
          route,
          method,
          status,
          totalMs: summary.totalMs,
          phases: summary.phases,
          slowestPhase: summary.slowest.name,
          budgetMs,
          overBudget,
          queryCount: totalQueries,
          timestamp: Date.now(),
        });

        // Calculate historical queries for this route
        const routeKey = `${method} ${route}`;
        const historicalStat = perfStore.getStats().find(s => s.route === routeKey);
        const avgQueries = historicalStat ? historicalStat.avgQueries : totalQueries;

        // Query Budget Enforcement
        if (totalQueries > queryBudget) {
          logger.warn(`⚠ QUERY BUDGET EXCEEDED [Avg: ${avgQueries} | Curr: ${totalQueries} | Budget: ${queryBudget}]`, { method, route });
        }

        const isCacheHit = summary.phases.some(p => p.name === 'cache_hit');
        const isCacheMiss = summary.phases.some(p => p.name === 'cache_miss');
        const cacheProviderName = require('./cache').CACHE_PROVIDER_NAME;
        const cacheStatus = isCacheHit ? `[CACHE HIT: ${cacheProviderName}]` : (isCacheMiss ? `[CACHE MISS: ${cacheProviderName}]` : '');

        // Structured log with phase breakdown
        if (summary.totalMs > 2000) {
          logger.error(`SLOW API (Critical) ${cacheStatus}`.trim(), {
            method, route, duration: summary.totalMs, budgetMs, overBudget, queries: totalQueries,
            phases: summary.phases, slowest: summary.slowest, status,
          });
        } else if (overBudget) {
          logger.warn(`OVER BUDGET ${cacheStatus}`.trim(), {
            method, route, duration: summary.totalMs, budgetMs, queries: totalQueries,
            phases: summary.phases, slowest: summary.slowest, status,
          });
        } else if (cacheStatus) {
          logger.info(`API Request ${cacheStatus}`.trim(), {
             method, route, duration: summary.totalMs, queries: totalQueries
          });
        } else if (summary.totalMs > 500) {
          logger.warn('Slow API', {
            method, duration: summary.totalMs, budgetMs, queries: totalQueries,
            phases: summary.phases, slowest: summary.slowest, status,
          });
        } else {
          logger.info('API Request', {
            method, duration: summary.totalMs, status, queries: totalQueries
          });
        }
        
        require('./db-metrics').dbMetricsStore.clearRequest(requestId);
      }
    });
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// getTimer — retrieve the RequestTimer from the current AsyncLocalStorage context
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns the active RequestTimer if the current request is wrapped with withPerf.
 * Returns null if called outside a withPerf context (safe to call anywhere).
 */
export function getTimer(): RequestTimer | null {
  const store = requestContext.getStore();
  return (store as any)?._timer ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// withTelemetry — PRESERVED for backward compatibility
// Routes already using withTelemetry continue to work without changes.
// New routes should use withPerf instead.
// ═══════════════════════════════════════════════════════════════════════════════

export function withTelemetry(handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse> | NextResponse) {
  return withPerf(handler);
}
