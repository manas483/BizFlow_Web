import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { employeeSchema } from '@/shared/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const employee = await prisma.employee.findFirst({
      where: { id, businessId: session.user.businessId, deletedAt: null },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    const { id } = await params;
    const body = await req.json();

    // Ensure the record belongs to this business
    const existing = await prisma.employee.findFirst({
      where: { id, businessId: session.user.businessId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const validatedData = employeeSchema.partial().parse(body);

    const employee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id },
        data: {
          ...validatedData,
          ...(validatedData.joinDate ? { joinDate: new Date(validatedData.joinDate) } : {}),
        },
      });

      if (existing.userId && (validatedData.role || validatedData.name)) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { 
            ...(validatedData.role ? { role: validatedData.role as any } : {}),
            ...(validatedData.name ? { name: validatedData.name } : {}),
          }
        });
      }

      if (validatedData.role && emp.role !== existing.role) {
        await tx.userActivity.create({
          data: {
            businessId: session.user.businessId,
            userId: session.user.id,
            eventType: 'EMPLOYEE_ROLE_CHANGED',
            metadata: {
              employeeId: emp.id,
              oldRole: existing.role,
              newRole: emp.role,
            }
          }
        });
      }

      return emp;
    });

    const { logAudit, computeChanges } = await import('@/shared/lib/audit');
    const changes = computeChanges(existing as any, employee as any);
    if (changes) {
      await logAudit({
        session,
        action: 'UPDATE',
        entityType: 'Employee',
        entityId: employee.id,
        entityLabel: employee.name,
        changes,
      });
    }

    return NextResponse.json(employee);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    const { id } = await params;

    const existing = await prisma.employee.findFirst({
      where: { id, businessId: session.user.businessId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Soft delete the employee record
      await tx.employee.update({ 
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy: session.user.id,
          email: `deleted_${Date.now()}_${existing.email}`,
        }
      });
      
      // 2. Anonymize the associated user login account to preserve audit integrity
      if (existing.userId) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            email: `deleted_${Date.now()}_${existing.userId}@deleted.local`,
            password: null,
          }
        }).catch(() => {});
        
        // Revoke all sessions for this user
        await tx.refreshToken.updateMany({
          where: { userId: existing.userId },
          data: { revokedAt: new Date() }
        }).catch(() => {});
        
        await tx.deviceToken.deleteMany({
          where: { userId: existing.userId }
        }).catch(() => {});
      }
      
      // 3. Delete any pending invitations for this email
      if (existing.email) {
        await tx.invitation.deleteMany({ 
          where: { email: existing.email, businessId: session.user.businessId } 
        });
      }
    });

    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({
      session,
      action: 'DELETE',
      entityType: 'Employee',
      entityId: id,
      entityLabel: existing.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

