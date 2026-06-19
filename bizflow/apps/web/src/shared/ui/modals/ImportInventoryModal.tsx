"use client";

import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/shared/ui/ui/Modal";
import { Button } from "@/shared/ui/ui/Button";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle,
  AlertTriangle, RotateCcw, ChevronDown, ChevronUp, Loader2,
  FileText, Pencil, Trash2, Plus
} from "lucide-react";
import { useBusiness } from "@/shared/hooks/useBusiness";
import { getBusinessProfile } from "@/shared/lib/business-intelligence";

type Step = "upload" | "validating" | "review" | "importing" | "done";

interface ValidationSummary {
  total: number; valid: number; errors: number; warnings: number; duplicates: number;
}
interface RowError { row: number; column: string; message: string; severity: "error" | "warning"; }
interface ImportResults { created: number; updated: number; skipped: number; failed: number; }

interface InvoiceProduct {
  name: string; sku: string; category: string;
  stock: number; unitsPerBag: number;
  basePurchasePrice: number; transportCost: number;
  purchasePrice: number; sellingPrice: number;
  unit: string; supplier: string;
  purchaseInvoiceNo: string; purchaseDate: string;
  gstRate: number; hsnCode: string;
}

interface InvoiceInfo {
  invoiceNumber: string; supplier: string; purchaseDate: string;
}

