import { useState, useEffect } from "react";
import { X, Save, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/shared/ui/ui/Button";
import { useUpdateExpense } from "@/shared/hooks/useExpenses";
import { CustomMultiSelect } from "@/shared/ui/ui/CustomMultiSelect";

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
  const [invoices, setInvoices] = useState<string[]>([]);

  const [form, setForm] = useState({
    category: "",
    amount: "",
    date: "",
    note: "",
    recurring: false,
    invoiceNumbers: [] as string[],
    excludedProductIds: [] as string[],
  });

  // Load distinct invoice numbers when modal opens
  useEffect(() => {
    if (expense) {
      fetch("/api/inventory/products/purchase-invoices")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setInvoices(data);
        })
        .catch(err => console.error("Failed to load purchase invoices", err));
    }
  }, [expense]);

  const [previewProducts, setPreviewProducts] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Fetch products associated with both currently and previously selected invoices
  useEffect(() => {
    const allInvs = Array.from(new Set([...form.invoiceNumbers, ...(expense?.invoiceNumbers || [])])).filter(Boolean);
    if (expense && allInvs.length > 0) {
      setLoadingPreview(true);
      fetch(`/api/inventory/products/purchase-invoices?invoices=${allInvs.join(",")}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setPreviewProducts(data);
          } else {
            setPreviewProducts([]);
          }
        })
        .catch(err => {
          console.error("Failed to load preview products", err);
          setPreviewProducts([]);
        })
        .finally(() => setLoadingPreview(false));
    } else {
      setPreviewProducts([]);
    }
  }, [expense, form.invoiceNumbers]);

  const getPreviewDetails = () => {
    const amount = parseFloat(form.amount) || 0;
    if (previewProducts.length === 0) return [];

    // Calculate old contribution
    const oldInvs = expense?.invoiceNumbers || [];
    const oldExcluded = expense?.excludedProductIds || [];
    const oldAmount = expense?.amount || 0;
    const oldProducts = previewProducts.filter(p => p.purchaseInvoiceNo && oldInvs.includes(p.purchaseInvoiceNo) && !oldExcluded.includes(p.id));
    const totalOldUnits = oldProducts.reduce((sum, p) => sum + (p.stock || 0) / (p.unitsPerBag || 1), 0);
    const oldContributionPerTransportUnit = totalOldUnits > 0 ? oldAmount / totalOldUnits : 0;

    // Calculate new contribution
    const newInvs = form.invoiceNumbers;
    const newExcluded = form.excludedProductIds;
    const newProducts = previewProducts.filter(p => p.purchaseInvoiceNo && newInvs.includes(p.purchaseInvoiceNo) && !newExcluded.includes(p.id));
    const totalNewUnits = newProducts.reduce((sum, p) => sum + (p.stock || 0) / (p.unitsPerBag || 1), 0);
    const newContributionPerTransportUnit = totalNewUnits > 0 ? amount / totalNewUnits : 0;

    return previewProducts.map(p => {
      const unitsPerBag = p.unitsPerBag || 1;
      const isOriginallyAffected = p.purchaseInvoiceNo && oldInvs.includes(p.purchaseInvoiceNo) && !oldExcluded.includes(p.id);
      const isCurrentlyAffected = p.purchaseInvoiceNo && newInvs.includes(p.purchaseInvoiceNo) && !newExcluded.includes(p.id);
      const isCurrentlyExcluded = newExcluded.includes(p.id);

      const oldContribution = isOriginallyAffected ? (oldContributionPerTransportUnit / unitsPerBag) : 0;
      const newContribution = isCurrentlyAffected ? (newContributionPerTransportUnit / unitsPerBag) : 0;

      const newAdditional = p.transportCost - oldContribution + newContribution;
      const newLanded = p.basePurchasePrice + newAdditional;
      const change = newContribution - oldContribution;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        invoice: p.purchaseInvoiceNo,
        stock: p.stock,
        unitsPerBag,
        currentLanded: p.purchasePrice,
        currentAdditional: p.transportCost,
        newAdditional,
        newLanded,
        change,
        isCurrentlyAffected,
        isCurrentlyExcluded
      };
    });
  };

  const previewDetails = getPreviewDetails();

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
        invoiceNumbers: expense.invoiceNumbers ?? [],
        excludedProductIds: expense.excludedProductIds ?? [],
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
          invoiceNumbers: form.invoiceNumbers,
          excludedProductIds: form.excludedProductIds,
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

          {/* Associate Invoice(s) */}
          <div>
            <label className="text-primary/40 text-xs mb-1.5 block">Associate Invoice(s)</label>
            <CustomMultiSelect
              value={form.invoiceNumbers}
              onChange={(v) => setForm({ ...form, invoiceNumbers: v })}
              options={invoices.map(inv => ({ value: inv, label: inv }))}
              placeholder="Select invoices..."
            />
          </div>

          {/* Landed Cost Preview Card */}
          {(form.invoiceNumbers.length > 0 || (expense?.invoiceNumbers && expense.invoiceNumbers.length > 0)) && (
            <div className="rounded-xl overflow-hidden bg-violet-500/5 border border-violet-500/10 backdrop-blur-sm">
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-violet-500/10 bg-violet-500/10">
                <span className="text-xs font-semibold text-violet-300">Landed Cost Allocation Preview</span>
                {loadingPreview && <span className="text-[10px] text-violet-400 animate-pulse">Calculating...</span>}
              </div>
              <div className="p-4 space-y-3">
                {loadingPreview ? (
                  <div className="text-center py-4 text-xs text-primary/40">Loading invoice details...</div>
                ) : previewDetails.length === 0 ? (
                  <div className="text-center py-4 text-xs text-primary/40">
                    {parseFloat(form.amount) > 0 
                      ? "No stock found in selected invoices to allocate costs." 
                      : "Enter an amount to see the cost allocation breakdown."}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="text-primary/40 border-b border-primary/5 pb-1">
                          <th className="w-8 font-medium pb-1.5 text-center"></th>
                          <th className="font-medium pb-1.5">Product</th>
                          <th className="font-medium text-center pb-1.5">Invoice</th>
                          <th className="font-medium text-right pb-1.5">Stock</th>
                          <th className="font-medium text-right pb-1.5">Add. Cost Delta</th>
                          <th className="font-medium text-right pb-1.5">Projected Landed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary/5">
                        {previewDetails.map((item) => {
                          const delta = item.change;
                          // If it's excluded, we don't apply opacity-40, we just show unchecked.
                          // But if it's completely unselected invoice, it shouldn't be here anyway.
                          return (
                            <tr key={item.id} className={`text-primary/70 hover:text-primary ${item.isCurrentlyExcluded ? "opacity-40" : ""}`}>
                              <td className="py-2 text-center w-8">
                                <input 
                                  type="checkbox" 
                                  className="w-3.5 h-3.5 rounded accent-violet-500"
                                  checked={!item.isCurrentlyExcluded}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setForm(prev => ({ ...prev, excludedProductIds: prev.excludedProductIds.filter(id => id !== item.id) }));
                                    } else {
                                      setForm(prev => ({ ...prev, excludedProductIds: [...prev.excludedProductIds, item.id] }));
                                    }
                                  }}
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <div className="font-medium">{item.name}</div>
                                {item.sku && <div className="text-[9px] text-primary/30 font-mono">{item.sku}</div>}
                                {!item.isCurrentlyAffected && !item.isCurrentlyExcluded && <span className="text-[9px] text-rose-400 bg-rose-500/10 px-1 py-0.2 rounded font-medium mt-0.5 inline-block">Removed</span>}
                              </td>
                              <td className="py-2 text-center text-primary/50">{item.invoice}</td>
                              <td className="py-2 text-right">
                                {item.stock} <span className="text-[9px] text-primary/30">({(item.stock / item.unitsPerBag).toFixed(1)} bag)</span>
                              </td>
                              <td className={`py-2 text-right font-medium ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-primary/40"}`}>
                                {delta > 0 ? `+${delta.toFixed(2)}` : delta < 0 ? `${delta.toFixed(2)}` : "—"}
                                <div className="text-[9px] text-primary/30">Total: {item.newAdditional.toFixed(2)}</div>
                              </td>
                              <td className="py-2 text-right">
                                <div className="line-through text-primary/30 text-[10px]">{item.currentLanded.toFixed(2)}</div>
                                <div className="font-semibold text-violet-400">₹{item.newLanded.toFixed(2)}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

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
