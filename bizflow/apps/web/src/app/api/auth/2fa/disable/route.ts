export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAuth, withAuth, getRequestMeta } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';
import { logAudit, logActivity } from '@/shared/lib/audit';
import { decryptSecret, verifyTOTPToken, verifyBackupCode } from '@/shared/lib/two-factor';
import bcrypt from 'bcryptjs';

// POST /api/auth/2fa/disable — disable 2FA (requires password + TOTP or backup code)
export const POST = withAuth(async (req: Request) => {
  const session = await requireAuth();
  const body = await req.json();
  const { password, token, backupCode } = body as {
    password?: string;
    token?: string;
    backupCode?: string;
  };

  if (!password) {
    return NextResponse.json(
      { success: false, error: { code: 'PASSWORD_REQUIRED', message: 'Current password is required' } },
      { status: 400 }
    );
  }

  if (!token && !backupCode) {
    return NextResponse.json(
      { success: false, error: { code: 'CODE_REQUIRED', message: 'TOTP code or backup code is required' } },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, twoFactorEnabled: true, twoFactorSecret: true, backupCodes: true },
  });

  if (!user?.twoFactorEnabled) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_ENABLED', message: '2FA is not enabled' } },
      { status: 400 }
    );
  }

  // Verify password
  if (!user.password) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_PASSWORD', message: 'Account has no password set' } },
      { status: 400 }
    );
  }

  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PASSWORD', message: 'Incorrect password' } },
      { status: 401 }
    );
  }

  // Verify TOTP or backup code
  if (token) {
    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_SECRET', message: '2FA secret not found' } },
        { status: 400 }
      );
    }

    const secret = decryptSecret(user.twoFactorSecret);
    const isValid = verifyTOTPToken(secret, token);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CODE', message: 'Invalid TOTP code' } },
        { status: 400 }
      );
    }
  } else if (backupCode) {
    const codeIndex = await verifyBackupCode(user.backupCodes, backupCode);
    if (codeIndex === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BACKUP', message: 'Invalid backup code' } },
        { status: 400 }
      );
    }
  }

  // Disable 2FA
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorEnabled:    false,
      twoFactorSecret:     null,
      backupCodes:         [],
      twoFactorVerifiedAt: null,
    },
  });

  const meta = await getRequestMeta();
  await logAudit({
    session,
    action: 'UPDATE',
    entityType: 'User',
    entityId: session.user.id,
    entityLabel: session.user.email,
    changes: { twoFactorEnabled: { old: true, new: false } },
    ...meta,
  });

  await logActivity({
    session,
    eventType: '2FA_DISABLED',
    ...meta,
  });

  return NextResponse.json({ success: true, message: 'Two-factor authentication disabled' });
});

