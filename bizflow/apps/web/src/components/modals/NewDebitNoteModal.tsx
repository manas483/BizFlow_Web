"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/components/ui/Modal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { FileUp } from "lucide-react";
import { useSales } from "@/hooks/useSales";
import { useCreateDebitNote } from "@/hooks/useInvoiceDocs";

export default function NewDebitNoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [saleId, setSaleId] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: salesPaged } = useSales(undefined, undefined, 1, 100);
  const sales = salesPaged?.data ?? [];
  const createNote = useCreateDebitNote();

  const saleOptions = sales.map((s: any) => ({
    value: s.id,
    label: `${s.invoiceNo} - ${s.customer?.name} (₹${s.total})`,
  }));

  const reasonOptions = [
    { value: "lower_taxable_value", label: "Lower Taxable Value Charged" },
    { value: "lower_tax_value", label: "Lower Tax Charged" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleId || !reason) { toast.error("Please select an invoice and a reason"); return; }
    setLoading(true);
    try {
      const sale = sales.find((s: any) => s.id === saleId);
      await createNote.mutateAsync({
        saleId,
        customerId: sale.customerId,
        reason,
        amount: parseFloat(amount) || 0,
        taxAmount: parseFloat(taxAmount) || 0,
        notes,
      });
      setSaleId(""); setReason(""); setAmount(""); setTaxAmount(""); setNotes("");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create debit note");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Debit Note" subtitle="Issue a debit note to correct an undercharge" icon={<FileUp size={18} />} iconColor="bg-amber-500/20 text-amber-400">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Select Original Invoice" required>
          <CustomSelect value={saleId} onChange={setSaleId} options={saleOptions} placeholder="Select invoice..." />
        </FormField>
        <FormField label="Reason for Issuance" required>
          <CustomSelect value={reason} onChange={setReason} options={reasonOptions} placeholder="Select reason..." />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Additional Taxable Value (₹)" required>
            <ModalInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </FormField>
          <FormField label="Additional GST (₹)" required>
            <ModalInput type="number" min="0" step="0.01" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} required />
          </FormField>
        </div>
        <FormField label="Notes">
          <ModalInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional details..." />
        </FormField>
        <ModalFooter onClose={onClose} loading={loading} submitLabel="Generate Debit Note" />
      </form>
    </Modal>
  );
}
