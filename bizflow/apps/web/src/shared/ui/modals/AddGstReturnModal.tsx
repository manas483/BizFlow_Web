"use client";

import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter, ModalSelect } from "@/shared/ui/ui/Modal";
import { FileText, Zap, ChevronDown } from "lucide-react";
import { useCreateGstReturn } from "@/shared/hooks/useAccounting";
import { formatCurrency } from "@/shared/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const RETURN_TYPES = [
  { value: "GSTR-1",  label: "GSTR-1 — Outward Sales" },
  { value: "GSTR-3B", label: "GSTR-3B — Summary & Payment" },
  { value: "GSTR-4",  label: "GSTR-4 — Composition Dealer" },
  { value: "GSTR-9",  label: "GSTR-9 — Annual Return" },
  { value: "GSTR-9C", label: "GSTR-9C — Reconciliation Statement" },
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const GST_SLABS = [5, 12, 18, 28] as const;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 2 + i); // -2 to +3

// ── Types ─────────────────────────────────────────────────────────────────────

type Slab = { rate: number; intraValue: string; interValue: string };

interface FormState {
  month: string;   // "1" – "12"
  year: string;    // "2026"
  returnType: string;
  filingDate: string;
  status: string;
  slabs: Slab[];
  cessEnabled: boolean;
  cessRate: string;
  arn: string;
  challanNo: string;
  filingRef: string;
  notes: string;
}

