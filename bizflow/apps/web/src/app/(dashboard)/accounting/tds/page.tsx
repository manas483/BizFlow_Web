"use client";

import { useState } from "react";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/ui/Card";
import { StatCard } from "@/shared/ui/ui/StatCard";
import { Button } from "@/shared/ui/ui/Button";
import { Badge } from "@/shared/ui/ui/Badge";
import { useTdsEntries } from "@/shared/hooks/useAccounting";
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import { Shield, Percent, ShieldCheck, Clock, Plus } from "lucide-react";
import AddTdsEntryModal from "@/shared/ui/modals/AddTdsEntryModal";

export default function TdsManagementPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [section, setSection] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const { data: tdsData, isLoading } = useTdsEntries(
    section || status ? { section: section || undefined, status: status || undefined } : undefined
  );

  const tdsEntries = tdsData?.entries ?? [];
  const totalDeducted = tdsData?.summary?.totalTds ?? 0;
  const totalOutstanding = tdsEntries.filter((entry: any) => entry.status === "DEDUCTED").reduce((sum: number, entry: any) => sum + entry.tdsAmount, 0);
  const totalDeposited = tdsEntries.filter((entry: any) => entry.status !== "DEDUCTED").reduce((sum: number, entry: any) => sum + entry.tdsAmount, 0);

  return (
    <DashboardLayout title="TDS Management">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">TDS Management</h2>
          <p className="text-primary/40 text-sm mt-0.5">Track tax deductions at source (TDS), deposits, and challans</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsModalOpen(true)}>Create TDS Record</Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total TDS Deducted" value={formatCurrency(totalDeducted)} icon={<Percent size={18} />} color="violet" />
        <StatCard label="Total Deposited (Paid)" value={formatCurrency(totalDeposited)} icon={<ShieldCheck size={18} />} color="emerald" />
        <StatCard label="TDS Outstanding (To Pay)" value={formatCurrency(totalOutstanding)} icon={<Clock size={18} />} color="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div>
          <select
            value={section}
            onChange={e => setSection(e.target.value)}
            className="rounded-xl px-3 py-1.5 text-xs bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50 cursor-pointer"
          >
            <option value="">All TDS Sections</option>
            <option value="194C">Sec 194C (Contracts)</option>
            <option value="194J">Sec 194J (Professionals)</option>
            <option value="194I">Sec 194I (Rent)</option>
            <option value="194H">Sec 194H (Commissions)</option>
            <option value="192">Sec 192 (Salary)</option>
          </select>
        </div>
        <div>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="rounded-xl px-3 py-1.5 text-xs bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="DEDUCTED">Deducted</option>
            <option value="DEPOSITED">Deposited</option>
            <option value="FILED">Filed</option>
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-primary/40 text-sm">Loading TDS entries...</div>
          ) : tdsEntries.length === 0 ? (
            <div className="text-center py-12 text-primary/40 text-sm">No TDS entries found. Create one to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/5 text-xs text-primary/40 border-b border-primary/10">
                    <th className="py-3 px-5">Deductee</th>
                    <th className="py-3 px-5">PAN</th>
                    <th className="py-3 px-5">Section</th>
                    <th className="py-3 px-5">Payment Date</th>
                    <th className="py-3 px-5 text-right">Payment Amount</th>
                    <th className="py-3 px-5 text-center">Rate</th>
                    <th className="py-3 px-5 text-right">TDS Amount</th>
                    <th className="py-3 px-5">Challan / Ref</th>
                    <th className="py-3 px-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {tdsEntries.map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-primary/5 transition-colors font-medium">
                      <td className="py-3.5 px-5 whitespace-nowrap">{entry.deducteeName}</td>
                      <td className="py-3.5 px-5 font-mono uppercase text-primary/60">{entry.deducteePan || "—"}</td>
                      <td className="py-3.5 px-5">{entry.section}</td>
                      <td className="py-3.5 px-5 whitespace-nowrap">{formatDate(entry.paymentDate)}</td>
                      <td className="py-3.5 px-5 text-right font-mono">{formatCurrency(entry.paymentAmount)}</td>
                      <td className="py-3.5 px-5 text-center font-mono">{entry.tdsRate}%</td>
                      <td className="py-3.5 px-5 text-right font-mono text-emerald-400">{formatCurrency(entry.tdsAmount)}</td>
                      <td className="py-3.5 px-5">{entry.challanNo || "—"}</td>
                      <td className="py-3.5 px-5">
                        <Badge variant={
                          entry.status === "FILED" ? "success" :
                          entry.status === "DEPOSITED" ? "violet" : "default"
                        }>
                          {entry.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddTdsEntryModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </DashboardLayout>
  );
}
