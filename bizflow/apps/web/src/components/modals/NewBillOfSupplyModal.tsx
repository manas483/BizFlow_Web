"use client";
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/components/ui/Modal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { FileMinus, Plus, Trash2, ChevronDown } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { useProducts } from "@/hooks/useProducts";
import { useCreateBillOfSupply } from "@/hooks/useInvoiceDocs";
import { formatCurrency } from "@/lib/utils";

function ProductPicker({ value, onChange, products }: any) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const selected = products.find((p: any) => p.id === value);
  return (
    <div className="relative">
      <button ref={btnRef} type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm text-left transition-all border border-primary/10 bg-primary/5">
        <span className="truncate">{selected ? selected.name : "Select product..."}</span>
        <ChevronDown size={12} className="text-primary/40" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full z-50 bg-[#1e1b4b] border border-primary/10 rounded-lg shadow-xl max-h-40 overflow-y-auto">
          {products.map((p: any) => (
            <button key={p.id} type="button" onClick={() => { onChange(p.id); setOpen(false); }}
              className="w-full flex justify-between px-3 py-2 text-xs text-left hover:bg-white/5">
              <span>{p.name}</span>
              <span className="text-primary/40">₹{p.sellingPrice}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewBillOfSupplyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState("");
  const [supplyType, setSupplyType] = useState("exempt");
  const [items, setItems] = useState([{ productId: "", qty: 1 as number | string, price: 0 }]);
  const [paid, setPaid] = useState("");
  const [notes, setNotes] = useState("");

  const { data: customersPaged } = useCustomers(undefined, 1, 100);
  const customers = customersPaged?.data ?? [];
  const { data: productsPaged } = useProducts(undefined, undefined, 1, 100);
  const products = productsPaged?.data ?? [];
  const createBill = useCreateBillOfSupply();

  const customerOptions = customers.map((c: any) => ({ value: c.id, label: c.name }));
  const typeOptions = [
    { value: "exempt", label: "Exempt Goods/Services" },
    { value: "composition", label: "Composition Scheme Supplier" }
  ];

  const handleProductChange = (idx: number, id: string) => {
    const p = products.find((x: any) => x.id === id);
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], productId: id, price: p?.sellingPrice || 0 };
    setItems(newItems);
  };

  const total = items.reduce((s, i) => s + (Number(i.qty) || 0) * i.price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || items.some(i => !i.productId)) { toast.error("Missing required fields"); return; }
    setLoading(true);
    try {
      await createBill.mutateAsync({
        customerId: customer,
        supplyType,
        items,
        paid: parseFloat(paid) || 0,
        notes,
      });
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Failed to create bill");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Bill of Supply" subtitle="Issue a non-GST document for exempt supplies or composition dealers" icon={<FileMinus size={18} />} iconColor="bg-blue-500/20 text-blue-400" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Customer" required>
            <CustomSelect value={customer} onChange={setCustomer} options={customerOptions} placeholder="Select customer..." />
          </FormField>
          <FormField label="Supply Type" required>
            <CustomSelect value={supplyType} onChange={setSupplyType} options={typeOptions} />
          </FormField>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-primary/60">Items</label>
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex-1"><ProductPicker value={item.productId} onChange={(id: string) => handleProductChange(idx, id)} products={products} /></div>
              <ModalInput type="number" min="1" value={item.qty} onFocus={(e: any) => e.target.select()} onChange={(e) => { const n = [...items]; n[idx].qty = e.target.value === '' ? '' : parseInt(e.target.value) || 0; setItems(n); }} style={{ width: '80px' }} />
              <div className="w-20 text-right text-sm text-primary font-medium">{formatCurrency((Number(item.qty) || 0) * item.price)}</div>
              <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} disabled={items.length === 1} className="p-2 text-rose-400 hover:bg-rose-400/10 rounded"><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setItems([...items, { productId: "", qty: 1, price: 0 }])} className="text-xs text-blue-400 flex items-center gap-1 mt-2"><Plus size={14} /> Add Item</button>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-primary/10">
          <FormField label="Amount Paid (₹)">
            <ModalInput type="number" min="0" max={total} value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0.00" />
          </FormField>
          <div className="text-right pt-4">
            <div className="text-sm text-primary/60 mb-1">Grand Total</div>
            <div className="text-xl font-bold text-blue-400">{formatCurrency(total)}</div>
          </div>
        </div>
        
        <FormField label="Notes">
          <ModalInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
        </FormField>
        
        <ModalFooter onClose={onClose} loading={loading} submitLabel="Generate Bill of Supply" />
      </form>
    </Modal>
  );
}