function defaultForm(): FormState {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    returnType: "GSTR-1",
    filingDate: "",
    status: "PENDING",
    slabs: GST_SLABS.map(rate => ({ rate, intraValue: "", interValue: "" })),
    cessEnabled: false,
    cessRate: "0",
    arn: "",
    challanNo: "",
    filingRef: "",
    notes: "",
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AddGstReturnModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);

  const createGst = useCreateGstReturn();

  // Reset on open
  useEffect(() => { if (open) setForm(defaultForm()); }, [open]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const setField = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const setSlabField = (idx: number, field: "intraValue" | "interValue") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(f => {
        const slabs = f.slabs.map((s, i) => i === idx ? { ...s, [field]: e.target.value } : s);
        return { ...f, slabs };
      });
    };

  const isFiledOrRevised = form.status === "FILED" || form.status === "REVISED";

  // ── Auto-calculations ────────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const cessRate = form.cessEnabled ? (parseFloat(form.cessRate) || 0) : 0;

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalCess = 0;

    const slabCalcs = form.slabs.map(slab => {
      const intra = parseFloat(slab.intraValue) || 0;
      const inter = parseFloat(slab.interValue) || 0;
      const taxable = intra + inter;

      const cgst = Math.round(intra * slab.rate / 2 / 100 * 100) / 100;
      const sgst = cgst;
      const igst = Math.round(inter * slab.rate / 100 * 100) / 100;
      const cess = Math.round(taxable * cessRate / 100 * 100) / 100;

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;
      totalCess += cess;

      return { rate: slab.rate, taxable, cgst, sgst, igst, cess };
    });

    const totalTax = Math.round((totalCgst + totalSgst + totalIgst + totalCess) * 100) / 100;

    return {
      slabCalcs,
      totalTaxable: Math.round(totalTaxable * 100) / 100,
      totalCgst: Math.round(totalCgst * 100) / 100,
      totalSgst: Math.round(totalSgst * 100) / 100,
      totalIgst: Math.round(totalIgst * 100) / 100,
      totalCess: Math.round(totalCess * 100) / 100,
      totalTax,
      grossTotal: Math.round((totalTaxable + totalTax) * 100) / 100,
      hasAnyValue: totalTaxable > 0,
    };
  }, [form.slabs, form.cessRate, form.cessEnabled]);

  // ── Period ───────────────────────────────────────────────────────────────────

  const period = `${form.year}-${String(form.month).padStart(2, "0")}`;

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isFiledOrRevised && !form.filingDate) {
      toast.error("Filing Date is required when status is Filed or Revised");
      return;
    }

    setLoading(true);
    try {
      await createGst.mutateAsync({
        period,
        returnType: form.returnType,
        filingDate: form.filingDate ? new Date(form.filingDate).toISOString() : null,
        status: form.status,
        totalTaxable: calc.totalTaxable,
        totalCgst: calc.totalCgst,
        totalSgst: calc.totalSgst,
        totalIgst: calc.totalIgst,
        totalCess: calc.totalCess,
        notes: form.notes || null,
        data: {
          slabBreakdown: calc.slabCalcs,
          cessEnabled: form.cessEnabled,
          cessRate: form.cessEnabled ? parseFloat(form.cessRate) || 0 : 0,
          acknowledgement: isFiledOrRevised ? {
            arn: form.arn || null,
            challanNo: form.challanNo || null,
            filingRef: form.filingRef || null,
          } : null,
        },
      });
      toast.success("GST Return record saved");
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to create GST record");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Create GST Return Record"
      subtitle="Enter filing period data with rate-wise breakdowns"
      icon={<FileText size={18} />}
      iconColor="bg-violet-500/20 text-violet-400"
    >
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Row 1: Filing Period (month picker) + Return Type ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Month-Year Picker */}
          <FormField label="Filing Period" required>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  id="gst-month"
                  value={form.month}
                  onChange={setField("month")}
                  required
                  className="w-full appearance-none rounded-xl bg-surface-raised border border-primary/10 px-3 py-2.5 text-sm text-primary focus:outline-none focus:border-violet-500/50 cursor-pointer pr-8"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary/40 pointer-events-none" />
              </div>
              <div className="relative flex-1">
                <select
                  id="gst-year"
                  value={form.year}
                  onChange={setField("year")}
                  required
                  className="w-full appearance-none rounded-xl bg-surface-raised border border-primary/10 px-3 py-2.5 text-sm text-primary focus:outline-none focus:border-violet-500/50 cursor-pointer pr-8"
                >
                  {YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary/40 pointer-events-none" />
              </div>
            </div>
            <p className="text-[11px] text-primary/35 mt-1">Selected period: <span className="font-mono text-primary/60">{period}</span></p>
          </FormField>

          <FormField label="Return Type" required>
            <ModalSelect value={form.returnType} onChange={setField("returnType")}>
              {RETURN_TYPES.map(rt => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </ModalSelect>
          </FormField>
        </div>

        {/* ── Row 2: Status + Filing Date (conditional) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Filing Status" required>
            <ModalSelect value={form.status} onChange={setField("status")}>
              <option value="PENDING">Pending</option>
              <option value="FILED">Filed</option>
              <option value="REVISED">Revised</option>
            </ModalSelect>
          </FormField>

          {isFiledOrRevised && (
            <FormField label="Filing Date" required hint="Required when status is Filed / Revised">
              <ModalInput
                type="date"
                required
                value={form.filingDate}
                onChange={setField("filingDate")}
              />
            </FormField>
          )}
        </div>

        {/* ── GST Summary Table ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-primary/60 uppercase tracking-wider">
              Tax Rate-wise Turnover Breakup
            </span>
            <span className="text-[10px] text-primary/35">Enter taxable value (₹ excl. GST)</span>
          </div>

          <div className="rounded-xl border border-primary/10 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[100px_1fr_1fr_120px] bg-primary/5 text-[10px] font-bold uppercase tracking-widest text-primary/40 px-0">
              <div className="py-2.5 px-4">GST Rate</div>
              <div className="py-2.5 px-3 border-l border-primary/10">Intra-State Value (₹)<br/><span className="font-normal normal-case tracking-normal text-primary/30">CGST + SGST applies</span></div>
              <div className="py-2.5 px-3 border-l border-primary/10">Inter-State Value (₹)<br/><span className="font-normal normal-case tracking-normal text-primary/30">IGST applies</span></div>
              <div className="py-2.5 px-3 border-l border-primary/10">Tax Amount</div>
            </div>

            {/* Slab Rows */}
            {form.slabs.map((slab, idx) => {
              const sc = calc.slabCalcs[idx];
              return (
                <div key={slab.rate} className="grid grid-cols-[100px_1fr_1fr_120px] border-t border-primary/8 hover:bg-primary/[0.02] transition-colors">
                  {/* Rate badge */}
                  <div className="flex items-center px-4 py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 text-xs font-bold font-mono border border-violet-500/15">
                      {slab.rate}%
                    </span>
                  </div>

                  {/* Intra-State */}
                  <div className="px-3 py-2 border-l border-primary/8">
                    <input
                      id={`gst-slab-${slab.rate}-intra`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={slab.intraValue}
                      onChange={setSlabField(idx, "intraValue")}
                      className="w-full bg-transparent text-sm text-primary font-mono placeholder:text-primary/20 focus:outline-none border-b border-transparent focus:border-violet-500/40 pb-0.5 transition-colors"
                    />
                    {sc.taxable > 0 && sc.cgst > 0 && (
                      <div className="text-[10px] text-emerald-400/70 mt-1 font-mono">
                        CGST {formatCurrency(sc.cgst)} + SGST {formatCurrency(sc.sgst)}
                      </div>
                    )}
                  </div>

                  {/* Inter-State */}
                  <div className="px-3 py-2 border-l border-primary/8">
                    <input
                      id={`gst-slab-${slab.rate}-inter`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={slab.interValue}
                      onChange={setSlabField(idx, "interValue")}
                      className="w-full bg-transparent text-sm text-primary font-mono placeholder:text-primary/20 focus:outline-none border-b border-transparent focus:border-violet-500/40 pb-0.5 transition-colors"
                    />
                    {sc.igst > 0 && (
                      <div className="text-[10px] text-blue-400/70 mt-1 font-mono">
                        IGST {formatCurrency(sc.igst)}
                      </div>
                    )}
                  </div>

                  {/* Tax Amount for this slab */}
                  <div className="px-3 py-2 border-l border-primary/8 flex items-center">
                    <span className={`text-sm font-mono font-semibold ${sc.taxable > 0 ? "text-emerald-400" : "text-primary/25"}`}>
                      {sc.taxable > 0 ? formatCurrency(sc.cgst + sc.sgst + sc.igst + sc.cess) : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Cess Toggle ── */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none group" htmlFor="gst-cess-toggle">
            <div
              onClick={() => setForm(f => ({ ...f, cessEnabled: !f.cessEnabled }))}
              className={`relative w-8 h-4.5 rounded-full transition-colors ${form.cessEnabled ? "bg-violet-500" : "bg-primary/15"}`}
              style={{ height: "18px", width: "32px" }}
            >
              <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${form.cessEnabled ? "translate-x-[14px]" : "translate-x-0.5"}`} />
            </div>
            <span className="text-xs text-primary/50 group-hover:text-primary/70 transition-colors">Enable Cess</span>
          </label>
          {form.cessEnabled && (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-primary/40">Cess Rate (%):</span>
              <input
                id="gst-cess-rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.cessRate}
                onChange={setField("cessRate")}
                className="w-20 bg-surface-raised border border-primary/10 rounded-lg px-2 py-1 text-sm font-mono text-primary focus:outline-none focus:border-violet-500/50"
              />
            </div>
          )}
        </div>

        {/* ── Live Tax Breakdown Preview ── */}
        {calc.hasAnyValue && (
          <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={13} className="text-violet-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                Auto-Calculated Summary
              </span>
            </div>

            <div className="space-y-1.5 text-xs font-medium">
              <div className="flex justify-between py-1 border-b border-primary/8">
                <span className="text-primary/50">Total Taxable Value (excl. GST)</span>
                <span className="font-mono text-primary/80">{formatCurrency(calc.totalTaxable)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-primary/40">CGST</span>
                <span className="font-mono text-emerald-400">{formatCurrency(calc.totalCgst)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-primary/40">SGST</span>
                <span className="font-mono text-emerald-400">{formatCurrency(calc.totalSgst)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-primary/40">IGST</span>
                <span className="font-mono text-blue-400">{formatCurrency(calc.totalIgst)}</span>
              </div>
              {form.cessEnabled && calc.totalCess > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-primary/40">Cess</span>
                  <span className="font-mono text-amber-400">{formatCurrency(calc.totalCess)}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-t border-primary/10 mt-1">
                <span className="text-primary/70 font-semibold">Total Tax Liability</span>
                <span className="font-mono font-bold text-violet-400 text-sm">{formatCurrency(calc.totalTax)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-primary/40">Gross Invoice Total (incl. GST)</span>
                <span className="font-mono text-primary/60">{formatCurrency(calc.grossTotal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Acknowledgement Details (Filed/Revised only) ── */}
        {isFiledOrRevised && (
          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">Acknowledgement Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="ARN Number" hint="Acknowledgement Reference Number">
                <ModalInput
                  id="gst-arn"
                  placeholder="e.g. AA012345678901Z"
                  value={form.arn}
                  onChange={setField("arn")}
                />
              </FormField>
              <FormField label="Challan Number" hint="Tax payment challan">
                <ModalInput
                  id="gst-challan"
                  placeholder="e.g. 24051600123456"
                  value={form.challanNo}
                  onChange={setField("challanNo")}
                />
              </FormField>
            </div>
            <FormField label="Filing Reference Number">
              <ModalInput
                id="gst-filing-ref"
                placeholder="e.g. GST Portal reference number"
                value={form.filingRef}
                onChange={setField("filingRef")}
              />
            </FormField>
          </div>
        )}

        {/* ── Notes ── */}
        <FormField label="Notes / Comments">
          <ModalInput
            id="gst-notes"
            placeholder="Add challan references, audit notes, portal observations..."
            value={form.notes}
            onChange={setField("notes")}
          />
        </FormField>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Save Return Record" />
      </form>
    </Modal>
  );
}
