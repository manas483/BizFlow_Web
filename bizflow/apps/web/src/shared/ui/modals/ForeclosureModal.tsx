"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter, ModalSelect } from "@/shared/ui/ui/Modal";
import { Landmark, AlertTriangle } from "lucide-react";
import { useForeclosure, useExecuteForeclosure } from "@/shared/hooks/useLoans";
import { formatCurrency } from "@/shared/lib/utils";

export default function ForeclosureModal({
  open,
  onClose,
  loanId,
  loanNumber,
  borrowerName,
}: {
  open: boolean;
  onClose: () => void;
  loanId: string;
  loanNumber: string;
  borrowerName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [chargesPercent, setChargesPercent] = useState<number>(2.0);
  const [form, setForm] = useState({
    paymentDate: "",
    reference: "",
    notes: "",
  });

  const { data: calc, isLoading } = useForeclosure(open ? loanId : null, chargesPercent);
  const executeForeclosure = useExecuteForeclosure();

  useEffect(() => {
    if (open) {
      setForm({
        paymentDate: new Date().toISOString().split("T")[0],
        reference: "",
        notes: "",
      });
      setChargesPercent(2.0);
    }
  }, [open]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanId) return;

    setLoading(true);
    try {
      await executeForeclosure.mutateAsync({
        loanId,
        data: {
          chargesPercent,
          paymentDate: new Date(form.paymentDate).toISOString(),
          reference: form.reference || null,
          notes: form.notes || null,
        },
      });
      toast.success("Loan foreclosed successfully and settled!");
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to execute foreclosure");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={`Foreclose Loan — ${loanNumber}`} subtitle={`Compute prepayment and close loan for ${borrowerName}`}
      icon={<Landmark size={18} />} iconColor="bg-rose-500/20 text-rose-400">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex gap-3 text-xs text-rose-300">
          <AlertTriangle className="shrink-0 mt-0.5" size={16} />
          <div>
            <span className="font-bold block">Warning: Irreversible Action</span>
            Foreclosing this loan will immediately set the outstanding balance to zero and write off all upcoming interest schedule payments. It will record a final closure ledger entry.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Closure Date" required>
            <ModalInput type="date" required value={form.paymentDate} onChange={set("paymentDate")} />
          </FormField>
          <FormField label="Pre-closure Charges (%)" required>
            <ModalInput 
              type="number" 
              step="0.1" 
              min="0" 
              max="100" 
              required 
              value={chargesPercent.toString()} 
              onChange={e => setChargesPercent(parseFloat(e.target.value) || 0)} 
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <FormField label="Transaction Reference / ID">
            <ModalInput placeholder="e.g. Bank Transfer Ref, NEFT, Cheque No" value={form.reference} onChange={set("reference")} />
          </FormField>
        </div>

        {/* Calculations display */}
        {isLoading ? (
          <div className="text-center py-6 text-xs text-primary/40 font-mono">Computing foreclosure details...</div>
        ) : calc ? (
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/5 space-y-3 text-xs font-mono">
            <h4 className="font-semibold uppercase tracking-wider text-primary/40 font-sans">Foreclosure Calculation Breakdown</h4>
            <div className="space-y-2 text-primary/80">
              <div className="flex justify-between border-b border-primary/5 pb-1.5">
                <span>Outstanding Principal:</span>
                <span className="font-bold">{formatCurrency(calc.outstandingPrincipal)}</span>
              </div>
              <div className="flex justify-between border-b border-primary/5 pb-1.5">
                <span>Pre-closure Charges ({chargesPercent}%):</span>
                <span className="font-bold text-rose-400">+{formatCurrency(calc.chargesAmount)}</span>
              </div>
              <div className="flex justify-between pt-1 text-sm font-sans">
                <span className="font-semibold text-primary">Final Settlement Amount:</span>
                <span className="font-bold text-emerald-400 font-mono text-base">{formatCurrency(calc.finalSettlementAmount)}</span>
              </div>
            </div>
          </div>
        ) : null}

        <FormField label="Remarks / Closure Notes">
          <ModalInput placeholder="Notes about foreclosure..." value={form.notes} onChange={set("notes")} />
        </FormField>

        <ModalFooter onClose={onClose} loading={loading || isLoading} submitLabel="Foreclose & Settle" />
      </form>
    </Modal>
  );
}
