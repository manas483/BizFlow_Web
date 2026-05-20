import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { randomBytes } from 'crypto';
import { sendEmployeeInvitationEmail } from '@/lib/email';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admins can resend invitations' }, { status: 403 });
    }

    const employee = await prisma.employee.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { user: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // ── Auto-sync status: if the linked User has verified their email,
    //    the employee is already active — update the stale status and block resend.
    if (employee.user?.emailVerified || employee.user?.password) {
      await prisma.employee.update({
        where: { id },
        data: { status: 'active' },
      });
      return NextResponse.json(
        { error: 'This employee has already activated their account. Their status has been updated to Active.' },
        { status: 400 }
      );
    }

    // Also block if status is explicitly 'active'
    if (employee.status === 'active') {
      return NextResponse.json({ error: 'Employee account is already active.' }, { status: 400 });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Upsert invitation — scoped to this business
    await prisma.invitation.upsert({
      where: {
        businessId_email: {
          businessId: session.user.businessId,
          email: employee.email,
        },
      },
      update: {
        token,
        expiresAt,
        createdAt: new Date(),
      },
      create: {
        email: employee.email,
        token,
        role: employee.role,
        businessId: session.user.businessId,
        expiresAt,
      },
    });

    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const inviteLink = `${protocol}://${host}/accept-invitation?token=${token}`;

    const business = await prisma.business.findUnique({ where: { id: session.user.businessId } });

    await sendEmployeeInvitationEmail(
      employee.email,
      employee.name,
      employee.role,
      inviteLink,
      business?.name
    );

    // Reset status to INVITATION_SENT so the flow restarts cleanly
    await prisma.employee.update({
      where: { id },
      data: { status: 'INVITATION_SENT' },
    });

    return NextResponse.json({ success: true, message: 'Invitation resent successfully' });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
