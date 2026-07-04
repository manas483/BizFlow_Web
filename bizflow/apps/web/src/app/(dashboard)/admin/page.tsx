'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface HealthData {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  components: {
    database: { status: string; latencyMs?: number; error?: string };
    environment: { status: string; error?: string };
    userTable: { status: string; latencyMs?: number; error?: string };
  };
  system: {
    nodeVersion: string;
    uptime: number;
  };
  authFailures?: Array<{
    timestamp: string;
    reqId?: string;
    email?: string;
    businessId?: string;
    step: string;
    reason: string;
    ip?: string;
    userAgent?: string;
  }>;
  slowQueries?: Array<{
    timestamp: string;
    reqId?: string;
    userId?: string;
    businessId?: string;
    model: string;
    operation: string;
    durationMs: number;
    rowsReturned: number;
    route?: string;
  }>;
  apiMetrics?: Array<{
    route: string;
    count: number;
    avgMs: number;
    p95Ms: number;
    maxMs: number;
    minMs: number;
    overBudgetCount: number;
    overBudgetPct: number;
    budgetMs: number;
    topSlowPhases: Record<string, number>;
  }>;
  dbMetrics?: Array<{
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
  }>;
  nPlusOneWarnings?: Array<{
    reqId: string;
    fingerprint: string;
    count: number;
    durationMs: number;
    timestamp: string;
  }>;
  cache?: {
    hit: number;
    miss: number;
    expired: number;
    invalidated: number;
    set: number;
    estimatedDbTimeSavedMs: number;
    currentKeys: number;
    hitRatePct: number;
  };
}

