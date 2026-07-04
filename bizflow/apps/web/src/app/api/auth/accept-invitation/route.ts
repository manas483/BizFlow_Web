export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

// GET — validate token and return invitation details (sets PENDING_VERIFICATION)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { business: true },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 404 });
    }

    // M-12: reject already-used tokens
    if (invitation.used) {
      return NextResponse.json({ error: 'This invitation link has already been used. Please ask your admin for a new one.' }, { status: 410 });
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.delete({ where: { id: invitation.id } });
      return NextResponse.json({ error: 'Invitation token has expired. Please ask your admin to resend.' }, { status: 410 });
    }

    // Update employee status to PENDING_VERIFICATION (scoped to this business)
    // Avoid updateMany as it may use internal transactions not supported by Neon HTTP
    const pendingEmployees = await prisma.employee.findMany({
      where: {
        email: invitation.email,
        businessId: invitation.businessId,
        status: 'INVITATION_SENT',
      },
      select: { id: true },
    });
    for (const emp of pendingEmployees) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { status: 'PENDING_VERIFICATION' },
      });
    }

    const expiresInHours = Math.round((invitation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));

    return NextResponse.json({
      valid: true,
      email: invitation.email,
      role: invitation.role,
      businessName: invitation.business?.name ?? 'BizFlow',
      expiresInHours,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST — complete account setup (set password, verify email, activate)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = acceptInviteSchema.parse(body);

    const invitation = await prisma.invitation.findUnique({
      where: { token: validatedData.token },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 400 });
    }

    // M-12: reject already-used tokens
    if (invitation.used) {
      return NextResponse.json({ error: 'This invitation link has already been used.' }, { status: 410 });
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.delete({ where: { id: invitation.id } });
      return NextResponse.json({ error: 'Invitation token has expired. Please ask your admin to resend.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Using sequential queries instead of $transaction because Neon HTTP driver
    // does not support interactive transactions.

    // 1. Update user — set password + verify email
    const user = await prisma.user.update({
      where: { email: invitation.email },
      data: {
        password: hashedPassword,
        emailVerified: true,
      },
    });

    // 2. Activate the employee and link userId (scoped to this business + email)
    const employeesToActivate = await prisma.employee.findMany({
      where: { email: invitation.email, businessId: invitation.businessId },
      select: { id: true },
    });
    for (const emp of employeesToActivate) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { status: 'active', userId: user.id },
      });
    }

    // 3. Mark invitation as used (soft-delete for audit trail) then delete
    await prisma.invitation.update({ where: { id: invitation.id }, data: { used: true } });
    await prisma.invitation.delete({ where: { id: invitation.id } });

    // 4. Audit log
    await prisma.userActivity.create({
      data: {
        businessId: invitation.businessId,
        userId: user.id,
        eventType: 'EMPLOYEE_ACCOUNT_ACTIVATED',
        metadata: {
          email: invitation.email,
          role: invitation.role,
        },
      },
    });

    // 5. Notification to admins only
    await prisma.notification.create({
      data: {
        businessId: invitation.businessId,
        type: 'SUCCESS',
        title: 'Employee Account Activated',
        message: `${invitation.email} has accepted their invitation and activated their ${invitation.role.replace('_', ' ')} account.`,
        targetRole: 'SUPER_ADMIN',
      },
    });

    return NextResponse.json({ success: true, message: 'Account setup complete. You can now log in.' });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
