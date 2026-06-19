import { describe, test, expect } from 'vitest';
import { hasPermission, ROLE_PERMISSIONS, ALL_PERMISSIONS, Role, Permission } from '@/shared/lib/permissions';

describe('Permissions Engine - Standard Role Checks', () => {
  test('SUPER_ADMIN has every permission', () => {
    ALL_PERMISSIONS.forEach(({ key }) => {
      expect(hasPermission('SUPER_ADMIN', key)).toBe(true);
    });
  });

  test('EMPLOYEE cannot manage_accounting, manage_settings, manage_employees', () => {
    expect(hasPermission('EMPLOYEE', 'manage_accounting')).toBe(false);
    expect(hasPermission('EMPLOYEE', 'manage_settings')).toBe(false);
    expect(hasPermission('EMPLOYEE', 'manage_employees')).toBe(false);
  });

  test('SALES_EXECUTIVE can manage_sales but not manage_inventory', () => {
    expect(hasPermission('SALES_EXECUTIVE', 'manage_sales')).toBe(true);
    expect(hasPermission('SALES_EXECUTIVE', 'manage_inventory')).toBe(false);
  });

  test('ACCOUNTANT can manage_accounting but not manage_employees', () => {
    expect(hasPermission('ACCOUNTANT', 'manage_accounting')).toBe(true);
    expect(hasPermission('ACCOUNTANT', 'manage_employees')).toBe(false);
  });

  test('STORE_MANAGER can manage_inventory but not manage_accounting', () => {
    expect(hasPermission('STORE_MANAGER', 'manage_inventory')).toBe(true);
    expect(hasPermission('STORE_MANAGER', 'manage_accounting')).toBe(false);
  });

  test('Every role in ROLE_PERMISSIONS has view_dashboard', () => {
    const roles = Object.keys(ROLE_PERMISSIONS) as Role[];
    roles.forEach(role => {
      expect(hasPermission(role, 'view_dashboard')).toBe(true);
    });
  });
});

describe('Permissions Engine - Custom Permissions', () => {
  test('Custom permission grants access even if role denies (additive override)', () => {
    // EMPLOYEE normally cannot view_reports
    expect(hasPermission('EMPLOYEE', 'view_reports')).toBe(false);
    
    // But with custom permissions, they can
    expect(hasPermission('EMPLOYEE', 'view_reports', ['view_reports'])).toBe(true);
  });

  test.todo('REVOCATION GAP: custom permissions cannot revoke predefined role permissions');
});

describe('Permissions Engine - Exhaustive Role x Permission Matrix', () => {
  test('Programmatically verify all denied permissions across all roles', () => {
    const roles = Object.keys(ROLE_PERMISSIONS) as Role[];
    
    roles.forEach(role => {
      // SUPER_ADMIN is exempt because they have all permissions explicitly or implicitly
      if (role === 'SUPER_ADMIN') return;
      
      const allowedPermissions = ROLE_PERMISSIONS[role] || [];
      
      ALL_PERMISSIONS.forEach(({ key }) => {
        if (!allowedPermissions.includes(key)) {
          // If the permission is not explicitly listed in ROLE_PERMISSIONS for this role, it should be false
          expect(hasPermission(role, key)).toBe(false);
        } else {
          // If it is listed, it should be true
          expect(hasPermission(role, key)).toBe(true);
        }
      });
    });
  });
});
