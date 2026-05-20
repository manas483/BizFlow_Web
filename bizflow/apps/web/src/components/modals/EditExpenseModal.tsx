"use client";

import { useState, useEffect } from "react";
import { X, Save, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUpdateExpense } from "@/hooks/useExpenses";

const CATEGORIES = [
  "Rent", "Electricity", "Salary", "Transport", "Misc",
  "Marketing", "Utilities", "Repairs", "Insurance", "Other",
];

interface EditExpenseModalProps {
  expense: any;
  onClose: () => void;
}

export default function EditExpenseModal({ expense, onClose }: EditExpenseModalProps) {
  const updateExpense = useUpdateExpense();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    category: "",
    amount: "",
    date: "",
    note: "",
    recurring: false,
  });

  // Populate form when expense loads
  useEffect(() => {
    if (expense) {
      setForm({
        category: expense.category ?? "",
        amount: String(expense.amount ?? ""),
        date: expense.date
          ? new Date(expense.date).toISOString().split("T")[0]
          : "",
        note: expense.note ?? "",
        recurring: expense.recurring ?? false,
      });
    }
  }, [expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const amount = parseFloat(form.amount);
    if (!form.category) { setError("Please select a category."); return; }
    if (isNaN(amount) || amount <= 0) { setError("Please enter a valid amount."); return; }
    if (!form.date) { setError("Please select a date."); return; }

    try {
      await updateExpense.mutateAsync({
        id: expense.id,
        data: {
          category: form.category,
          amount,
          date: form.date,
          note: form.note || null,
          recurring: form.recurring,
        },
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to update expense.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="font-semibold text-primary">Edit Expense</h2>
          <button
            onClick={onClose}
            aria-label="Close edit expense modal"
            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/40 hover:text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {/* Success banner */}
          {saved && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              <CheckCircle size={13} /> Expense updated successfully!
            </div>
          )}

          {/* Category */}
          <div>
            <label className="text-primary/40 text-xs mb-1.5 block">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm
                text-primary focus:outline-none focus:border-violet-500/50 transition-all"
            >
              <option value="">Select category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              {/* Keep existing category if it's custom */}
              {form.category && !CATEGORIES.includes(form.category) && (
                <option value={form.category}>{form.category}</option>
              )}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="text-primary/40 text-xs mb-1.5 block">Amount (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm
                text-primary focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-primary/40 text-xs mb-1.5 block">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm
                text-primary focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-primary/40 text-xs mb-1.5 block">Note (optional)</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Brief description..."
              className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm
                text-primary focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-primary text-sm font-medium">Recurring Expense</p>
              <p className="text-primary/40 text-xs">Monthly fixed cost</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, recurring: !form.recurring })}
              className={`relative w-10 h-5 rounded-full transition-all duration-200 ${
                form.recurring ? "bg-violet-600" : "bg-primary/10"
              }`}
              aria-label="Toggle recurring expense"
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                  form.recurring ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-primary/60
                hover:text-primary hover:bg-primary/5 transition-all border border-primary/10"
            >
              Cancel
            </button>
            <Button
              type="submit"
              size="md"
              className="flex-1"
              disabled={updateExpense.isPending || saved}
              icon={saved ? <CheckCircle size={14} /> : <Save size={14} />}
            >
              {updateExpense.isPending ? "Saving..." : saved ? "Saved!" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
