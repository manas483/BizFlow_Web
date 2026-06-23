export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAuth, withAuth, AuthError, getRequestMeta } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';
import { logAudit, logActivity } from '@/shared/lib/audit';
import {
  generateTOTPSecret,
  generateQRCodeDataURL,
  verifyTOTPToken,
  encryptSecret,
  decryptSecret,
  generateBackupCodes,
} from '@/shared/lib/two-factor';

// POST /api/auth/2fa/setup — initiate 2FA setup
export const POST = withAuth(async () => {
  const session = await requireAuth();

  // Check if already enabled
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  });

  if (user?.twoFactorEnabled) {
    return NextResponse.json(
      { success: false, error: { code: 'ALREADY_ENABLED', message: '2FA is already enabled' } },
      { status: 400 }
    );
  }

  // Generate TOTP secret
  const { secret, uri } = generateTOTPSecret(session.user.email);
  const qrCodeDataUrl   = await generateQRCodeDataURL(uri);

  // Generate backup codes
  const { plaintextCodes, hashedCodes } = await generateBackupCodes();

  // Store the encrypted secret and hashed backup codes (but don't enable yet)
  const encryptedSecret = encryptSecret(secret);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorSecret: encryptedSecret,
      backupCodes:     hashedCodes,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      qrCode:      qrCodeDataUrl,
      manualKey:   secret,
      backupCodes: plaintextCodes,
    },
  });
});

// PUT /api/auth/2fa/setup — verify and confirm 2FA setup
export const PUT = withAuth(async (req: Request) => {
  const session = await requireAuth();
  const body = await req.json();
  const { token } = body as { token?: string };

  if (!token || token.length !== 6) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_TOKEN', message: 'A 6-digit code is required' } },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user?.twoFactorSecret) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_SETUP', message: 'Start 2FA setup first' } },
      { status: 400 }
    );
  }

  if (user.twoFactorEnabled) {
    return NextResponse.json(
      { success: false, error: { code: 'ALREADY_ENABLED', message: '2FA is already enabled' } },
      { status: 400 }
    );
  }

  // Decrypt and verify
  const secret = decryptSecret(user.twoFactorSecret);
  const isValid = verifyTOTPToken(secret, token);

  if (!isValid) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_CODE', message: 'Invalid verification code. Try again.' } },
      { status: 400 }
    );
  }

  // Enable 2FA
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorEnabled:    true,
      twoFactorVerifiedAt: new Date(),
    },
  });

  const meta = await getRequestMeta();
  await logAudit({
    session,
    action: 'UPDATE',
    entityType: 'User',
    entityId: session.user.id,
    entityLabel: session.user.email,
    changes: { twoFactorEnabled: { old: false, new: true } },
    ...meta,
  });

  await logActivity({
    session,
    eventType: '2FA_ENABLED',
    metadata: { method: 'totp' },
    ...meta,
  });

  return NextResponse.json({ success: true, message: 'Two-factor authentication enabled' });
});

