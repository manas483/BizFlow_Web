"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter, ModalSelect } from "@/shared/ui/ui/Modal";
import { DollarSign } from "lucide-react";
import { useCreateCashBookEntry, useAccounts } from "@/shared/hooks/useAccounting";

export default function AddCashBookEntryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: "",
    transactionType: "RECEIPT",
    accountId: "",
    amount: "",
    narration: "",
    reference: "",
  });

  const { data: accounts = [] } = useAccounts();
  const createEntry = useCreateCashBookEntry();

  useEffect(() => {
    if (open) {
      setForm({
        date: new Date().toISOString().split("T")[0],
        transactionType: "RECEIPT",
        accountId: "",
        amount: "",
        narration: "",
        reference: "",
      });
    }
  }, [open]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createEntry.mutateAsync({
        date: new Date(form.date).toISOString(),
        transactionType: form.transactionType,
        accountId: form.accountId,
        amount: parseFloat(form.amount) || 0,
        narration: form.narration,
        reference: form.reference || null,
      });
      toast.success("Cash Book entry added");
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to add cash entry");
    } finally {
      setLoading(false);
    }
  };

  const activeAccounts = accounts.filter((a: any) => a.isActive);

  return (
    <Modal open={open} onClose={onClose}
      title="Add Cash Book Entry" subtitle="Record physical cash receipts or payments"
      icon={<DollarSign size={18} />} iconColor="bg-violet-500/20 text-violet-400">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Entry Date" required>
            <ModalInput type="date" required value={form.date} onChange={set("date")} />
          </FormField>
          <FormField label="Transaction Type" required>
            <ModalSelect value={form.transactionType} onChange={set("transactionType")}>
              <option value="RECEIPT">Receipt (Cash In)</option>
              <option value="PAYMENT">Payment (Cash Out)</option>
            </ModalSelect>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Ledger Account" required hint="Account this transaction affects">
            <ModalSelect value={form.accountId} onChange={set("accountId")} required>
              <option value="">-- Select Account --</option>
              {activeAccounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.accountType})</option>
              ))}
            </ModalSelect>
          </FormField>
          <FormField label="Amount (₹)" required>
            <ModalInput type="number" step="0.01" min="0.01" required placeholder="0.00" value={form.amount} onChange={set("amount")} />
          </FormField>
        </div>

        <FormField label="Reference / Voucher Number">
          <ModalInput placeholder="e.g. VCH-0012, bill number" value={form.reference} onChange={set("reference")} />
        </FormField>

        <FormField label="Narration / Description" required>
          <ModalInput required placeholder="Memo details..." value={form.narration} onChange={set("narration")} />
        </FormField>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Save Cash Entry" />
      </form>
    </Modal>
  );
}
