"use client";
import toast from "react-hot-toast";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Modal, { FormField, ModalInput, ModalFooter } from "@/shared/ui/ui/Modal";
import { CustomSelect } from "@/shared/ui/ui/CustomSelect";
import { ShoppingCart, Plus, ChevronDown, AlertTriangle, RefreshCw } from "lucide-react";
import { useCustomers } from "@/shared/hooks/useCustomers";
import { useProducts } from "@/shared/hooks/useProducts";
import { useCreateSale, useUpdateSale } from "@/shared/hooks/useSales";
import { useBusiness } from "@/shared/hooks/useBusiness";
import { useGlobalBarcode } from "@/shared/hooks/useGlobalBarcode";
import { formatCurrency } from "@/shared/lib/utils";
import AddCustomerModal from "@/shared/ui/modals/AddCustomerModal";
import AddProductModal from "@/shared/ui/modals/AddProductModal";
import ProductPickerModal from "@/shared/ui/ProductPicker/ProductPickerModal";
import { PRODUCT_PICKER_MAX_CACHE } from "@/shared/ui/ProductPicker/constants";
// ── Invoice components ──
import type { LineItem, InvoiceTotals } from "@/shared/ui/invoice/types";
import { createEmptyLineItem, createLineItemFromProduct, lineItemToPayload, computeFlatDiscount } from "@/shared/ui/invoice/types";
import LineItemRow from "@/shared/ui/invoice/LineItemRow";
import InvoiceSummary from "@/shared/ui/invoice/InvoiceSummary";
import { PaymentTermsSelect } from "@/shared/ui/invoice/PaymentTermsSelect";
import { SplitPaymentPanel, PaymentEntry } from "@/shared/ui/invoice/SplitPaymentPanel";

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




