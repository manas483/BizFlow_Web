"use client";

import { useState } from "react";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/ui/Card";
import { StatCard } from "@/shared/ui/ui/StatCard";
import { Button } from "@/shared/ui/ui/Button";
import { useCashBook } from "@/shared/hooks/useAccounting";
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import { Wallet, ArrowDownRight, ArrowUpRight, Plus, Calendar, Search } from "lucide-react";
import AddCashBookEntryModal from "@/shared/ui/modals/AddCashBookEntryModal";

export default function CashBookPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    type: "",
  });

  const { data = { entries: [], totalReceipts: 0, totalPayments: 0, netCash: 0 }, isLoading } = useCashBook(
    filters.from || filters.to || filters.type ? filters : undefined
  );

  const handleClearFilters = () => {
    setFilters({ from: "", to: "", type: "" });
  };

  return (
    <DashboardLayout title="Cash Book">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">Cash Book</h2>
          <p className="text-primary/40 text-sm mt-0.5">Record and monitor all cash inflows and outflows</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsModalOpen(true)}>Add Cash Entry</Button>
      </div>

      {/* Cash Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Receipts (In)" value={formatCurrency(data.totalReceipts)} icon={<ArrowDownRight size={18} />} color="emerald" />
        <StatCard label="Total Payments (Out)" value={formatCurrency(data.totalPayments)} icon={<ArrowUpRight size={18} />} color="amber" />
        <StatCard label="Net Cash Balance" value={formatCurrency(data.netCash)} icon={<Wallet size={18} />} color="violet" />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 items-end">
        <div>
          <label className="text-xs font-medium text-primary/60 mb-1.5 block">From Date</label>
          <input
            type="date"
            value={filters.from}
            onChange={e => setFilters(prev => ({ ...prev, from: e.target.value }))}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-primary/60 mb-1.5 block">To Date</label>
          <input
            type="date"
            value={filters.to}
            onChange={e => setFilters(prev => ({ ...prev, to: e.target.value }))}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-primary/60 mb-1.5 block">Transaction Type</label>
          <select
            value={filters.type}
            onChange={e => setFilters(prev => ({ ...prev, type: e.target.value }))}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50 cursor-pointer"
          >
            <option value="">All Transactions</option>
            <option value="RECEIPT">Receipts Only</option>
            <option value="PAYMENT">Payments Only</option>
          </select>
        </div>
        <div>
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="w-full">
            Clear Filters
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-primary/40 text-sm">Loading cash book...</div>
          ) : data.entries.length === 0 ? (
            <div className="text-center py-12 text-primary/40 text-sm">No cash book entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/5 text-xs text-primary/40 border-b border-primary/10">
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Voucher / Ref</th>
                    <th className="py-3 px-5">Account Name</th>
                    <th className="py-3 px-5">Narration</th>
                    <th className="py-3 px-5 text-right">Inflow (Receipt)</th>
                    <th className="py-3 px-5 text-right">Outflow (Payment)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {data.entries.map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-primary/5 transition-colors font-medium">
                      <td className="py-3.5 px-5 whitespace-nowrap">{formatDate(entry.date)}</td>
                      <td className="py-3.5 px-5 text-violet-400">{entry.reference || "—"}</td>
                      <td className="py-3.5 px-5">{entry.account.code} - {entry.account.name}</td>
                      <td className="py-3.5 px-5 max-w-xs truncate">{entry.narration}</td>
                      <td className="py-3.5 px-5 text-right font-mono text-emerald-400">
                        {entry.transactionType === "RECEIPT" ? formatCurrency(entry.amount) : "—"}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-rose-400">
                        {entry.transactionType === "PAYMENT" ? formatCurrency(entry.amount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddCashBookEntryModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </DashboardLayout>
  );
}
