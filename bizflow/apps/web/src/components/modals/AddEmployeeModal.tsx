"use client";

import { useState } from "react";
import Modal, { FormField, ModalInput, ModalFooter } from "@/components/ui/Modal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { UserCheck, Shield, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { useCreateEmployee } from "@/hooks/useEmployees";
import { useBusiness } from "@/hooks/useBusiness";
import { getBusinessProfile } from "@/lib/business-intelligence";
import { ROLE_PERMISSIONS, Permission } from "@/lib/permissions";

const ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin — Full Access" },
  { value: "MANAGER", label: "Manager — Operations & Sales" },
  { value: "ACCOUNTANT", label: "Accountant — Finance & Reports" },
  { value: "STAFF", label: "Staff — Basic Operations" },
  { value: "CUSTOM_ROLE", label: "Custom Role — Define Manually" },
];

const DEPARTMENTS = [
  { value: "Operations", label: "Operations" },
  { value: "Finance", label: "Finance" },
  { value: "Sales", label: "Sales" },
  { value: "Inventory", label: "Inventory" },
  { value: "Logistics", label: "Logistics" },
  { value: "Management", label: "Management" },
  { value: "HR", label: "HR" },
];

const ALL_PERMISSIONS: Permission[] = [
  "view_dashboard",
  "manage_employees",
  "manage_inventory",
  "manage_sales",
  "manage_customers",
  "view_reports",
  "manage_settings",
  "manage_billing",
  "process_payments",
  "manage_accounting",
  "manage_loans",
];

const PERMISSION_LABELS: Record<Permission, string> = {
  view_dashboard: "View Dashboard",
  manage_employees: "Manage Employees",
  manage_inventory: "Manage Inventory",
  manage_sales: "Manage Sales",
  manage_customers: "Manage Customers",
  view_reports: "View Reports",
  manage_settings: "Manage Settings",
  manage_billing: "Manage Billing",
  process_payments: "Process Payments",
  manage_accounting: "Manage Accounting",
  manage_loans: "Manage Loans",
};

export default function AddEmployeeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPermissions, setShowPermissions] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    role: "STAFF", department: "Sales", designation: "",
    salary: "", joinDate: new Date().toISOString().split("T")[0],
    permissions: ROLE_PERMISSIONS["STAFF"] as Permission[],
  });

  const createEmployee = useCreateEmployee();
  const { data: business } = useBusiness();

  const profile = business ? getBusinessProfile(business.businessType) : null;
  const domain = profile?.displayName ? profile.displayName.toLowerCase().replace(/[^a-z0-9]/g, '') : "bizflow";
  const sampleEmail = `employee@${domain}.com`;

  const handleRoleChange = (role: string) => {
    const defaultPerms = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || ["view_dashboard"] as Permission[];
    setForm({ ...form, role, permissions: defaultPerms });
  };

  const togglePermission = (perm: Permission, checked: boolean) => {
    const newPerms = checked
      ? [...form.permissions, perm]
      : form.permissions.filter((p) => p !== perm);
    setForm({ ...form, permissions: newPerms });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createEmployee.mutateAsync({
        ...form,
        salary: parseFloat(form.salary) || 0,
        permissions: form.permissions,
      });
      setForm({
        name: "", email: "", phone: "", role: "STAFF", department: "Sales",
        designation: "", salary: "", joinDate: new Date().toISOString().split("T")[0],
        permissions: ROLE_PERMISSIONS["STAFF"],
      });
      setShowPermissions(false);
      setError("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add employee. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open} onClose={onClose}
      title="Add New Employee" subtitle="Invite a new staff member with role-based access"
      icon={<UserCheck size={18} />} iconColor="bg-emerald-500/20 text-emerald-400" size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Error Banner */}
        {error && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Full Name" required>
            <ModalInput required placeholder="e.g. Ramesh Kumar" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Phone Number">
            <ModalInput type="tel" placeholder="+91 98765 43210" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </FormField>
        </div>

        <FormField label="Email Address" required>
          <ModalInput type="email" required placeholder={sampleEmail} value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Role (Access Level)" required>
            <CustomSelect
              value={form.role}
              onChange={handleRoleChange}
              options={ROLES}
            />
          </FormField>
          <FormField label="Department">
            <CustomSelect
              value={form.department}
              onChange={(v) => setForm({ ...form, department: v })}
              options={DEPARTMENTS}
            />
          </FormField>
        </div>

        <FormField label="Designation (Job Title)">
          <ModalInput placeholder="e.g. Senior Sales Executive" value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        </FormField>

        {/* Role Permissions Preview */}
        <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={() => setShowPermissions(!showPermissions)}
            className="flex items-center justify-between w-full text-sm font-medium text-primary hover:text-violet-400 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield size={15} />
              <span>Access Permissions</span>
              <span className="text-xs text-primary/40 font-normal">
                ({form.permissions.length} of {ALL_PERMISSIONS.length} enabled)
              </span>
            </div>
            {showPermissions ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {/* Quick preview badges */}
          {!showPermissions && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {form.permissions.slice(0, 5).map((perm) => (
                <span key={perm} className="px-2 py-0.5 rounded-full text-[10px] font-medium
                  bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  {PERMISSION_LABELS[perm]}
                </span>
              ))}
              {form.permissions.length > 5 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/5 text-primary/40">
                  +{form.permissions.length - 5} more
                </span>
              )}
            </div>
          )}

          {showPermissions && (
            <div className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-xs text-primary/40 mb-3">
                These permissions are auto-set based on the selected role. You can customize them.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <label key={perm} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(perm)}
                      onChange={(e) => togglePermission(perm, e.target.checked)}
                      className="w-4 h-4 rounded border-primary/20 text-violet-600 focus:ring-violet-500/20 accent-violet-500"
                    />
                    <span className="text-xs text-primary/60 group-hover:text-primary transition-colors capitalize">
                      {PERMISSION_LABELS[perm]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <FormField label="Monthly Salary (₹)" required>
            <ModalInput type="number" required min="0" placeholder="e.g. 18000" value={form.salary}
              onChange={(e) => setForm({ ...form, salary: e.target.value })} />
          </FormField>
          <FormField label="Joining Date">
            <ModalInput type="date" value={form.joinDate}
              onChange={(e) => setForm({ ...form, joinDate: e.target.value })} />
          </FormField>
        </div>

        {/* Invitation Info */}
        <div className="rounded-xl p-3 bg-emerald-500/5 border border-emerald-500/15 text-xs text-emerald-400">
          <div className="flex items-center gap-2 font-medium mb-1">
            <UserCheck size={13} />
            <span>Secure Invitation Email</span>
          </div>
          <p className="text-emerald-400/70">
            A tokenized invitation link (valid 7 days) will be sent to the employee's email immediately after adding. They will set their own password and verify their identity.
          </p>
        </div>

        <ModalFooter onClose={onClose} loading={loading} submitLabel="Add Employee & Send Invite" />
      </form>
    </Modal>
  );
}
