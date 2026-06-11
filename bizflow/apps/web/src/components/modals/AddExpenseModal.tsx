"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/components/ui/Modal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { CustomMultiSelect } from "@/components/ui/CustomMultiSelect";
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
  const [invoices, setInvoices] = useState<string[]>([]);
  const [form, setForm] = useState({
    category: "Misc", amount: "",
    date: new Date().toISOString().split("T")[0],
    note: "", recurring: false,
    invoiceNumbers: [] as string[],
  });

  const createExpense = useCreateExpense();
  const { data: business } = useBusiness();

  // Load distinct invoice numbers when modal opens
  useEffect(() => {
    if (open) {
      fetch("/api/products/purchase-invoices")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setInvoices(data);
        })
        .catch(err => console.error("Failed to load purchase invoices", err));
    }
  }, [open]);

  const [previewProducts, setPreviewProducts] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Fetch products associated with selected invoices to calculate live preview
  useEffect(() => {
    if (open && form.invoiceNumbers.length > 0) {
      setLoadingPreview(true);
      fetch(`/api/products/purchase-invoices?invoices=${form.invoiceNumbers.join(",")}`)
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
  }, [open, form.invoiceNumbers]);

  const getPreviewDetails = () => {
    const amount = parseFloat(form.amount) || 0;
    if (amount <= 0 || previewProducts.length === 0) return [];

    const totalUnits = previewProducts.reduce((sum, p) => {
      const stock = p.stock || 0;
      const unitsPerBag = p.unitsPerBag || 1;
      return sum + (stock / unitsPerBag);
    }, 0);

    if (totalUnits <= 0) return [];

    const expensePerTransportUnit = amount / totalUnits;

    return previewProducts.map(p => {
      const unitsPerBag = p.unitsPerBag || 1;
      const additionalCostFromThis = expensePerTransportUnit / unitsPerBag;
      const newTransportCost = p.transportCost + additionalCostFromThis;
      const newLandedCost = p.basePurchasePrice + newTransportCost;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        invoice: p.purchaseInvoiceNo,
        stock: p.stock,
        unitsPerBag,
        currentLanded: p.purchasePrice,
        currentAdditional: p.transportCost,
        newAdditional: newTransportCost,
        newLanded: newLandedCost,
        change: additionalCostFromThis
      };
    });
  };

  const previewDetails = getPreviewDetails();

  const profile = business ? getBusinessProfile(business.businessType) : null;
  const categoriesList = profile 
    ? Array.from(new Set([...profile.expenseCategories, "Misc"])).map(c => ({ value: c, label: c }))
    : CATEGORIES;

  const sampleExpense = profile?.expenseCategories?.[0] || "Monthly shop rent";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createExpense.mutateAsync({ ...form, amount: parseFloat(form.amount) || 0 });
      setForm({ category: "Misc", amount: "", date: new Date().toISOString().split("T")[0], note: "", recurring: false, invoiceNumbers: [] });
      setPreviewProducts([]);
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

        <FormField label="Associate Invoice(s)">
          <CustomMultiSelect
            value={form.invoiceNumbers}
            onChange={(v) => setForm({ ...form, invoiceNumbers: v })}
            options={invoices.map(inv => ({ value: inv, label: inv }))}
            placeholder="Select invoices..."
          />
        </FormField>

        {/* Landed Cost Preview Card */}
        {form.invoiceNumbers.length > 0 && (
          <div className="rounded-xl overflow-hidden mt-4 bg-violet-500/5 border border-violet-500/10 backdrop-blur-sm">
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
                    : "Enter an amount above to see the cost allocation breakdown."}
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="text-primary/40 border-b border-primary/5 pb-1">
                        <th className="font-medium pb-1.5">Product</th>
                        <th className="font-medium text-center pb-1.5">Invoice</th>
                        <th className="font-medium text-right pb-1.5">Stock</th>
                        <th className="font-medium text-right pb-1.5">Add. Cost</th>
                        <th className="font-medium text-right pb-1.5">Landed Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5">
                      {previewDetails.map((item) => (
                        <tr key={item.id} className="text-primary/70 hover:text-primary">
                          <td className="py-2 pr-2">
                            <div className="font-medium">{item.name}</div>
                            {item.sku && <div className="text-[9px] text-primary/30 font-mono">{item.sku}</div>}
                          </td>
                          <td className="py-2 text-center text-primary/50">{item.invoice}</td>
                          <td className="py-2 text-right">
                            {item.stock} <span className="text-[9px] text-primary/30">({(item.stock / item.unitsPerBag).toFixed(1)} bag)</span>
                          </td>
                          <td className="py-2 text-right font-medium text-emerald-400">
                            +{item.change.toFixed(2)}
                            <div className="text-[9px] text-primary/30">Total: {item.newAdditional.toFixed(2)}</div>
                          </td>
                          <td className="py-2 text-right">
                            <div className="line-through text-primary/30 text-[10px]">{item.currentLanded.toFixed(2)}</div>
                            <div className="font-semibold text-violet-400">₹{item.newLanded.toFixed(2)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

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
