"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter, ModalSelect } from "@/shared/ui/ui/Modal";
import { Landmark } from "lucide-react";
import { useRecordLoanPayment, useLoanSchedule } from "@/shared/hooks/useLoans";

export default function RecordLoanPaymentModal({
  open,
  onClose,
  loanId,
  loanNumber,
  borrowerName,
  outstandingBalance = 0,
  suggestedAmount = 0,
}: {
  open: boolean;
  onClose: () => void;
  loanId: string;
  loanNumber: string;
  borrowerName: string;
  outstandingBalance?: number;
  suggestedAmount?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    paymentDate: "",
    amount: "",
    paymentType: "EMI",
    reference: "",
    notes: "",
  });

  const recordPayment = useRecordLoanPayment();
  const { data: scheduleData } = useLoanSchedule(open ? loanId : null);
  const schedule = scheduleData?.schedule || [];

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        paymentDate: new Date().toISOString().split("T")[0],
        amount: suggestedAmount > 0 ? suggestedAmount.toString() : "",
        paymentType: "EMI",
        reference: "",
        notes: "",
      });
    }
  }, [open, suggestedAmount]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // Calculate principal & interest splits dynamically
  const nextInstallment = schedule.find((s: any) => s.status === 'PENDING' || s.status === 'OVERDUE');
  const paymentAmt = parseFloat(form.amount) || 0;
  let principalPaid = 0;
  let interestPaid = 0;

  if (paymentAmt > 0) {
    if (form.paymentType === 'PREPAYMENT') {
      principalPaid = paymentAmt;
      interestPaid = 0;
    } else if (nextInstallment) {
      interestPaid = Math.min(paymentAmt, nextInstallment.interestAmount);
      principalPaid = Math.min(paymentAmt - interestPaid, nextInstallment.principalAmount);
      
      // If amount exceeds the current installment, allocate the rest to principal
      if (paymentAmt > nextInstallment.emiAmount) {
        principalPaid = paymentAmt - interestPaid;
      }
    } else {
      principalPaid = paymentAmt;
      interestPaid = 0;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanId) return;

    setLoading(true);
    try {
      await recordPayment.mutateAsync({
        loanId,
        data: {
          paymentDate: new Date(form.paymentDate).toISOString(),
          amount: parseFloat(form.amount) || 0,
          paymentType: form.paymentType,
          reference: form.reference || null,
          notes: form.notes || null,
        },
      });
      toast.success("Payment recorded successfully");
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={`Record Payment — ${loanNumber}`} subtitle={`Repayment from ${borrowerName}`}
      icon={<Landmark size={18} />} iconColor="bg-violet-500/20 text-violet-400">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Payment Date" required>
            <ModalInput type="date" required value={form.paymentDate} onChange={set("paymentDate")} />
          </FormField>
          <FormField label="Payment Type" required>
            <ModalSelect value={form.paymentType} onChange={set("paymentType")}>
              <option value="EMI">Regular EMI</option>
              <option value="PREPAYMENT">Prepayment (Reduce Principal)</option>
              <option value="PARTIAL">Partial EMI Payment</option>
              <option value="CLOSURE">Full Loan Closure</option>
            </ModalSelect>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Amount (₹)" required hint={`Current Outstanding: ₹${outstandingBalance.toFixed(2)}`}>
            <ModalInput type="number" step="0.01" min="0.01" required placeholder="0.00" value={form.amount} onChange={set("amount")} />
          </FormField>
          <FormField label="Payment Reference / Txn ID">
            <ModalInput placeholder="e.g. UPI Ref, NEFT, Cheque No" value={form.reference} onChange={set("reference")} />
          </FormField>
        </div>

        {paymentAmt > 0 && (
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/5 space-y-2 text-xs font-mono">
            <h4 className="font-semibold uppercase tracking-wider text-primary/40 font-sans">Payment Split Preview</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-primary/40 block">Principal Repayment (Reduces Outstanding):</span>
                <span className="font-bold text-sm text-emerald-400">₹{principalPaid.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-primary/40 block">Interest Paid (Expense):</span>
                <span className="font-bold text-sm text-violet-400">₹{interestPaid.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        <FormField label="Remarks / Notes">
          <ModalInput placeholder="Notes..." value={form.notes} onChange={set("notes")} />
        </FormField>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Record Payment" />
      </form>
    </Modal>
  );
}