export default function ImportInventoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const { data: business } = useBusiness();
  const profile = business ? getBusinessProfile(business.businessType) : null;
  const categoriesList = profile 
    ? [...profile.productCategories, "Other"]
    : ["Grains", "Pulses", "Edible Oil", "Spices", "Construction", "Other"];

  // Validation state (Excel)
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [warnings, setWarnings] = useState<RowError[]>([]);
  const [showErrors, setShowErrors] = useState(true);
  const [showWarnings, setShowWarnings] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});

  // PDF Invoice state
  const [isInvoicePdf, setIsInvoicePdf] = useState(false);
  const [invoiceInfo, setInvoiceInfo] = useState<InvoiceInfo | null>(null);
  const [invoiceProducts, setInvoiceProducts] = useState<InvoiceProduct[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // Import state
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const reset = () => {
    setStep("upload"); setFile(null); setValidationSummary(null);
    setErrors([]); setWarnings([]); setImportResults(null);
    setImportError(null); setProgress(0); setColumnMapping({});
    setUnmapped([]); setSuggestions({});
    setIsInvoicePdf(false); setInvoiceInfo(null); setInvoiceProducts([]);
    setEditingIdx(null);
  };

  const handleClose = () => { reset(); onClose(); };

  // Download template
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await fetch("/api/inventory/import/template");
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="(.+)"/);
      const name = match?.[1] ?? "BizFlow_Inventory_Template.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast.error("Failed to download template. Please try again."); }
    finally { setDownloadingTemplate(false); }
  };

  const processFile = useCallback(async (f: File) => {
    setFile(f); setStep("validating"); setProgress(20);
    try {
      const fd = new FormData();
      fd.append("file", f); fd.append("mode", "validate");
      setProgress(50);
      const res = await fetch("/api/inventory/import", { method: "POST", body: fd });
      const data = await res.json();
      setProgress(100);
      if (!res.ok) { setImportError(data.error ?? "Validation failed"); setStep("upload"); return; }

      if (data.isInvoicePdf) {
        // PDF Invoice flow
        setIsInvoicePdf(true);
        setInvoiceInfo(data.invoiceInfo);
        const products: InvoiceProduct[] = (data.validation?.processedRows ?? []).map((r: any) => ({
          name: r.data.name ?? "",
          sku: r.data.sku ?? "",
          category: r.data.category ?? "",
          stock: Number(r.data.stock ?? 0),
          unitsPerBag: Number(r.data.unitsPerBag ?? 1),
          basePurchasePrice: Number(r.data.basePurchasePrice ?? 0),
          transportCost: Number(r.data.transportCost ?? 0),
          purchasePrice: Number(r.data.purchasePrice ?? 0),
          sellingPrice: Number(r.data.sellingPrice ?? 0),
          unit: r.data.unit ?? "pcs",
          supplier: r.data.supplier ?? "",
          purchaseInvoiceNo: r.data.purchaseInvoiceNo ?? "",
          purchaseDate: r.data.purchaseDate ?? "",
          gstRate: Number(r.data.gstRate ?? 0),
          hsnCode: r.data.hsnCode ?? "",
        }));
        setInvoiceProducts(products);
        setValidationSummary(data.validation?.summary ?? null);
        setStep("review");
      } else {
        // Excel/CSV flow
        setIsInvoicePdf(false);
        setValidationSummary(data.validation?.summary ?? null);
        setErrors(data.validation?.errors ?? []);
        setWarnings(data.validation?.warnings ?? []);
        setColumnMapping(data.columnMapping ?? {});
        setUnmapped(data.unmappedHeaders ?? []);
        setSuggestions(data.mappingSuggestions ?? {});
        setStep("review");
      }
    } catch { setImportError("Network error. Please try again."); setStep("upload"); }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && /\.(xlsx|xls|csv|pdf)$/i.test(f.name)) processFile(f);
    else toast.error("Please upload an Excel (.xlsx, .xls, .csv) or PDF invoice file.");
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  // Excel import (existing flow)
  const handleImport = async () => {
    if (!file) return;
    setStep("importing"); setProgress(10);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("mode", "import");
      setProgress(40);
      const res = await fetch("/api/inventory/import", { method: "POST", body: fd });
      setProgress(80);
      const data = await res.json();
      if (!res.ok) { setImportError(data.error ?? "Import failed"); setStep("review"); return; }
      setImportResults(data.results);
      setProgress(100);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch { setImportError("Network error during import."); setStep("review"); }
  };

  // Invoice PDF confirmed import
  const handleInvoiceConfirmImport = async () => {
    if (invoiceProducts.length === 0) return;
    setStep("importing"); setProgress(10);
    try {
      setProgress(40);
      const res = await fetch("/api/inventory/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: invoiceProducts }),
      });
      setProgress(80);
      const data = await res.json();
      if (!res.ok) { setImportError(data.error ?? "Import failed"); setStep("review"); return; }
      setImportResults(data.results);
      setProgress(100);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch { setImportError("Network error during import."); setStep("review"); }
  };

  // Edit invoice product inline
  const updateInvoiceProduct = (idx: number, field: keyof InvoiceProduct, value: string | number) => {
    setInvoiceProducts(prev => {
      const updated = [...prev];
      const p = { ...updated[idx], [field]: value };
      // Auto-recalc landed cost when purchase cost changes
      if (field === "basePurchasePrice" || field === "transportCost") {
        p.purchasePrice = Number(p.basePurchasePrice) + Number(p.transportCost);
      }
      updated[idx] = p;
      return updated;
    });
  };

  const removeInvoiceProduct = (idx: number) => {
    setInvoiceProducts(prev => prev.filter((_, i) => i !== idx));
  };

  const hasErrors = (validationSummary?.errors ?? 0) > 0;
  const mappedCount = Object.values(columnMapping).filter(Boolean).length;

  const isPdf = file?.name.toLowerCase().endsWith(".pdf");

  return (
    <Modal open={open} onClose={handleClose} title="Import Inventory" size="2xl"
      icon={<FileSpreadsheet size={16} />} iconColor="bg-emerald-500/20 text-emerald-400"
      subtitle={isInvoicePdf ? "Import from PDF Invoice" : "Bulk update inventory from Excel, CSV, or Invoice PDF"}>

      <datalist id="category-options">
        {categoriesList.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* Step Indicator */}
      <div className="flex items-center gap-1 mb-5">
        {(["upload", "review", "done"] as const).map((s, i) => {
          const active = step === s || (step === "validating" && s === "upload") || (step === "importing" && s === "review");
          const done = (s === "upload" && ["review","importing","done"].includes(step)) ||
                       (s === "review" && step === "done");
          return (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${done ? "bg-emerald-500/10 text-emerald-400" : active ? "bg-violet-500/10 text-violet-400" : "bg-primary/5 text-primary/30"}`}>
                {done ? <CheckCircle2 size={12} /> : <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">{i+1}</span>}
                {s === "upload" ? "Upload" : s === "review" ? "Verify" : "Complete"}
              </div>
              {i < 2 && <div className={`w-4 h-px ${done ? "bg-emerald-500/40" : "bg-primary/10"}`} />}
            </div>
          );
        })}
      </div>

      {/* ── STEP: UPLOAD ── */}
      {(step === "upload" || step === "validating") && (
        <div className="space-y-4">
          {/* Download Template */}
          <div className="rounded-xl p-4 flex items-center justify-between gap-3"
            style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)" }}>
            <div>
              <p className="text-sm font-medium text-primary">Download Sample Template</p>
              <p className="text-xs text-primary/40 mt-0.5">Auto-generated for your store type with example data</p>
            </div>
            <Button variant="secondary" size="sm" icon={downloadingTemplate ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              onClick={handleDownloadTemplate} disabled={downloadingTemplate}>
              {downloadingTemplate ? "Generating..." : "Download"}
            </Button>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all
              ${dragOver ? "border-violet-500/60 bg-violet-500/5" : "border-primary/10 hover:border-primary/20 hover:bg-primary/3"}`}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={handleFileChange} />
            {step === "validating" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                  <Loader2 size={22} className="text-violet-400 animate-spin" />
                </div>
                <p className="text-sm font-medium text-primary">
                  {isPdf ? "Extracting invoice data…" : "Analysing your file…"}
                </p>
                <div className="w-48 h-1.5 bg-primary/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-primary/40">
                  {isPdf ? "Reading invoice items" : "Smart validation in progress"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all
                  ${dragOver ? "bg-violet-500/20" : "bg-primary/5"}`}>
                  <Upload size={22} className={dragOver ? "text-violet-400" : "text-primary/30"} />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">Drop your file here</p>
                  <p className="text-xs text-primary/40 mt-1">or click to browse · .xlsx, .xls, .csv, <span className="text-violet-400 font-medium">.pdf invoice</span> supported</p>
                </div>
              </div>
            )}
          </div>

          {importError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <XCircle size={14} className="text-rose-400 flex-shrink-0" />
              <p className="text-xs text-rose-400">{importError}</p>
            </div>
          )}
        </div>
      )}

      {/* ── STEP: REVIEW (Invoice PDF) ── */}
      {step === "review" && isInvoicePdf && invoiceInfo && (
        <div className="space-y-4">
          {/* Invoice Header */}
          <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-violet-400" />
              <p className="text-sm font-semibold text-primary">Invoice Detected</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-primary/40 uppercase tracking-wider">Invoice No.</p>
                <p className="text-xs font-medium text-primary mt-0.5">{invoiceInfo.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-[10px] text-primary/40 uppercase tracking-wider">Supplier</p>
                <p className="text-xs font-medium text-primary mt-0.5">{invoiceInfo.supplier}</p>
              </div>
              <div>
                <p className="text-[10px] text-primary/40 uppercase tracking-wider">Date</p>
                <p className="text-xs font-medium text-primary mt-0.5">{invoiceInfo.purchaseDate}</p>
              </div>
            </div>
          </div>

          {/* Editable Products Table */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ background: "var(--bg-surface-2)" }}>
              <p className="text-xs font-semibold text-primary">
                {invoiceProducts.length} Products — Review & Edit
              </p>
              <p className="text-[10px] text-primary/40">Click any value to edit</p>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                    <th className="px-2 py-1.5 text-left text-primary/50 font-medium">Item Name</th>
                    <th className="px-2 py-1.5 text-left text-primary/50 font-medium">Category</th>
                    <th className="px-2 py-1.5 text-left text-primary/50 font-medium w-20">HSN/SAC</th>
                    <th className="px-2 py-1.5 text-right text-primary/50 font-medium w-16">GST %</th>
                    <th className="px-2 py-1.5 text-right text-primary/50 font-medium">Stock</th>
                    <th className="px-2 py-1.5 text-right text-primary/50 font-medium">Pack Size</th>
                    <th className="px-2 py-1.5 text-right text-primary/50 font-medium">Purchase ₹</th>
                    <th className="px-2 py-1.5 text-right text-primary/50 font-medium">Selling ₹</th>
                    <th className="px-2 py-1.5 text-center text-primary/50 font-medium w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceProducts.map((p, idx) => (
                    <tr key={idx} className="border-b hover:bg-primary/3 transition-colors group"
                      style={{ borderColor: "var(--border)" }}>
                      <td className="px-2 py-1.5">
                        {editingIdx === idx ? (
                          <input className="w-full bg-primary/5 border border-violet-500/40 text-primary text-[11px] outline-none px-1.5 py-0.5 rounded"
                            value={p.name} onChange={(e) => updateInvoiceProduct(idx, "name", e.target.value)}
                            onBlur={() => setEditingIdx(null)} autoFocus />
                        ) : (
                          <span className="text-primary cursor-pointer hover:text-violet-400 transition-colors border-b border-dashed border-primary/25 pb-0.5"
                            onClick={() => setEditingIdx(idx)}>{p.name}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          list="category-options"
                          className="w-24 bg-primary/5 border border-primary/10 rounded focus:border-violet-500/40 text-primary text-[11px] outline-none px-1.5 py-0.5 transition-colors"
                          value={p.category || ""}
                          onChange={(e) => updateInvoiceProduct(idx, "category", e.target.value)}
                          placeholder="Category"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input className="w-20 bg-primary/5 border border-primary/10 rounded focus:border-violet-500/40 text-primary text-[11px] outline-none px-1.5 py-0.5 transition-colors"
                          value={p.hsnCode || ""} onChange={(e) => updateInvoiceProduct(idx, "hsnCode", e.target.value)} />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input type="number" className="w-12 bg-primary/5 border border-primary/10 rounded focus:border-violet-500/40 text-primary text-[11px] text-right outline-none px-1.5 py-0.5 transition-colors"
                          value={p.gstRate} onChange={(e) => updateInvoiceProduct(idx, "gstRate", Number(e.target.value))} min={0} max={100} />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input type="number" className="w-14 bg-primary/5 border border-primary/10 rounded focus:border-violet-500/40 text-primary text-[11px] text-right outline-none px-1.5 py-0.5 transition-colors"
                          value={p.stock} onChange={(e) => updateInvoiceProduct(idx, "stock", Number(e.target.value))} min={0} />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input type="number" className="w-12 bg-primary/5 border border-primary/10 rounded focus:border-violet-500/40 text-primary text-[11px] text-right outline-none px-1.5 py-0.5 transition-colors"
                          value={p.unitsPerBag} onChange={(e) => updateInvoiceProduct(idx, "unitsPerBag", Number(e.target.value))} min={1} />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input type="number" className="w-16 bg-primary/5 border border-primary/10 rounded focus:border-violet-500/40 text-primary text-[11px] text-right outline-none px-1.5 py-0.5 transition-colors"
                          value={p.basePurchasePrice} onChange={(e) => updateInvoiceProduct(idx, "basePurchasePrice", Number(e.target.value))} min={0} step="any" />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input type="number" className="w-16 bg-primary/5 border border-primary/10 rounded focus:border-violet-500/40 text-primary text-[11px] text-right outline-none px-1.5 py-0.5 transition-colors"
                          value={p.sellingPrice} onChange={(e) => updateInvoiceProduct(idx, "sellingPrice", Number(e.target.value))} min={0} step="any" />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => removeInvoiceProduct(idx)}
                          className="opacity-0 group-hover:opacity-100 text-rose-400/60 hover:text-rose-400 transition-all" title="Remove">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-emerald-400">
              {invoiceProducts.length} products extracted from invoice. Review the data above and click <strong>Confirm & Import</strong>.
            </p>
          </div>

          {importError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <XCircle size={14} className="text-rose-400 flex-shrink-0" />
              <p className="text-xs text-rose-400">{importError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" icon={<RotateCcw size={13} />} onClick={reset} className="flex-1">
              Re-upload
            </Button>
            <Button size="sm" className="flex-1" onClick={handleInvoiceConfirmImport}
              disabled={invoiceProducts.length === 0}>
              Confirm & Import {invoiceProducts.length} Products
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP: REVIEW (Excel/CSV — existing flow) ── */}
      {step === "review" && !isInvoicePdf && validationSummary && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Total Rows", value: validationSummary.total, color: "text-primary" },
              { label: "Valid", value: validationSummary.valid, color: "text-emerald-400" },
              { label: "Errors", value: validationSummary.errors, color: "text-rose-400" },
              { label: "Warnings", value: validationSummary.warnings, color: "text-amber-400" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "var(--bg-surface-2)" }}>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-primary/40 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Column Mapping Summary */}
          <div className="rounded-xl p-3" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold text-primary mb-2">
              🔗 Column Mapping — {mappedCount} of {Object.keys(columnMapping).length} matched
            </p>
            <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto">
              {Object.entries(columnMapping).map(([template, uploaded]) => (
                <div key={template} className="flex items-center gap-1.5 text-[10px]">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${uploaded ? "bg-emerald-400" : "bg-rose-400"}`} />
                  <span className="text-primary/60 truncate">{template.replace(/\b\w/g, c => c.toUpperCase())}</span>
                  {uploaded && <span className="text-primary/30">→ {uploaded}</span>}
                </div>
              ))}
            </div>
            {unmapped.length > 0 && (
              <p className="text-[10px] text-amber-400 mt-2">⚠️ Unrecognised columns: {unmapped.join(", ")}</p>
            )}
          </div>

          {/* Errors Panel */}
          {errors.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(239,68,68,0.2)" }}>
              <button onClick={() => setShowErrors(!showErrors)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
                <span className="flex items-center gap-1.5"><XCircle size={12} /> {errors.length} Error{errors.length !== 1 ? "s" : ""} — must fix before import</span>
                {showErrors ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showErrors && (
                <div className="max-h-40 overflow-y-auto">
                  {errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 border-t text-[11px]" style={{ borderColor: "rgba(239,68,68,0.1)" }}>
                      <span className="text-primary/30 font-mono w-12 flex-shrink-0">Row {e.row}</span>
                      <span className="text-rose-300/80 font-medium w-28 flex-shrink-0 truncate">{e.column}</span>
                      <span className="text-primary/50">{e.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Warnings Panel */}
          {warnings.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(245,158,11,0.2)" }}>
              <button onClick={() => setShowWarnings(!showWarnings)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                <span className="flex items-center gap-1.5"><AlertTriangle size={12} /> {warnings.length} Warning{warnings.length !== 1 ? "s" : ""} — review before import</span>
                {showWarnings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showWarnings && (
                <div className="max-h-32 overflow-y-auto">
                  {warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 border-t text-[11px]" style={{ borderColor: "rgba(245,158,11,0.1)" }}>
                      <span className="text-primary/30 font-mono w-12 flex-shrink-0">Row {w.row}</span>
                      <span className="text-amber-300/80 font-medium w-28 flex-shrink-0 truncate">{w.column}</span>
                      <span className="text-primary/50">{w.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Success note */}
          {!hasErrors && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-400">
                All {validationSummary.valid} rows validated. Ready to import.
                {warnings.length > 0 && ` (${warnings.length} warnings — import will proceed)`}
              </p>
            </div>
          )}

          {importError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <XCircle size={14} className="text-rose-400 flex-shrink-0" />
              <p className="text-xs text-rose-400">{importError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" icon={<RotateCcw size={13} />} onClick={reset} className="flex-1">
              Re-upload
            </Button>
            {hasErrors ? (
              <Button variant="danger" size="sm" className="flex-1" disabled>
                Fix {validationSummary.errors} Error{validationSummary.errors !== 1 ? "s" : ""} First
              </Button>
            ) : (
              <Button size="sm" className="flex-1" onClick={handleImport}>
                Import {validationSummary.valid} Products
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── STEP: IMPORTING ── */}
      {step === "importing" && (
        <div className="flex flex-col items-center gap-5 py-8">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
            <Loader2 size={28} className="text-violet-400 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-primary">
              {isInvoicePdf ? "Importing invoice products…" : "Importing products…"}
            </p>
            <p className="text-xs text-primary/40 mt-1">Please do not close this window</p>
          </div>
          <div className="w-64 h-2 bg-primary/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-primary/30">{progress}% complete</p>
        </div>
      )}

      {/* ── STEP: DONE ── */}
      {step === "done" && importResults && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-primary">Import Complete!</p>
              <p className="text-xs text-primary/40 mt-1">
                {isInvoicePdf && invoiceInfo
                  ? `Invoice ${invoiceInfo.invoiceNumber} has been imported successfully.`
                  : "Your inventory has been updated successfully."}
              </p>
            </div>
          </div>

          {/* Result cards */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Created", value: importResults.created, color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/15" },
              { label: "Updated", value: importResults.updated, color: "text-violet-400", bg: "bg-violet-500/5 border-violet-500/15" },
              { label: "Skipped", value: importResults.skipped, color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/15" },
              { label: "Failed", value: importResults.failed, color: "text-rose-400", bg: "bg-rose-500/5 border-rose-500/15" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-4 text-center border ${s.bg}`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-primary/40 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" className="flex-1" onClick={reset}
              icon={<Upload size={13} />}>Import More</Button>
            <Button size="sm" className="flex-1" onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
