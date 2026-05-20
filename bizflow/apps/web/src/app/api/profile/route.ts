import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { z } from 'zod';

const profileUpdateSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      name: user.name,
      email: user.email,
      phone: user.employee?.phone || '',
      role: user.role,
      department: user.employee?.department || '',
      designation: user.employee?.designation || '',
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const validatedData = profileUpdateSchema.parse(body);
    
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update User record
      const user = await tx.user.update({
        where: { id: session.user.id },
        data: { name: validatedData.name },
        include: { employee: true }
      });
      
      // Update Employee record if it exists
      if (user.employee) {
        await tx.employee.update({
          where: { id: user.employee.id },
          data: { 
            name: validatedData.name,
            phone: validatedData.phone || null,
          }
        });
      }
      
      return user;
    });
    
    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    }
    if (error instanceof AuthError) return error.response;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
