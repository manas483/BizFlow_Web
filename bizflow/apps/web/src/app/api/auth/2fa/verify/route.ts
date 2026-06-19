import { NextResponse } from 'next/server';
import { withAuth } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';
import { decryptSecret, verifyTOTPToken, verifyBackupCode } from '@/shared/lib/two-factor';
import { logActivity } from '@/shared/lib/audit';
import { headers } from 'next/headers';

// POST /api/auth/2fa/verify — verify TOTP during login flow
// Called after initial credentials check when user has 2FA enabled.
// Does NOT require an active session — uses a temporary pendingUserId.
export const POST = withAuth(async (req: Request) => {
  const body = await req.json();
  const { userId, token, backupCode } = body as {
    userId?: string;
    token?: string;
    backupCode?: string;
  };

  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_USER', message: 'User ID is required' } },
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
    where: { id: userId },
    select: {
      id: true, email: true, name: true, role: true, businessId: true,
      twoFactorEnabled: true, twoFactorSecret: true, backupCodes: true,
    },
  });

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid 2FA verification request' } },
      { status: 400 }
    );
  }

  const secret = decryptSecret(user.twoFactorSecret);

  if (token) {
    const isValid = verifyTOTPToken(secret, token);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CODE', message: 'Invalid verification code' } },
        { status: 401 }
      );
    }
  } else if (backupCode) {
    const codeIndex = await verifyBackupCode(user.backupCodes, backupCode);
    if (codeIndex === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BACKUP', message: 'Invalid backup code' } },
        { status: 401 }
      );
    }

    // Remove the used backup code
    const updatedCodes = [...user.backupCodes];
    updatedCodes.splice(codeIndex, 1);
    await prisma.user.update({
      where: { id: user.id },
      data: { backupCodes: updatedCodes },
    });
  }

  // Log the successful 2FA verification
  const hdrs = await headers();
  const ipAddress = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip') ?? '127.0.0.1';
  const userAgent = hdrs.get('user-agent') ?? 'unknown';

  await logActivity({
    session: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        businessId: user.businessId,
        businessType: '',
        permissions: [],
      },
    },
    eventType: '2FA_VERIFIED',
    metadata: { method: token ? 'totp' : 'backup_code' },
    ipAddress,
    userAgent,
  });

  // Return a verification token that the login flow can use
  return NextResponse.json({
    success: true,
    data: {
      verified: true,
      userId:   user.id,
    },
  });
});
