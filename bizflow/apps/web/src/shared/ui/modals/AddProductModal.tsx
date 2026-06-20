"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/shared/ui/ui/Modal";
import { CustomSelect } from "@/shared/ui/ui/CustomSelect";
import { Package, Calendar } from "lucide-react";
import { useCreateProduct } from "@/shared/hooks/useProducts";
import { useBusiness } from "@/shared/hooks/useBusiness";
import { getBusinessProfile } from "@/shared/lib/business-intelligence";

const CATEGORIES = [
  { value: "Grains", label: "Grains" },
  { value: "Pulses", label: "Pulses" },
  { value: "Edible Oil", label: "Edible Oil" },
  { value: "Spices", label: "Spices" },
  { value: "Construction", label: "Construction" },
  { value: "Other", label: "Other" },
];

export default function AddProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", sku: "", category: "Grains", unit: "pcs", noOfBags: "", unitsPerBag: "1", stock: "", minStock: "",
    basePurchasePrice: "", transportCost: "", purchasePrice: "", sellingPrice: "", supplier: "",
    hsnCode: "", gstRate: "0",
    purchaseDate: "", purchaseFrom: "", purchaseInvoiceNo: "",
    reorderLevel: "", preferredSupplier: "",
  });

  // Bidirectional calculations for Bags, Packets in 1 Bag, and Stock
  const handleBagsChange = (bagsVal: string) => {
    const bags = parseFloat(bagsVal) || 0;
    const perBag = parseFloat(form.unitsPerBag) || 1;
    setForm(f => ({
      ...f,
      noOfBags: bagsVal,
      stock: bagsVal ? String(Math.round(bags * perBag)) : ""
    }));
  };

  const handleUnitsPerBagChange = (perBagVal: string) => {
    const perBag = parseFloat(perBagVal) || 1;
    const bags = parseFloat(form.noOfBags) || 0;
    setForm(f => ({
      ...f,
      unitsPerBag: perBagVal,
      stock: form.noOfBags ? String(Math.round(bags * perBag)) : f.stock
    }));
  };

  const handleStockChange = (stockVal: string) => {
    const stock = parseFloat(stockVal) || 0;
    const perBag = parseFloat(form.unitsPerBag) || 1;
    setForm(f => ({
      ...f,
      stock: stockVal,
      noOfBags: stockVal ? String(Number((stock / perBag).toFixed(2))) : ""
    }));
  };

  // Auto-calculate purchase price (After) = basePurchasePrice (Before) + transportCost
  useEffect(() => {
    const base = parseFloat(form.basePurchasePrice) || 0;
    const transport = parseFloat(form.transportCost) || 0;
    if (base > 0 || transport > 0) {
      setForm(f => ({ ...f, purchasePrice: (base + transport).toFixed(2) }));
    }
  }, [form.basePurchasePrice, form.transportCost]);

  const createProduct = useCreateProduct();
  const { data: business } = useBusiness();

  const profile = business ? getBusinessProfile(business.businessType) : null;
  const primaryUnit = profile?.primaryUnit || "pcs";

  // Auto-set the primary unit when the profile loads (if the user hasn't changed it)
  useEffect(() => {
    if (primaryUnit && form.unit === "pcs") {
      setForm(f => ({ ...f, unit: primaryUnit }));
    }
  }, [primaryUnit]);
  const categoriesList = profile 
    ? [...profile.productCategories, "Other"].map(c => ({ value: c, label: c }))
    : CATEGORIES;

  // Dynamic placeholders
  const sampleProduct = profile?.seedProducts?.[0] ?? {
    name: "Basmati Rice (25kg)",
    sku: "GR-001",
    hsnCode: "1005"
  };
  const sampleSupplier = profile?.displayName ? `${profile.displayName.split(' ')[0]} Distributors` : "Agro Traders";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createProduct.mutateAsync({
        ...form,
        stock: parseInt(form.stock) || 0,
        minStock: parseInt(form.minStock) || 0,
        unitsPerBag: parseInt(form.unitsPerBag) || 1,
        basePurchasePrice: parseFloat(form.basePurchasePrice) || 0,
        transportCost: parseFloat(form.transportCost) || 0,
        purchasePrice: parseFloat(form.purchasePrice) || 0,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        gstRate: parseFloat(form.gstRate) || 0,
        purchaseDate: form.purchaseDate || null,
        purchaseFrom: form.supplier || null,
        purchaseInvoiceNo: form.purchaseInvoiceNo || null,
        reorderLevel: parseInt(form.reorderLevel) || 0,
        preferredSupplier: form.preferredSupplier || null,
      });
      setForm({ name: "", sku: "", category: "Grains", unit: "pcs", noOfBags: "", unitsPerBag: "1", stock: "", minStock: "", basePurchasePrice: "", transportCost: "", purchasePrice: "", sellingPrice: "", supplier: "", hsnCode: "", gstRate: "0", purchaseDate: "", purchaseFrom: "", purchaseInvoiceNo: "", reorderLevel: "", preferredSupplier: "" });
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open} onClose={onClose}
      title="Add New Product" subtitle="Create a new product in your inventory"
      icon={<Package size={18} />} iconColor="bg-violet-500/20 text-violet-400" size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Item Name" required>
            <ModalInput required placeholder={`e.g. ${sampleProduct.name}`} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Item Code / Barcode">
            <ModalInput placeholder={`e.g. ${sampleProduct.sku}`} value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Category">
            <CustomSelect
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              options={categoriesList}
            />
          </FormField>
          <FormField label="Unit of Measure (UOM)">
            <CustomSelect
              value={form.unit}
              onChange={(v) => setForm({ ...form, unit: v })}
              options={unitOptions}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Opening Stock" required>
            <ModalInput type="number" required min="0" placeholder="0" value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </FormField>
          <FormField label="Min Stock Alert">
            <ModalInput type="number" min="0" placeholder="10" value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          </FormField>
          <FormField label="Pack Size">
            <ModalInput type="number" min="1" placeholder="1" value={form.unitsPerBag}
              onChange={(e) => setForm({ ...form, unitsPerBag: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Reorder Level" hint="Stock level that triggers auto reorder alert">
            <ModalInput type="number" min="0" placeholder="e.g. 20" value={form.reorderLevel}
              onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
          </FormField>
          <FormField label="Preferred Supplier" hint="Auto-suggested in reorder alerts">
            <ModalInput placeholder="e.g. ABC Distributors" value={form.preferredSupplier}
              onChange={(e) => setForm({ ...form, preferredSupplier: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <FormField label="Supplier / Vendor">
            <ModalInput placeholder={`e.g. ${sampleSupplier}`} value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </FormField>
          <FormField label="Purchase Date">
            <ModalInput type="date" placeholder="YYYY-MM-DD" value={form.purchaseDate}
              onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
          </FormField>
          <FormField label="Invoice Number">
            <ModalInput placeholder="e.g. INV-001" value={form.purchaseInvoiceNo}
              onChange={(e) => setForm({ ...form, purchaseInvoiceNo: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <FormField label="Purchase Cost (₹/Unit)">
            <ModalInput type="number" min="0" step="any" placeholder="0.00" value={form.basePurchasePrice}
              onChange={(e) => setForm({ ...form, basePurchasePrice: e.target.value })} />
          </FormField>
          <FormField label="Additional Cost (₹/Unit)">
            <ModalInput type="number" min="0" step="any" placeholder="0.00" value={form.transportCost}
              onChange={(e) => setForm({ ...form, transportCost: e.target.value })} />
          </FormField>
          <FormField label="Landed Cost (₹/Unit)">
            <ModalInput type="number" min="0" step="any" placeholder="Auto-calculated" value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
            <p className="text-[10px] text-primary/30 mt-0.5">Purchase Cost + Additional Cost</p>
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <FormField label="Selling Price (₹/Unit)">
            <ModalInput type="number" min="0" step="any" placeholder="0.00" value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="HSN/SAC Code">
            <ModalInput placeholder={`e.g. ${sampleProduct.hsnCode || "1005"}`} value={form.hsnCode}
              onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} />
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

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Add Product" />
      </form>
    </Modal>
  );
}
