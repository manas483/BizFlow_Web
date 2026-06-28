"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/shared/ui/ui/Modal";
import { Users } from "lucide-react";
import { useUpdateCustomer } from "@/shared/hooks/useCustomers";

export default function EditCustomerModal({ customer, onClose }: { customer: any; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", dues: "", status: "active" });

  useEffect(() => {
    if (customer) setForm({
      name: customer.name ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      city: customer.city ?? "",
      dues: String(customer.dues ?? 0),
      status: customer.status ?? "active",
    });
  }, [customer]);

  const updateCustomer = useUpdateCustomer();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateCustomer.mutateAsync({
        id: customer.id,
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        city: form.city || null,
        dues: parseFloat(form.dues) || 0,
        status: form.status,
      });
      onClose();
    } catch (error: any) { toast.error(error.message || "Failed to update customer"); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={!!customer} onClose={onClose}
      title="Edit Customer" subtitle="Update customer details"
      icon={<Users size={18} />} iconColor="bg-blue-500/20 text-blue-400">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Customer Name" required>
          <ModalInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Phone">
            <ModalInput type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </FormField>
          <FormField label="Email">
            <ModalInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="City">
            <ModalInput value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </FormField>
          <FormField label="Outstanding Dues (₹)">
            <ModalInput type="number" min="0" step="any" value={form.dues} onChange={(e) => setForm({ ...form, dues: e.target.value })} />
          </FormField>
        </div>
        {/* Status toggle */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Account Status</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Toggle customer active/inactive</p>
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...form, status: form.status === "active" ? "inactive" : "active" })}
            className={`relative w-10 h-5 rounded-full transition-all duration-200 ${form.status === "active" ? "bg-emerald-600" : "bg-primary/10"}`}
            aria-label="Toggle customer status"
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${form.status === "active" ? "left-5" : "left-0.5"}`} />
          </button>
        </div>
        <ModalFooter onClose={onClose} loading={loading} submitLabel="Save Changes" />
      </form>
    </Modal>
  );
}
