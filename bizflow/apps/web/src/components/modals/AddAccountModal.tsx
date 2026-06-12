"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter, ModalTextarea, ModalSelect } from "@/components/ui/Modal";
import { FolderTree } from "lucide-react";
import { useCreateAccount } from "@/hooks/useAccounting";

export default function AddAccountModal({ open, onClose, accounts = [] }: { open: boolean; onClose: () => void; accounts: any[] }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    accountType: "ASSET",
    parentId: "",
    description: "",
    openingBalance: "0",
  });

  const createAccount = useCreateAccount();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.value;
    if (k === "parentId" && val) {
      const parent = accounts.find(a => a.id === val);
      if (parent) {
        setForm(f => ({ ...f, parentId: val, accountType: parent.accountType }));
        return;
      }
    }
    setForm(f => ({ ...f, [k]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createAccount.mutateAsync({
        code: form.code,
        name: form.name,
        accountType: form.accountType,
        parentId: form.parentId || null,
        description: form.description || null,
        openingBalance: parseFloat(form.openingBalance) || 0,
      });
      setForm({ code: "", name: "", accountType: "ASSET", parentId: "", description: "", openingBalance: "0" });
      onClose();
      toast.success("Account created successfully");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  // Filter possible parents (only active accounts)
  const parentOptions = accounts
    .filter((a: any) => a.isActive)
    .map((a: any) => ({ value: a.id, label: `${a.code} - ${a.name} (${a.accountType})` }));

  return (
    <Modal open={open} onClose={onClose}
      title="Add New Account" subtitle="Create an account code for the General Ledger"
      icon={<FolderTree size={18} />} iconColor="bg-violet-500/20 text-violet-400">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Account Code" required hint="e.g. 1100, 2200, 4001">
            <ModalInput required placeholder="Code" value={form.code} onChange={set("code")} />
          </FormField>
          <FormField label="Account Name" required>
            <ModalInput required placeholder="e.g. Cash, Sales, Rent" value={form.name} onChange={set("name")} />
          </FormField>
        </div>

        <FormField label="Parent Account" hint="Optional. Selecting a parent locks type to match parent.">
          <ModalSelect value={form.parentId} onChange={set("parentId")}>
            <option value="">-- No Parent (Root Level) --</option>
            {parentOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </ModalSelect>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Account Type" required>
            <ModalSelect value={form.accountType} onChange={set("accountType")} disabled={!!form.parentId}>
              <option value="ASSET">ASSET</option>
              <option value="LIABILITY">LIABILITY</option>
              <option value="EQUITY">EQUITY</option>
              <option value="REVENUE">REVENUE</option>
              <option value="EXPENSE">EXPENSE</option>
            </ModalSelect>
          </FormField>
          <FormField label="Opening Balance">
            <ModalInput type="number" step="0.01" placeholder="0.00" value={form.openingBalance} onChange={set("openingBalance")} />
          </FormField>
        </div>

        <FormField label="Description">
          <ModalTextarea placeholder="Describe the purpose of this account..." value={form.description} onChange={set("description")} />
        </FormField>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Save Account" />
      </form>
    </Modal>
  );
}
