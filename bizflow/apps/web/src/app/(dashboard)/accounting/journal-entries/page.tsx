"use client";

import { useState } from "react";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/ui/Card";
import { Badge } from "@/shared/ui/ui/Badge";
import { Button } from "@/shared/ui/ui/Button";
import { StatCard } from "@/shared/ui/ui/StatCard";
import { useJournalEntries, useUpdateJournalEntry } from "@/shared/hooks/useAccounting";
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import { BookOpen, Search, Download, Plus, AlertCircle, ArrowLeft } from "lucide-react";
import AddJournalEntryModal from "@/shared/ui/modals/AddJournalEntryModal";
import Link from "next/link";
import toast from "react-hot-toast";

export default function JournalEntriesPage() {
  const [search, setSearch] = useState("");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const { data: entries = [], isLoading } = useJournalEntries();
  const updateEntry = useUpdateJournalEntry();

  const filtered = entries.filter((e: any) => 
    e.entryNumber.toLowerCase().includes(search.toLowerCase()) ||
    e.narration.toLowerCase().includes(search.toLowerCase()) ||
    e.reference?.toLowerCase().includes(search.toLowerCase())
  );

  // Stats - exclude REVERSED entries from the totals
  const activeEntries = entries.filter((e: any) => e.status !== 'REVERSED');
  const totalAmount = activeEntries.reduce((s: number, e: any) => s + e.totalAmount, 0);

  const getSourceBadge = (reference?: string | null) => {
    if (!reference) return <Badge variant="default">Manual</Badge>;
    if (reference.startsWith('SALE:')) return <Badge variant="success">Sale</Badge>;
    if (reference.startsWith('PAYMENT:')) return <Badge variant="success">Payment</Badge>;
    if (reference.startsWith('LOAN_PAYMENT:')) return <Badge variant="warning">Loan EMI</Badge>;
    if (reference.startsWith('EXPENSE:')) return <Badge variant="violet">Expense</Badge>;
    if (reference.startsWith('PAYABLE:')) return <Badge variant="danger">Payable</Badge>;
    return <Badge variant="default">Auto</Badge>;
  };

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
        <div className="flex items-center gap-3">
          <Link href="/accounting">
            <Button variant="secondary" className="p-2 w-9 h-9" aria-label="Go back to Accounting">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div>
            <h2 className="text-xl font-bold text-primary">Journal Entries</h2>
            <p className="text-primary/40 text-sm mt-0.5">Double-entry accounting records and ledger postings</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Download size={14} />}>Export</Button>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsNewOpen(true)}>New Journal Entry</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total Entries" value={entries.length.toString()} icon={<BookOpen size={18} />} color="blue" />
        <StatCard label="Active Posted" value={activeEntries.length.toString()} icon={<BookOpen size={18} />} color="emerald" />
        <StatCard label="Total Value" value={formatCurrency(totalAmount)} icon={<BookOpen size={18} />} color="violet" />
        <StatCard label="Drafts / Reversed" value={(entries.length - activeEntries.length).toString()} icon={<AlertCircle size={18} />} color="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Journal History</CardTitle>
          <div className="relative flex-1 max-w-xs mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-3.5 h-3.5" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entries..."
              className="w-full bg-primary/5 border border-primary/10 rounded-lg pl-8 pr-3 py-1.5 text-xs
                text-primary placeholder:text-primary/40 focus:outline-none focus:border-violet-500/50" />
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-primary/10">
                {["Date", "Entry No.", "Source", "Reference", "Account Details", "Debit", "Credit", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-primary/40 text-xs font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-12 text-primary/40 text-sm">Loading entries...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-primary/40 text-sm">No entries found</td></tr>
              ) : filtered.map((entry: any) => (
                <tr key={entry.id} className={`hover:bg-primary/5 transition-colors ${entry.status === 'REVERSED' ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3.5 text-primary/60 text-sm">{formatDate(entry.date)}</td>
                  <td className="px-5 py-3.5 text-violet-400 font-mono text-xs font-medium">{entry.entryNumber}</td>
                  <td className="px-5 py-3.5">{getSourceBadge(entry.reference)}</td>
                  <td className="px-5 py-3.5 text-primary/40 text-xs">{entry.reference || "—"}</td>
                  <td className="px-5 py-3.5">
                    <div className="space-y-1.5">
                      {entry.lines.map((line: any, idx: number) => (
                        <div key={idx} className={`flex items-center gap-2 text-xs ${line.credit > 0 ? "ml-4" : ""}`}>
                          <span className="text-primary font-medium">{line.account?.name}</span>
                          {line.narration && <span className="text-primary/30 truncate max-w-[200px]">- {line.narration}</span>}
                        </div>
                      ))}
                      <div className="text-primary/40 text-xs italic mt-2 border-t border-primary/5 pt-1">
                        {entry.narration}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 align-top pt-5">
                    <div className="space-y-1.5">
                      {entry.lines.map((line: any, idx: number) => (
                        <div key={idx} className="text-xs text-primary/60 h-[18px]">
                          {line.debit > 0 ? formatCurrency(line.debit) : ""}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 align-top pt-5">
                    <div className="space-y-1.5">
                      {entry.lines.map((line: any, idx: number) => (
                        <div key={idx} className="text-xs text-primary/60 h-[18px]">
                          {line.credit > 0 ? formatCurrency(line.credit) : ""}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 align-top pt-5">
                    <Badge variant={entry.status === "POSTED" ? "success" : entry.status === "REVERSED" ? "danger" : "warning"}>
                      {entry.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 align-top pt-5">
                    <div className="flex items-center gap-2">
                      {entry.status === "DRAFT" && (
                        <Button size="sm" variant="ghost" onClick={() => handlePost(entry.id)}>Post</Button>
                      )}
                      {entry.status === "POSTED" && (
                        <Button size="sm" variant="ghost" onClick={() => handleReverse(entry.id)}>Reverse</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AddJournalEntryModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </DashboardLayout>
  );
}
