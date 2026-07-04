"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/shared/ui/ui/Modal";
import { Button } from "@/shared/ui/ui/Button";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle,
  AlertTriangle, RotateCcw, ChevronDown, ChevronUp, Loader2,
  FileText, Pencil, Trash2, Plus, Truck, IndianRupee
} from "lucide-react";
import { useBusiness } from "@/shared/hooks/useBusiness";
import { useProductCategories } from "@/shared/hooks/useProducts";
import { getBusinessProfile } from "@/shared/lib/business-intelligence";

type Step = "upload" | "validating" | "review" | "expenses" | "summary" | "training" | "importing" | "done";

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
  matchScore?: number;
  matchType?: "auto-matched" | "needs-review" | "manual";
}

interface InvoiceInfo {
  invoiceNumber: string; supplier: string; purchaseDate: string;
  grandTotal?: number; format?: string; templateName?: string;
  validationPassed?: boolean; validationDetails?: string;
  supplierMatch?: { matchType: "auto-matched" | "new-supplier"; score: number; originalName: string; };
  attachment?: { url: string; fileName: string; fileSize: number; mimeType: string; };
}

interface SharedExpense {
  id: string;
  category: string;
  amount: number;
  applicableProductIds?: string[]; // undefined means all products
  isExpanded?: boolean;
}

interface UploadedInvoiceFile {
  id: string;
  file: File;
  status: "processing" | "success" | "error";
  progress: number;
  error?: string;
  isInvoicePdf: boolean;
  invoiceInfo?: InvoiceInfo;
  invoiceProducts: InvoiceProduct[];
  validationSummary?: ValidationSummary;
  errors: RowError[];
  warnings: RowError[];
  columnMapping?: Record<string, string | null>;
  unmapped?: string[];
  suggestions?: Record<string, string>;
  trainingRequired?: boolean;
  trainingPreview?: any;
  isTraining?: boolean;
}

const EXPENSE_CATEGORIES = [
  "Transport", "Labour", "Loading", "Unloading", "Freight",
  "Insurance", "Customs", "Handling", "Other",
];

