"use client";

import { useState } from "react";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/ui/Card";
import { StatCard } from "@/shared/ui/ui/StatCard";
import { Badge } from "@/shared/ui/ui/Badge";
import { Button } from "@/shared/ui/ui/Button";
import { usePayables, useCreatePayable } from "@/shared/hooks/useAccounting";
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import { ArrowUpRight, Clock, Plus, Landmark, Search } from "lucide-react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/shared/ui/ui/Modal";

export default function PayablesPage() {
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    supplierName: "",
    invoiceRef: "",
    amount: "",
    dueDate: "",
    category: "",
    notes: "",
  });

  const { data = { payables: [], aging: [], totalOutstanding: 0 }, isLoading } = usePayables(status || undefined);
  const createPayable = useCreatePayable();

  const handleOpenModal = () => {
    setForm({
      supplierName: "",
      invoiceRef: "",
      amount: "",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      category: "",
      notes: "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createPayable.mutateAsync({
        supplierName: form.supplierName,
        invoiceRef: form.invoiceRef,
        amount: parseFloat(form.amount) || 0,
        paidAmount: 0,
        dueDate: new Date(form.dueDate).toISOString(),
        category: form.category || null,
        notes: form.notes || null,
      });
      toast.success("Payable invoice logged successfully");
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create payable");
    } finally {
      setLoading(false);
    }
  };

  const filtered = data.payables.filter((p: any) =>
    !search ||
    p.supplierName.toLowerCase().includes(search.toLowerCase()) ||
    p.invoiceRef.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout title="Accounts Payable">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">Accounts Payable (AP)</h2>
          <p className="text-primary/40 text-sm mt-0.5">Track and analyze money owed to suppliers and vendor invoice aging</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={handleOpenModal}>Log Supplier Invoice</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-1">
          <StatCard label="AP Outstanding" value={formatCurrency(data.totalOutstanding)} icon={<ArrowUpRight size={18} />} color="amber" />
        </div>
        <div className="md:col-span-3">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-xs flex items-center gap-1.5"><Clock size={13} /> Payable Aging Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="py-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {data.aging.map((bucket: any, idx: number) => (
                  <div key={idx} className="bg-primary/5 p-3 rounded-xl border border-primary/5 text-center">
                    <span className="text-[10px] text-primary/40 block font-semibold">{bucket.label}</span>
                    <span className="text-sm font-bold text-primary block mt-1">{formatCurrency(bucket.amount)}</span>
                    <span className="text-[10px] text-violet-400 block mt-0.5">{bucket.count} invoices</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30" />
          <input
            type="text"
            placeholder="Search supplier or invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface border border-primary/10 text-sm text-primary placeholder:text-primary/30 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div className="flex gap-2">
          {["", "OUTSTANDING", "PARTIALLY_PAID", "PAID", "OVERDUE"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${status === s ? "bg-violet-500/20 text-violet-400" : "text-primary/40 hover:bg-primary/5"}`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-primary/40 text-sm">Loading payables...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-primary/40 text-sm">No payable entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/5 text-xs text-primary/40 border-b border-primary/10">
                    <th className="py-3 px-5">Supplier Name</th>
                    <th className="py-3 px-5">Invoice Reference</th>
                    <th className="py-3 px-5">Due Date</th>
                    <th className="py-3 px-5">Category</th>
                    <th className="py-3 px-5">Total Amount</th>
                    <th className="py-3 px-5">Paid Amount</th>
                    <th className="py-3 px-5">Balance Due</th>
                    <th className="py-3 px-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {filtered.map((p: any) => {
                    const balance = p.amount - p.paidAmount;
                    const isOverdue = new Date(p.dueDate) < new Date() && p.status !== "PAID";
                    return (
                      <tr key={p.id} className="hover:bg-primary/5 transition-colors font-medium">
                        <td className="py-3.5 px-5 whitespace-nowrap">{p.supplierName}</td>
                        <td className="py-3.5 px-5 text-violet-400">{p.invoiceRef}</td>
                        <td className={`py-3.5 px-5 whitespace-nowrap ${isOverdue ? "text-rose-400" : ""}`}>
                          {formatDate(p.dueDate)} {isOverdue && " (Overdue)"}
                        </td>
                        <td className="py-3.5 px-5 text-primary/60">{p.category || "—"}</td>
                        <td className="py-3.5 px-5 font-mono">{formatCurrency(p.amount)}</td>
                        <td className="py-3.5 px-5 font-mono text-emerald-400">{formatCurrency(p.paidAmount)}</td>
                        <td className="py-3.5 px-5 font-mono text-rose-400">{formatCurrency(balance)}</td>
                        <td className="py-3.5 px-5">
                          <Badge variant={
                            p.status === "PAID" ? "success" :
                            p.status === "PARTIALLY_PAID" ? "violet" :
                            isOverdue ? "danger" : "default"
                          }>
                            {isOverdue ? "OVERDUE" : p.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual invoice logger modal */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}
        title="Log Outstanding Payable" subtitle="Log historical or external vendor invoices to track payables"
        icon={<Landmark size={18} />} iconColor="bg-violet-500/20 text-violet-400">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Supplier / Vendor Name" required>
            <ModalInput required placeholder="e.g. Supplier Pvt Ltd" value={form.supplierName} onChange={e => setForm(prev => ({ ...prev, supplierName: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Invoice Reference" required>
              <ModalInput required placeholder="e.g. SUP-1002" value={form.invoiceRef} onChange={e => setForm(prev => ({ ...prev, invoiceRef: e.target.value }))} />
            </FormField>
            <FormField label="Amount (₹)" required>
              <ModalInput type="number" step="0.01" min="0.01" required placeholder="0.00" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Due Date" required>
              <ModalInput type="date" required value={form.dueDate} onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))} />
            </FormField>
            <FormField label="Expense Category">
              <ModalInput placeholder="e.g. Raw Material, Utility" value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Notes">
            <ModalInput placeholder="Optional description..." value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
          </FormField>
          <ModalFooter onClose={() => setIsModalOpen(false)} loading={loading} submitLabel="Log Invoice" />
        </form>
      </Modal>
    </DashboardLayout>
  );
}
