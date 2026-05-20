"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter, ModalTextarea } from "@/components/ui/Modal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Users } from "lucide-react";
import { useCreateCustomer, useCustomers } from "@/hooks/useCustomers";
import { useBusiness } from "@/hooks/useBusiness";
import { getBusinessProfile } from "@/lib/business-intelligence";

const INDIAN_STATES = [
  { label: "Andhra Pradesh", code: "37" }, { label: "Arunachal Pradesh", code: "12" },
  { label: "Assam", code: "18" }, { label: "Bihar", code: "10" },
  { label: "Chhattisgarh", code: "22" }, { label: "Goa", code: "30" },
  { label: "Gujarat", code: "24" }, { label: "Haryana", code: "06" },
  { label: "Himachal Pradesh", code: "02" }, { label: "Jharkhand", code: "20" },
  { label: "Karnataka", code: "29" }, { label: "Kerala", code: "32" },
  { label: "Madhya Pradesh", code: "23" }, { label: "Maharashtra", code: "27" },
  { label: "Manipur", code: "14" }, { label: "Meghalaya", code: "17" },
  { label: "Mizoram", code: "15" }, { label: "Nagaland", code: "13" },
  { label: "Odisha", code: "21" }, { label: "Punjab", code: "03" },
  { label: "Rajasthan", code: "08" }, { label: "Sikkim", code: "11" },
  { label: "Tamil Nadu", code: "33" }, { label: "Telangana", code: "36" },
  { label: "Tripura", code: "16" }, { label: "Uttar Pradesh", code: "09" },
  { label: "Uttarakhand", code: "05" }, { label: "West Bengal", code: "19" },
  { label: "Andaman and Nicobar Islands", code: "35" }, { label: "Chandigarh", code: "04" },
  { label: "Dadra and Nagar Haveli and Daman and Diu", code: "26" },
  { label: "Delhi", code: "07" }, { label: "Jammu and Kashmir", code: "01" },
  { label: "Ladakh", code: "38" }, { label: "Lakshadweep", code: "31" },
  { label: "Puducherry", code: "34" },
];

const stateOptions = INDIAN_STATES.map(s => ({ value: s.label, label: `${s.code} - ${s.label}` }));

export default function AddCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", city: "",
    state: "", stateCode: "", gstNumber: "", initialDues: "0",
  });

  const createCustomer = useCreateCustomer();
  const { data: business } = useBusiness();
  const { data: customers = [] } = useCustomers();

  const profile = business ? getBusinessProfile(business.businessType) : null;
  
  const sampleName = profile?.customerPlaceholder?.name || "e.g. Acme Corp";
  const sampleEmail = profile?.customerPlaceholder?.email || "e.g. john@example.com";
  const samplePhone = "+91 99999 00000";

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleStateChange = (val: string) => {
    const found = INDIAN_STATES.find(s => s.label === val);
    setForm(f => ({ ...f, state: val, stateCode: found?.code || "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createCustomer.mutateAsync({
        ...form,
        dues: parseFloat(form.initialDues) || 0,
        totalPurchases: 0,
      });
      setForm({ name: "", phone: "", email: "", address: "", city: "", state: "", stateCode: "", gstNumber: "", initialDues: "0" });
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to add customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}
      title="Add New Customer" subtitle="Register a new customer for GST billing and CRM"
      icon={<Users size={18} />} iconColor="bg-blue-500/20 text-blue-400">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Customer Name" required>
          <ModalInput required placeholder={sampleName} value={form.name} onChange={set("name")} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Phone Number" required>
            <ModalInput required type="tel" placeholder={samplePhone} value={form.phone} onChange={set("phone")} />
          </FormField>
          <FormField label="Email Address">
            <ModalInput type="email" placeholder={sampleEmail} value={form.email} onChange={set("email")} />
          </FormField>
        </div>

        <FormField label="Billing / Shipping Address">
          <ModalTextarea placeholder="Shop no, Street, Landmark..." value={form.address} onChange={set("address")} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="City / Town">
            <ModalInput placeholder="e.g. Mumbai" value={form.city} onChange={set("city")} />
          </FormField>
          <FormField label="State" hint="Auto-fills state code">
            <CustomSelect
              value={form.state}
              onChange={handleStateChange}
              options={stateOptions}
              placeholder="Select state..."
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="State Code" hint="Auto-filled from state">
            <ModalInput placeholder="e.g. 27" value={form.stateCode} onChange={set("stateCode")} />
          </FormField>
          <FormField label="GSTIN" hint="15-digit GST number (if registered)">
            <ModalInput
              placeholder="e.g. 27AAAAA0000A1Z5"
              value={form.gstNumber}
              onChange={set("gstNumber")}
              style={{ fontFamily: "monospace", textTransform: "uppercase" }}
            />
          </FormField>
        </div>

        <FormField label="Opening Dues (₹)" hint="Any existing unpaid amount">
          <ModalInput type="number" min="0" placeholder="0.00" value={form.initialDues} onChange={set("initialDues")} />
        </FormField>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Save Customer" />
      </form>
    </Modal>
  );
}
