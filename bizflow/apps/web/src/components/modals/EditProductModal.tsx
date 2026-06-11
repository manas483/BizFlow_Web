"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/components/ui/Modal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Package } from "lucide-react";
import { useUpdateProduct } from "@/hooks/useProducts";
import { useBusiness } from "@/hooks/useBusiness";
import { getBusinessProfile } from "@/lib/business-intelligence";

const FALLBACK_CATEGORIES = [
  { value: "Grains", label: "Grains" },
  { value: "Pulses", label: "Pulses" },
  { value: "Edible Oil", label: "Edible Oil" },
  { value: "Spices", label: "Spices" },
  { value: "Construction", label: "Construction" },
  { value: "Other", label: "Other" },
];

export default function EditProductModal({ product, onClose }: { product: any; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", sku: "", category: "Other", unit: "pcs", unitsPerBag: "1", stock: "", minStock: "",
    basePurchasePrice: "", transportCost: "", purchasePrice: "", sellingPrice: "", supplier: "",
    hsnCode: "", gstRate: "0",
    purchaseDate: "", purchaseFrom: "", purchaseInvoiceNo: "",
  });

  const { data: business } = useBusiness();
  const profile = business ? getBusinessProfile(business.businessType) : null;
  const primaryUnit = profile?.primaryUnit || "pcs";

  // Build dynamic categories from business profile
  const categoriesList = profile
    ? [...profile.productCategories, "Other"].map(c => ({ value: c, label: c }))
    : FALLBACK_CATEGORIES;

  // Build dynamic unit options, sorted by the business's primary unit first
  const unitOptions = [
    { value: "pcs", label: "Pieces (pcs)" },
    { value: "kg", label: "Kilograms (kg)" },
    { value: "gm", label: "Grams (gm)" },
    { value: "L", label: "Liters (L)" },
    { value: "pack", label: "Pack" },
    { value: "box", label: "Box" },
    { value: "strip", label: "Strip" },
    { value: "bag", label: "Bag" },
    { value: "tin", label: "Tin" },
  ].sort((a, b) => a.value === primaryUnit ? -1 : b.value === primaryUnit ? 1 : 0);

  // Pre-fill form with product's existing data when the product changes
  useEffect(() => {
    if (product) {
      setForm({
        name: product.name ?? "",
        sku: product.sku ?? "",
        category: product.category ?? (categoriesList[0]?.value ?? "Other"),
        unit: product.unit ?? primaryUnit,
        unitsPerBag: String(product.unitsPerBag ?? 1),
        stock: String(product.stock ?? 0),
        minStock: String(product.minStock ?? 5),
        basePurchasePrice: String(product.basePurchasePrice ?? 0),
        transportCost: String(product.transportCost ?? 0),
        purchasePrice: String(product.purchasePrice ?? 0),
        sellingPrice: String(product.sellingPrice ?? 0),
        supplier: product.supplier ?? "",
        hsnCode: product.hsnCode ?? "",
        gstRate: String(product.gstRate ?? 0),
        purchaseDate: product.purchaseDate ? new Date(product.purchaseDate).toISOString().split('T')[0] : "",
        purchaseFrom: product.purchaseFrom ?? "",
        purchaseInvoiceNo: product.purchaseInvoiceNo ?? "",
      });
    }
  }, [product]);

  // Auto-calculate purchase price (After) = basePurchasePrice (Before) + transportCost
  useEffect(() => {
    const base = parseFloat(form.basePurchasePrice) || 0;
    const transport = parseFloat(form.transportCost) || 0;
    if (base > 0 || transport > 0) {
      setForm(f => ({ ...f, purchasePrice: (base + transport).toFixed(2) }));
    }
  }, [form.basePurchasePrice, form.transportCost]);

  const updateProduct = useUpdateProduct();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProduct.mutateAsync({
        id: product.id,
        name: form.name,
        sku: form.sku,
        category: form.category,
        unit: form.unit,
        unitsPerBag: parseInt(form.unitsPerBag) || 1,
        stock: parseInt(form.stock) || 0,
        minStock: parseInt(form.minStock) || 5,
        basePurchasePrice: parseFloat(form.basePurchasePrice) || 0,
        transportCost: parseFloat(form.transportCost) || 0,
        purchasePrice: parseFloat(form.purchasePrice) || 0,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        supplier: form.supplier || null,
        hsnCode: form.hsnCode || null,
        gstRate: parseFloat(form.gstRate) || 0,
        purchaseDate: form.purchaseDate || null,
        purchaseFrom: form.supplier || null,
        purchaseInvoiceNo: form.purchaseInvoiceNo || null,
      });
      onClose();
    } catch { toast.error("Failed to update product"); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={!!product} onClose={onClose}
      title="Edit Product" subtitle="Update product details"
      icon={<Package size={18} />} iconColor="bg-violet-500/20 text-violet-400" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Item Name" required>
            <ModalInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Item Code / Barcode">
            <ModalInput value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Category">
            {/* Dynamic — driven by business type (e.g. Pharmacy shows medicines, not grains) */}
            <CustomSelect value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={categoriesList} />
          </FormField>
          <FormField label="Unit of Measure (UOM)">
            {/* Dynamic — primary unit for the business type appears first */}
            <CustomSelect
              value={form.unit}
              onChange={(v) => setForm({ ...form, unit: v })}
              options={unitOptions}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Opening Stock">
            <ModalInput type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </FormField>
          <FormField label="Reorder Level">
            <ModalInput type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          </FormField>
          <FormField label="Pack Size">
            <ModalInput type="number" min="1" value={form.unitsPerBag} onChange={(e) => setForm({ ...form, unitsPerBag: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <FormField label="Supplier / Vendor">
            <ModalInput value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </FormField>
          <FormField label="Purchase Date">
            <ModalInput type="date" value={form.purchaseDate}
              onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
          </FormField>
          <FormField label="Invoice Number">
            <ModalInput value={form.purchaseInvoiceNo}
              onChange={(e) => setForm({ ...form, purchaseInvoiceNo: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <FormField label="Purchase Cost (₹/Unit)">
            <ModalInput type="number" min="0" step="any" value={form.basePurchasePrice}
              onChange={(e) => setForm({ ...form, basePurchasePrice: e.target.value })} />
          </FormField>
          <FormField label="Additional Cost (₹/Unit)">
            <ModalInput type="number" min="0" step="any" value={form.transportCost}
              onChange={(e) => setForm({ ...form, transportCost: e.target.value })} />
          </FormField>
          <FormField label="Landed Cost (₹/Unit)">
            <ModalInput type="number" min="0" step="any" value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
            <p className="text-[10px] text-primary/30 mt-0.5">Purchase Cost + Additional Cost</p>
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <FormField label="Selling Price (₹/Unit)">
            <ModalInput type="number" min="0" step="any" value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="HSN/SAC Code">
            <ModalInput value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} />
          </FormField>
          <FormField label="GST Rate (%)">
            <CustomSelect
              value={form.gstRate}
              onChange={(v) => setForm({ ...form, gstRate: v })}
              options={[
                { value: "0", label: "0% - Tax Free" },
                { value: "5", label: "5%" },
                { value: "12", label: "12%" },
                { value: "18", label: "18%" },
                { value: "28", label: "28%" },
              ]}
            />
          </FormField>
        </div>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Save Changes" />
      </form>
    </Modal>
  );
}