/** Searchable customer picker with filter input */
function CustomerPicker({
  value, onChange, customers, onAddNew,
}: {
  value: string;
  onChange: (id: string) => void;
  customers: any[];
  onAddNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) { setOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(o => !o);
  };

  const filtered = customers.filter((c: any) =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const selected = customers.find((c: any) => c.id === value);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm text-left transition-all focus:outline-none"
        style={{
          backgroundColor: "var(--input-bg)",
          border: "1px solid var(--input-border)",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <span className="truncate">{selected ? `${selected.name} (${selected.phone})` : "Select a customer..."}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
      </button>

      {open && rect && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: rect.bottom + 4,
            left: Math.min(rect.left, typeof window !== 'undefined' ? window.innerWidth - Math.max(rect.width, 280) - 16 : rect.left),
            width: Math.min(Math.max(rect.width, 280), typeof window !== 'undefined' ? window.innerWidth - 32 : 9999),
            zIndex: 9999,
            backgroundColor: "var(--bg-surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            maxHeight: "260px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search input */}
          <div className="p-2 border-b border-primary/10">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-primary/5 border border-primary/10 rounded-lg px-3 py-1.5 text-xs text-primary placeholder:text-primary/40 focus:outline-none focus:border-violet-500/50"
            />
          </div>

          {/* Add new customer */}
          <button
            type="button"
            onClick={() => { onAddNew(); setOpen(false); setSearch(""); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-violet-400 hover:bg-violet-500/10 transition-colors border-b border-primary/10 font-medium flex-shrink-0"
          >
            <Plus size={12} /> Add New Customer
          </button>

          {/* Customer list */}
          <div style={{ overflowY: "auto", maxHeight: "180px" }}>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-center" style={{ color: "var(--text-muted)" }}>No customers found</p>
            ) : filtered.map((c: any) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange(c.id); setOpen(false); setSearch(""); }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors"
              >
                <span style={{ color: c.id === value ? "#a78bfa" : "var(--text-secondary)" }}>
                  {c.name}
                </span>
                <span style={{ color: "var(--text-muted)" }}>{c.phone}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


export default function NewSaleModal({ open, onClose, editSaleId }: { open: boolean; onClose: () => void; editSaleId?: string }) {
  const [loading, setLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState<LineItem[]>([createEmptyLineItem()]);
  const [paid, setPaid] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [isAggregate, setIsAggregate] = useState(false);
  const [notes, setNotes] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null);
  // Invoice-level discount
  const [invoiceDiscountInput, setInvoiceDiscountInput] = useState("");
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<"flat" | "percent">("flat");
  const [paymentTerms, setPaymentTerms] = useState<string>("immediate");
  const [customDueDate, setCustomDueDate] = useState<string>("");
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [deletedItems, setDeletedItems] = useState<{item: LineItem, index: number, timer: any}[]>([]);
  const [workflowState, setWorkflowState] = useState<"draft" | "posted">("draft");

  // ── Permissions ──
  const { data: session } = useSession();
  const permissions = ((session?.user as any)?.permissions ?? []) as string[];
  const canOverridePrice = permissions.includes("override_selling_price");
  const canOverrideGst = permissions.includes("override_gst_rate");

  const { data: customersPaged } = useCustomers(undefined, 1, 100);
  const customers = customersPaged?.data ?? [];
  const { data: productsPaged } = useProducts(undefined, undefined, 1, PRODUCT_PICKER_MAX_CACHE, true);
  const products = productsPaged?.data ?? [];
  const { data: business } = useBusiness();
  const gstInclusive: boolean = business?.gstInclusive ?? false;
  const isInterState = placeOfSupply && business?.state
    ? placeOfSupply.toLowerCase() !== business.state.toLowerCase()
    : false;
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();

  // ── Phase 3: Barcode-First Workflow ──
  useGlobalBarcode({
    onScan: (barcode) => {
      if (!open) return;
      const product = products.find((p: any) => p.sku === barcode || p.id === barcode);
      if (product) {
        setItems(curr => {
          const newItems = [...curr];
          const existingIndex = newItems.findIndex(i => i.productId === product.id);
          if (existingIndex >= 0) {
            newItems[existingIndex].qty = String(Number(newItems[existingIndex].qty) + 1);
          } else {
            const emptyIndex = newItems.findIndex(i => !i.productId);
            if (emptyIndex >= 0) {
              newItems[emptyIndex] = createLineItemFromProduct(product);
            } else {
              newItems.push(createLineItemFromProduct(product));
            }
          }
          return newItems;
        });
        toast.success(`Scanned: ${product.name}`);
        // Play beep sound if available
        try { new Audio('/scan-beep.mp3').play().catch(() => {}); } catch(e) {}
      } else {
        toast.error(`Barcode not found: ${barcode}`);
      }
    }
  });

  useEffect(() => {
    if (open && editSaleId) {
      setIsFetchingData(true);
      fetch(`/api/sales/${editSaleId}`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            setCustomer(data.customerId || "");
            if (data.items && data.items.length > 0) {
              setItems(data.items.map((i: any) => ({
                productId: i.productId,
                qty: i.qty,
                price: i.price,
                originalPrice: i.price,
                priceOverrideReason: "",
                discount: i.discount || 0,
                discountType: "flat" as const,
                discountInput: i.discount || 0,
                hsnCode: i.hsnCode || "",
                gstRate: i.gstRate || 0,
                originalGstRate: i.gstRate || 0,
                unit: i.productUnit || "pcs",
              })));
            }
            setPaid(data.paid > 0 ? String(data.paid) : "");
            setPlaceOfSupply(data.placeOfSupply || "");
            setReverseCharge(!!data.reverseCharge);
            setIsAggregate(!!data.isAggregate);
            setNotes(data.notes || "");
            setInvoiceDate(data.invoiceDate ? new Date(data.invoiceDate).toISOString().split("T")[0] : new Date(data.createdAt).toISOString().split("T")[0]);
            setPaymentTerms(data.paymentTerms || "immediate");
            if (data.dueDate) setCustomDueDate(new Date(data.dueDate).toISOString().split("T")[0]);
            if (data.payments) {
              setPayments(data.payments.map((p: any) => ({
                id: p.id, paymentMethod: p.paymentMethod, amount: p.amount, reference: p.reference, notes: p.notes
              })));
            }
            setWorkflowState(data.workflowState || "posted");
          }
        })
        .finally(() => setIsFetchingData(false));
    } else if (!open) {
      // Clean up when modal closes
      resetForm();
    }
  }, [open, editSaleId]);

  const placeOfSupplyOptions = INDIAN_STATES.map(s => ({ value: s, label: s }));

  const resetForm = () => {
    setCustomer(""); setItems([createEmptyLineItem()]);
    setPaid(""); setPlaceOfSupply(""); setReverseCharge(false); setIsAggregate(false); setNotes("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setInvoiceDiscountInput(""); setInvoiceDiscountType("flat");
    setLastAddedIndex(null);
    setPaymentTerms("immediate"); setCustomDueDate(""); setPayments([]); setWorkflowState("draft");
    deletedItems.forEach(d => clearTimeout(d.timer)); setDeletedItems([]);
  };

  const handleCustomerChange = (val: string) => {
    setCustomer(val);
    // Auto-fill place of supply from customer's state
    const cust = customers.find((c: any) => c.id === val);
    if (cust?.state && !placeOfSupply) setPlaceOfSupply(cust.state);
  };

  const handleAddItem = () => setItems([...items, createEmptyLineItem()]);
  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleUpdateItem = useCallback((index: number, updates: Partial<LineItem>) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], ...updates };
      return newItems;
    });
  }, []);

  const handleAddSelectedProducts = (result: any) => {
    const selectedList = result.selections;
    if (selectedList.length === 0) return;

    if (pickingIndex !== null) {
      // Replace the specific row with the first selection
      const firstSel = selectedList[0];
      if (firstSel) {
        const newItems = [...items];
        newItems[pickingIndex] = createLineItemFromProduct(firstSel.product, firstSel.qty, firstSel.resolvedPrice);
        setLastAddedIndex(pickingIndex);
        
        // If there are more selections, append them (merging if necessary)
        const remainingSelections = selectedList.slice(1);
        remainingSelections.forEach((sel: any) => {
          const existingIdx = newItems.findIndex(i => i.productId === sel.product.id);
          if (existingIdx !== -1) {
            const currentQty = Number(newItems[existingIdx].qty) || 0;
            newItems[existingIdx] = { ...newItems[existingIdx], qty: currentQty + sel.qty };
            toast.success(`Merged quantity for ${sel.product.name}`);
          } else {
            newItems.push(createLineItemFromProduct(sel.product, sel.qty, sel.resolvedPrice));
            setLastAddedIndex(newItems.length - 1);
          }
        });
        setItems(newItems);
      }
    } else {
      // Append multi-selections with duplicate merge checks
      const activeItems = [...items].filter(i => i.productId !== "");
      const newItems = [...activeItems];

      selectedList.forEach((sel: any) => {
        const existingIdx = newItems.findIndex(i => i.productId === sel.product.id);
        if (existingIdx !== -1) {
          const currentQty = Number(newItems[existingIdx].qty) || 0;
          newItems[existingIdx] = { ...newItems[existingIdx], qty: currentQty + sel.qty };
          toast.success(`Merged quantity for ${sel.product.name}`);
        } else {
          newItems.push(createLineItemFromProduct(sel.product, sel.qty, sel.resolvedPrice));
        }
      });

      setItems(newItems.length > 0 ? newItems : [createEmptyLineItem()]);
      setLastAddedIndex(newItems.length - 1);
    }
  };

  // ── Totals ──
  const computeTotals = (): InvoiceTotals => {
    let subtotal = 0;
    let lineDiscountTotal = 0;
    let totalGst = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalQty = 0;
    let itemCount = 0;

    items.forEach(item => {
      if (!item.productId) return;
      const qty = Number(item.qty) || 0;
      const lineAmount = qty * item.price;
      const lineDiscount = item.discount || 0;
      const grossAmt = lineAmount - lineDiscount;
      const rate = item.gstRate || 0;

      subtotal += lineAmount;
      lineDiscountTotal += lineDiscount;
      totalQty += qty;
      itemCount++;

      let lineTax: number;
      if (gstInclusive && rate > 0) {
        const base = grossAmt / (1 + rate / 100);
        lineTax = grossAmt - base;
      } else {
        lineTax = grossAmt * (rate / 100);
      }

      totalGst += lineTax;
      if (isInterState) {
        totalIgst += lineTax;
      } else {
        totalCgst += lineTax / 2;
        totalSgst += lineTax - (lineTax / 2);
      }
    });

    // Invoice-level discount
    const invoiceDiscountRaw = Number(invoiceDiscountInput) || 0;
    let invoiceDiscountAmount = 0;
    if (invoiceDiscountType === "percent") {
      invoiceDiscountAmount = Math.round((subtotal - lineDiscountTotal) * invoiceDiscountRaw / 100 * 100) / 100;
    } else {
      invoiceDiscountAmount = Math.min(invoiceDiscountRaw, subtotal - lineDiscountTotal);
    }

    const taxableValue = subtotal - lineDiscountTotal - invoiceDiscountAmount;
    const preRoundTotal = taxableValue + totalGst;

    // Round-off to nearest rupee
    const roundedTotal = Math.round(preRoundTotal);
    const roundOff = Math.round((roundedTotal - preRoundTotal) * 100) / 100;

    const paidAmt = parseFloat(paid) || 0;

    return {
      itemCount,
      totalQty,
      subtotal,
      lineDiscountTotal,
      invoiceDiscountAmount,
      taxableValue,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGst,
      roundOff,
      grandTotal: roundedTotal,
      paid: paidAmt,
      balanceDue: Math.max(0, roundedTotal - paidAmt),
    };
  };

  const totals = computeTotals();
  const hasGst = items.some(i => (i.gstRate || 0) > 0);

  // ── Validation Panel ──
  const getValidationIssues = (): string[] => {
    const issues: string[] = [];
    if (!customer) issues.push("Select a customer");
    if (items.every(i => !i.productId)) issues.push("Add at least one product");
    items.forEach((item, i) => {
      if (item.productId && (Number(item.qty) || 0) <= 0) issues.push(`Line ${i + 1}: Qty must be > 0`);
      if (item.price !== item.originalPrice && item.originalPrice > 0 && !item.priceOverrideReason && canOverridePrice)
        issues.push(`Line ${i + 1}: Price override needs a reason`);
    });
    return issues;
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const saveSale = async (isDraft: boolean) => {
    const issues = getValidationIssues();
    if (issues.length > 0) {
      // Show first issue as toast for quick feedback
      toast.error(issues[0]);
      return;
    }

    if (!customer) { toast.error("Please select a customer"); return; }
    if (items.some(i => !i.productId)) { toast.error("Please select products for all items"); return; }

    setLoading(true);
    try {
      // Distribute invoice discount across items proportionally
      const invoiceDisc = totals.invoiceDiscountAmount;
      const subBeforeInvDisc = totals.subtotal - totals.lineDiscountTotal;
      const payloadItems = items.filter(i => i.productId).map(item => {
        const p = lineItemToPayload(item);
        if (invoiceDisc > 0 && subBeforeInvDisc > 0) {
          const lineNet = (Number(item.qty) || 0) * item.price - item.discount;
          const proportion = lineNet / subBeforeInvDisc;
          p.discount = Math.round((item.discount + invoiceDisc * proportion) * 100) / 100;
        }
        return p;
      });

      const payload = {
        customerId: customer,
        items: payloadItems,
        paid: totals.paid,
        notes: notes || undefined,
        placeOfSupply: placeOfSupply || undefined,
        reverseCharge,
        isAggregate,
        aggregateDate: isAggregate ? new Date().toISOString().split("T")[0] : undefined,
        invoiceDate: invoiceDate || undefined,
        workflowState: isDraft ? 'draft' : 'posted',
      };

      if (editSaleId) {
        await updateSale.mutateAsync({ id: editSaleId, data: payload });
        toast.success("Invoice updated successfully!");
      } else {
        await createSale.mutateAsync(payload);
        toast.success("Invoice created successfully!");
      }
      handleClose();
    } catch (error: any) {
      console.error(error);
      const msg = error?.message || `Failed to ${editSaleId ? "update" : "create"} invoice.`;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    saveSale(false);
  };

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Enter → submit
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        const form = document.querySelector("[data-invoice-form]") as HTMLFormElement;
        if (form) form.requestSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <Modal open={open} onClose={handleClose}
      title={editSaleId ? "Edit GST Invoice" : "Create GST Invoice"} subtitle="GST-compliant tax invoice for goods or services"
      icon={<ShoppingCart size={18} />} iconColor="bg-violet-500/20 text-violet-400" size="3xl">
      {isFetchingData ? (
        <div className="py-20 flex flex-col items-center justify-center text-primary/50">
          <RefreshCw size={24} className="animate-spin mb-4" />
          <p className="text-sm">Loading invoice details...</p>
        </div>
      ) : (
      <form onSubmit={handleSubmit} data-invoice-form className="space-y-5">

        {/* ── Customer + Date ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Select Customer" required>
            <CustomerPicker
              value={customer}
              onChange={handleCustomerChange}
              customers={customers}
              onAddNew={() => setIsAddCustomerOpen(true)}
            />
          </FormField>
          <FormField label="Invoice Date">
            <ModalInput type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </FormField>
        </div>

        {/* ── GST Details ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 rounded-xl border border-violet-500/20 bg-violet-500/5">
          <FormField label="Place of Supply" hint="State where delivered">
            <CustomSelect
              value={placeOfSupply}
              onChange={setPlaceOfSupply}
              options={placeOfSupplyOptions}
              placeholder="Select state..."
            />
          </FormField>
          <FormField label="Reverse Charge (RCM)" hint="Tax payable by recipient under RCM?">
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
                {reverseCharge ? "Yes — RCM Applicable" : "No"}
              </span>
            </div>
          </FormField>
          <FormField label="Aggregate Invoice" hint="For <₹200 unregistered bulk">
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => setIsAggregate(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  isAggregate ? "bg-violet-500" : "bg-primary/20"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAggregate ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={`text-xs font-medium ${isAggregate ? "text-violet-400" : "text-primary/40"}`}>
                {isAggregate ? "Yes" : "No"}
              </span>
            </div>
          </FormField>
        </div>

        {reverseCharge && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
            <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              Reverse Charge: Tax under this invoice is payable by the recipient. You must also issue a payment voucher on payment to the supplier.
            </p>
          </div>
        )}

        {/* ── Line Items ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Line Items</label>
              {gstInclusive && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 font-medium">GST Inclusive</span>
              )}
            </div>
            <button type="button" onClick={() => { setPickingIndex(null); setIsProductPickerOpen(true); }}
              className="text-xs font-medium text-violet-400 flex items-center gap-1 hover:text-violet-300 transition-colors">
              <Plus size={14} /> Add Items
            </button>
          </div>

          <div className="bg-primary/5 border border-primary/10 rounded-xl overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-left text-sm min-w-[720px]">
              <thead className="bg-primary/5 border-b border-primary/10 text-primary/40 text-xs">
                <tr>
                  <th className="p-3 font-medium text-left">Product</th>
                  <th className="p-3 font-medium w-20 min-w-[70px]">HSN/SAC</th>
                  <th className="p-3 font-medium w-24 min-w-[85px]">Qty / Unit</th>
                  <th className="p-3 font-medium w-32 min-w-[120px]">Rate (₹)</th>
                  <th className="p-3 font-medium w-28 min-w-[100px]">Discount</th>
                  <th className="p-3 font-medium w-20 min-w-[75px]">GST</th>
                  <th className="p-3 font-medium w-28 min-w-[110px]">Line Total</th>
                  <th className="p-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {items.map((item, index) => (
                  <LineItemRow
                    key={index}
                    item={item}
                    index={index}
                    product={products.find((p: any) => p.id === item.productId)}
                    gstInclusive={gstInclusive}
                    canOverridePrice={canOverridePrice}
                    canOverrideGst={canOverrideGst}
                    onUpdate={handleUpdateItem}
                    onRemove={handleRemoveItem}
                    onOpenPicker={(i) => { setPickingIndex(i); setIsProductPickerOpen(true); }}
                    isOnly={items.length === 1}
                    autoFocusQty={index === lastAddedIndex && item.productId !== ""}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Validation issues panel */}
          {(() => {
            const issues = getValidationIssues();
            return issues.length > 0 && items.some(i => i.productId) ? (
              <div className="flex flex-wrap gap-1.5 px-1">
                {issues.map((issue, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {issue}
                  </span>
                ))}
              </div>
            ) : null;
          })()}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <PaymentTermsSelect
            value={paymentTerms}
            onChange={setPaymentTerms}
            customDueDate={customDueDate}
            onCustomDueDateChange={setCustomDueDate}
            disabled={workflowState === 'posted'}
          />
          <SplitPaymentPanel
            total={totals.grandTotal}
            payments={payments}
            onChange={setPayments}
            disabled={workflowState === 'posted'}
          />
        </div>

        {/* ── Summary + Payment ── */}
        <div className="pt-2 pb-2">
          <InvoiceSummary
            totals={totals}
            gstInclusive={gstInclusive}
            isInterState={!!isInterState}
            hasGst={hasGst}
            placeOfSupply={placeOfSupply}
            invoiceDiscountInput={invoiceDiscountInput}
            invoiceDiscountType={invoiceDiscountType}
            onInvoiceDiscountInputChange={setInvoiceDiscountInput}
            onInvoiceDiscountTypeChange={setInvoiceDiscountType}
            paid={paid}
            onPaidChange={setPaid}
            notes={notes}
            onNotesChange={setNotes}
            maxPayable={totals.grandTotal}
          />

          <div className="flex items-center justify-between mt-8 pt-4 border-t border-primary/10 gap-3">
            <button 
              type="button" 
              onClick={() => saveSale(true)} 
              disabled={loading}
              className="px-5 py-2.5 border border-primary/10 text-primary/60 rounded-xl hover:bg-primary/5 hover:text-primary disabled:opacity-50 text-sm font-medium transition-all"
            >
              {loading ? "Saving..." : "Save Draft"}
            </button>
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleClose} disabled={loading} className="px-4 py-2.5 text-primary/50 hover:text-primary transition-colors text-sm font-medium">Cancel</button>
              <button
                type="button"
                onClick={() => saveSale(false)}
                disabled={loading || items.length === 0 || !customer}
                className="px-8 py-2.5 rounded-xl text-sm font-semibold text-white transition-all bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 shadow-lg shadow-violet-500/20 disabled:opacity-50 hover:-translate-y-0.5"
              >
                {workflowState === 'draft' ? "Confirm & Post" : (editSaleId ? "Update Invoice" : "Confirm & Post")}
              </button>
            </div>
          </div>

          {/* Keyboard hint */}
          <p className="text-center text-[10px] text-primary/20 mt-3">
            <kbd className="px-1 py-0.5 rounded bg-primary/5 border border-primary/10 text-primary/30">Ctrl+Enter</kbd> Generate Invoice
          </p>
        </div>
      </form>
      )}
      
      <AddCustomerModal open={isAddCustomerOpen} onClose={() => setIsAddCustomerOpen(false)} />
      <AddProductModal open={isAddProductOpen} onClose={() => setIsAddProductOpen(false)} />
      <ProductPickerModal
        open={isProductPickerOpen}
        onClose={() => {
          setIsProductPickerOpen(false);
          setPickingIndex(null);
        }}
        headerActions={
          <button
            onClick={() => setIsAddProductOpen(true)}
            className="flex items-center px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Product
          </button>
        }
        onAdd={handleAddSelectedProducts}
        customer={customers.find((c: any) => c.id === customer)}
        mode="sale"
        initialItems={items.map(item => ({ productId: item.productId, qty: Number(item.qty) || 0 }))}
        singleSelectIndex={pickingIndex}
      />
    </Modal>
  );
}
