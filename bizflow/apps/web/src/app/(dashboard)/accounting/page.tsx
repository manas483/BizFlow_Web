"use client";

import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/ui/Card";
import { StatCard } from "@/shared/ui/ui/StatCard";
import { Button } from "@/shared/ui/ui/Button";
import { useAccounts, useJournalEntries, useReceivables, usePayables } from "@/shared/hooks/useAccounting";
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import Link from "next/link";
import {
  BookOpen, FileText, ArrowDownRight, ArrowUpRight,
  Wallet, Landmark, PieChart, Calculator, FileBarChart,
  Receipt, Shield, ChevronRight,
} from "lucide-react";

const modules = [
  { href: "/accounting/chart-of-accounts", icon: BookOpen, label: "Chart of Accounts", description: "Manage your account hierarchy", color: "violet" },
  { href: "/accounting/journal-entries", icon: FileText, label: "Journal Entries", description: "Record double-entry transactions", color: "blue" },
  { href: "/accounting/general-ledger", icon: Calculator, label: "General Ledger", description: "View account-wise transaction history", color: "emerald" },
  { href: "/accounting/receivables", icon: ArrowDownRight, label: "Accounts Receivable", description: "Track money owed to you", color: "green" },
  { href: "/accounting/payables", icon: ArrowUpRight, label: "Accounts Payable", description: "Track money you owe", color: "orange" },
  { href: "/accounting/cash-book", icon: Wallet, label: "Cash Book", description: "Cash receipts & payments", color: "cyan" },
  { href: "/accounting/bank-book", icon: Landmark, label: "Bank Book", description: "Bank transactions & reconciliation", color: "indigo" },
  { href: "/accounting/gst", icon: Receipt, label: "GST Management", description: "GST returns & compliance", color: "amber" },
  { href: "/accounting/tds", icon: Shield, label: "TDS Management", description: "TDS deductions & deposits", color: "rose" },
  { href: "/accounting/reports", icon: FileBarChart, label: "Financial Reports", description: "P&L, Balance Sheet, Cash Flow", color: "purple" },
];

const colorMap: Record<string, { border: string; hoverBorder: string; hoverGlow: string; icon: string; text: string }> = {
  violet: {
    border: "border-violet-500/10",
    hoverBorder: "hover:border-violet-500/30",
    hoverGlow: "hover:shadow-violet-500/5",
    icon: "bg-violet-500/10 text-violet-400",
    text: "text-violet-400",
  },
  blue: {
    border: "border-blue-500/10",
    hoverBorder: "hover:border-blue-500/30",
    hoverGlow: "hover:shadow-blue-500/5",
    icon: "bg-blue-500/10 text-blue-400",
    text: "text-blue-400",
  },
  emerald: {
    border: "border-emerald-500/10",
    hoverBorder: "hover:border-emerald-500/30",
    hoverGlow: "hover:shadow-emerald-500/5",
    icon: "bg-emerald-500/10 text-emerald-400",
    text: "text-emerald-400",
  },
  green: {
    border: "border-green-500/10",
    hoverBorder: "hover:border-green-500/30",
    hoverGlow: "hover:shadow-green-500/5",
    icon: "bg-green-500/10 text-green-400",
    text: "text-green-400",
  },
  orange: {
    border: "border-orange-500/10",
    hoverBorder: "hover:border-orange-500/30",
    hoverGlow: "hover:shadow-orange-500/5",
    icon: "bg-orange-500/10 text-orange-400",
    text: "text-orange-400",
  },
  cyan: {
    border: "border-cyan-500/10",
    hoverBorder: "hover:border-cyan-500/30",
    hoverGlow: "hover:shadow-cyan-500/5",
    icon: "bg-cyan-500/10 text-cyan-400",
    text: "text-cyan-400",
  },
  indigo: {
    border: "border-indigo-500/10",
    hoverBorder: "hover:border-indigo-500/30",
    hoverGlow: "hover:shadow-indigo-500/5",
    icon: "bg-indigo-500/10 text-indigo-400",
    text: "text-indigo-400",
  },
  amber: {
    border: "border-amber-500/10",
    hoverBorder: "hover:border-amber-500/30",
    hoverGlow: "hover:shadow-amber-500/5",
    icon: "bg-amber-500/10 text-amber-400",
    text: "text-amber-400",
  },
  rose: {
    border: "border-rose-500/10",
    hoverBorder: "hover:border-rose-500/30",
    hoverGlow: "hover:shadow-rose-500/5",
    icon: "bg-rose-500/10 text-rose-400",
    text: "text-rose-400",
  },
  purple: {
    border: "border-purple-500/10",
    hoverBorder: "hover:border-purple-500/30",
    hoverGlow: "hover:shadow-purple-500/5",
    icon: "bg-purple-500/10 text-purple-400",
    text: "text-purple-400",
  },
};

