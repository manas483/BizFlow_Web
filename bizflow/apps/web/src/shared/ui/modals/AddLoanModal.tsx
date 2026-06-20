"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter, ModalSelect } from "@/shared/ui/ui/Modal";
import { Landmark } from "lucide-react";
import { useCreateLoan } from "@/shared/hooks/useLoans";
import { generateEMISchedule } from "@/shared/lib/accounting-utils";
import { formatCurrency } from "@/shared/lib/utils";

export default function AddLoanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    borrowerName: "",
    loanType: "TERM_LOAN",
    amount: "",
    interestRate: "",
    tenure: "",
    startDate: "",
    lender: "",
    purpose: "Business Expansion",
    notes: "",
  });

  const createLoan = useCreateLoan();

  useEffect(() => {
    if (open) {
      setForm({
        borrowerName: "",
        loanType: "TERM_LOAN",
        amount: "",
        interestRate: "",
        tenure: "",
        startDate: new Date().toISOString().split("T")[0],
        lender: "",
        purpose: "Business Expansion",
        notes: "",
      });
    }
  }, [open]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // Dynamic preview calculations using pure accounting utility functions
  const amt = parseFloat(form.amount) || 0;
  const rate = parseFloat(form.interestRate) || 0;
  const tenureMonths = parseInt(form.tenure) || 0;
  const dateObj = form.startDate ? new Date(form.startDate) : new Date();

  let preview = { emiAmount: 0, totalInterest: 0, totalPayable: 0 };
  if (amt > 0 && rate >= 0 && tenureMonths > 0) {
    try {
      const res = generateEMISchedule(amt, rate, tenureMonths, dateObj);
      preview = { emiAmount: res.emiAmount, totalInterest: res.totalInterest, totalPayable: res.totalPayable };
    } catch (e) {
      console.error(e);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createLoan.mutateAsync({
        borrowerName: form.borrowerName,
        loanType: form.loanType,
        amount: parseFloat(form.amount),
        interestRate: parseFloat(form.interestRate),
        tenure: parseInt(form.tenure),
        startDate: new Date(form.startDate).toISOString(),
        lender: form.lender || null,
        purpose: form.purpose || null,
        notes: form.notes || null,
      });
      toast.success("Loan Master profile created and EMI schedule generated!");
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to create loan profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg"
      title="Create Loan Master Profile" subtitle="Setup a borrower profile and generate an EMI schedule"
      icon={<Landmark size={18} />} iconColor="bg-violet-500/20 text-violet-400">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Borrower Name" required>
            <ModalInput required placeholder="Name of Borrower" value={form.borrowerName} onChange={set("borrowerName")} />
          </FormField>
          <FormField label="Loan Type" required>
            <ModalSelect value={form.loanType} onChange={set("loanType")}>
              <option value="TERM_LOAN">Term Loan</option>
              <option value="PERSONAL_LOAN">Personal Loan</option>
              <option value="BUSINESS_LOAN">Business Loan</option>
              <option value="HOME_LOAN">Home Loan</option>
              <option value="VEHICLE_LOAN">Vehicle Loan</option>
              <option value="GOLD_LOAN">Gold Loan</option>
              <option value="WORKING_CAPITAL">Working Capital</option>
              <option value="OTHER">Other Loan</option>
            </ModalSelect>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Lender / Financial Institution">
            <ModalInput placeholder="e.g. SBI, HDFC, ICICI, NBFC" value={form.lender} onChange={set("lender")} />
          </FormField>
          <FormField label="Loan Purpose">
            <ModalSelect value={form.purpose} onChange={set("purpose")}>
              <option value="Business Expansion">Business Expansion</option>
              <option value="Working Capital">Working Capital</option>
              <option value="Machinery">Machinery & Equipment</option>
              <option value="Vehicle">Vehicle Purchase</option>
              <option value="Property">Property & Infrastructure</option>
              <option value="Other">Other Purpose</option>
            </ModalSelect>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Principal Amount (₹)" required>
            <ModalInput type="number" step="0.01" min="1" required placeholder="Principal Amount" value={form.amount} onChange={set("amount")} />
          </FormField>
          <FormField label="Interest Rate (% p.a.)" required>
            <ModalInput type="number" step="0.01" min="0" max="100" required placeholder="Annual Rate" value={form.interestRate} onChange={set("interestRate")} />
          </FormField>
          <FormField label="Tenure (Months)" required>
            <ModalInput type="number" step="1" min="1" required placeholder="Tenure" value={form.tenure} onChange={set("tenure")} />
          </FormField>
        </div>

        <FormField label="Disbursement / Start Date" required>
          <ModalInput type="date" required value={form.startDate} onChange={set("startDate")} />
        </FormField>

        {/* Real-time EMI Schedule Preview */}
        {amt > 0 && rate >= 0 && tenureMonths > 0 && (
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/5 space-y-2 text-xs">
            <h4 className="font-semibold uppercase tracking-wider text-primary/40">EMI Preview (Reducing Balance)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-primary/80">
              <div>
                <span className="text-[10px] text-primary/40 block">Monthly EMI:</span>
                <span className="font-bold text-sm text-violet-400">{formatCurrency(preview.emiAmount)}</span>
              </div>
              <div>
                <span className="text-[10px] text-primary/40 block">Total Interest:</span>
                <span className="font-bold text-sm text-emerald-400">{formatCurrency(preview.totalInterest)}</span>
              </div>
              <div>
                <span className="text-[10px] text-primary/40 block">Total Repayable:</span>
                <span className="font-bold text-sm text-emerald-400">{formatCurrency(preview.totalPayable)}</span>
              </div>
            </div>
          </div>
        )}

        <FormField label="Notes / Remarks">
          <ModalInput placeholder="Loan details, collateral info, covenants..." value={form.notes} onChange={set("notes")} />
        </FormField>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Generate Schedule & Save" />
      </form>
    </Modal>
  );
}
