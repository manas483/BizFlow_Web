"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/shared/ui/ui/Modal";
import { Landmark } from "lucide-react";
import { useCreateBankAccount } from "@/shared/hooks/useAccounting";

export default function AddBankAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    accountName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    branch: "",
    currentBalance: "0",
  });

  const createBankAccount = useCreateBankAccount();

  useEffect(() => {
    if (open) {
      setForm({
        accountName: "",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        branch: "",
        currentBalance: "0",
      });
    }
  }, [open]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createBankAccount.mutateAsync({
        accountName: form.accountName,
        bankName: form.bankName,
        accountNumber: form.accountNumber,
        ifscCode: form.ifscCode || null,
        branch: form.branch || null,
        currentBalance: parseFloat(form.currentBalance) || 0,
      });
      toast.success("Bank Account registered successfully");
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to register bank account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}
      title="Register Bank Account" subtitle="Add business bank account to track deposits, withdrawals, and payouts"
      icon={<Landmark size={18} />} iconColor="bg-violet-500/20 text-violet-400">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Account Display Name" required hint="e.g. HDFC Current Account">
          <ModalInput required placeholder="Display Name" value={form.accountName} onChange={set("accountName")} />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Bank Name" required>
            <ModalInput required placeholder="e.g. HDFC Bank" value={form.bankName} onChange={set("bankName")} />
          </FormField>
          <FormField label="Account Number" required>
            <ModalInput required placeholder="Account Number" value={form.accountNumber} onChange={set("accountNumber")} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="IFSC Code" hint="e.g. HDFC0000123">
            <ModalInput placeholder="IFSC Code" value={form.ifscCode} onChange={set("ifscCode")} style={{ textTransform: "uppercase" }} />
          </FormField>
          <FormField label="Branch Name">
            <ModalInput placeholder="Branch" value={form.branch} onChange={set("branch")} />
          </FormField>
        </div>

        <FormField label="Opening / Current Balance (₹)">
          <ModalInput type="number" step="0.01" placeholder="0.00" value={form.currentBalance} onChange={set("currentBalance")} />
        </FormField>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Register Account" />
      </form>
    </Modal>
  );
}
