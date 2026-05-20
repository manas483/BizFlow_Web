/**
 * GET    /api/v1/employees/[id]
 * PUT    /api/v1/employees/[id]   (SUPER_ADMIN only)
 * DELETE /api/v1/employees/[id]   (SUPER_ADMIN only)
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { employeeSchema }         from '@/lib/validations';
import { ok, deleted, notFound, validationError, internalError } from '@/lib/response';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session  = await requireAuth();
    const { id }   = await params;
    const employee = await prisma.employee.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!employee) return notFound('Employee not found');
    return ok(employee);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    const { id }  = await params;
    const exists  = await prisma.employee.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Employee not found');

    const parsed = employeeSchema.partial().safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);
    const data = parsed.data as any;

    const employee = await prisma.$transaction(async (tx: any) => {
      const emp = await tx.employee.update({
        where: { id },
        data:  { ...data, ...(data.joinDate ? { joinDate: new Date(data.joinDate) } : {}) },
      });
      // Propagate role/name changes to the linked User record
      if (exists.userId && (data.role || data.name)) {
        await tx.user.update({
          where: { id: exists.userId },
          data:  { ...(data.role ? { role: data.role } : {}), ...(data.name ? { name: data.name } : {}) },
        });
      }
      if (data.role && emp.role !== exists.role) {
        await tx.userActivity.create({ data: { businessId: session.user.businessId, userId: session.user.id, eventType: 'EMPLOYEE_ROLE_CHANGED', metadata: { employeeId: emp.id, oldRole: exists.role, newRole: emp.role } } });
      }
      return emp;
    });

    return ok(employee, { message: 'Employee updated' });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    const { id }  = await params;
    const exists  = await prisma.employee.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Employee not found');
    await prisma.employee.delete({ where: { id } });
    return deleted(id);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}
