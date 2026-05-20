import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { employeeSchema } from '@/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const employee = await prisma.employee.findFirst({
      where: { id, businessId: session.user.businessId },
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
      where: { id, businessId: session.user.businessId },
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
      where: { id, businessId: session.user.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

