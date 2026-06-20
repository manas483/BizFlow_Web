"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter, ModalSelect } from "@/shared/ui/ui/Modal";
import { Landmark } from "lucide-react";
import { useCreateBankBookEntry, useBankAccounts, useAccounts } from "@/shared/hooks/useAccounting";

export default function AddBankBookEntryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: "",
    transactionType: "RECEIPT",
    bankAccountId: "",
    accountId: "",
    amount: "",
    narration: "",
    reference: "",
  });

  const { data: bankAccounts = [] } = useBankAccounts();
  const { data: accounts = [] } = useAccounts();
  const createEntry = useCreateBankBookEntry();

  useEffect(() => {
    if (open) {
      setForm({
        date: new Date().toISOString().split("T")[0],
        transactionType: "RECEIPT",
        bankAccountId: bankAccounts[0]?.id || "",
        accountId: "",
        amount: "",
        narration: "",
        reference: "",
      });
    }
  }, [open, bankAccounts]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bankAccountId) {
      toast.error("Please register a bank account first.");
      return;
    }
    setLoading(true);
    try {
      await createEntry.mutateAsync({
        date: new Date(form.date).toISOString(),
        transactionType: form.transactionType,
        bankAccountId: form.bankAccountId,
        accountId: form.accountId,
        amount: parseFloat(form.amount) || 0,
        narration: form.narration,
        reference: form.reference || null,
      });
      toast.success("Bank Book entry saved");
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to record bank entry");
    } finally {
      setLoading(false);
    }
  };

  const activeAccounts = accounts.filter((a: any) => a.isActive);
  const activeBankAccounts = bankAccounts.filter((b: any) => b.isActive);

  return (
    <Modal open={open} onClose={onClose}
      title="Add Bank Transaction" subtitle="Record bank deposits, withdrawals, transfers, and fees"
      icon={<Landmark size={18} />} iconColor="bg-violet-500/20 text-violet-400">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Transaction Date" required>
            <ModalInput type="date" required value={form.date} onChange={set("date")} />
          </FormField>
          <FormField label="Transaction Type" required>
            <ModalSelect value={form.transactionType} onChange={set("transactionType")}>
              <option value="RECEIPT">Deposit / Cash In</option>
              <option value="PAYMENT">Withdrawal / Payment / Out</option>
            </ModalSelect>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Select Bank Account" required>
            <ModalSelect value={form.bankAccountId} onChange={set("bankAccountId")} required>
              <option value="">-- Select Bank Account --</option>
              {activeBankAccounts.map((b: any) => (
                <option key={b.id} value={b.id}>{b.bankName} - {b.accountName} (***{b.accountNumber.slice(-4)})</option>
              ))}
            </ModalSelect>
          </FormField>
          <FormField label="Ledger Account" required hint="Balancing double-entry account">
            <ModalSelect value={form.accountId} onChange={set("accountId")} required>
              <option value="">-- Select Account --</option>
              {activeAccounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.accountType})</option>
              ))}
            </ModalSelect>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Amount (₹)" required>
            <ModalInput type="number" step="0.01" min="0.01" required placeholder="0.00" value={form.amount} onChange={set("amount")} />
          </FormField>
          <FormField label="Reference (Cheque / Txn ID)">
            <ModalInput placeholder="e.g. Txn-829103, Cheque-129" value={form.reference} onChange={set("reference")} />
          </FormField>
        </div>

        <FormField label="Narration / Purpose" required>
          <ModalInput required placeholder="Memo details..." value={form.narration} onChange={set("narration")} />
        </FormField>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Save Transaction" />
      </form>
    </Modal>
  );
}