const CategoryCell = ({ value, options, onChange }: { value: string, options: string[], onChange: (val: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value || "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const showAdd = search.trim() !== "" && !options.some(o => o.toLowerCase() === search.toLowerCase());

  return (
    <div ref={ref} className="relative">
      <input
        className="w-28 bg-primary/5 border border-primary/10 rounded focus:border-violet-500/40 text-primary text-[11px] outline-none px-1.5 py-0.5 transition-colors"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Category"
      />
      {open && (
        <div className="absolute z-50 w-40 mt-1 rounded-md shadow-xl max-h-48 overflow-y-auto custom-scrollbar"
          style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          {filtered.map(opt => (
            <div key={opt}
              className="px-2 py-1.5 text-[11px] text-primary/80 hover:bg-violet-500/10 hover:text-violet-400 cursor-pointer"
              onClick={() => {
                setSearch(opt);
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </div>
          ))}
          {showAdd && (
            <div className="px-2 py-1.5 text-[11px] text-violet-400 font-medium border-t border-primary/10">
              Will add "{search}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function ImportInventoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<UploadedInvoiceFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showExpenses, setShowExpenses] = useState(false);
  const [sharedExpenses, setSharedExpenses] = useState<SharedExpense[]>([]);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const { data: business } = useBusiness();
  const profile = business ? getBusinessProfile(business.businessType) : null;
  const { data: dbCategories } = useProductCategories();
  const profileCats = profile ? profile.productCategories : ["Grains", "Pulses", "Edible Oil", "Spices", "Construction"];
  const categoriesList = Array.from(new Set([...(dbCategories || []), ...profileCats, "Other"]));

  // Import state
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const activeFile = files.find(f => f.id === activeFileId);

  // ── Shared Expense helpers ──
  const addExpense = () => {
    setSharedExpenses(prev => [
      ...prev.map(e => ({ ...e, isExpanded: false })), 
      { id: crypto.randomUUID(), category: "Transport", amount: 0, isExpanded: true }
    ]);
    setShowExpenses(true);
  };

  const removeExpense = (id: string) => {
    setSharedExpenses(prev => prev.filter(e => e.id !== id));
  };

  const updateExpense = (id: string, field: keyof SharedExpense, value: any) => {
    setSharedExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const toggleProductApplicability = (id: string, productId: string) => {
    setSharedExpenses(prev => prev.map(e => {
      if (e.id !== id) return e;
      const allProductIds = files.flatMap(f => (f.invoiceProducts || []).map((_, i) => `${f.id}-${i}`));
      const current = e.applicableProductIds || allProductIds;
      const updated = current.includes(productId) ? current.filter(i => i !== productId) : [...current, productId];
      return { ...e, applicableProductIds: updated.length === allProductIds.length ? undefined : updated };
    }));
  };

  const setProductApplicabilityAll = (id: string, isAll: boolean) => {
    setSharedExpenses(prev => prev.map(e => {
      if (e.id !== id) return e;
      return { ...e, applicableProductIds: isAll ? undefined : [] };
    }));
  };

  const getProductExpenseShare = (fileId: string, p: InvoiceProduct, pIdx: number) => {
    const productId = `${fileId}-${pIdx}`;
    let totalShare = 0;
    for (const exp of sharedExpenses) {
      if (!exp.amount) continue;
      const allProductIds = files.flatMap(f => (f.invoiceProducts || []).map((_, i) => `${f.id}-${i}`));
      const appliesTo = exp.applicableProductIds || allProductIds;
      if (!appliesTo.includes(productId)) continue;
      
      const applicableBags = files
        .flatMap(f => (f.invoiceProducts || []).map((ap, i) => ({ 
          id: `${f.id}-${i}`, 
          bags: (Number(ap.stock) || 0) / (Number(ap.unitsPerBag) || 1) 
        })))
        .filter(ap => appliesTo.includes(ap.id))
        .reduce((sum, ap) => sum + ap.bags, 0);
      
      if (applicableBags > 0) {
        const bags = (Number(p.stock) || 0) / (Number(p.unitsPerBag) || 1);
        const expPerBag = exp.amount / applicableBags;
        totalShare += bags * expPerBag;
      }
    }
    return Number(totalShare.toFixed(2));
  };

  const getProductPerUnitExpense = (fileId: string, p: InvoiceProduct, pIdx: number) => {
    const qty = Number(p.stock) || 0;
    if (qty <= 0) return 0;
    return Number((getProductExpenseShare(fileId, p, pIdx) / qty).toFixed(4));
  };

  const totalExpenseAmount = sharedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalUnits = files.flatMap(f => f.invoiceProducts).reduce((sum, p) => sum + (Number(p.stock) || 0), 0);

  const reset = () => {
    setStep("upload"); setFiles([]); setActiveFileId(null);
    setImportResults(null); setImportError(null); setProgress(0);
    setEditingIdx(null); setShowExpenses(false);
  };

  const handleClose = () => { reset(); onClose(); };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (step === "review" && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        const canImport = files.filter(f => f.status === "success" && !f.trainingRequired).length > 0;
        if (canImport) {
          handleInvoiceConfirmImport();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, files]);


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

  const processFiles = useCallback(async (uploadedFiles: File[]) => {
    setStep("validating");
    setProgress(10);
    setImportError(null);

    const fileObjects: UploadedInvoiceFile[] = uploadedFiles.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      status: "processing",
      progress: 20,
      isInvoicePdf: f.name.toLowerCase().endsWith(".pdf"),
      invoiceProducts: [],
      invoiceExpenses: [],
      errors: [],
      warnings: [],
    }));

    setFiles(fileObjects);

    // Process all files in parallel
    await Promise.all(fileObjects.map(async (fileObj) => {
      try {
        const fd = new FormData();
        fd.append("file", fileObj.file);
        fd.append("mode", "validate");

        const res = await fetch("/api/inventory/import", { method: "POST", body: fd });
        const data = await res.json();

        if (!res.ok) {
          setFiles(prev => prev.map(f => f.id === fileObj.id ? {
            ...f,
            status: "error",
            progress: 100,
            error: data.error ?? "Validation failed"
          } : f));
          return;
        }

        // Handle training_required mode
        if (data.mode === "training_required") {
          setFiles(prev => prev.map(f => f.id === fileObj.id ? {
            ...f,
            status: "success",
            progress: 100,
            trainingRequired: true,
            trainingPreview: data.trainedPreview || null,
          } : f));
          return;
        }

        if (data.isInvoicePdf) {
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
            matchScore: r.data.matchScore,
            matchType: r.data.matchType,
          }));

          setFiles(prev => prev.map(f => f.id === fileObj.id ? {
            ...f,
            status: "success",
            progress: 100,
            isInvoicePdf: true,
            invoiceInfo: data.invoiceInfo,
            invoiceProducts: products,
            validationSummary: data.validation?.summary ?? null,
            errors: data.validation?.errors ?? [],
            warnings: data.validation?.warnings ?? [],
          } : f));
        } else {
          // Excel/CSV
          const validProducts: InvoiceProduct[] = (data.validation?.processedRows ?? [])
            .filter((r: any) => r.errors?.length === 0)
            .map((r: any) => ({
              name: r.data.name ?? "",
              sku: r.data.sku ?? "",
              category: r.data.category ?? "",
              stock: Number(r.data.stock ?? 0),
              unitsPerBag: Number(r.data.unitsPerBag ?? 1),
              basePurchasePrice: Number(r.data.basePurchasePrice ?? r.data.purchasePrice ?? 0),
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

          setFiles(prev => prev.map(f => f.id === fileObj.id ? {
            ...f,
            status: "success",
            progress: 100,
            isInvoicePdf: false,
            validationSummary: data.validation?.summary ?? null,
            errors: data.validation?.errors ?? [],
            warnings: data.validation?.warnings ?? [],
            columnMapping: data.columnMapping ?? {},
            unmapped: data.unmappedHeaders ?? [],
            suggestions: data.mappingSuggestions ?? {},
            invoiceProducts: validProducts,
          } : f));
        }
      } catch (err: any) {
        setFiles(prev => prev.map(f => f.id === fileObj.id ? {
          ...f,
          status: "error",
          progress: 100,
          error: err.message ?? "Network error during validation"
        } : f));
      }
    }));

    setFiles(prev => {
      if (prev.length > 0) {
        setActiveFileId(prev[0].id);
      }
      return prev;
    });
    setProgress(100);
    setStep("review");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const uploadedFiles = Array.from(e.dataTransfer.files).filter(f => /\.(xlsx|xls|csv|pdf)$/i.test(f.name));
    if (uploadedFiles.length > 0) processFiles(uploadedFiles);
    else toast.error("Please upload Excel (.xlsx, .xls, .csv) or PDF invoice files.");
  }, [processFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files ?? []);
    if (uploadedFiles.length > 0) processFiles(uploadedFiles);
  };

  // Invoice PDF/Excel confirmed import
  const handleInvoiceConfirmImport = async () => {
    const invoicesToImport: any[] = [];

    const successfulFiles = files.filter(f => f.status === "success" && !f.trainingRequired && f.invoiceProducts.length > 0);
    if (successfulFiles.length === 0) {
      toast.error("No valid products to import.");
      return;
    }

    successfulFiles.forEach(fileObj => {
      const currentInvoiceProducts: any[] = [];
      (fileObj.invoiceProducts || []).forEach((p, pIdx) => {
        const productId = `${fileObj.id}-${pIdx}`;
        const productExpenses: any[] = [];

        sharedExpenses.forEach(exp => {
          if (!exp.amount) return;
          const allProductIds = files.flatMap(f => (f.invoiceProducts || []).map((_, i) => `${f.id}-${i}`));
          const appliesTo = exp.applicableProductIds || allProductIds;
          if (appliesTo.includes(productId)) {
            const applicableBags = files
              .flatMap(f => (f.invoiceProducts || []).map((ap, i) => ({ 
                id: `${f.id}-${i}`, 
                bags: (Number(ap.stock) || 0) / (Number(ap.unitsPerBag) || 1) 
              })))
              .filter(ap => appliesTo.includes(ap.id))
              .reduce((sum, ap) => sum + ap.bags, 0);
              
            if (applicableBags > 0) {
              const bags = (Number(p.stock) || 0) / (Number(p.unitsPerBag) || 1);
              const expPerBag = exp.amount / applicableBags;
              const totalShareForThisProduct = bags * expPerBag;
              const sharePerUnit = totalShareForThisProduct / (Number(p.stock) || 1);
              
              productExpenses.push({
                expenseType: exp.category,
                amount: Number(sharePerUnit.toFixed(4)),
              });
            }
          }
        });

        const perUnitExpensesSum = productExpenses.reduce((sum, e) => sum + e.amount, 0);
        
        // purchasePrice is Standard Cost (which now already includes GST) + expenses
        const baseWithGst = Number(p.basePurchasePrice || 0);

        currentInvoiceProducts.push({
          ...p,
          expenses: productExpenses,
          transportCost: Number((p.transportCost || 0) + perUnitExpensesSum),
          purchasePrice: Number(baseWithGst + (p.transportCost || 0) + perUnitExpensesSum),
        });
      });

      invoicesToImport.push({
        invoiceInfo: fileObj.invoiceInfo,
        products: currentInvoiceProducts,
      });
    });

    setStep("importing"); setProgress(10);
    try {
      // Upload PDFs to Vercel Blob
      for (const fileObj of successfulFiles) {
        if (fileObj.isInvoicePdf && fileObj.file) {
          try {
            const formData = new FormData();
            formData.append("file", fileObj.file);
            const uploadRes = await fetch(`/api/upload?filename=${encodeURIComponent(fileObj.file.name)}`, {
              method: "POST",
              body: fileObj.file,
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              const targetInvoice = invoicesToImport.find(i => i.invoiceInfo.invoiceNumber === fileObj.invoiceInfo?.invoiceNumber);
              if (targetInvoice) {
                targetInvoice.invoiceInfo.attachment = {
                  url: uploadData.url,
                  fileName: fileObj.file.name,
                  fileSize: fileObj.file.size,
                  mimeType: fileObj.file.type || 'application/pdf',
                };
              }
            } else {
              console.error("Failed to upload PDF", await uploadRes.text());
            }
          } catch (uploadErr) {
            console.error("Error uploading PDF", uploadErr);
          }
        }
      }

      setProgress(40);
      const res = await fetch("/api/inventory/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoices: invoicesToImport,
        }),
      });
      setProgress(80);
      
      let data;
      let rawText = "";
      try {
        rawText = await res.text();
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error("Non-JSON response received:", rawText);
        setImportError(`Server Error: ${rawText.slice(0, 100)}...`);
        toast.error("Server Error: Check console for details");
        setStep("review");
        return;
      }
      
      if (!res.ok) { 
        const errStr = data.error ?? "Import failed";
        setImportError(errStr); 
        toast.error(errStr);
        setStep("review"); 
        return; 
      }
      setImportResults(data.results);
      setProgress(100);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) { 
      setImportError(`Network error during import: ${err.message}`); 
      toast.error(`Network error: ${err.message}`);
      setStep("review"); 
    }
  };

  // Train template then re-parse the PDF
  const handleTrainTemplate = async (id: string) => {
    const invFile = files.find(f => f.id === id);
    if (!invFile) return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, isTraining: true, status: "processing", progress: 30 } : f));
    try {
      const fd = new FormData();
      fd.append("file", invFile.file);
      const trainRes = await fetch("/api/inventory/train-template", { method: "POST", body: fd });
      const trainData = await trainRes.json();

      if (!trainRes.ok) {
        setFiles(prev => prev.map(f => f.id === id ? {
          ...f,
          isTraining: false,
          status: "error",
          error: trainData.error ?? "Training failed"
        } : f));
        return;
      }

      toast.success(`Template "${trainData.template?.name}" trained successfully!`);

      if (trainData.extraction && trainData.extraction.products?.length > 0) {
        const products: InvoiceProduct[] = trainData.extraction.products.map((p: any) => ({
          name: p.name ?? "", sku: p.sku ?? "", category: p.category ?? "",
          stock: Number(p.quantity ?? p.stock ?? 0),
          unitsPerBag: Number(p.unitsPerBag ?? 1),
          basePurchasePrice: Number(p.basePurchasePrice ?? 0),
          transportCost: 0,
          purchasePrice: Number(p.purchasePrice ?? 0),
          sellingPrice: Number(p.sellingPrice ?? 0),
          unit: p.unit ?? "pcs",
          supplier: trainData.extraction.supplier ?? "",
          purchaseInvoiceNo: trainData.extraction.invoiceNumber ?? "",
          purchaseDate: trainData.extraction.purchaseDate ?? "",
          gstRate: Number(p.gstRate ?? 0),
          hsnCode: p.hsnCode ?? "",
        }));

        setFiles(prev => prev.map(f => f.id === id ? {
          ...f,
          status: "success",
          progress: 100,
          isTraining: false,
          trainingRequired: false,
          isInvoicePdf: true,
          invoiceInfo: {
            invoiceNumber: trainData.extraction.invoiceNumber || "Unknown",
            supplier: trainData.extraction.supplier || "Unknown Supplier",
            purchaseDate: trainData.extraction.purchaseDate || new Date().toISOString(),
          },
          invoiceProducts: products,
          validationSummary: { total: products.length, valid: products.length, errors: 0, warnings: 0, duplicates: 0 },
        } : f));
        return;
      }

      const fd2 = new FormData();
      fd2.append("file", invFile.file); fd2.append("mode", "validate");
      const parseRes = await fetch("/api/inventory/import", { method: "POST", body: fd2 });
      const parseData = await parseRes.json();

      if (!parseRes.ok || parseData.mode === "training_required") {
        setFiles(prev => prev.map(f => f.id === id ? {
          ...f,
          isTraining: false,
          status: "error",
          error: parseData.error ?? "Still could not parse after template training"
        } : f));
        return;
      }

      const products: InvoiceProduct[] = (parseData.validation?.processedRows ?? []).map((r: any) => ({
        name: r.data.name ?? "", sku: r.data.sku ?? "", category: r.data.category ?? "",
        stock: Number(r.data.stock ?? 0), unitsPerBag: Number(r.data.unitsPerBag ?? 1),
        basePurchasePrice: Number(r.data.basePurchasePrice ?? 0), transportCost: Number(r.data.transportCost ?? 0),
        purchasePrice: Number(r.data.purchasePrice ?? 0), sellingPrice: Number(r.data.sellingPrice ?? 0),
        unit: r.data.unit ?? "pcs", supplier: r.data.supplier ?? "",
        purchaseInvoiceNo: r.data.purchaseInvoiceNo ?? "", purchaseDate: r.data.purchaseDate ?? "",
        gstRate: Number(r.data.gstRate ?? 0), hsnCode: r.data.hsnCode ?? "",
      }));

      setFiles(prev => prev.map(f => f.id === id ? {
        ...f,
        status: "success",
        progress: 100,
        isTraining: false,
        trainingRequired: false,
        isInvoicePdf: true,
        invoiceInfo: parseData.invoiceInfo,
        invoiceProducts: products,
        validationSummary: parseData.validation?.summary ?? null,
      } : f));
    } catch {
      setFiles(prev => prev.map(f => f.id === id ? {
        ...f,
        isTraining: false,
        status: "error",
        error: "Network error during training setup"
      } : f));
    }
  };

  // Edit invoice product inline
  const updateInvoiceProduct = (idx: number, field: keyof InvoiceProduct, value: string | number) => {
    setFiles(prev => prev.map(f => {
      if (f.id !== activeFileId) return f;
      const updatedProducts = [...f.invoiceProducts];
      const p = { ...updatedProducts[idx], [field]: value };
      
      const gstMultiplier = 1 + (Number(p.gstRate) || 0) / 100;
      p.purchasePrice = Number(p.basePurchasePrice || 0) * gstMultiplier;
      
      updatedProducts[idx] = p;
      return { ...f, invoiceProducts: updatedProducts };
    }));
  };

  const removeInvoiceProduct = (idx: number) => {
    setFiles(prev => prev.map(f => {
      if (f.id !== activeFileId) return f;
      return { ...f, invoiceProducts: f.invoiceProducts.filter((_, i) => i !== idx) };
    }));
  };

  const hasErrors = activeFile?.errors && activeFile.errors.length > 0;
  const mappedCount = activeFile?.columnMapping 
    ? Object.values(activeFile.columnMapping).filter(Boolean).length 
    : 0;

  return (
    <Modal open={open} onClose={handleClose} title="Import Multiple Invoices" size="5xl"
      icon={<FileSpreadsheet size={16} />} iconColor="bg-emerald-500/20 text-emerald-400"
      subtitle="Bulk update inventory from multiple Excel, CSV, or Invoice PDF files simultaneously">

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-4">
        {(["upload", "review", "expenses", "summary", "done"] as const).map((s, i) => {
          const active = step === s || (step === "validating" && s === "upload") || (step === "importing" && s === "summary") || (step === "training" && s === "review");
          const done = (s === "upload" && ["review","expenses","summary","training","importing","done"].includes(step)) ||
                       (s === "review" && ["expenses", "summary", "importing", "done"].includes(step)) ||
                       (s === "expenses" && ["summary", "importing", "done"].includes(step)) ||
                       (s === "summary" && step === "done");
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all
                ${done ? "bg-emerald-500/10 text-emerald-400" : active ? "bg-violet-500/10 text-violet-400" : "text-primary/40"}`}>
                {done ? <CheckCircle2 size={12} /> : <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] ${active ? "border-violet-400" : "border-primary/30"}`}>{i+1}</span>}
                {s === "upload" ? "Upload" : s === "review" ? "Verify Items" : s === "expenses" ? "Expenses" : s === "summary" ? "Landed Cost" : "Complete"}
              </div>
              {i < 4 && <div className={`w-3 h-px ${done ? "bg-emerald-500/40" : "bg-primary/10"}`} />}
            </div>
          );
        })}
      </div>

      {/* ── STEP: UPLOAD ── */}
      {(step === "upload" || step === "validating") && (
        <div className="space-y-3">
          {/* Download Template - Compact */}
          <div className="flex items-center justify-between bg-primary/3 border border-primary/10 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={13} className="text-violet-400" />
              <span className="text-[11px] text-primary/60">Need a format? Download a sample template.</span>
            </div>
            <button 
              onClick={handleDownloadTemplate} 
              disabled={downloadingTemplate}
              className="text-[11px] font-medium text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
            >
              {downloadingTemplate ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Template
            </button>
          </div>

          {/* Drop Zone - Compact */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-xl border border-dashed py-8 px-6 text-center cursor-pointer transition-all
              ${dragOver ? "border-violet-500/50 bg-violet-500/5" : "border-primary/15 hover:border-primary/25 hover:bg-primary/[0.02]"}`}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={handleFileChange} multiple />
            {step === "validating" ? (
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Loader2 size={18} className="text-violet-400 animate-spin" />
                </div>
                <div>
                  <p className="text-xs font-medium text-primary">Processing files…</p>
                  <p className="text-[10px] text-primary/40 mt-0.5">Extracting and matching structures</p>
                </div>
                <div className="w-40 h-1 mt-1 bg-primary/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all
                  ${dragOver ? "bg-violet-500/20" : "bg-primary/5"}`}>
                  <Upload size={18} className={dragOver ? "text-violet-400" : "text-primary/30"} />
                </div>
                <div>
                  <p className="text-xs font-medium text-primary">Drop invoices or spreadsheets here</p>
                  <p className="text-[10px] text-primary/40 mt-0.5">Click to browse • Multiple PDF / Excel / CSV allowed</p>
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

      {/* ── STEP: REVIEW (Layout with Sidebar & Panel) ── */}
      {step === "review" && files.length > 0 && (
        <div className="flex flex-col md:flex-row gap-4 h-[600px]">
          {/* Left Sidebar: Invoices list */}
          <div className="w-full md:w-64 border-r border-primary/10 pr-3 flex flex-col h-full">
            <h3 className="text-xs font-semibold text-primary/50 uppercase tracking-wider mb-2.5">Uploaded Invoices</h3>
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
              {files.map((fileObj) => {
                const isActive = fileObj.id === activeFileId;
                const isSuccess = fileObj.status === "success" && !fileObj.trainingRequired;
                const needsTrain = fileObj.trainingRequired;
                const isError = fileObj.status === "error";

                return (
                  <button
                    key={fileObj.id}
                    onClick={() => { setActiveFileId(fileObj.id); setEditingIdx(null); }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${isActive ? 'bg-violet-500/10 border-violet-500/35 text-violet-300' : 'bg-primary/3 border-primary/5 hover:bg-primary/5 hover:border-primary/10 text-primary/80'}`}
                  >
                    <div className="mt-0.5">
                      {fileObj.isInvoicePdf ? <FileText size={15} className="text-violet-400" /> : <FileSpreadsheet size={15} className="text-emerald-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" title={fileObj.file.name}>{fileObj.file.name}</p>
                      <div className="flex items-center gap-1 mt-1 text-[9px]">
                        {isSuccess && (
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            <CheckCircle2 size={8} /> {fileObj.invoiceProducts.length} items
                          </span>
                        )}
                        {needsTrain && (
                          <span className="text-amber-400 flex items-center gap-0.5">
                            <AlertTriangle size={8} /> Needs training
                          </span>
                        )}
                        {isError && (
                          <span className="text-rose-400 flex items-center gap-0.5">
                            <XCircle size={8} /> Error
                          </span>
                        )}
                        {fileObj.status === "processing" && (
                          <span className="text-violet-400 flex items-center gap-0.5">
                            <Loader2 size={8} className="animate-spin" /> Processing
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            
            {/* Global Actions */}
            <div className="pt-3 border-t border-primary/10 mt-3 space-y-2">
              <Button variant="secondary" size="sm" icon={<RotateCcw size={13} />} onClick={reset} className="w-full justify-center">
                Clear & Restart
              </Button>
              <Button size="sm" onClick={() => setStep("expenses")} className="w-full justify-center group relative"
                disabled={
                  files.filter(f => f.status === "success" && !f.trainingRequired).length === 0 ||
                  files.some(f => f.status === "success" && !f.trainingRequired && !f.invoiceInfo?.supplier?.trim())
                }>
                <span className="flex items-center gap-1.5">
                  Continue to Expenses
                  <span className="text-[9px] font-mono text-primary/40 bg-primary/5 px-1 rounded ml-1 group-hover:text-primary/70 transition-colors">Ctrl+↵</span>
                </span>
              </Button>
            </div>
          </div>

          {/* Right Panel: Detailed active invoice review */}
          <div className="flex-1 h-full min-w-0 overflow-y-auto overscroll-contain scroll-smooth pr-1 custom-scrollbar">
            {!activeFile ? (
              <div className="h-full flex items-center justify-center text-primary/30 text-xs">
                Select an invoice from the sidebar to verify
              </div>
            ) : activeFile.status === "processing" ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 py-12">
                <Loader2 size={24} className="text-violet-400 animate-spin" />
                <p className="text-xs text-primary/40">Validating & extracting data...</p>
              </div>
            ) : activeFile.status === "error" ? (
              <div className="h-full p-6 rounded-2xl bg-rose-500/5 border border-rose-500/25 flex flex-col items-center justify-center text-center">
                <XCircle size={36} className="text-rose-400 mb-2" />
                <h4 className="text-sm font-semibold text-primary">Failed to Process Invoice</h4>
                <p className="text-xs text-primary/40 mt-1 max-w-md">{activeFile.error || "Unknown validation error occurred"}</p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => {
                  setFiles(prev => prev.filter(f => f.id !== activeFile.id));
                  if (files.length > 1) {
                    setActiveFileId(files.find(f => f.id !== activeFile.id)?.id || null);
                  } else {
                    reset();
                  }
                }}>Remove File</Button>
              </div>
            ) : activeFile.trainingRequired ? (
              /* Training Panel */
              <div className="space-y-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                    <AlertTriangle size={22} className="text-amber-400" />
                  </div>
                  <p className="text-sm font-semibold text-primary">New Invoice Template Learner Needed</p>
                  <p className="text-xs text-primary/40 mt-1 max-w-sm mx-auto">
                    The format for <strong>{activeFile.file.name}</strong> hasn't been learned yet. Learn it now.
                  </p>
                </div>

                {activeFile.trainingPreview && (
                  <div className="rounded-xl p-3" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                    <p className="text-xs font-semibold text-primary mb-2">📋 Detected Structure</p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-primary/40">Format:</span>{" "}
                        <span className="text-primary font-medium">{activeFile.trainingPreview.formatName || "Standard PDF"}</span>
                      </div>
                      <div>
                        <span className="text-primary/40">Detected Rows:</span>{" "}
                        <span className="text-primary font-medium">{activeFile.trainingPreview.productRowCount || 0}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={() => handleTrainTemplate(activeFile.id)} disabled={activeFile.isTraining}>
                    {activeFile.isTraining ? "Training AI Learner…" : "Train Format & Extract"}
                  </Button>
                </div>
              </div>
            ) : (
              /* Normal verified invoice panel */
              <div className="space-y-4 pb-4">
                {/* Active Invoice Header Card */}
                <div className="rounded-xl p-3 bg-violet-500/5 border border-violet-500/15">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-violet-400" />
                      <p className="text-xs font-semibold text-primary">Invoice Information</p>
                    </div>
                    {activeFile.invoiceInfo?.grandTotal && (
                      <span className="text-[11px] font-semibold text-emerald-400">Total: ₹{activeFile.invoiceInfo.grandTotal}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-primary/40">Invoice:</span>{" "}
                      <span className="text-primary font-medium">{activeFile.invoiceInfo?.invoiceNumber || activeFile.file.name}</span>
                    </div>
                    <div>
                      <span className="text-primary/40">Supplier:</span>{" "}
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          className={`w-full bg-transparent border-b ${!activeFile.invoiceInfo?.supplier ? 'border-rose-400 text-rose-400 placeholder:text-rose-400/50' : 'border-dashed border-primary/25 text-primary'} font-medium outline-none transition-colors focus:border-violet-400`}
                          value={activeFile.invoiceInfo?.supplier || ""}
                          placeholder="Enter Supplier Name"
                          onChange={(e) => {
                            setFiles(prev => prev.map(f => f.id === activeFile.id ? {
                              ...f,
                              invoiceInfo: { ...f.invoiceInfo!, supplier: e.target.value }
                            } : f))
                          }}
                        />
                        {activeFile.invoiceInfo?.supplierMatch && (
                          <span title={`Confidence: ${Math.round(activeFile.invoiceInfo.supplierMatch.score * 100)}%`} className="ml-1 flex items-center shrink-0">
                            {activeFile.invoiceInfo.supplierMatch.matchType === "auto-matched" 
                              ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_rgba(52,211,153,0.5)]" /> 
                              : <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block shadow-[0_0_8px_rgba(251,113,133,0.5)]" />}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-primary/40">Date:</span>{" "}
                      <span className="text-primary font-medium">{activeFile.invoiceInfo?.purchaseDate || "Today"}</span>
                    </div>
                  </div>
                </div>

                {/* Products Review Table */}
                <div className="border border-primary/10 rounded-xl overflow-hidden bg-primary/3">
                  <div className="px-3 py-2 flex items-center justify-between border-b border-primary/10" style={{ background: "var(--bg-surface-2)" }}>
                    <span className="text-xs font-semibold text-primary">{activeFile.invoiceProducts.length} Extracted Products</span>
                    <span className="text-[10px] text-primary/40">Click Name to edit, or customize inputs</span>
                  </div>
                  <div className="w-full overflow-x-auto custom-scrollbar">
                    <table className="w-full text-[11px]">
                      <thead className="sticky top-0 bg-surface-2 border-b border-primary/10 z-10">
                        <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                          <th className="px-2.5 py-1.5 text-left text-primary/50 font-medium">Item Name</th>
                          <th className="px-2.5 py-1.5 text-left text-primary/50 font-medium">Category</th>
                          <th className="px-2.5 py-1.5 text-left text-primary/50 font-medium w-20">HSN/SAC</th>
                          <th className="px-2.5 py-1.5 text-right text-primary/50 font-medium w-12">GST %</th>
                          <th className="px-2.5 py-1.5 text-right text-primary/50 font-medium w-14">Stock</th>
                          <th className="px-2.5 py-1.5 text-right text-primary/50 font-medium w-14" title="Number of Bags/Packets for Expenses">Bags</th>
                          <th className="px-2.5 py-1.5 text-right text-primary/50 font-medium w-14" title="Base Purchase Price (Incl. GST)">Base ₹</th>
                          <th className="px-2.5 py-1.5 text-right text-primary/50 font-medium w-16" title="Landed Cost (Base + Shared Expenses)">Landed ₹</th>
                          <th className="px-2.5 py-1.5 text-right text-primary/50 font-medium w-14">Selling ₹</th>
                          <th className="px-2.5 py-1.5 text-center text-primary/50 font-medium w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary/5">
                        {activeFile.invoiceProducts.map((p, idx) => {
                          const isGstWarning = activeFile.warnings.some(w => w.row === idx + 1 && w.column === 'gstRate');
                          const isHsnWarning = activeFile.warnings.some(w => w.row === idx + 1 && w.column === 'hsnCode');
                          const isStockWarning = activeFile.warnings.some(w => w.row === idx + 1 && w.column === 'stock');
                          
                          return (
                          <tr key={idx} className="hover:bg-primary/5 transition-colors group">
                            <td className="px-2.5 py-1.5">
                              {editingIdx === idx ? (
                                <input className="w-full bg-primary/5 border border-violet-500/40 text-primary text-[11px] outline-none px-1 py-0.5 rounded"
                                  value={p.name} onChange={(e) => updateInvoiceProduct(idx, "name", e.target.value)}
                                  onBlur={() => setEditingIdx(null)} autoFocus />
                              ) : (
                                <span className="text-primary cursor-pointer hover:text-violet-400 transition-colors border-b border-dashed border-primary/25 pb-0.5 flex items-center gap-1.5"
                                  onClick={() => setEditingIdx(idx)}>
                                  {p.matchType && (
                                    <span title={`Confidence: ${Math.round((p.matchScore || 0) * 100)}%`} className="flex-shrink-0">
                                      {p.matchType === "auto-matched" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_rgba(52,211,153,0.5)]" />}
                                      {p.matchType === "needs-review" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shadow-[0_0_8px_rgba(251,191,36,0.5)]" />}
                                      {p.matchType === "manual" && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block shadow-[0_0_8px_rgba(251,113,133,0.5)]" />}
                                    </span>
                                  )}
                                  <span className="truncate">{p.name}</span>
                                </span>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <CategoryCell 
                                value={p.category} 
                                options={categoriesList} 
                                onChange={(val) => updateInvoiceProduct(idx, "category", val)} 
                              />
                            </td>
                            <td className="px-2.5 py-1.5">
                              <input className={`w-20 ${isHsnWarning ? 'bg-amber-500/10 border-amber-500/50' : 'bg-primary/5 border-primary/10'} border rounded focus:border-violet-500/40 text-primary text-[11px] outline-none px-1 py-0.5 transition-colors`}
                                value={p.hsnCode || ""} onChange={(e) => updateInvoiceProduct(idx, "hsnCode", e.target.value)} title={isHsnWarning ? "Missing HSN Code" : ""} />
                            </td>
                            <td className="px-2.5 py-1.5 text-right">
                              <input type="number" className={`w-12 ${isGstWarning ? 'bg-amber-500/10 border-amber-500/50' : 'bg-primary/5 border-primary/10'} border rounded focus:border-violet-500/40 text-primary text-[11px] text-right outline-none px-1 py-0.5 transition-colors`}
                                value={p.gstRate} onChange={(e) => updateInvoiceProduct(idx, "gstRate", Number(e.target.value))} min={0} max={100} title={isGstWarning ? "Missing GST Rate" : ""} />
                            </td>
                            <td className="px-2.5 py-1.5 text-right">
                              <input type="number" className={`w-14 ${isStockWarning ? 'bg-amber-500/10 border-amber-500/50' : 'bg-primary/5 border-primary/10'} border rounded focus:border-violet-500/40 text-primary text-[11px] text-right outline-none px-1 py-0.5 transition-colors`}
                                value={p.stock} onChange={(e) => updateInvoiceProduct(idx, "stock", Number(e.target.value))} min={0} title={isStockWarning ? "Missing Quantity" : ""} />
                            </td>
                            <td className="px-2.5 py-1.5 text-right">
                              <input type="number" className="w-14 bg-primary/5 border border-primary/10 rounded focus:border-violet-500/40 text-primary text-[11px] text-right outline-none px-1 py-0.5 transition-colors"
                                value={p.stock > 0 ? Number((p.stock / (p.unitsPerBag || 1)).toFixed(2)) : 0} 
                                onChange={(e) => {
                                  const bags = Number(e.target.value) || 1;
                                  const newUnitsPerBag = (p.stock || 0) / bags;
                                  updateInvoiceProduct(idx, "unitsPerBag", newUnitsPerBag);
                                }} min={0.01} step="any" title="Edit number of bags to correctly distribute transport/labour expenses" />
                            </td>
                            <td className="px-2.5 py-1.5 text-right">
                              <input type="number" className="w-16 bg-primary/5 border border-primary/10 rounded focus:border-violet-500/40 text-primary text-[11px] text-right outline-none px-1 py-0.5 transition-colors"
                                value={p.basePurchasePrice} onChange={(e) => updateInvoiceProduct(idx, "basePurchasePrice", Number(e.target.value))} min={0} step="any" />
                            </td>
                            <td className="px-2.5 py-1.5 text-right">
                              {(() => {
                                const baseWithGst = Number(p.basePurchasePrice || 0);
                                const perUnitExp = getProductPerUnitExpense(activeFile.id, p, idx);
                                const landed = baseWithGst + perUnitExp;
                                return (
                                  <span className="text-[11px] font-medium text-emerald-400" title={`Base (Incl. GST) ₹${baseWithGst.toFixed(2)} + Exp ₹${perUnitExp.toFixed(2)}`}>
                                    ₹{landed.toFixed(2)}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-2.5 py-1.5 text-right">
                              <input type="number" className="w-16 bg-primary/5 border border-primary/10 rounded focus:border-violet-500/40 text-primary text-[11px] text-right outline-none px-1 py-0.5 transition-colors"
                                value={p.sellingPrice} onChange={(e) => updateInvoiceProduct(idx, "sellingPrice", Number(e.target.value))} min={0} step="any" />
                            </td>
                            <td className="px-2.5 py-1.5 text-center">
                              <button onClick={() => removeInvoiceProduct(idx)}
                                className="text-rose-400/60 hover:text-rose-400 transition-all" title="Remove">
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>



                {/* Warnings / Errors Panel for Active File */}
                {activeFile.errors.length > 0 && (
                  <div className="rounded-xl overflow-hidden border border-rose-500/20 bg-rose-500/5">
                    <div className="px-3 py-2 text-xs font-medium text-rose-400 flex items-center gap-1.5">
                      <XCircle size={12} /> {activeFile.errors.length} Critical Validation Errors (must fix before import)
                    </div>
                    <div className="max-h-28 overflow-y-auto divide-y divide-rose-500/10 border-t border-rose-500/10">
                      {activeFile.errors.map((e, i) => (
                        <div key={i} className="flex items-start gap-2 px-3 py-1.5 text-[11px]">
                          <span className="text-primary/30 font-mono w-12">Row {e.row}</span>
                          <span className="text-rose-300/80 font-medium w-28 truncate">{e.column}</span>
                          <span className="text-primary/50">{e.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeFile.warnings.length > 0 && (
                  <div className="rounded-xl overflow-hidden border border-amber-500/20 bg-amber-500/5">
                    <div className="px-3 py-2 text-xs font-medium text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {activeFile.warnings.length} Warnings (review; will still import)
                    </div>
                    <div className="max-h-24 overflow-y-auto divide-y divide-amber-500/10 border-t border-amber-500/10">
                      {activeFile.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 px-3 py-1.5 text-[11px]">
                          <span className="text-primary/30 font-mono w-12">Row {w.row}</span>
                          <span className="text-amber-300/80 font-medium w-28 truncate">{w.column}</span>
                          <span className="text-primary/50">{w.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP: EXPENSES ── */}
      {step === "expenses" && files.length > 0 && (
        <div className="flex flex-col h-[600px] max-w-3xl mx-auto py-4">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-primary">Shared Inbound Expenses</h2>
            <p className="text-xs text-primary/40 mt-1">Add freight, loading, or transport costs to proportionally distribute landed costs across the imported products.</p>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-6 space-y-4">
             {sharedExpenses.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-12 border border-dashed border-primary/15 rounded-2xl bg-primary/3 h-full">
                 <Truck size={32} className="text-primary/20 mb-3" />
                 <p className="text-sm font-medium text-primary mb-1">No shared expenses added</p>
                 <p className="text-xs text-primary/40 mb-4 max-w-sm text-center">Do you have additional transport or handling bills that apply to these invoices?</p>
                 <Button onClick={addExpense} icon={<Plus size={14} />}>Add Expense</Button>
               </div>
             ) : (
                <div className="space-y-4">
                  {sharedExpenses.map((exp) => (
                    <div key={exp.id} className="p-4 rounded-xl border border-primary/10 bg-surface-2 space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <label className="text-[10px] text-primary/40 uppercase tracking-wider font-semibold mb-1.5 block">Expense Category</label>
                          <select
                            className="w-full bg-primary/5 border border-primary/10 rounded-lg text-primary text-sm outline-none px-3 py-2 transition-colors focus:border-violet-500/40"
                            value={exp.category}
                            onChange={(e) => updateExpense(exp.id, "category", e.target.value)}
                          >
                            {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-primary/40 uppercase tracking-wider font-semibold mb-1.5 block">Amount (₹)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30">₹</span>
                            <input
                              type="number"
                              className="w-full bg-primary/5 border border-primary/10 rounded-lg text-primary text-sm outline-none pl-7 pr-3 py-2 transition-colors focus:border-violet-500/40"
                              value={exp.amount || ""}
                              onChange={(e) => updateExpense(exp.id, "amount", Number(e.target.value))}
                              placeholder="0.00"
                              min={0}
                              step="any"
                            />
                          </div>
                        </div>
                        <button onClick={() => updateExpense(exp.id, "isExpanded", !(exp.isExpanded ?? true))} className="mt-6 p-2 text-primary/40 hover:text-primary transition-colors" title="Toggle Products">
                          {(exp.isExpanded ?? true) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button onClick={() => removeExpense(exp.id)} className="mt-6 p-2 text-rose-400/50 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors" title="Delete Expense">
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {(exp.isExpanded ?? true) && (
                        <div className="rounded-lg border border-primary/5 bg-primary/5 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-primary/50 font-medium">Apply expense to these products:</span>
                            <div className="flex gap-2 text-xs">
                              <button onClick={() => setProductApplicabilityAll(exp.id, true)} className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">Select All</button>
                              <span className="text-primary/10">|</span>
                              <button onClick={() => setProductApplicabilityAll(exp.id, false)} className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">Deselect All</button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {files.flatMap(f => (f.invoiceProducts || []).map((p, pIdx) => {
                              const productId = `${f.id}-${pIdx}`;
                              const allProductIds = files.flatMap(file => (file.invoiceProducts || []).map((_, i) => `${file.id}-${i}`));
                              const appliesTo = exp.applicableProductIds || allProductIds;
                              const isChecked = appliesTo.includes(productId);
                              return (
                                <label key={productId} className="flex items-center gap-2.5 text-xs text-primary/75 hover:text-primary cursor-pointer transition-colors select-none py-1 px-2 rounded-md hover:bg-primary/5">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleProductApplicability(exp.id, productId)}
                                    className="rounded border-primary/20 text-violet-500 focus:ring-violet-500/40 bg-transparent w-4 h-4 cursor-pointer"
                                  />
                                  <span className="truncate flex-1" title={p.name}>{p.name || 'Unnamed'} <span className="text-primary/30 ml-1 text-[10px]">({f.invoiceInfo?.invoiceNumber || 'Unknown'})</span></span>
                                </label>
                              );
                            }))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={addExpense} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium">
                    <Plus size={14} /> Add Another Expense
                  </button>
                </div>
             )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-primary/10">
            <Button variant="secondary" onClick={() => setStep("review")}>Back to Products</Button>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-primary/40 uppercase tracking-wider font-semibold">Total Additional Cost</p>
                <p className="text-sm font-bold text-violet-400">₹{totalExpenseAmount.toLocaleString('en-IN')}</p>
              </div>
              <Button onClick={() => setStep("summary")} className="group relative">
                <span className="flex items-center gap-1.5">
                  Review Final Summary
                  <span className="text-[9px] font-mono text-primary/40 bg-primary/5 px-1 rounded ml-1 group-hover:text-primary/70 transition-colors">Ctrl+↵</span>
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: SUMMARY ── */}
      {step === "summary" && files.length > 0 && (
        <div className="flex flex-col h-[600px] py-4">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-primary">Final Landed Cost Summary</h2>
            <p className="text-xs text-primary/40 mt-1">Review the final purchase prices including all shared expenses before importing.</p>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-xl border-primary/10 bg-surface-2 relative">
            <table className="w-full text-left text-xs text-primary/70">
              <thead className="bg-primary/5 sticky top-0 backdrop-blur-md z-10 text-[10px] uppercase tracking-wider text-primary/40 font-semibold border-b border-primary/10">
                <tr>
                  <th className="py-2.5 px-4 font-medium w-[25%]">Product Name</th>
                  <th className="py-2.5 px-4 font-medium text-right">Invoice Qty</th>
                  <th className="py-2.5 px-4 font-medium text-right">Base / Unit (₹)</th>
                  <th className="py-2.5 px-4 font-medium text-right">Exp / Unit (₹)</th>
                  <th className="py-2.5 px-4 font-medium text-right text-violet-400">Landed / Unit (₹)</th>
                  <th className="py-2.5 px-4 font-medium text-right text-emerald-400">Total Landed (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {files.filter(f => f.status === "success" && !f.trainingRequired).flatMap(f => 
                  (f.invoiceProducts || []).map((p, idx) => {
                    const units = Number(p.stock) || 0;
                    const basePrice = Number(p.basePurchasePrice || p.purchasePrice) || 0;
                    const perUnitExpense = getProductPerUnitExpense(f.id, p, idx);
                    const landedCostPerUnit = basePrice + perUnitExpense;
                    const totalLandedCost = landedCostPerUnit * units;
                    
                    return (
                      <tr key={`${f.id}-${idx}`} className="hover:bg-primary/5 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-primary truncate max-w-[200px]" title={p.name}>{p.name}</div>
                          <div className="text-[10px] text-primary/40 mt-0.5 font-mono">{f.invoiceInfo?.invoiceNumber || "Unknown Inv"}</div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium">{units.toFixed(1)} {p.unit || 'u'}</td>
                        <td className="py-2.5 px-4 text-right">₹{basePrice.toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right text-rose-400">
                          {perUnitExpense > 0 ? `+₹${perUnitExpense.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-violet-400">
                          ₹{landedCostPerUnit.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                          ₹{totalLandedCost.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 mt-4 border-t border-primary/10">
            <Button variant="secondary" onClick={() => setStep("expenses")}>Back to Expenses</Button>
            <div className="flex items-center gap-4">
              <Button onClick={handleInvoiceConfirmImport} className="group relative shadow-violet-500/20 shadow-lg">
                <span className="flex items-center gap-1.5">
                  Confirm & Import to Inventory
                  <span className="text-[9px] font-mono text-primary/40 bg-primary/5 px-1 rounded ml-1 group-hover:text-primary/70 transition-colors">Ctrl+↵</span>
                </span>
              </Button>
            </div>
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
            <p className="text-sm font-semibold text-primary">Importing all products from successful invoices…</p>
            <p className="text-xs text-primary/40 mt-1">Please do not close this modal</p>
          </div>
          <div className="w-64 h-2 bg-primary/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* ── STEP: DONE ── */}
      {step === "done" && importResults && (
        <div className="space-y-4 max-w-lg mx-auto">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-primary">Batch Import Complete!</p>
              <p className="text-xs text-primary/40 mt-1">
                Your inventory levels, layers, and landing expenses have been saved.
              </p>
            </div>
          </div>

          {/* Result cards */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Created New Products", value: importResults.created, color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/15" },
              { label: "Updated Existing Products", value: importResults.updated, color: "text-violet-400", bg: "bg-violet-500/5 border-violet-500/15" },
              { label: "Skipped / Ignored", value: importResults.skipped, color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/15" },
              { label: "Failed Items", value: importResults.failed, color: "text-rose-400", bg: "bg-rose-500/5 border-rose-500/15" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-3 text-center border ${s.bg}`}>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-primary/40 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={reset}
              icon={<Upload size={13} />}>Import More Invoices</Button>
            <Button size="sm" className="flex-1 justify-center" onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
