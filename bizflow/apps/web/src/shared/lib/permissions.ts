import { Role } from "@prisma/client";

export type Permission =
  | "view_dashboard"
  | "manage_employees"
  | "manage_inventory"
  | "view_inventory"
  | "manage_sales"
  | "manage_customers"
  | "view_reports"
  | "manage_settings"
  | "manage_billing"
  | "process_payments"
  | "manage_accounting"
  | "manage_loans"
  | "view_audit_trail"
  | "manage_backups"
  | "manage_security"
  | "manage_roles";

/** All available permissions — used by the custom role editor UI. */
export const ALL_PERMISSIONS: { key: Permission; label: string; group: string }[] = [
  // Core
  { key: "view_dashboard",    label: "View Dashboard",         group: "Core" },
  { key: "manage_settings",   label: "Manage Settings",        group: "Core" },
  // People
  { key: "manage_employees",  label: "Manage Employees",       group: "People" },
  { key: "manage_customers",  label: "Manage Customers",       group: "People" },
  // Operations
  { key: "manage_inventory",  label: "Manage Inventory",       group: "Operations" },
  { key: "view_inventory",    label: "View Inventory (Read-Only)", group: "Operations" },
  { key: "manage_sales",      label: "Manage Sales & Billing", group: "Operations" },
  { key: "process_payments",  label: "Process Payments",       group: "Operations" },
  // Finance
  { key: "manage_billing",    label: "Manage Expenses",        group: "Finance" },
  { key: "manage_accounting", label: "Manage Accounting",      group: "Finance" },
  { key: "manage_loans",      label: "Manage Loans",           group: "Finance" },
  { key: "view_reports",      label: "View Reports",           group: "Finance" },
  // Administration
  { key: "view_audit_trail",  label: "View Audit Trail",       group: "Administration" },
  { key: "manage_backups",    label: "Manage Backups",         group: "Administration" },
  { key: "manage_security",   label: "Manage Security",        group: "Administration" },
  { key: "manage_roles",      label: "Manage Roles",           group: "Administration" },
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "view_dashboard",
    "manage_employees",
    "manage_inventory",
    "view_inventory",
    "manage_sales",
    "manage_customers",
    "view_reports",
    "manage_settings",
    "manage_billing",
    "process_payments",
    "manage_accounting",
    "manage_loans",
    "view_audit_trail",
    "manage_backups",
    "manage_security",
    "manage_roles",
  ],
  ADMIN: [
    "view_dashboard",
    "manage_employees",
    "manage_inventory",
    "view_inventory",
    "manage_sales",
    "manage_customers",
    "view_reports",
    "manage_settings",
    "manage_billing",
    "process_payments",
    "manage_accounting",
    "manage_loans",
    "view_audit_trail",
    "manage_backups",
  ],
  ACCOUNTANT: [
    "view_dashboard",
    "view_reports",
    "manage_sales",
    "manage_billing",
    "process_payments",
    "manage_accounting",
    "manage_loans",
  ],
  SALES_EXECUTIVE: [
    "view_dashboard",
    "manage_sales",
    "manage_customers",
    "process_payments",
  ],
  STORE_MANAGER: [
    "view_dashboard",
    "manage_employees",
    "manage_inventory",
    "view_inventory",
    "manage_sales",
    "manage_customers",
    "view_reports",
    "manage_loans",
  ],
  EMPLOYEE: [
    "view_dashboard",
    "view_inventory",
    "manage_sales",
  ],
  // ── Deprecated roles (kept for migration compatibility) ──
  MANAGER: [
    "view_dashboard",
    "manage_inventory",
    "manage_sales",
    "manage_customers",
    "view_reports",
    "manage_loans",
  ],
  STAFF: [
    "view_dashboard",
    "manage_inventory",
    "manage_sales",
  ],
  CUSTOM_ROLE: [
    "view_dashboard",
  ],
};

/** Display-friendly role names (used in UI). */
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN:    "Super Admin",
  ADMIN:          "Admin",
  ACCOUNTANT:     "Accountant",
  SALES_EXECUTIVE: "Sales Executive",
  STORE_MANAGER:  "Store Manager",
  EMPLOYEE:       "Employee",
  MANAGER:        "Manager",
  STAFF:          "Staff",
  CUSTOM_ROLE:    "Custom Role",
};

export function hasPermission(userRole: Role, permission: Permission, customPermissions?: string[]): boolean {
  // If it's a super admin, they have all permissions
  if (userRole === "SUPER_ADMIN") return true;

  // Check predefined permissions for the role
  const predefined = ROLE_PERMISSIONS[userRole] || [];
  if (predefined.includes(permission)) return true;

  // Check custom permissions if any
  if (customPermissions && customPermissions.includes(permission)) return true;

  return false;
}
