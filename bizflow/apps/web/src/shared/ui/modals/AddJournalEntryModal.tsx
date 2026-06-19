"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter, ModalSelect } from "@/shared/ui/ui/Modal";
import { Plus, Trash2, Scale } from "lucide-react";
import { useCreateJournalEntry, useAccounts } from "@/shared/hooks/useAccounting";
import { formatCurrency } from "@/shared/lib/utils";

interface JournalLineInput {
  accountId: string;
  debit: string;
  credit: string;
  narration: string;
}

export default function AddJournalEntryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState("");
  const [narration, setNarration] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<JournalLineInput[]>([
    { accountId: "", debit: "0", credit: "0", narration: "" },
    { accountId: "", debit: "0", credit: "0", narration: "" },
  ]);

  const { data: accounts = [] } = useAccounts();
  const createJournalEntry = useCreateJournalEntry();

  // Set today's date on open
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split("T")[0]);
      setNarration("");
      setReference("");
      setLines([
        { accountId: "", debit: "0", credit: "0", narration: "" },
        { accountId: "", debit: "0", credit: "0", narration: "" },
      ]);
    }
  }, [open]);

  const handleLineChange = (index: number, key: keyof JournalLineInput, value: string) => {
    setLines(prev => {
      const copy = [...prev];
      const line = { ...copy[index] };

      if (key === "debit" && parseFloat(value) > 0) {
        line.debit = value;
        line.credit = "0"; // Clear credit if debit is entered
      } else if (key === "credit" && parseFloat(value) > 0) {
        line.credit = value;
        line.debit = "0"; // Clear debit if credit is entered
      } else {
        (line as any)[key] = value;
      }

      copy[index] = line;
      return copy;
    });
  };

  const addLine = () => {
    setLines(prev => [...prev, { accountId: "", debit: "0", credit: "0", narration: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) {
      toast.error("A journal entry must have at least 2 lines");
      return;
    }
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.01 && totalDebit > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isBalanced) {
      toast.error("Total Debits and Credits must balance!");
      return;
    }

    // Check that all lines have accounts
    if (lines.some(l => !l.accountId)) {
      toast.error("Please select accounts for all journal lines.");
      return;
    }

    setLoading(true);
    try {
      await createJournalEntry.mutateAsync({
        date: new Date(date).toISOString(),
        narration,
        reference: reference || null,
        lines: lines.map(l => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          narration: l.narration || null,
        })),
      });
      toast.success("Journal Entry created successfully");
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to create journal entry");
    } finally {
      setLoading(false);
    }
  };

  const activeAccounts = accounts.filter((a: any) => a.isActive);

  return (
    <Modal open={open} onClose={onClose} size="3xl"
      title="Create Journal Entry" subtitle="Record double-entry transactions directly into the ledger"
      icon={<Scale size={18} />} iconColor="bg-violet-500/20 text-violet-400">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Entry Date" required>
            <ModalInput type="date" required value={date} onChange={e => setDate(e.target.value)} />
          </FormField>
          <FormField label="Reference / Invoice No">
            <ModalInput placeholder="e.g. INV-1029, CHQ-209" value={reference} onChange={e => setReference(e.target.value)} />
          </FormField>
          <FormField label="Narration / General Memo" required>
            <ModalInput required placeholder="Purpose of this entry..." value={narration} onChange={e => setNarration(e.target.value)} />
          </FormField>
        </div>

        {/* Lines */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary/40">Journal Lines</h4>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-medium py-1 px-2 rounded-lg hover:bg-violet-500/5 transition-colors"
            >
              <Plus size={14} /> Add Line
            </button>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {lines.map((line, idx) => (
              <div key={idx} className="flex flex-col md:flex-row gap-3 items-end bg-primary/5 p-3 rounded-xl border border-primary/5">
                <div className="flex-1 min-w-0 w-full">
                  <label className="text-[10px] text-primary/40 block mb-1">Account</label>
                  <ModalSelect
                    value={line.accountId}
                    onChange={e => handleLineChange(idx, "accountId", e.target.value)}
                    required
                  >
                    <option value="">-- Select Account --</option>
                    {activeAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.accountType})</option>
                    ))}
                  </ModalSelect>
                </div>

                <div className="w-full md:w-32">
                  <label className="text-[10px] text-primary/40 block mb-1">Debit (Dr)</label>
                  <ModalInput
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={line.debit === "0" ? "" : line.debit}
                    onChange={e => handleLineChange(idx, "debit", e.target.value)}
                    disabled={parseFloat(line.credit) > 0}
                  />
                </div>

                <div className="w-full md:w-32">
                  <label className="text-[10px] text-primary/40 block mb-1">Credit (Cr)</label>
                  <ModalInput
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={line.credit === "0" ? "" : line.credit}
                    onChange={e => handleLineChange(idx, "credit", e.target.value)}
                    disabled={parseFloat(line.debit) > 0}
                  />
                </div>

                <div className="flex-1 min-w-0 w-full">
                  <label className="text-[10px] text-primary/40 block mb-1">Line Description (Optional)</label>
                  <ModalInput
                    placeholder="Memo for this line..."
                    value={line.narration}
                    onChange={e => handleLineChange(idx, "narration", e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="p-2.5 rounded-xl text-primary/40 hover:text-rose-400 hover:bg-rose-500/10 transition-all mb-[1px]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Balance Sheet style summary */}
        <div className="bg-primary/5 p-4 rounded-xl border border-primary/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm font-medium">
          <div className="flex gap-6">
            <div>
              <span className="text-xs text-primary/40 block">Total Debits</span>
              <span className="text-emerald-400 font-bold text-base">{formatCurrency(totalDebit)}</span>
            </div>
            <div>
              <span className="text-xs text-primary/40 block">Total Credits</span>
              <span className="text-emerald-400 font-bold text-base">{formatCurrency(totalCredit)}</span>
            </div>
          </div>
          <div className="text-right">
            {isBalanced ? (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400">
                Balanced
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400">
                Out of Balance by {formatCurrency(difference)}
              </span>
            )}
          </div>
        </div>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Post Entry" />
      </form>
    </Modal>
  );
}
