"use client";

import { useState } from "react";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/ui/Card";
import { StatCard } from "@/shared/ui/ui/StatCard";
import { Button } from "@/shared/ui/ui/Button";
import { Badge } from "@/shared/ui/ui/Badge";
import { useGstReturns } from "@/shared/hooks/useAccounting";
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import { Receipt, FileText, CheckCircle, Clock, Plus } from "lucide-react";
import AddGstReturnModal from "@/shared/ui/modals/AddGstReturnModal";

export default function GstManagementPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [returnType, setReturnType] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const { data: gstData, isLoading } = useGstReturns(
    returnType || status ? { returnType: returnType || undefined, status: status || undefined } : undefined
  );

  const gstReturns = gstData?.returns ?? [];
  const totalTaxable = gstData?.summary?.totalTaxable ?? 0;
  const totalTax = gstData?.summary?.totalTax ?? 0;
  const pendingCount = gstData?.summary?.pending ?? 0;

  return (
    <DashboardLayout title="GST Management">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">GST Management</h2>
          <p className="text-primary/40 text-sm mt-0.5">Track GST returns, tax slabs, and filing compliance status</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsModalOpen(true)}>Create GST Return Record</Button>
      </div>

      {/* Quick Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Taxable Value" value={formatCurrency(totalTaxable)} icon={<FileText size={18} />} color="violet" />
        <StatCard label="Total GST Collected/Liability" value={formatCurrency(totalTax)} icon={<Receipt size={18} />} color="emerald" />
        <StatCard label="Pending Returns" value={pendingCount} icon={<Clock size={18} />} color="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div>
          <select
            value={returnType}
            onChange={e => setReturnType(e.target.value)}
            className="rounded-xl px-3 py-1.5 text-xs bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50 cursor-pointer"
          >
            <option value="">All Form Types</option>
            <option value="GSTR-1">GSTR-1</option>
            <option value="GSTR-3B">GSTR-3B</option>
            <option value="GSTR-4">GSTR-4</option>
            <option value="GSTR-9">GSTR-9</option>
            <option value="GSTR-9C">GSTR-9C</option>
          </select>
        </div>
        <div>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="rounded-xl px-3 py-1.5 text-xs bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="FILED">Filed</option>
            <option value="REVISED">Revised</option>
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-primary/40 text-sm">Loading return records...</div>
          ) : gstReturns.length === 0 ? (
            <div className="text-center py-12 text-primary/40 text-sm">No return records found. Create one to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/5 text-xs text-primary/40 border-b border-primary/10">
                    <th className="py-3 px-5">Filing Period</th>
                    <th className="py-3 px-5">Return Type</th>
                    <th className="py-3 px-5">Taxable Value</th>
                    <th className="py-3 px-5">CGST</th>
                    <th className="py-3 px-5">SGST</th>
                    <th className="py-3 px-5">IGST</th>
                    <th className="py-3 px-5">Filing Date</th>
                    <th className="py-3 px-5">ARN</th>
                    <th className="py-3 px-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {gstReturns.map((r: any) => {
                    const arn = r.data?.acknowledgement?.arn;
                    return (
                      <tr key={r.id} className="hover:bg-primary/5 transition-colors font-medium">
                        <td className="py-3.5 px-5 text-violet-400 font-mono">{r.period}</td>
                        <td className="py-3.5 px-5">{r.returnType}</td>
                        <td className="py-3.5 px-5 font-mono">{formatCurrency(r.totalTaxable)}</td>
                        <td className="py-3.5 px-5 font-mono text-emerald-400">{formatCurrency(r.totalCgst)}</td>
                        <td className="py-3.5 px-5 font-mono text-emerald-400">{formatCurrency(r.totalSgst)}</td>
                        <td className="py-3.5 px-5 font-mono text-blue-400">{formatCurrency(r.totalIgst)}</td>
                        <td className="py-3.5 px-5 whitespace-nowrap">{r.filingDate ? formatDate(r.filingDate) : "—"}</td>
                        <td className="py-3.5 px-5 font-mono text-xs">
                          {arn ? (
                            <span className="text-emerald-400">{arn}</span>
                          ) : (
                            <span className="text-primary/25">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5">
                          <Badge variant={
                            r.status === "FILED" ? "success" :
                            r.status === "REVISED" ? "violet" : "default"
                          }>
                            {r.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddGstReturnModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </DashboardLayout>
  );
}
