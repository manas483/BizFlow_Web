"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/ui/Card";
import { StatCard } from "@/shared/ui/ui/StatCard";
import { Button } from "@/shared/ui/ui/Button";
import { Badge } from "@/shared/ui/ui/Badge";
import { useBankAccounts, useBankBook } from "@/shared/hooks/useAccounting";
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import { Landmark, ArrowDownRight, ArrowUpRight, Plus, RefreshCw, CheckCircle, Clock, ArrowLeft } from "lucide-react";
import AddBankAccountModal from "@/shared/ui/modals/AddBankAccountModal";
import AddBankBookEntryModal from "@/shared/ui/modals/AddBankBookEntryModal";
import BankReconciliationModal from "@/shared/ui/modals/BankReconciliationModal";

export default function BankBookPage() {
  const router = useRouter();
  const [activeAccountTab, setActiveAccountTab] = useState<string>("");
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isReconModalOpen, setIsReconModalOpen] = useState(false);

  const { data: bankAccounts = [], isLoading: loadingAccounts } = useBankAccounts();

  // Pick first bank account if activeTab is empty
  const activeBankId = activeAccountTab || bankAccounts[0]?.id || "";

  const { data = { entries: [], totalReceipts: 0, totalPayments: 0, netBalance: 0 }, isLoading: loadingBook } = useBankBook(
    activeBankId ? { bankAccountId: activeBankId } : undefined
  );

  const selectedBank = bankAccounts.find((b: any) => b.id === activeBankId);

  return (
    <DashboardLayout title="Bank Book & Reconciliation">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="p-2 w-9 h-9" aria-label="Go back" onClick={() => router.back()}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-primary">Bank Book & Reconciliation</h2>
            <p className="text-primary/40 text-sm mt-0.5">Manage bank account registries and reconcile them with physical statements</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setIsAccountModalOpen(true)}>Add Bank Account</Button>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsEntryModalOpen(true)}>Log Bank Txn</Button>
          <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={() => setIsReconModalOpen(true)}>Reconcile Statement</Button>
        </div>
      </div>

      {/* Bank Account Tabs */}
      {loadingAccounts ? (
        <div className="text-center py-6 text-primary/40 text-sm">Loading bank registries...</div>
      ) : bankAccounts.length === 0 ? (
        <div className="bg-surface border border-primary/10 p-8 rounded-2xl text-center mb-6">
          <Landmark size={32} className="mx-auto mb-2 text-primary/30" />
          <p className="text-sm text-primary/60">No bank accounts registered yet. Register a bank account to get started.</p>
          <Button size="sm" className="mt-4" onClick={() => setIsAccountModalOpen(true)}>Register Bank Account</Button>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {bankAccounts.map((b: any) => {
            const isSelected = activeBankId === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setActiveAccountTab(b.id)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left min-w-[200px] ${
                  isSelected ? "bg-violet-500/10 border-violet-500/30 text-violet-400 font-semibold" : "bg-surface border-primary/10 text-primary/60 hover:bg-primary/5"
                }`}
              >
                <Landmark size={20} />
                <div>
                  <h4 className="text-xs font-bold truncate max-w-[150px]">{b.accountName}</h4>
                  <p className="text-[10px] text-primary/40 truncate">{b.bankName} (***{b.accountNumber.slice(-4)})</p>
                  <p className="text-xs font-mono font-bold mt-1 text-primary">{formatCurrency(b.currentBalance)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedBank && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Book Deposits (In)" value={formatCurrency(data.totalReceipts)} icon={<ArrowDownRight size={18} />} color="emerald" />
            <StatCard label="Book Withdrawals (Out)" value={formatCurrency(data.totalPayments)} icon={<ArrowUpRight size={18} />} color="amber" />
            <StatCard label="Current Book Balance" value={formatCurrency(selectedBank.currentBalance)} icon={<Landmark size={18} />} color="violet" />
          </div>

          {/* Book Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Register History — {selectedBank.accountName}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingBook ? (
                <div className="text-center py-12 text-primary/40 text-sm">Loading transactions...</div>
              ) : data.entries.length === 0 ? (
                <div className="text-center py-12 text-primary/40 text-sm">No bank book transactions recorded for this account.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-primary/5 text-xs text-primary/40 border-b border-primary/10">
                        <th className="py-3 px-5">Date</th>
                        <th className="py-3 px-5">Ref / Cheque</th>
                        <th className="py-3 px-5">Narration</th>
                        <th className="py-3 px-5">Ledger Offset</th>
                        <th className="py-3 px-5">Reconciliation</th>
                        <th className="py-3 px-5 text-right">Deposits (+)</th>
                        <th className="py-3 px-5 text-right">Withdrawals (-)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5">
                      {data.entries.map((entry: any) => (
                        <tr key={entry.id} className="hover:bg-primary/5 transition-colors font-medium">
                          <td className="py-3.5 px-5 whitespace-nowrap">{formatDate(entry.date)}</td>
                          <td className="py-3.5 px-5 text-violet-400">{entry.reference || "—"}</td>
                          <td className="py-3.5 px-5 max-w-xs truncate">{entry.narration}</td>
                          <td className="py-3.5 px-5">{entry.account.code} - {entry.account.name}</td>
                          <td className="py-3.5 px-5">
                            {entry.reconciliationStatus === "MATCHED" ? (
                              <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                                <CheckCircle size={12} /> Matched
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-primary/40">
                                <Clock size={12} /> Pending
                              </span>
                            )}
                          </td>
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
        </>
      )}

      {/* Modals */}
      <AddBankAccountModal open={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} />
      <AddBankBookEntryModal open={isEntryModalOpen} onClose={() => setIsEntryModalOpen(false)} />
      <BankReconciliationModal open={isReconModalOpen} onClose={() => setIsReconModalOpen(false)} />
    </DashboardLayout>
  );
}
