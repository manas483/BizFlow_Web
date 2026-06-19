"use client";

import { useState, useMemo } from "react";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/ui/Card";
import { Button } from "@/shared/ui/ui/Button";
import { Badge } from "@/shared/ui/ui/Badge";
import { useActivityLogs } from "@/shared/hooks/useActivityLogs";
import {
  Activity, Search, ChevronLeft, ChevronRight, Filter, Clock, User,
  LogIn, LogOut, Shield, Settings, Package, ShoppingCart,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const EVENT_ICONS: Record<string, any> = {
  LOGIN_SUCCESS:  LogIn,
  LOGIN_FAILED:   Shield,
  LOGOUT:         LogOut,
  "2FA_ENABLED":  Shield,
  "2FA_DISABLED": Shield,
  "2FA_VERIFIED": Shield,
  SETTINGS_UPDATE: Settings,
  PRODUCT_VIEW:   Package,
  SALE_CREATE:    ShoppingCart,
};

const EVENT_COLORS: Record<string, string> = {
  LOGIN_SUCCESS:  "text-emerald-400",
  LOGIN_FAILED:   "text-rose-400",
  LOGOUT:         "text-amber-400",
  "2FA_ENABLED":  "text-violet-400",
  "2FA_DISABLED": "text-orange-400",
  "2FA_VERIFIED": "text-blue-400",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatEventType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function ActivityLogsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    userId?: string;
    eventType?: string;
    dateFrom?: string;
    dateTo?: string;
  }>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useActivityLogs({ ...filters, page, limit: 50 });

  // Build chart data from the activity log entries (group by date)
  const chartData = useMemo(() => {
    if (!data?.data) return [];
    const grouped: Record<string, number> = {};
    data.data.forEach(entry => {
      const day = new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      grouped[day] = (grouped[day] || 0) + 1;
    });
    return Object.entries(grouped).reverse().map(([date, count]) => ({ date, count }));
  }, [data?.data]);

  // Get unique event types for filter
  const eventTypes = useMemo(() => {
    if (!data?.data) return [];
    return [...new Set(data.data.map(e => e.eventType))].sort();
  }, [data?.data]);

  return (
    <DashboardLayout title="Activity Logs">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-primary">Activity Logs</h2>
        <p className="text-primary/40 text-sm mt-0.5">Real-time feed of user activity across your business</p>
      </div>

      {/* Activity Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity size={18} /> Activity Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,15,25,0.95)",
                    border: "1px solid rgba(139,92,246,0.3)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="count" fill="url(#actGradient)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="actGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-primary/30 text-sm">No activity data to chart yet</div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" icon={<Filter size={13} />} onClick={() => setShowFilters(!showFilters)}>
              Filters
            </Button>
            <span className="text-primary/30 text-xs">
              {data?.pagination.total ?? 0} total events
            </span>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-primary/10">
              <select
                value={filters.eventType || ""}
                onChange={e => { setFilters(f => ({ ...f, eventType: e.target.value || undefined })); setPage(1); }}
                className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2 text-sm text-primary focus:outline-none"
              >
                <option value="">All Events</option>
                {eventTypes.map(t => <option key={t} value={t}>{formatEventType(t)}</option>)}
              </select>

              <input
                type="date"
                value={filters.dateFrom || ""}
                onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value || undefined })); setPage(1); }}
                className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2 text-sm text-primary focus:outline-none"
              />

              <input
                type="date"
                value={filters.dateTo || ""}
                onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value || undefined })); setPage(1); }}
                className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2 text-sm text-primary focus:outline-none"
              />

              <Button variant="secondary" size="sm" onClick={() => { setFilters({}); setPage(1); }}>
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock size={18} /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-14 bg-primary/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !data?.data.length ? (
            <div className="text-center py-12">
              <Activity size={40} className="mx-auto text-primary/20 mb-3" />
              <p className="text-primary/40 text-sm">No activity recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.data.map(entry => {
                const Icon = EVENT_ICONS[entry.eventType] || Activity;
                const color = EVENT_COLORS[entry.eventType] || "text-primary/40";
                return (
                  <div key={entry.id} className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <div className={`p-2 rounded-lg bg-primary/5 ${color}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-primary text-sm font-medium">{formatEventType(entry.eventType)}</span>
                        <span className="text-primary/40 text-xs flex items-center gap-1">
                          <User size={10} /> {entry.userName || "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-primary/30 text-xs flex items-center gap-1">
                          <Clock size={10} /> {formatDate(entry.createdAt)}
                        </span>
                        {entry.ipAddress && (
                          <span className="text-primary/20 text-xs hidden sm:inline">{entry.ipAddress}</span>
                        )}
                      </div>
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {Object.entries(entry.metadata).map(([k, v]) => (
                            <span key={k} className="text-[10px] px-1.5 py-0.5 bg-primary/5 rounded text-primary/40">
                              {k}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-primary/10">
              <Button variant="secondary" size="sm" icon={<ChevronLeft size={13} />}
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                Previous
              </Button>
              <span className="text-primary/40 text-xs">Page {page} of {data.pagination.totalPages}</span>
              <Button variant="secondary" size="sm" icon={<ChevronRight size={13} />}
                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page >= data.pagination.totalPages}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
