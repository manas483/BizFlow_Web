"use client";

import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/components/ui/Modal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { FileText, Plus, Trash2, ChevronDown, AlertTriangle } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { useProducts } from "@/hooks/useProducts";
import { useCreateQuotation } from "@/hooks/useQuotations";
import { useBusiness } from "@/hooks/useBusiness";
import { formatCurrency } from "@/lib/utils";
import AddCustomerModal from "@/components/modals/AddCustomerModal";
import AddProductModal from "@/components/modals/AddProductModal";

/* ── Indian States for Place of Supply ─────────────────── */
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

function ProductPicker({
  value, onChange, products,
}: {
  value: string;
  onChange: (id: string) => void;
  products: any[];
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleOpen = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(o => !o);
  };

  const selected = products.find((p: any) => p.id === value);

  return (
    <div className="relative">
      <button
        type="button"
        ref={btnRef}
        onClick={handleOpen}
        className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm text-left transition-all"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--input-border)",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <span className="truncate">{selected ? selected.name : "Select product..."}</span>
        <ChevronDown size={12} className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
      </button>

      {open && rect && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            width: Math.max(rect.width, 220),
            zIndex: 9999,
            backgroundColor: "var(--bg-surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          <button
            type="button"
            onClick={() => { onChange("NEW_PRODUCT"); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-violet-400 hover:bg-violet-500/10 transition-colors border-b border-primary/10 font-medium"
          >
            <Plus size={12} /> Add New Product
          </button>
          
          {products.length === 0 ? (
            <p className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>No products found</p>
          ) : products.map((p: any) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange(p.id); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors"
            >
              <span style={{ color: p.id === value ? "#a78bfa" : "var(--text-secondary)" }}>{p.name}</span>
              <span style={{ color: "var(--text-muted)" }}>Stock: {p.stock}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewQuotationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState([{ productId: "", qty: 1 as number | string, price: 0, discount: 0, hsnCode: "", gstRate: 0 }]);
  const [validUntil, setValidUntil] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [notes, setNotes] = useState("");
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  const { data: customersPaged } = useCustomers(undefined, 1, 100);
  const customers = customersPaged?.data ?? [];
  const { data: productsPaged } = useProducts(undefined, undefined, 1, 100);
  const products = productsPaged?.data ?? [];
  const { data: business } = useBusiness();
  const gstInclusive: boolean = business?.gstInclusive ?? false;
  const isInterState = placeOfSupply && business?.state
    ? placeOfSupply.toLowerCase() !== business.state.toLowerCase()
    : false;
  const createQuotation = useCreateQuotation();

  const customerOptions = [
    { value: "NEW_CUSTOMER", label: "+ Add New Customer" },
    ...customers.map((c: any) => ({ value: c.id, label: `${c.name} (${c.phone})` }))
  ];

  const placeOfSupplyOptions = INDIAN_STATES.map(s => ({ value: s, label: s }));

  const handleCustomerChange = (val: string) => {
    if (val === "NEW_CUSTOMER") {
      setIsAddCustomerOpen(true);
    } else {
      setCustomer(val);
      const cust = customers.find((c: any) => c.id === val);
      if (cust?.state && !placeOfSupply) setPlaceOfSupply(cust.state);
    }
  };

  const handleAddItem = () => setItems([...items, { productId: "", qty: 1, price: 0, discount: 0, hsnCode: "", gstRate: 0 }]);
  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleProductChange = (index: number, productId: string) => {
    if (productId === "NEW_PRODUCT") {
      setIsAddProductOpen(true);
      return;
    }
    const product = products.find((p: any) => p.id === productId);
    const newItems = [...items];
    newItems[index] = { 
      ...newItems[index], 
      productId, 
      price: product ? product.sellingPrice : 0,
      discount: 0,
      hsnCode: product ? (product.hsnCode || "") : "",
      gstRate: product ? product.gstRate : 0
    };
    setItems(newItems);
  };

  const handleQtyChange = (index: number, qty: number | string) => {
    const newItems = [...items];
    newItems[index].qty = qty;
    setItems(newItems);
  };

  // Totals — handle GST-inclusive pricing
  let subtotal = 0;
  let totalGst = 0;
  items.forEach(item => {
    const qty = Number(item.qty) || 0;
    const grossAmt = (qty * item.price) - (item.discount || 0);
    const rate = item.gstRate || 0;
    if (gstInclusive && rate > 0) {
      const base = grossAmt / (1 + rate / 100);
      subtotal += base;
      totalGst += grossAmt - base;
    } else {
      subtotal += grossAmt;
      totalGst += grossAmt * (rate / 100);
    }
  });
  const total = subtotal + totalGst;

  const hasGst = items.some(i => (i.gstRate || 0) > 0);

  const handleClose = () => {
    setCustomer(""); setItems([{ productId: "", qty: 1, price: 0, discount: 0, hsnCode: "", gstRate: 0 }]);
    setValidUntil(""); setPlaceOfSupply(""); setReverseCharge(false); setNotes("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) { toast.error("Please select a customer"); return; }
    if (items.some(i => !i.productId)) { toast.error("Please select products for all items"); return; }
    setLoading(true);
    try {
      await createQuotation.mutateAsync({
        customerId: customer,
        items,
        notes: notes || undefined,
        placeOfSupply: placeOfSupply || undefined,
        reverseCharge,
        validUntil: validUntil || undefined,
      });
      handleClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create quotation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose}
      title="Create Quotation" subtitle="Generate an estimate or quotation for goods or services"
      icon={<FileText size={18} />} iconColor="bg-violet-500/20 text-violet-400" size="3xl">
      <form onSubmit={handleSubmit} className="space-y-5">

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Select Customer" required>
            <CustomSelect
              value={customer}
              onChange={handleCustomerChange}
              options={customerOptions}
              placeholder="Select a customer..."
            />
          </FormField>
          <FormField label="Valid Until">
            <ModalInput type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4 p-3 rounded-xl border border-violet-500/20 bg-violet-500/5">
          <FormField label="Place of Supply" hint="State where delivered">
            <CustomSelect
              value={placeOfSupply}
              onChange={setPlaceOfSupply}
              options={placeOfSupplyOptions}
              placeholder="Select state..."
            />
          </FormField>
          <FormField label="Reverse Charge (RCM)" hint="Tax payable by recipient?">
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => setReverseCharge(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  reverseCharge ? "bg-amber-500" : "bg-primary/20"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    reverseCharge ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={`text-xs font-medium ${reverseCharge ? "text-amber-400" : "text-primary/40"}`}>
                {reverseCharge ? "Yes" : "No"}
              </span>
            </div>
          </FormField>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Line Items</label>
              {gstInclusive && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 font-medium">GST Inclusive</span>
              )}
            </div>
            <button type="button" onClick={handleAddItem}
              className="text-xs font-medium text-violet-400 flex items-center gap-1 hover:text-violet-300 transition-colors">
              <Plus size={14} /> Add Item
            </button>
          </div>

          <div className="bg-primary/5 border border-primary/10 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-primary/5 border-b border-primary/10 text-primary/40 text-xs">
                <tr>
                  <th className="p-3 font-medium text-left">Product</th>
                  <th className="p-3 font-medium w-24 min-w-[90px]">HSN/SAC</th>
                  <th className="p-3 font-medium w-24 min-w-[80px]">Qty</th>
                  <th className="p-3 font-medium w-32 min-w-[110px]">Rate (₹)</th>
                  <th className="p-3 font-medium w-28 min-w-[90px]">Disc (₹)</th>
                  <th className="p-3 font-medium w-20 min-w-[70px]">GST %</th>
                  <th className="p-3 font-medium w-32 min-w-[120px]">Line Total</th>
                  <th className="p-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {items.map((item, index) => {
                  const qty = Number(item.qty) || 0;
                  const grossAmt = (qty * item.price) - (item.discount || 0);
                  const rate = item.gstRate || 0;
                  const taxable = (gstInclusive && rate > 0)
                    ? grossAmt / (1 + rate / 100)
                    : grossAmt;
                  const tax = (gstInclusive && rate > 0)
                    ? grossAmt - taxable
                    : grossAmt * (rate / 100);
                  return (
                    <tr key={index}>
                      <td className="p-2">
                        <ProductPicker
                          value={item.productId}
                          onChange={(id) => handleProductChange(index, id)}
                          products={products}
                        />
                      </td>
                      <td className="p-2 text-primary/40 text-xs text-center font-mono">{item.hsnCode || '—'}</td>
                      <td className="p-2">
                        <input type="number" min="1" required
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                          value={item.qty}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleQtyChange(index, e.target.value === '' ? '' : parseInt(e.target.value) || 0)} />
                      </td>
                      <td className="p-2 text-primary/60 text-sm">{formatCurrency(item.price)}</td>
                      <td className="p-2">
                        <input type="number" min="0" step="0.01"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                          value={item.discount || ''}
                          placeholder="0"
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[index].discount = parseFloat(e.target.value) || 0;
                            setItems(newItems);
                          }} />
                      </td>
                      <td className="p-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          item.gstRate > 0 ? "bg-violet-500/15 text-violet-300" : "text-primary/30"
                        }`}>
                          {item.gstRate > 0 ? `${item.gstRate}%` : "Nil"}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="text-primary font-medium text-sm">{formatCurrency(taxable + tax)}</div>
                        {item.gstRate > 0 && (
                          <div className="text-xs text-violet-400/70">
                            {gstInclusive ? `(incl. ${formatCurrency(tax)} GST)` : `+${formatCurrency(tax)} GST`}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button type="button" onClick={() => handleRemoveItem(index)}
                          className="p-1.5 text-primary/40 hover:text-rose-400 hover:bg-rose-400/10 rounded-md transition-colors"
                          disabled={items.length === 1}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="space-y-4">
            <FormField label="Notes / Terms">
              <textarea
                rows={2}
                placeholder="Quotation terms, valid dates, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 resize-none"
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--input-border)",
                  color: "var(--text-primary)",
                }}
              />
            </FormField>
          </div>

          <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--text-secondary)" }}>
                {gstInclusive ? "Taxable Value (excl. GST)" : "Taxable Value"}
              </span>
              <span style={{ color: "var(--text-primary)" }}>{formatCurrency(subtotal)}</span>
            </div>
            {hasGst && (
              <>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--text-secondary)" }}>Total GST</span>
                  <span className="text-violet-300">{formatCurrency(totalGst)}</span>
                </div>
                {placeOfSupply ? (
                  <div className="text-xs text-primary/40 pl-0">
                    {isInterState
                      ? `IGST: ${formatCurrency(totalGst)}`
                      : `CGST: ${formatCurrency(totalGst / 2)} + SGST: ${formatCurrency(totalGst - (totalGst / 2))}`}
                  </div>
                ) : null}
              </>
            )}
            <div className="h-px bg-primary/10 my-1" />
            <div className="flex justify-between">
              <span className="font-semibold text-primary">Grand Total</span>
              <span className="font-bold text-emerald-400 text-lg">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <ModalFooter onClose={handleClose} loading={loading} submitLabel="Generate Quotation" />
      </form>
      
      <AddCustomerModal open={isAddCustomerOpen} onClose={() => setIsAddCustomerOpen(false)} />
      <AddProductModal open={isAddProductOpen} onClose={() => setIsAddProductOpen(false)} />
    </Modal>
  );
}
