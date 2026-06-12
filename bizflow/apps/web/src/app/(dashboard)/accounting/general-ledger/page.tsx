"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { useAccounts, useGeneralLedger } from "@/hooks/useAccounting";
import { formatCurrency } from "@/lib/utils";
import { Search, Calculator, Calendar } from "lucide-react";

export default function GeneralLedgerPage() {
  const [accountId, setAccountId] = useState<string>("");
  const [dateRange, setDateRange] = useState({
    from: "",
    to: "",
  });

  const { data: accounts = [] } = useAccounts();
  const { data: ledgerData, isLoading } = useGeneralLedger(
    accountId || null,
    dateRange.from || dateRange.to ? dateRange : undefined
  );

  const selectedAccount = accounts.find((a: any) => a.id === accountId);
  const ledgerEntries = ledgerData?.entries ?? [];
  const openingBalance = ledgerData?.openingBalance ?? 0;

  // Calculate running balance locally for display
  let runningBalance = openingBalance;
  const entriesWithRunning = ledgerEntries.map((entry: any) => {
    const isAssetOrExpense = selectedAccount?.accountType === "ASSET" || selectedAccount?.accountType === "EXPENSE";
    if (isAssetOrExpense) {
      runningBalance += (entry.debit - entry.credit);
    } else {
      runningBalance += (entry.credit - entry.debit);
    }
    return { ...entry, runningBalance };
  });

  return (
    <DashboardLayout title="General Ledger">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">General Ledger</h2>
          <p className="text-primary/40 text-sm mt-0.5">Track transaction history and running balances per account</p>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="text-xs font-medium text-primary/60 mb-1.5 block">Select Account</label>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50 cursor-pointer"
          >
            <option value="">-- Choose Account --</option>
            {accounts.map((a: any) => (
              <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.accountType})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-primary/60 mb-1.5 block">From Date</label>
          <input
            type="date"
            value={dateRange.from}
            onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-primary/60 mb-1.5 block">To Date</label>
          <input
            type="date"
            value={dateRange.to}
            onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50"
          />
        </div>
      </div>

      {accountId ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center w-full">
              <span className="flex items-center gap-2">
                <Calculator size={16} /> Ledger: {selectedAccount?.code} - {selectedAccount?.name}
              </span>
              <span className="text-xs font-normal text-primary/40">
                Opening Balance: {formatCurrency(openingBalance)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-primary/40 text-sm">Loading ledger entries...</div>
            ) : entriesWithRunning.length === 0 ? (
              <div className="text-center py-12 text-primary/40 text-sm">No ledger entries found for the selected period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-primary/5 text-xs text-primary/40 border-b border-primary/10">
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-5">Entry #</th>
                      <th className="py-3 px-5">Narration / Line Detail</th>
                      <th className="py-3 px-5 text-right">Debit (Dr)</th>
                      <th className="py-3 px-5 text-right">Credit (Cr)</th>
                      <th className="py-3 px-5 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {entriesWithRunning.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-primary/5 transition-colors font-medium">
                        <td className="py-3.5 px-5 whitespace-nowrap">{new Date(entry.journalEntry.date).toLocaleDateString()}</td>
                        <td className="py-3.5 px-5 text-violet-400">{entry.journalEntry.entryNumber}</td>
                        <td className="py-3.5 px-5 max-w-xs truncate">
                          <div>{entry.journalEntry.narration}</div>
                          {entry.narration && <div className="text-xs text-primary/40 mt-0.5">{entry.narration}</div>}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono text-emerald-400">{entry.debit > 0 ? formatCurrency(entry.debit) : "—"}</td>
                        <td className="py-3.5 px-5 text-right font-mono text-rose-400">{entry.credit > 0 ? formatCurrency(entry.credit) : "—"}</td>
                        <td className="py-3.5 px-5 text-right font-mono text-primary">{formatCurrency(entry.runningBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-20 bg-surface border border-primary/10 rounded-2xl text-primary/40 text-sm">
          Please select an account from the dropdown to view its ledger history.
        </div>
      )}
    </DashboardLayout>
  );
}
