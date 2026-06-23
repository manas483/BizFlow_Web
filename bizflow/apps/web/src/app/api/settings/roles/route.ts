export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requirePermission, withAuth, AuthError, getRequestMeta } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';
import { logAudit } from '@/shared/lib/audit';
import { ALL_PERMISSIONS, Permission } from '@/shared/lib/permissions';

const validPermissionKeys = new Set(ALL_PERMISSIONS.map(p => p.key));

// GET /api/roles — list all custom roles for the business
export const GET = withAuth(async () => {
  const session = await requirePermission('manage_roles');

  const customRoles = await prisma.customRole.findMany({
    where: { businessId: session.user.businessId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: customRoles });
});

// POST /api/roles — create a new custom role
export const POST = withAuth(async (req: Request) => {
  const session = await requirePermission('manage_roles');
  const body = await req.json();

  const { name, description, permissions } = body as {
    name?: string;
    description?: string;
    permissions?: string[];
  };

  if (!name?.trim()) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Role name is required' } },
      { status: 400 }
    );
  }

  if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one permission is required' } },
      { status: 400 }
    );
  }

  // Validate all permission keys
  const invalidPerms = permissions.filter(p => !validPermissionKeys.has(p as Permission));
  if (invalidPerms.length > 0) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid permissions: ${invalidPerms.join(', ')}` } },
      { status: 400 }
    );
  }

  // Check for duplicate name
  const existing = await prisma.customRole.findUnique({
    where: { businessId_name: { businessId: session.user.businessId, name: name.trim() } },
  });
  if (existing) {
    return NextResponse.json(
      { success: false, error: { code: 'DUPLICATE', message: 'A role with this name already exists' } },
      { status: 409 }
    );
  }

  const role = await prisma.customRole.create({
    data: {
      name:        name.trim(),
      description: description?.trim() || null,
      permissions,
      businessId:  session.user.businessId,
    },
  });

  const meta = await getRequestMeta();
  await logAudit({
    session,
    action: 'CREATE',
    entityType: 'CustomRole',
    entityId: role.id,
    entityLabel: role.name,
    ...meta,
  });

  return NextResponse.json({ success: true, data: role }, { status: 201 });
});

// PATCH /api/roles — update a custom role
export const PATCH = withAuth(async (req: Request) => {
  const session = await requirePermission('manage_roles');
  const body = await req.json();

  const { id, name, description, permissions } = body as {
    id: string;
    name?: string;
    description?: string;
    permissions?: string[];
  };

  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Role ID is required' } },
      { status: 400 }
    );
  }

  const existing = await prisma.customRole.findFirst({
    where: { id, businessId: session.user.businessId },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } },
      { status: 404 }
    );
  }

  // Validate permissions if provided
  if (permissions) {
    const invalidPerms = permissions.filter(p => !validPermissionKeys.has(p as Permission));
    if (invalidPerms.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid permissions: ${invalidPerms.join(', ')}` } },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.customRole.update({
    where: { id },
    data: {
      ...(name        ? { name: name.trim() }              : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
      ...(permissions ? { permissions }                    : {}),
    },
  });

  const meta = await getRequestMeta();
  await logAudit({
    session,
    action: 'UPDATE',
    entityType: 'CustomRole',
    entityId: updated.id,
    entityLabel: updated.name,
    changes: {
      ...(name && name !== existing.name ? { name: { old: existing.name, new: name } } : {}),
      ...(permissions ? { permissions: { old: existing.permissions, new: permissions } } : {}),
    },
    ...meta,
  });

  return NextResponse.json({ success: true, data: updated });
});

// DELETE /api/roles — delete a custom role
export const DELETE = withAuth(async (req: Request) => {
  const session = await requirePermission('manage_roles');
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Role ID is required' } },
      { status: 400 }
    );
  }

  const existing = await prisma.customRole.findFirst({
    where: { id, businessId: session.user.businessId },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } },
      { status: 404 }
    );
  }

  // Check if any employees are using this custom role
  const usersWithRole = await prisma.employee.count({
    where: {
      businessId: session.user.businessId,
      role: 'CUSTOM_ROLE',
      // Check if any employee has a custom permissions set matching this role
    },
  });

  await prisma.customRole.delete({ where: { id } });

  const meta = await getRequestMeta();
  await logAudit({
    session,
    action: 'DELETE',
    entityType: 'CustomRole',
    entityId: id,
    entityLabel: existing.name,
    ...meta,
  });

  return NextResponse.json({ success: true });
});

