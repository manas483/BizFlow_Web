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
    name: "", sku: "", category: "Other", unit: "pcs", stock: "", minStock: "",
    purchasePrice: "", sellingPrice: "", supplier: "",
    hsnCode: "", gstRate: "0",
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
        stock: String(product.stock ?? 0),
        minStock: String(product.minStock ?? 5),
        purchasePrice: String(product.purchasePrice ?? 0),
        sellingPrice: String(product.sellingPrice ?? 0),
        supplier: product.supplier ?? "",
        hsnCode: product.hsnCode ?? "",
        gstRate: String(product.gstRate ?? 0),
      });
    }
  }, [product]);

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
        stock: parseInt(form.stock) || 0,
        minStock: parseInt(form.minStock) || 5,
        purchasePrice: parseFloat(form.purchasePrice) || 0,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        supplier: form.supplier || null,
        hsnCode: form.hsnCode || null,
        gstRate: parseFloat(form.gstRate) || 0,
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
          <FormField label="Product Name" required>
            <ModalInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="SKU / Barcode">
            <ModalInput value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Category">
            {/* Dynamic — driven by business type (e.g. Pharmacy shows medicines, not grains) */}
            <CustomSelect value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={categoriesList} />
          </FormField>
          <FormField label="Unit">
            {/* Dynamic — primary unit for the business type appears first */}
            <CustomSelect
              value={form.unit}
              onChange={(v) => setForm({ ...form, unit: v })}
              options={unitOptions}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Stock">
            <ModalInput type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </FormField>
          <FormField label="Low Stock Alert">
            <ModalInput type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <FormField label="Supplier">
            <ModalInput value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <FormField label="Purchase Price (₹)" required>
            <ModalInput type="number" required min="0" step="any" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
          </FormField>
          <FormField label="Selling Price (₹)" required>
            <ModalInput type="number" required min="0" step="any" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
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
