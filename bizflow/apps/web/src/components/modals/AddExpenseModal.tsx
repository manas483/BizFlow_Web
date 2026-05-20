"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/components/ui/Modal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Receipt } from "lucide-react";
import { useCreateExpense } from "@/hooks/useExpenses";
import { useBusiness } from "@/hooks/useBusiness";
import { getBusinessProfile } from "@/lib/business-intelligence";

const CATEGORIES = [
  { value: "Rent", label: "Rent" },
  { value: "Electricity", label: "Electricity" },
  { value: "Salary", label: "Salary" },
  { value: "Transport", label: "Transport" },
  { value: "Inventory", label: "Inventory Purchase" },
  { value: "Misc", label: "Miscellaneous" },
];

export default function AddExpenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    category: "Misc", amount: "",
    date: new Date().toISOString().split("T")[0],
    note: "", recurring: false,
  });

  const createExpense = useCreateExpense();
  const { data: business } = useBusiness();

  const profile = business ? getBusinessProfile(business.businessType) : null;
  const categoriesList = profile 
    ? [...profile.expenseCategories, "Misc"].map(c => ({ value: c, label: c }))
    : CATEGORIES;

  const sampleExpense = profile?.expenseCategories?.[0] || "Monthly shop rent";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createExpense.mutateAsync({ ...form, amount: parseFloat(form.amount) || 0 });
      setForm({ category: "Misc", amount: "", date: new Date().toISOString().split("T")[0], note: "", recurring: false });
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open} onClose={onClose}
      title="Add New Expense" subtitle="Record a business expense"
      icon={<Receipt size={18} />} iconColor="bg-rose-500/20 text-rose-400"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Amount (₹)" required>
            <ModalInput required type="number" min="0" placeholder="0.00" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </FormField>
          <FormField label="Date" required>
            <ModalInput required type="date" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </FormField>
        </div>

        <FormField label="Category">
          <CustomSelect
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            options={categoriesList}
          />
        </FormField>

        <FormField label="Description / Note" required>
          <ModalInput required placeholder={`e.g. ${sampleExpense}`} value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </FormField>

        <div className="flex items-center gap-2 pt-2">
          <input type="checkbox" id="recurring" checked={form.recurring}
            onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
            className="w-4 h-4 rounded accent-violet-500" />
          <label htmlFor="recurring" className="text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            Mark as recurring monthly expense
          </label>
        </div>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Save Expense" />
      </form>
    </Modal>
  );
}