export default function AccountingPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: entries = [] } = useJournalEntries();
  const { data: arData } = useReceivables();
  const { data: apData } = usePayables();

  const totalAccounts = accounts.length;
  const postedEntries = entries.filter((e: any) => e.status === "POSTED").length;
  const arOutstanding = arData?.totalOutstanding ?? 0;
  const apOutstanding = apData?.totalOutstanding ?? 0;

  // Recent journal entries from API
  const recentEntries = entries.slice(0, 5);

  return (
    <DashboardLayout title="Accounting">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">Accounting & Finance</h2>
          <p className="text-primary/40 text-sm mt-0.5">Manage your business finances with double-entry bookkeeping</p>
        </div>
      </div>

      {/* Quick Stats — all dynamic from API data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total Accounts" value={totalAccounts} icon={<BookOpen size={18} />} color="violet" className="rounded-3xl" />
        <StatCard label="Posted Entries" value={postedEntries} icon={<FileText size={18} />} color="blue" className="rounded-3xl" />
        <StatCard label="AR Outstanding" value={formatCurrency(arOutstanding)} icon={<ArrowDownRight size={18} />} color="emerald" className="rounded-3xl" />
        <StatCard label="AP Outstanding" value={formatCurrency(apOutstanding)} icon={<ArrowUpRight size={18} />} color="amber" className="rounded-3xl" />
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        {modules.map(({ href, icon: Icon, label, description, color }) => (
          <Link key={href} href={href}>
            <div className={`group relative p-4 rounded-xl border bg-surface ${colorMap[color].border} ${colorMap[color].hoverBorder} hover:shadow-lg ${colorMap[color].hoverGlow} hover:scale-[1.02] transition-all duration-200 cursor-pointer`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${colorMap[color].icon} flex items-center justify-center`}>
                  <Icon size={20} />
                </div>
                <ChevronRight size={16} className={`opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ${colorMap[color].text}`} />
              </div>
              <h3 className="font-semibold text-sm text-primary">{label}</h3>
              <p className="text-xs text-primary/40 mt-1">{description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Journal Entries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Journal Entries</CardTitle>
            <Link href="/accounting/journal-entries">
              <Button size="sm" variant="ghost">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <div className="divide-y divide-primary/10">
          {recentEntries.length === 0 ? (
            <div className="text-center py-12 text-primary/40 text-sm">No journal entries yet</div>
          ) : recentEntries.map((entry: any) => (
            <div key={entry.id} className="flex items-center justify-between px-5 py-4 hover:bg-primary/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                  <FileText size={14} />
                </div>
                <div>
                  <p className="text-primary text-sm font-medium">{entry.entryNumber}</p>
                  <p className="text-primary/40 text-xs">{entry.narration}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-primary/40 text-xs">{formatDate(entry.date)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  entry.status === "POSTED" ? "bg-emerald-500/10 text-emerald-400" :
                  entry.status === "REVERSED" ? "bg-rose-500/10 text-rose-400" :
                  "bg-amber-500/10 text-amber-400"
                }`}>
                  {entry.status}
                </span>
                <span className="text-primary font-semibold text-sm">{formatCurrency(entry.totalAmount)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </DashboardLayout>
  );
}
