"use client";

import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter, ModalSelect } from "@/shared/ui/ui/Modal";
import { Percent, Zap } from "lucide-react";
import { useCreateTdsEntry } from "@/shared/hooks/useAccounting";
import { formatCurrency } from "@/shared/lib/utils";

// Statutory default TDS rates per section
const SECTION_DEFAULTS: Record<string, { rate: number; description: string }> = {
  "194C": { rate: 1,   description: "Contractors / Sub-contractors" },
  "194J": { rate: 10,  description: "Professional / Technical Fees" },
  "194I": { rate: 10,  description: "Rent on Land / Building" },
  "194H": { rate: 5,   description: "Commission / Brokerage" },
  "192":  { rate: 30,  description: "Salary (Slab Rate)" },
  "194A": { rate: 10,  description: "Interest (Banks)" },
  "194D": { rate: 5,   description: "Insurance Commission" },
  "194Q": { rate: 0.1, description: "Purchase of Goods" },
};

export default function AddTdsEntryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    section: "194C",
    deducteeName: "",
    deducteePan: "",
    paymentDate: "",
    paymentAmount: "",
    tdsRate: "1",
    depositDate: "",
    challanNo: "",
    status: "DEDUCTED",
    notes: "",
  });

  const createTds = useCreateTdsEntry();

  // When section changes → auto-fill the default TDS rate
  const handleSectionChange = (section: string) => {
    const def = SECTION_DEFAULTS[section];
    setForm(prev => ({
      ...prev,
      section,
      tdsRate: def ? def.rate.toString() : prev.tdsRate,
    }));
  };

  useEffect(() => {
    if (open) {
      setForm({
        section: "194C",
        deducteeName: "",
        deducteePan: "",
        paymentDate: new Date().toISOString().split("T")[0],
        paymentAmount: "",
        tdsRate: "1",
        depositDate: "",
        challanNo: "",
        status: "DEDUCTED",
        notes: "",
      });
    }
  }, [open]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // ── Auto TDS calculation ──────────────────────────────────────────────────
  const calc = useMemo(() => {
    const payAmt = parseFloat(form.paymentAmount) || 0;
    const rate = parseFloat(form.tdsRate) || 0;
    const tdsAmount = Math.round(payAmt * rate / 100 * 100) / 100;
    const netPayable = Math.round((payAmt - tdsAmount) * 100) / 100;
    return { tdsAmount, netPayable, rate };
  }, [form.paymentAmount, form.tdsRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createTds.mutateAsync({
        section: form.section,
        deducteeName: form.deducteeName,
        deducteePan: form.deducteePan || null,
        paymentDate: new Date(form.paymentDate).toISOString(),
        paymentAmount: parseFloat(form.paymentAmount) || 0,
        tdsRate: parseFloat(form.tdsRate) || 0,
        tdsAmount: calc.tdsAmount,
        depositDate: form.depositDate ? new Date(form.depositDate).toISOString() : null,
        challanNo: form.challanNo || null,
        status: form.status,
        notes: form.notes || null,
      });
      toast.success("TDS entry saved successfully");
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to save TDS record");
    } finally {
      setLoading(false);
    }
  };

  const payAmt = parseFloat(form.paymentAmount) || 0;
  const sectionInfo = SECTION_DEFAULTS[form.section];

  return (
    <Modal open={open} onClose={onClose} size="lg"
      title="Create TDS Record" subtitle="TDS amount is auto-calculated from payment amount × rate"
      icon={<Percent size={18} />} iconColor="bg-violet-500/20 text-violet-400">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section + Deductee */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="TDS Section" required>
            <ModalSelect value={form.section} onChange={e => handleSectionChange(e.target.value)}>
              {Object.entries(SECTION_DEFAULTS).map(([code, info]) => (
                <option key={code} value={code}>Sec {code} — {info.description}</option>
              ))}
            </ModalSelect>
          </FormField>
          <FormField label="Deductee / Payee Name" required>
            <ModalInput required placeholder="Name of Deductee" value={form.deducteeName} onChange={set("deducteeName")} />
          </FormField>
        </div>

        {/* PAN + Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Deductee PAN" hint="10-character PAN">
            <ModalInput
              placeholder="e.g. ABCDE1234F"
              value={form.deducteePan}
              onChange={set("deducteePan")}
              style={{ textTransform: "uppercase" }}
            />
          </FormField>
          <FormField label="Payment / Invoice Date" required>
            <ModalInput type="date" required value={form.paymentDate} onChange={set("paymentDate")} />
          </FormField>
        </div>

        {/* Payment Amount + TDS Rate → auto-calculates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Gross Payment Amount (₹)" required>
            <ModalInput
              type="number" step="0.01" min="0.01" required
              placeholder="Total payment before deduction"
              value={form.paymentAmount}
              onChange={set("paymentAmount")}
            />
          </FormField>
          <FormField label={`TDS Rate (%) — Sec ${form.section} default: ${sectionInfo?.rate ?? "—"}%`} required>
            <ModalInput
              type="number" step="0.01" min="0" max="100" required
              placeholder={sectionInfo?.rate?.toString() ?? "0"}
              value={form.tdsRate}
              onChange={set("tdsRate")}
            />
          </FormField>
        </div>

        {/* Auto-calculated TDS preview */}
        {payAmt > 0 && (
          <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={13} className="text-violet-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                Auto-Calculated TDS
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-primary/5 p-2.5 rounded-lg text-center border border-primary/5">
                <span className="text-primary/40 block text-[10px] font-semibold uppercase">Gross Payment</span>
                <span className="font-mono font-bold text-primary text-sm">{formatCurrency(payAmt)}</span>
              </div>
              <div className="bg-rose-500/10 p-2.5 rounded-lg text-center border border-rose-500/10">
                <span className="text-rose-400/70 block text-[10px] font-semibold uppercase">TDS @ {calc.rate}%</span>
                <span className="font-mono font-bold text-rose-400 text-sm">{formatCurrency(calc.tdsAmount)}</span>
              </div>
              <div className="bg-emerald-500/10 p-2.5 rounded-lg text-center border border-emerald-500/10">
                <span className="text-emerald-400/70 block text-[10px] font-semibold uppercase">Net Payable</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">{formatCurrency(calc.netPayable)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Status + Challan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-primary/5 pt-4">
          <FormField label="TDS Status" required>
            <ModalSelect value={form.status} onChange={set("status")}>
              <option value="DEDUCTED">Deducted (To Be Deposited)</option>
              <option value="DEPOSITED">Deposited (Challan Paid)</option>
              <option value="FILED">Filed (Return Submitted)</option>
            </ModalSelect>
          </FormField>
          <FormField label="Challan / BSR Number" hint="Only if Deposited/Filed">
            <ModalInput placeholder="e.g. BSR12345/2026" value={form.challanNo} onChange={set("challanNo")} />
          </FormField>
        </div>

        {form.status !== "DEDUCTED" && (
          <FormField label="Deposit / Payment Date">
            <ModalInput type="date" value={form.depositDate} onChange={set("depositDate")} />
          </FormField>
        )}

        <FormField label="Remarks / Memo">
          <ModalInput placeholder="Internal notes..." value={form.notes} onChange={set("notes")} />
        </FormField>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Save TDS Record" />
      </form>
    </Modal>
  );
}
