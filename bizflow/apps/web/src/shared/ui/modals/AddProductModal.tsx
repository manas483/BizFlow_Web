"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/shared/ui/ui/Modal";
import { CustomSelect } from "@/shared/ui/ui/CustomSelect";
import { Package, Calendar, Plus, Trash2, Scale } from "lucide-react";
import { useCreateProduct, useProductCategories } from "@/shared/hooks/useProducts";
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
    standardCost: "", sellingPrice: "", supplier: "",
    hsnCode: "", gstRate: "0",
    purchaseDate: "", purchaseFrom: "", purchaseInvoiceNo: "",
    reorderLevel: "", preferredSupplier: "",
    allowLooseSale: false,
    baseUnit: "",
  });

  // Packaging variants state for loose sale products
  interface PackagingRow {
    label: string; unit: string; conversionFactor: string;
    defaultPrice: string; isPurchaseUnit: boolean; isLoose: boolean; isDefault: boolean;
  }
  const emptyPkg = (): PackagingRow => ({ label: "", unit: "", conversionFactor: "", defaultPrice: "", isPurchaseUnit: false, isLoose: false, isDefault: false });
  const [packagingRows, setPackagingRows] = useState<PackagingRow[]>([]);

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
  const { data: dbCategories } = useProductCategories();
  const profileCats = profile ? profile.productCategories : CATEGORIES.map(c => c.value);
  const mergedCategories = Array.from(new Set([...(dbCategories || []), ...profileCats, "Other"]));
  
  const categoriesList = mergedCategories.map(c => ({ value: c, label: c }));

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
      // Build packaging options for loose-enabled products
      const finalBaseUnit = form.allowLooseSale ? (form.baseUnit || "Kg") : null;
      
      const packagingOptions = form.allowLooseSale
        ? packagingRows.filter(p => p.label && p.conversionFactor).map((p, i) => ({
            label: p.label,
            unit: p.unit || finalBaseUnit,
            conversionFactor: parseFloat(p.conversionFactor) || 1,
            defaultPrice: p.defaultPrice ? parseFloat(p.defaultPrice) : null,
            isPurchaseUnit: p.isPurchaseUnit,
            isLoose: p.isLoose,
            isDefault: p.isDefault,
            sortOrder: i,
          }))
        : undefined;

      await createProduct.mutateAsync({
        ...form,
        stock: parseInt(form.stock) || 0,
        minStock: parseInt(form.minStock) || 0,
        unitsPerBag: parseInt(form.unitsPerBag) || 1,
        standardCost: parseFloat(form.standardCost) || 0,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        gstRate: parseFloat(form.gstRate) || 0,
        purchaseDate: form.purchaseDate || null,
        purchaseFrom: form.supplier || null,
        purchaseInvoiceNo: form.purchaseInvoiceNo || null,
        reorderLevel: parseInt(form.reorderLevel) || 0,
        preferredSupplier: form.preferredSupplier || null,
        allowLooseSale: form.allowLooseSale,
        baseUnit: finalBaseUnit,
        packagingOptions,
      });
      setForm({ name: "", sku: "", category: "Grains", unit: "pcs", noOfBags: "", unitsPerBag: "1", stock: "", minStock: "", standardCost: "", sellingPrice: "", supplier: "", hsnCode: "", gstRate: "0", purchaseDate: "", purchaseFrom: "", purchaseInvoiceNo: "", reorderLevel: "", preferredSupplier: "", allowLooseSale: false, baseUnit: "" });
      setPackagingRows([]);
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <FormField label="Standard Cost (₹/Unit)">
            <ModalInput type="number" min="0" step="any" placeholder="0.00" value={form.standardCost}
              onChange={(e) => setForm({ ...form, standardCost: e.target.value })} />
            <p className="text-[10px] text-primary/30 mt-0.5">Used for valuation fallback only.</p>
          </FormField>
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

        {/* ── Loose Sale Configuration ── */}
        <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => {
                const next = !form.allowLooseSale;
                setForm(f => ({ ...f, allowLooseSale: next }));
                if (next && packagingRows.length === 0) {
                  setPackagingRows([
                    { label: "50 Kg Bag", unit: "Bag", conversionFactor: "50", defaultPrice: "", isPurchaseUnit: true, isLoose: false, isDefault: true },
                    { label: "Loose", unit: "Kg", conversionFactor: "1", defaultPrice: "", isPurchaseUnit: false, isLoose: true, isDefault: false },
                  ]);
                  if (!form.baseUnit) setForm(f => ({ ...f, allowLooseSale: true, baseUnit: "Kg" }));
                }
              }}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                form.allowLooseSale ? "bg-violet-500" : "bg-white/10"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                form.allowLooseSale ? "translate-x-5" : ""
              }`} />
            </button>
            <div className="flex items-center gap-2">
              <Scale size={14} className="text-violet-400" />
              <span className="text-sm font-medium">Allow Loose Sale</span>
            </div>
            <span className="text-xs text-primary/40">Sell in fractional units (Kg, Liter, g, ml)</span>
          </div>

          {form.allowLooseSale && (
            <div className="space-y-3 pl-2 border-l-2 border-violet-500/30 ml-2">
              <FormField label="Base Unit" hint="Smallest unit for this product (Kg, Liter, g, ml)">
                <CustomSelect
                  value={form.baseUnit}
                  onChange={(v) => setForm({ ...form, baseUnit: v })}
                  options={[
                    { value: "Kg", label: "Kilograms (Kg)" },
                    { value: "g", label: "Grams (g)" },
                    { value: "Liter", label: "Liters (L)" },
                    { value: "ml", label: "Milliliters (ml)" },
                  ]}
                />
              </FormField>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-primary/60">Packaging Variants</label>
                  <button
                    type="button"
                    onClick={() => setPackagingRows([...packagingRows, emptyPkg()])}
                    className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Variant
                  </button>
                </div>

                {packagingRows.map((pkg, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_80px_80px_auto] gap-2 items-end">
                    <ModalInput
                      placeholder="e.g. 50 Kg Bag"
                      value={pkg.label}
                      onChange={(e) => {
                        const rows = [...packagingRows];
                        rows[idx] = { ...rows[idx], label: e.target.value };
                        setPackagingRows(rows);
                      }}
                    />
                    <ModalInput
                      type="number" min="0" step="any"
                      placeholder="Factor"
                      title="Conversion factor (1 of this = N base units)"
                      value={pkg.conversionFactor}
                      onChange={(e) => {
                        const rows = [...packagingRows];
                        rows[idx] = { ...rows[idx], conversionFactor: e.target.value };
                        setPackagingRows(rows);
                      }}
                    />
                    <ModalInput
                      type="number" min="0" step="any"
                      placeholder="₹ Price"
                      title="Default selling price (optional)"
                      value={pkg.defaultPrice}
                      onChange={(e) => {
                        const rows = [...packagingRows];
                        rows[idx] = { ...rows[idx], defaultPrice: e.target.value };
                        setPackagingRows(rows);
                      }}
                    />
                    <div className="flex items-center gap-1">
                      <label className="flex items-center gap-1 text-[10px] text-primary/50" title="Primary purchase unit">
                        <input
                          type="radio" name="purchaseUnit" checked={pkg.isPurchaseUnit}
                          onChange={() => {
                            const rows = packagingRows.map((r, i) => ({ ...r, isPurchaseUnit: i === idx }));
                            setPackagingRows(rows);
                          }}
                        />
                        Buy
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-primary/50" title="Loose variant">
                        <input
                          type="checkbox" checked={pkg.isLoose}
                          onChange={(e) => {
                            const rows = [...packagingRows];
                            rows[idx] = { ...rows[idx], isLoose: e.target.checked };
                            setPackagingRows(rows);
                          }}
                        />
                        Loose
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPackagingRows(packagingRows.filter((_, i) => i !== idx))}
                      className="text-red-400/60 hover:text-red-400 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {packagingRows.length === 0 && (
                  <p className="text-xs text-primary/30 italic">No packaging variants. Click "Add Variant" to define pack sizes.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Add Product" />
      </form>
    </Modal>
  );
}
