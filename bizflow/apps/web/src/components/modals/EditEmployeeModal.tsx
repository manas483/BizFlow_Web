"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal, { FormField, ModalInput, ModalFooter } from "@/components/ui/Modal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { UserCheck, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { useUpdateEmployee } from "@/hooks/useEmployees";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

const ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "STAFF", label: "Staff" },
  { value: "CUSTOM_ROLE", label: "Custom Role" },
];
const DEPARTMENTS = [
  { value: "Operations", label: "Operations" },
  { value: "Finance", label: "Finance" },
  { value: "Sales", label: "Sales" },
  { value: "Inventory", label: "Inventory" },
  { value: "Logistics", label: "Logistics" },
];

export default function EditEmployeeModal({ employee, onClose }: { employee: any; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>({
    name: "", email: "", phone: "", role: "STAFF", department: "Sales", designation: "", salary: "", joinDate: "",
    permissions: [],
  });
  const [showPermissions, setShowPermissions] = useState(false);

  useEffect(() => {
    if (employee) setForm({
      name: employee.name ?? "",
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      role: employee.role ?? "STAFF",
      department: employee.department ?? "Sales",
      designation: employee.designation ?? "",
      salary: String(employee.salary ?? 0),
      joinDate: employee.joinDate ? new Date(employee.joinDate).toISOString().split("T")[0] : "",
      permissions: employee.permissions || ROLE_PERMISSIONS[employee.role as keyof typeof ROLE_PERMISSIONS] || [],
    });
  }, [employee]);

  const updateEmployee = useUpdateEmployee();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateEmployee.mutateAsync({
        id: employee.id,
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        role: form.role,
        department: form.department,
        designation: form.designation || null,
        salary: parseFloat(form.salary) || 0,
        joinDate: form.joinDate,
        permissions: form.permissions,
      });
      onClose();
    } catch { toast.error("Failed to update employee"); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={!!employee} onClose={onClose}
      title="Edit Employee" subtitle="Update employee details"
      icon={<UserCheck size={18} />} iconColor="bg-emerald-500/20 text-emerald-400" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Full Name" required>
            <ModalInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Phone">
            <ModalInput type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Email" required>
          <ModalInput type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Role (Access Level)">
            <CustomSelect value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={ROLES} />
          </FormField>
          <FormField label="Department">
            <CustomSelect value={form.department} onChange={(v) => setForm({ ...form, department: v })} options={DEPARTMENTS} />
          </FormField>
        </div>
        <FormField label="Designation (Job Title)">
          <ModalInput placeholder="e.g. Senior Sales Executive" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        </FormField>

        <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={() => setShowPermissions(!showPermissions)}
            className="flex items-center justify-between w-full text-sm font-medium text-primary hover:text-violet-500 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield size={16} />
              <span>Advanced Permissions</span>
            </div>
            {showPermissions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {showPermissions && (
            <div className="grid grid-cols-2 gap-2 mt-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
              {Object.keys(ROLE_PERMISSIONS.SUPER_ADMIN).map((perm: any) => {
                const permission = ROLE_PERMISSIONS.SUPER_ADMIN[perm];
                return (
                  <label key={permission} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(permission)}
                      onChange={(e) => {
                        const newPerms = e.target.checked
                          ? [...form.permissions, permission]
                          : form.permissions.filter((p: string) => p !== permission);
                        setForm({ ...form, permissions: newPerms });
                      }}
                      className="w-4 h-4 rounded border-primary/20 text-violet-600 focus:ring-violet-500/20"
                    />
                    <span className="text-xs text-primary/60 group-hover:text-primary transition-colors capitalize">
                      {permission.replace(/_/g, " ")}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <FormField label="Monthly Salary (₹)">
            <ModalInput type="number" min="0" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
          </FormField>
          <FormField label="Join Date">
            <ModalInput type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} />
          </FormField>
        </div>
        <ModalFooter onClose={onClose} loading={loading} submitLabel="Save Changes" />
      </form>
    </Modal>
  );
}
