"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter, ModalSelect } from "@/components/ui/Modal";
import { Check, ShieldAlert } from "lucide-react";
import { useCreateBankReconciliation, useBankAccounts, useBankBook } from "@/hooks/useAccounting";
import { formatCurrency } from "@/lib/utils";

export default function BankReconciliationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [bankAccountId, setBankAccountId] = useState("");
  const [statementDate, setStatementDate] = useState("");
  const [statementBalance, setStatementBalance] = useState("0");
  const [reconciledIds, setReconciledIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const { data: bankAccounts = [] } = useBankAccounts();
  const createReconciliation = useCreateBankReconciliation();

  // Load pending bank book entries for matching
  const { data: bankBookData, isLoading: loadingEntries } = useBankBook(
    bankAccountId ? { bankAccountId } : undefined
  );

  const bankBookEntries = bankBookData?.entries || [];

  // Filter pending entries up to statementDate
  const pendingEntries = bankBookEntries.filter((entry: any) => {
    if (entry.reconciliationStatus !== "PENDING") return false;
    if (!statementDate) return true;
    return new Date(entry.date) <= new Date(statementDate);
  });

  useEffect(() => {
    if (open) {
      setBankAccountId(bankAccounts[0]?.id || "");
      setStatementDate(new Date().toISOString().split("T")[0]);
      setStatementBalance("0");
      setReconciledIds([]);
      setNotes("");
    }
  }, [open, bankAccounts]);

  // Handle toggling of transaction selection
  const toggleSelect = (id: string) => {
    setReconciledIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Find bank account details
  const selectedBank = bankAccounts.find((b: any) => b.id === bankAccountId);
  const bookBalance = selectedBank?.currentBalance || 0;

  // Calculate reconciled balance based on selected checks
  const reconciledSum = pendingEntries
    .filter((entry: any) => reconciledIds.includes(entry.id))
    .reduce((sum: number, entry: any) => {
      const amount = entry.amount;
      return entry.transactionType === "RECEIPT" ? sum + amount : sum - amount;
    }, bookBalance);

  const stmtBal = parseFloat(statementBalance) || 0;
  const difference = stmtBal - reconciledSum;
  const canPost = Math.abs(difference) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) {
      toast.error("Reconciliation must balance to Statement Ending Balance first!");
      return;
    }

    setLoading(true);
    try {
      await createReconciliation.mutateAsync({
        bankAccountId,
        statementDate: new Date(statementDate).toISOString(),
        statementBalance: stmtBal,
        reconciledEntries: reconciledIds,
        notes: notes || null,
      });
      toast.success("Bank account reconciled successfully");
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to post bank reconciliation");
    } finally {
      setLoading(false);
    }
  };

  const activeBankAccounts = bankAccounts.filter((b: any) => b.isActive);

  return (
    <Modal open={open} onClose={onClose} size="4xl"
      title="Bank Reconciliation" subtitle="Match ledger bank entries to your actual bank statement"
      icon={<Check size={18} />} iconColor="bg-violet-500/20 text-violet-400">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Bank Account" required>
            <ModalSelect value={bankAccountId} onChange={e => { setBankAccountId(e.target.value); setReconciledIds([]); }} required>
              <option value="">-- Select Bank Account --</option>
              {activeBankAccounts.map((b: any) => (
                <option key={b.id} value={b.id}>{b.bankName} - {b.accountName} (***{b.accountNumber.slice(-4)})</option>
              ))}
            </ModalSelect>
          </FormField>
          <FormField label="Statement Ending Date" required>
            <ModalInput type="date" required value={statementDate} onChange={e => { setStatementDate(e.target.value); setReconciledIds([]); }} />
          </FormField>
          <FormField label="Statement Ending Balance (₹)" required>
            <ModalInput type="number" step="0.01" required placeholder="0.00" value={statementBalance} onChange={e => setStatementBalance(e.target.value)} />
          </FormField>
        </div>

        {/* Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending items */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary/40">Unreconciled Bank Book Entries</h4>
            <div className="border border-primary/10 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
              {loadingEntries ? (
                <div className="text-center py-12 text-primary/40 text-sm">Loading book entries...</div>
              ) : pendingEntries.length === 0 ? (
                <div className="text-center py-12 text-primary/40 text-sm">No pending transactions found for this period.</div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-primary/5 text-xs text-primary/40 border-b border-primary/10">
                      <th className="py-2.5 px-3 w-10">Match</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Ref/Txn</th>
                      <th className="py-2.5 px-3">Narration</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {pendingEntries.map((entry: any) => {
                      const isSelected = reconciledIds.includes(entry.id);
                      return (
                        <tr key={entry.id}
                          className={`hover:bg-primary/5 transition-colors cursor-pointer ${isSelected ? "bg-violet-500/5 text-violet-400 font-medium" : ""}`}
                          onClick={() => toggleSelect(entry.id)}
                        >
                          <td className="py-2 px-3">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? "border-violet-500 bg-violet-500 text-white" : "border-primary/20"}`}>
                              {isSelected && <Check size={10} />}
                            </div>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                          <td className="py-2 px-3 truncate max-w-[100px]">{entry.reference || "—"}</td>
                          <td className="py-2 px-3 truncate max-w-[150px]">{entry.narration}</td>
                          <td className={`py-2 px-3 text-right font-mono ${entry.transactionType === "RECEIPT" ? "text-emerald-400" : "text-rose-400"}`}>
                            {entry.transactionType === "RECEIPT" ? "+" : "-"}{formatCurrency(entry.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Real-time Balancing calculations */}
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/5 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary/40 mb-3">Balance Summary</h4>
              <div className="space-y-2.5 text-xs text-primary/80">
                <div className="flex justify-between">
                  <span>System Book Balance:</span>
                  <span className="font-mono">{formatCurrency(bookBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Matched Deposits (+):</span>
                  <span className="font-mono text-emerald-400">
                    {formatCurrency(
                      pendingEntries
                        .filter((e: any) => reconciledIds.includes(e.id) && e.transactionType === "RECEIPT")
                        .reduce((sum: number, e: any) => sum + e.amount, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Matched Withdrawals (-):</span>
                  <span className="font-mono text-rose-400">
                    {formatCurrency(
                      pendingEntries
                        .filter((e: any) => reconciledIds.includes(e.id) && e.transactionType === "PAYMENT")
                        .reduce((sum: number, e: any) => sum + e.amount, 0)
                    )}
                  </span>
                </div>
                <hr className="border-primary/10" />
                <div className="flex justify-between font-semibold text-sm">
                  <span>Reconciled Book Balance:</span>
                  <span className="font-mono">{formatCurrency(reconciledSum)}</span>
                </div>
                <div className="flex justify-between font-semibold text-sm">
                  <span>Statement End Balance:</span>
                  <span className="font-mono">{formatCurrency(stmtBal)}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-primary/10">
              {canPost ? (
                <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-lg flex items-center gap-2 text-xs font-medium">
                  <Check size={14} /> balanced! Difference: ₹0.00
                </div>
              ) : (
                <div className="bg-rose-500/10 text-rose-400 p-2.5 rounded-lg flex items-center gap-2 text-xs font-medium">
                  <ShieldAlert size={14} /> Out of balance by {formatCurrency(difference)}
                </div>
              )}
            </div>
          </div>
        </div>

        <FormField label="Reconciliation Memo / Notes">
          <ModalInput placeholder="Write notes on differences, adjustments, etc..." value={notes} onChange={e => setNotes(e.target.value)} />
        </FormField>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Complete Reconciliation" />
      </form>
    </Modal>
  );
}
