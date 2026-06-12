"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { useAccounts, useJournalEntries, useReceivables, usePayables } from "@/hooks/useAccounting";
import { formatCurrency, formatDate } from "@/lib/utils";
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

const colorMap: Record<string, string> = {
  violet: "from-violet-500/20 to-violet-600/5 text-violet-400 border-violet-500/20",
  blue: "from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/20",
  emerald: "from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20",
  green: "from-green-500/20 to-green-600/5 text-green-400 border-green-500/20",
  orange: "from-orange-500/20 to-orange-600/5 text-orange-400 border-orange-500/20",
  cyan: "from-cyan-500/20 to-cyan-600/5 text-cyan-400 border-cyan-500/20",
  indigo: "from-indigo-500/20 to-indigo-600/5 text-indigo-400 border-indigo-500/20",
  amber: "from-amber-500/20 to-amber-600/5 text-amber-400 border-amber-500/20",
  rose: "from-rose-500/20 to-rose-600/5 text-rose-400 border-rose-500/20",
  purple: "from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/20",
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
        <StatCard label="Total Accounts" value={totalAccounts} icon={<BookOpen size={18} />} color="violet" />
        <StatCard label="Posted Entries" value={postedEntries} icon={<FileText size={18} />} color="blue" />
        <StatCard label="AR Outstanding" value={formatCurrency(arOutstanding)} icon={<ArrowDownRight size={18} />} color="emerald" />
        <StatCard label="AP Outstanding" value={formatCurrency(apOutstanding)} icon={<ArrowUpRight size={18} />} color="amber" />
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        {modules.map(({ href, icon: Icon, label, description, color }) => (
          <Link key={href} href={href}>
            <div className={`group relative p-4 rounded-2xl border bg-gradient-to-br ${colorMap[color]} hover:scale-[1.02] transition-all duration-200 cursor-pointer`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <Icon size={20} />
                </div>
                <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
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