export default function AdminDashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/auth-health')
      .then((res) => res.json())
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>

      <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">System Health Diagnostics</h3>
        </div>
        <div className="p-6 pt-0">
          {loading ? (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Running health checks...</span>
            </div>
          ) : error ? (
            <div className="flex items-center space-x-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span>Failed to load health data: {error}</span>
            </div>
          ) : health ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <span className="font-semibold">Overall Status:</span>
                {health.status === 'ok' ? (
                  <span className="flex items-center text-green-600"><CheckCircle className="h-4 w-4 mr-1"/> OK</span>
                ) : health.status === 'degraded' ? (
                  <span className="flex items-center text-yellow-600"><AlertTriangle className="h-4 w-4 mr-1"/> Degraded</span>
                ) : (
                  <span className="flex items-center text-red-600"><XCircle className="h-4 w-4 mr-1"/> Down</span>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="border rounded-lg shadow-sm">
                  <div className="py-3 px-4 bg-muted/50 border-b">
                    <h4 className="text-sm font-medium">Database</h4>
                  </div>
                  <div className="py-3 px-4">
                    <div className="text-sm">
                      Status: {health.components.database.status}
                      {health.components.database.latencyMs !== undefined && (
                        <div>Latency: {health.components.database.latencyMs}ms</div>
                      )}
                      {health.components.database.error && (
                        <div className="text-destructive text-xs mt-1">{health.components.database.error}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="border rounded-lg shadow-sm">
                  <div className="py-3 px-4 bg-muted/50 border-b">
                    <h4 className="text-sm font-medium">Users Table</h4>
                  </div>
                  <div className="py-3 px-4">
                    <div className="text-sm">
                      Status: {health.components.userTable.status}
                      {health.components.userTable.latencyMs !== undefined && (
                        <div>Latency: {health.components.userTable.latencyMs}ms</div>
                      )}
                      {health.components.userTable.error && (
                        <div className="text-destructive text-xs mt-1">{health.components.userTable.error}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg shadow-sm">
                  <div className="py-3 px-4 bg-muted/50 border-b">
                    <h4 className="text-sm font-medium">Environment</h4>
                  </div>
                  <div className="py-3 px-4">
                    <div className="text-sm">
                      Status: {health.components.environment.status}
                      {health.components.environment.error && (
                        <div className="text-destructive text-xs mt-1">{health.components.environment.error}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground mt-4 pt-4 border-t">
                Last checked: {new Date(health.timestamp).toLocaleString()} • Node: {health.system.nodeVersion} • Uptime: {Math.round(health.system.uptime / 60)}m
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Cache Metrics UI */}
      {health?.cache && (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="text-xl font-semibold leading-none tracking-tight">Cache Performance</h3>
            <p className="text-sm text-muted-foreground">Global cache hit rates and invalidations</p>
          </div>
          <div className="p-6 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border rounded-lg p-4 shadow-sm bg-muted/20">
                <div className="text-sm text-muted-foreground">Hit Rate</div>
                <div className="text-2xl font-bold">{health.cache.hitRatePct}%</div>
                <div className="text-xs text-muted-foreground mt-1">{health.cache.hit} hits / {health.cache.miss} misses</div>
              </div>
              <div className="border rounded-lg p-4 shadow-sm bg-muted/20">
                <div className="text-sm text-muted-foreground">Est. DB Time Saved</div>
                <div className="text-2xl font-bold text-green-600">{(health.cache.estimatedDbTimeSavedMs / 1000).toFixed(1)}s</div>
                <div className="text-xs text-muted-foreground mt-1">Based on fallback times</div>
              </div>
              <div className="border rounded-lg p-4 shadow-sm bg-muted/20">
                <div className="text-sm text-muted-foreground">Evictions</div>
                <div className="text-2xl font-bold">{health.cache.expired + health.cache.invalidated}</div>
                <div className="text-xs text-muted-foreground mt-1">{health.cache.expired} expired / {health.cache.invalidated} invalidated</div>
              </div>
              <div className="border rounded-lg p-4 shadow-sm bg-muted/20">
                <div className="text-sm text-muted-foreground">Current Keys</div>
                <div className="text-2xl font-bold">{health.cache.currentKeys}</div>
                <div className="text-xs text-muted-foreground mt-1">{health.cache.set} total sets</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auth Failures Ring Buffer UI */}
      {health?.authFailures && health.authFailures.length > 0 && (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="text-xl font-semibold leading-none tracking-tight">Recent Authentication Failures</h3>
            <p className="text-sm text-muted-foreground">Last {health.authFailures.length} failed login attempts</p>
          </div>
          <div className="p-0 border-t">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b">
                  <tr>
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Error Code</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">IP</th>
                    <th className="px-6 py-3 font-medium">Req ID</th>
                  </tr>
                </thead>
                <tbody>
                  {health.authFailures.map((failure: any, idx: number) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3 whitespace-nowrap">{new Date(failure.timestamp).toLocaleTimeString()}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                          {failure.reason}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs">{failure.email || '-'}</td>
                      <td className="px-6 py-3 font-mono text-xs">{failure.ip || '-'}</td>
                      <td className="px-6 py-3 font-mono text-xs truncate max-w-[100px]" title={failure.reqId}>{failure.reqId || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* API Metrics UI */}
      {health?.apiMetrics && health.apiMetrics.length > 0 && (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="text-xl font-semibold leading-none tracking-tight">API Performance Metrics</h3>
            <p className="text-sm text-muted-foreground">Aggregated latency and budget enforcement (last 500 requests)</p>
          </div>
          <div className="p-0 border-t">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b">
                  <tr>
                    <th className="px-6 py-3 font-medium">Route</th>
                    <th className="px-6 py-3 font-medium">Count</th>
                    <th className="px-6 py-3 font-medium">Avg (ms)</th>
                    <th className="px-6 py-3 font-medium">P95 (ms)</th>
                    <th className="px-6 py-3 font-medium">Max (ms)</th>
                    <th className="px-6 py-3 font-medium">Budget (ms)</th>
                    <th className="px-6 py-3 font-medium">% Over</th>
                  </tr>
                </thead>
                <tbody>
                  {health.apiMetrics.map((metric: any, idx: number) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3 font-mono text-xs">{metric.route}</td>
                      <td className="px-6 py-3">{metric.count}</td>
                      <td className="px-6 py-3">{metric.avgMs}</td>
                      <td className="px-6 py-3">{metric.p95Ms}</td>
                      <td className="px-6 py-3 text-destructive">{metric.maxMs}</td>
                      <td className="px-6 py-3">{metric.budgetMs}</td>
                      <td className="px-6 py-3">
                        {metric.overBudgetPct > 0 ? (
                          <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                            {metric.overBudgetPct}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0%</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Slow Queries UI */}
      {health?.slowQueries && health.slowQueries.length > 0 && (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="text-xl font-semibold leading-none tracking-tight">Slow Database Queries</h3>
            <p className="text-sm text-muted-foreground">Recent queries exceeding 100ms</p>
          </div>
          <div className="p-0 border-t">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b">
                  <tr>
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Model</th>
                    <th className="px-6 py-3 font-medium">Operation</th>
                    <th className="px-6 py-3 font-medium">Duration</th>
                    <th className="px-6 py-3 font-medium">Rows</th>
                    <th className="px-6 py-3 font-medium">Route</th>
                  </tr>
                </thead>
                <tbody>
                  {health.slowQueries.map((q: any, idx: number) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3 whitespace-nowrap text-xs">{new Date(q.timestamp).toLocaleTimeString()}</td>
                      <td className="px-6 py-3 font-mono text-xs">{q.model}</td>
                      <td className="px-6 py-3 font-mono text-xs">{q.operation}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          q.durationMs > 500 ? 'bg-red-50 text-red-700 ring-red-600/10' : 
                          q.durationMs > 250 ? 'bg-orange-50 text-orange-700 ring-orange-600/10' : 
                          'bg-yellow-50 text-yellow-800 ring-yellow-600/20'
                        }`}>
                          {q.durationMs}ms
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs">{q.rowsReturned}</td>
                      <td className="px-6 py-3 font-mono text-xs max-w-[200px] truncate" title={q.route}>{q.route || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Top Database Consumers */}
      {health?.dbMetrics && health.dbMetrics.length > 0 && (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="text-xl font-semibold leading-none tracking-tight">Top Database Consumers</h3>
            <p className="text-sm text-muted-foreground">Queries ranked by total DB execution time</p>
          </div>
          <div className="p-0 border-t">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b">
                  <tr>
                    <th className="px-6 py-3 font-medium">Query Fingerprint</th>
                    <th className="px-6 py-3 font-medium">Impact Score</th>
                    <th className="px-6 py-3 font-medium">Total Time</th>
                    <th className="px-6 py-3 font-medium">Calls</th>
                    <th className="px-6 py-3 font-medium">Avg Time</th>
                    <th className="px-6 py-3 font-medium">Regression</th>
                    <th className="px-6 py-3 font-medium">N+1 Risk</th>
                    <th className="px-6 py-3 font-medium">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {health.dbMetrics.map((m: any, idx: number) => {
                    let cacheConfidence = null;
                    if (m.count > 100 && m.avgDurationMs < 20) {
                      // Simple heuristic for demo: FindUnique is more confident because it targets a single record
                      cacheConfidence = m.operation === 'findUnique' || m.operation === 'findFirst' ? 'High' : 'Medium';
                    }
                    
                    return (
                      <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-3 font-mono text-xs text-blue-600">{m.fingerprint}</td>
                        <td className="px-6 py-3 font-semibold text-purple-700">{Math.round(m.impactScore)}</td>
                        <td className="px-6 py-3">{m.totalDurationMs}ms</td>
                        <td className="px-6 py-3">{m.count}</td>
                        <td className="px-6 py-3">{m.avgDurationMs}ms</td>
                        <td className="px-6 py-3">
                          {m.regressionPct > 20 ? (
                            <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                              <AlertTriangle className="h-3 w-3 mr-1" /> +{m.regressionPct}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-3">
                          {m.nPlusOneTriggers > 0 ? (
                            <span className="text-red-600 font-medium">{m.nPlusOneTriggers} alerts</span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-3 text-xs">
                          {cacheConfidence && (
                            <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/10">
                              💡 Cache Candidate ({cacheConfidence})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* N+1 Warnings */}
      {health?.nPlusOneWarnings && health.nPlusOneWarnings.length > 0 && (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="text-xl font-semibold leading-none tracking-tight text-red-600 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              N+1 Query Detection
            </h3>
            <p className="text-sm text-muted-foreground">Duplicate queries detected within the same request</p>
          </div>
          <div className="p-0 border-t">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b">
                  <tr>
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Query Fingerprint</th>
                    <th className="px-6 py-3 font-medium">Duplicates per Req</th>
                    <th className="px-6 py-3 font-medium">Last Duration</th>
                    <th className="px-6 py-3 font-medium">Req ID</th>
                  </tr>
                </thead>
                <tbody>
                  {health.nPlusOneWarnings.map((w: any, idx: number) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3 text-xs">{new Date(w.timestamp).toLocaleTimeString()}</td>
                      <td className="px-6 py-3 font-mono text-xs">{w.fingerprint}</td>
                      <td className="px-6 py-3 font-semibold text-red-600">{w.count}x</td>
                      <td className="px-6 py-3 text-xs">{w.durationMs}ms</td>
                      <td className="px-6 py-3 font-mono text-xs truncate max-w-[100px]" title={w.reqId}>{w.reqId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
