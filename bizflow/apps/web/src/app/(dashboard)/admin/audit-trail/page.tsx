"use client";

import { useState } from "react";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/ui/Card";
import { Button } from "@/shared/ui/ui/Button";
import { Badge } from "@/shared/ui/ui/Badge";
import { useAuditTrail } from "@/shared/hooks/useAuditTrail";
import {
  FileText, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Download, Filter, Clock, User, Shield,
} from "lucide-react";

const ACTION_COLORS: Record<string, "success" | "warning" | "violet" | "info"> = {
  CREATE: "success",
  UPDATE: "warning",
  DELETE: "violet",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function AuditTrailPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    userId?: string;
    entityType?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useAuditTrail({ ...filters, page, limit: 30 });

  const handleExportCSV = () => {
    if (!data?.data) return;
    const rows = data.data.map(log => ({
      Date:        formatDate(log.createdAt),
      User:        log.userName,
      Action:      log.action,
      Entity:      log.entityType,
      Label:       log.entityLabel || "",
      IP:          log.ipAddress || "",
      Changes:     log.changes ? JSON.stringify(log.changes) : "",
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${(r as any)[h]}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Audit Trail">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-primary">Audit Trail</h2>
        <p className="text-primary/40 text-sm mt-0.5">Immutable record of every data change in your business</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Entries", value: data?.pagination.total ?? 0, icon: FileText, color: "text-violet-400" },
          { label: "Creates", value: data?.data.filter(d => d.action === "CREATE").length ?? 0, icon: Shield, color: "text-emerald-400" },
          { label: "Updates", value: data?.data.filter(d => d.action === "UPDATE").length ?? 0, icon: Clock, color: "text-amber-400" },
          { label: "Deletes", value: data?.data.filter(d => d.action === "DELETE").length ?? 0, icon: User, color: "text-rose-400" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-primary/5 ${s.color}`}>
                  <s.icon size={16} />
                </div>
                <div>
                  <p className="text-xl font-bold text-primary">{s.value}</p>
                  <p className="text-primary/40 text-xs">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Actions */}
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30" />
              <input
                placeholder="Search by name, entity, label..."
                value={filters.search || ""}
                onChange={e => { setFilters(f => ({ ...f, search: e.target.value || undefined })); setPage(1); }}
                className="w-full bg-primary/5 border border-primary/10 rounded-xl pl-9 pr-4 py-2 text-sm
                  text-primary focus:outline-none focus:border-violet-500/50 transition-all"
              />
            </div>

            <Button variant="secondary" size="sm" icon={<Filter size={13} />} onClick={() => setShowFilters(!showFilters)}>
              Filters
            </Button>
            <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={handleExportCSV}>
              Export CSV
            </Button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-3 pt-3 border-t border-primary/10">
              <select
                value={filters.action || ""}
                onChange={e => { setFilters(f => ({ ...f, action: e.target.value || undefined })); setPage(1); }}
                className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2 text-sm text-primary focus:outline-none"
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
              </select>

              <select
                value={filters.entityType || ""}
                onChange={e => { setFilters(f => ({ ...f, entityType: e.target.value || undefined })); setPage(1); }}
                className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2 text-sm text-primary focus:outline-none"
              >
                <option value="">All Entities</option>
                {data?.filters.entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <select
                value={filters.userId || ""}
                onChange={e => { setFilters(f => ({ ...f, userId: e.target.value || undefined })); setPage(1); }}
                className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2 text-sm text-primary focus:outline-none"
              >
                <option value="">All Users</option>
                {data?.filters.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>

              <input
                type="date"
                value={filters.dateFrom || ""}
                onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value || undefined })); setPage(1); }}
                className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2 text-sm text-primary focus:outline-none"
                placeholder="From"
              />

              <input
                type="date"
                value={filters.dateTo || ""}
                onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value || undefined })); setPage(1); }}
                className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2 text-sm text-primary focus:outline-none"
                placeholder="To"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText size={18} /> Audit Entries
            {data?.pagination && (
              <span className="text-primary/40 text-xs font-normal ml-2">
                Showing {((page - 1) * 30) + 1}–{Math.min(page * 30, data.pagination.total)} of {data.pagination.total}
              </span>
            )}
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
              <FileText size={40} className="mx-auto text-primary/20 mb-3" />
              <p className="text-primary/40 text-sm">No audit entries found</p>
              <p className="text-primary/30 text-xs mt-1">Data changes will appear here automatically</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.data.map(log => (
                <div key={log.id}>
                  <button
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10
                      hover:border-violet-500/20 transition-all text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={ACTION_COLORS[log.action] || "info"} className="text-[10px]">
                          {log.action}
                        </Badge>
                        <span className="text-primary text-sm font-medium">{log.entityType}</span>
                        {log.entityLabel && (
                          <span className="text-primary/50 text-xs">"{log.entityLabel}"</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-primary/40 text-xs flex items-center gap-1">
                          <User size={10} /> {log.userName}
                        </span>
                        <span className="text-primary/30 text-xs flex items-center gap-1">
                          <Clock size={10} /> {formatDate(log.createdAt)}
                        </span>
                        {log.ipAddress && (
                          <span className="text-primary/20 text-xs hidden sm:inline">{log.ipAddress}</span>
                        )}
                      </div>
                    </div>
                    {log.changes && (
                      expandedId === log.id
                        ? <ChevronUp size={14} className="text-primary/30" />
                        : <ChevronDown size={14} className="text-primary/30" />
                    )}
                  </button>

                  {/* Expanded Changes */}
                  {expandedId === log.id && log.changes && (
                    <div className="ml-4 mt-1 p-3 rounded-xl bg-primary/3 border border-primary/5 space-y-1.5">
                      <p className="text-primary/50 text-xs font-semibold mb-2">Changes</p>
                      {Object.entries(log.changes as Record<string, { old: unknown; new: unknown }>).map(([field, change]) => (
                        <div key={field} className="flex items-start gap-2 text-xs">
                          <span className="text-primary/60 font-mono min-w-[100px]">{field}</span>
                          <span className="text-rose-400/80 line-through">{JSON.stringify(change.old)}</span>
                          <span className="text-primary/30">→</span>
                          <span className="text-emerald-400/80">{JSON.stringify(change.new)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-primary/10">
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronLeft size={13} />}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-primary/40 text-xs">
                Page {page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronRight size={13} />}
                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page >= data.pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
