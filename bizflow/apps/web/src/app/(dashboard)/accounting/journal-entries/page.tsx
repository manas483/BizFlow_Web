"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { useJournalEntries, useCreateJournalEntry, useUpdateJournalEntry } from "@/hooks/useAccounting";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import AddJournalEntryModal from "@/components/modals/AddJournalEntryModal";

export default function JournalEntriesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: entries = [], isLoading } = useJournalEntries(statusFilter ? { status: statusFilter } : undefined);
  const updateEntry = useUpdateJournalEntry();

  // Dynamic stats from API data
  const draft = entries.filter((e: any) => e.status === "DRAFT").length;
  const posted = entries.filter((e: any) => e.status === "POSTED").length;
  const reversed = entries.filter((e: any) => e.status === "REVERSED").length;
  const totalAmount = entries.filter((e: any) => e.status === "POSTED").reduce((s: number, e: any) => s + e.totalAmount, 0);

  // Dynamic status filter options from data
  const statuses = [...new Set(entries.map((e: any) => e.status))] as string[];

  const handlePost = async (id: string) => {
    try {
      await updateEntry.mutateAsync({ id, data: { action: "post" } });
      toast.success("Entry posted successfully");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleReverse = async (id: string) => {
    try {
      await updateEntry.mutateAsync({ id, data: { action: "reverse" } });
      toast.success("Entry reversed successfully");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout title="Journal Entries">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">Journal Entries</h2>
          <p className="text-primary/40 text-sm mt-0.5">Record and manage double-entry transactions</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsModalOpen(true)}>New Entry</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Draft" value={draft} icon={<Clock size={18} />} color="amber" />
        <StatCard label="Posted" value={posted} icon={<CheckCircle size={18} />} color="emerald" />
        <StatCard label="Reversed" value={reversed} icon={<XCircle size={18} />} color="rose" />
        <StatCard label="Total Posted Value" value={formatCurrency(totalAmount)} icon={<FileText size={18} />} color="violet" />
      </div>

      {/* Dynamic filter tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setStatusFilter("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!statusFilter ? "bg-violet-500/20 text-violet-400" : "text-primary/40 hover:bg-primary/5"}`}
        >All ({entries.length})</button>
        {statuses.map((s: string) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? "bg-violet-500/20 text-violet-400" : "text-primary/40 hover:bg-primary/5"}`}
          >{s} ({entries.filter((e: any) => e.status === s).length})</button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Entries</CardTitle></CardHeader>
        <div className="divide-y divide-primary/10">
          {isLoading ? (
            <div className="text-center py-12 text-primary/40 text-sm">Loading entries...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-primary/40 text-sm">No journal entries found</div>
          ) : entries.map((entry: any) => (
            <div key={entry.id} className="px-5 py-4 hover:bg-primary/5 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-primary">{entry.entryNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    entry.status === "POSTED" ? "bg-emerald-500/10 text-emerald-400" :
                    entry.status === "REVERSED" ? "bg-rose-500/10 text-rose-400" :
                    "bg-amber-500/10 text-amber-400"
                  }`}>{entry.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-primary/40 text-xs">{formatDate(entry.date)}</span>
                  <span className="text-primary font-semibold text-sm">{formatCurrency(entry.totalAmount)}</span>
                  {entry.status === "DRAFT" && (
                    <Button size="sm" variant="ghost" onClick={() => handlePost(entry.id)}>Post</Button>
                  )}
                  {entry.status === "POSTED" && (
                    <Button size="sm" variant="ghost" onClick={() => handleReverse(entry.id)}>Reverse</Button>
                  )}
                </div>
              </div>
              <p className="text-primary/50 text-xs mb-2">{entry.narration}</p>
              {/* Journal Lines */}
              <div className="bg-primary/5 rounded-xl p-3 space-y-1">
                {entry.lines?.map((line: any) => (
                  <div key={line.id} className="flex items-center justify-between text-xs">
                    <span className="text-primary/60">
                      <span className="font-mono text-primary/30 mr-2">{line.account?.code}</span>
                      {line.account?.name}
                    </span>
                    <div className="flex gap-6">
                      <span className={line.debit > 0 ? "text-blue-400 font-medium" : "text-primary/20"}>
                        {line.debit > 0 ? formatCurrency(line.debit) : "—"}
                      </span>
                      <span className={line.credit > 0 ? "text-emerald-400 font-medium" : "text-primary/20"}>
                        {line.credit > 0 ? formatCurrency(line.credit) : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <AddJournalEntryModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </DashboardLayout>
  );
}
