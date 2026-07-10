"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/shared/ui/ui/Modal";
import { CustomSelect } from "@/shared/ui/ui/CustomSelect";
import { Package, Plus, Trash2, Scale } from "lucide-react";
import { useUpdateProduct, useProductCategories } from "@/shared/hooks/useProducts";
import { useBusiness } from "@/shared/hooks/useBusiness";
import { getBusinessProfile } from "@/shared/lib/business-intelligence";
import { formatCurrency } from "@/shared/lib/utils";

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
    standardCost: "", sellingPrice: "", supplier: "",
    hsnCode: "", gstRate: "0",
    purchaseDate: "", purchaseFrom: "", purchaseInvoiceNo: "",
    purchaseCost: "0", additionalCost: "0", landedCost: "0", activeLayersCount: 0, activeLayerQty: 0,
    allowLooseSale: false, baseUnit: ""
  });

  // Packaging variants state for loose sale products
  interface PackagingRow {
    id?: string; label: string; unit: string; conversionFactor: string;
    defaultPrice: string; isPurchaseUnit: boolean; isLoose: boolean; isDefault: boolean;
  }
  const emptyPkg = (): PackagingRow => ({ label: "", unit: "", conversionFactor: "", defaultPrice: "", isPurchaseUnit: false, isLoose: false, isDefault: false });
  const [packagingRows, setPackagingRows] = useState<PackagingRow[]>([]);

  const { data: business } = useBusiness();
  const profile = business ? getBusinessProfile(business.businessType) : null;
  const primaryUnit = profile?.primaryUnit || "pcs";

  const { data: dbCategories } = useProductCategories();
  const profileCats = profile ? profile.productCategories : FALLBACK_CATEGORIES.map(c => c.value);
  const mergedCategories = Array.from(new Set([...(dbCategories || []), ...profileCats, "Other"]));

  // Build dynamic categories from business profile
  const categoriesList = mergedCategories.map(c => ({ value: c, label: c }));

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
        standardCost: String(product.standardCost ?? 0),
        sellingPrice: String(product.sellingPrice ?? 0),
        supplier: product.supplier ?? "",
        hsnCode: product.hsnCode ?? "",
        gstRate: String(product.gstRate ?? 0),
        purchaseDate: product.purchaseDate ? new Date(product.purchaseDate).toISOString().split('T')[0] : "",
        purchaseFrom: product.purchaseFrom ?? "",
        purchaseInvoiceNo: product.purchaseInvoiceNo ?? "",
        purchaseCost: String(product.purchaseCost ?? 0),
        additionalCost: String(product.additionalCost ?? 0),
        landedCost: String(product.landedCost ?? 0),
        activeLayersCount: Number(product.activeLayersCount ?? 0),
        activeLayerQty: Number(product.activeLayerQty ?? 0),
        allowLooseSale: product.allowLooseSale ?? false,
        baseUnit: product.baseUnit ?? "",
      });
      if (product.allowLooseSale && product.packagingOptions && product.packagingOptions.length > 0) {
        let rows = product.packagingOptions.map((p: any) => ({
          id: p.id,
          label: p.label,
          unit: p.unit,
          conversionFactor: String(p.conversionFactor),
          defaultPrice: p.defaultPrice !== null ? String(p.defaultPrice) : "",
          isPurchaseUnit: p.isPurchaseUnit,
          isLoose: p.isLoose,
          isDefault: p.isDefault
        }));
        
        // Backwards compatibility: If no row is set as the purchase unit, auto-select the first non-loose row (or the first row)
        if (!rows.some((r: any) => r.isPurchaseUnit)) {
          const firstNonLoose = rows.findIndex((r: any) => !r.isLoose);
          if (firstNonLoose >= 0) rows[firstNonLoose].isPurchaseUnit = true;
          else rows[0].isPurchaseUnit = true;
        }
        
        setPackagingRows(rows);
      } else {
        setPackagingRows([]);
      }
    }
  }, [product]);



  const updateProduct = useUpdateProduct();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const finalBaseUnit = form.allowLooseSale ? (form.baseUnit || "Kg") : null;

      const packagingOptions = form.allowLooseSale
        ? packagingRows.filter(p => p.label && p.conversionFactor).map((p, i) => ({
            id: p.id,
            label: p.label,
            // Loose variants use the base unit (Kg, Liter, etc.);
            // non-loose variants default to "Bag" if no explicit unit is set.
            unit: p.unit || (p.isLoose ? finalBaseUnit : 'Bag'),
            conversionFactor: parseFloat(p.conversionFactor) || 1,
            defaultPrice: p.defaultPrice ? parseFloat(p.defaultPrice) : null,
            isPurchaseUnit: p.isPurchaseUnit,
            isLoose: p.isLoose,
            isDefault: p.isDefault,
            sortOrder: i,
          }))
        : undefined;

      await updateProduct.mutateAsync({
        id: product.id,
        name: form.name,
        sku: form.sku,
        category: form.category,
        unit: form.unit,
        unitsPerBag: parseInt(form.unitsPerBag) || 1,
        stock: parseInt(form.stock) || 0,
        minStock: parseInt(form.minStock) || 5,
        standardCost: parseFloat(form.standardCost) || 0,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        supplier: form.supplier || null,
        hsnCode: form.hsnCode || null,
        gstRate: parseFloat(form.gstRate) || 0,
        purchaseDate: form.purchaseDate || null,
        purchaseFrom: form.supplier || null,
        purchaseInvoiceNo: form.purchaseInvoiceNo || null,
        allowLooseSale: form.allowLooseSale,
        baseUnit: finalBaseUnit,
        packagingOptions,
      });
      onClose();
    } catch (err: any) { toast.error(err?.message || "Failed to update product"); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={!!product} onClose={onClose}
      title="Edit Product" subtitle="Update product details"
      icon={<Package size={18} />} iconColor="bg-violet-500/20 text-violet-400" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Item Name" required>
            <ModalInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Item Code / Barcode">
            <ModalInput value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label={product?.allowLooseSale ? "Stock (Read-only for loose products)" : "Opening Stock"}>
            <ModalInput type="number" min="0" value={form.stock} disabled={product?.allowLooseSale} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </FormField>
          <FormField label="Reorder Level">
            <ModalInput type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          </FormField>
          <FormField label="Pack Size">
            <ModalInput type="number" min="1" value={form.unitsPerBag} onChange={(e) => setForm({ ...form, unitsPerBag: e.target.value })} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <FormField label="Current Standard Cost (WAC) (Read Only)">
            <div className="bg-primary/5 px-3.5 py-2.5 rounded-xl border border-primary/10 text-primary font-semibold text-sm">
              {formatCurrency(Number(form.standardCost))}
            </div>
            <p className="text-[10px] text-primary/30 mt-0.5">Used for valuation fallback only.</p>
          </FormField>
          <FormField label="Selling Price (₹/Unit)">
            <ModalInput type="number" min="0" step="any" value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
          </FormField>
        </div>

        {/* Dynamic Averages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <FormField label="Purchase Cost (Avg)">
            <ModalInput disabled className="opacity-60 cursor-not-allowed" value={formatCurrency(Number(form.purchaseCost))} onChange={() => {}} />
          </FormField>
          <FormField label="Additional Cost (Avg)">
            <ModalInput disabled className="opacity-60 cursor-not-allowed" value={formatCurrency(Number(form.additionalCost))} onChange={() => {}} />
          </FormField>
          <FormField label="Landed Cost (Avg)">
            <ModalInput disabled className="opacity-60 cursor-not-allowed" value={formatCurrency(Number(form.landedCost))} onChange={() => {}} />
          </FormField>
        </div>
        {Number(form.activeLayersCount) > 0 ? (
          <p className="text-[11px] text-primary/40 mt-1">
            Calculated from {form.activeLayersCount} active inventory layer{Number(form.activeLayersCount) > 1 ? 's' : ''} ({form.activeLayerQty} units)
          </p>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  if (!form.baseUnit) setForm(f => ({ ...f, baseUnit: "Kg" }));
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

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Save Changes" />
      </form>
    </Modal>
  );
}
