import { Role } from "@prisma/client";

export type Permission = 
  | "view_dashboard"
  | "manage_employees"
  | "manage_inventory"
  | "manage_sales"
  | "manage_customers"
  | "view_reports"
  | "manage_settings"
  | "manage_billing"
  | "process_payments";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "view_dashboard",
    "manage_employees",
    "manage_inventory",
    "manage_sales",
    "manage_customers",
    "view_reports",
    "manage_settings",
    "manage_billing",
    "process_payments",
  ],
  MANAGER: [
    "view_dashboard",
    "manage_inventory",
    "manage_sales",
    "manage_customers",
    "view_reports",
  ],
  ACCOUNTANT: [
    "view_dashboard",
    "view_reports",
    "manage_sales",
    "manage_billing",
    "process_payments",
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
