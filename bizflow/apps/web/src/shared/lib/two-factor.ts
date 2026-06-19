/**
 * Two-Factor Authentication (2FA) — TOTP-based using authenticator apps.
 *
 * Uses the `otpauth` library for TOTP generation/verification and
 * `qrcode` for generating QR codes that users scan with Google Authenticator,
 * Authy, or any TOTP-compatible app.
 *
 * Secrets are encrypted at rest using AES-256-GCM with the NEXTAUTH_SECRET.
 */

import { TOTP }    from 'otpauth';
import * as QRCode from 'qrcode';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import bcrypt from 'bcryptjs';

const ISSUER = 'BizFlow';

// ── Encryption helpers ──────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET ?? 'bizflow-dev-secret';
  // Derive a 32-byte key from the secret using scrypt
  return scryptSync(secret, 'bizflow-2fa-salt', 32);
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted secret format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const ciphertext = Buffer.from(parts[2], 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

// ── TOTP operations ─────────────────────────────────────────────────────────

/**
 * Generate a new TOTP secret for a user.
 * Returns the raw secret (to be encrypted before storing) and the otpauth URI.
 */
export function generateTOTPSecret(email: string): { secret: string; uri: string } {
  const totp = new TOTP({
    issuer:    ISSUER,
    label:     email,
    algorithm: 'SHA1',
    digits:    6,
    period:    30,
  });

  return {
    secret: totp.secret.base32,
    uri:    totp.toString(),
  };
}

/**
 * Generate a QR code data URL from a TOTP URI.
 * Returns a base64-encoded PNG image that can be displayed in an <img> tag.
 */
export async function generateQRCodeDataURL(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, {
    width:  256,
    margin: 2,
    color: {
      dark:  '#000000',
      light: '#ffffff',
    },
  });
}

/**
 * Verify a TOTP token against a secret.
 * Allows a 1-period window (30 seconds before/after) for clock drift.
 */
export function verifyTOTPToken(secret: string, token: string): boolean {
  const totp = new TOTP({
    issuer:    ISSUER,
    algorithm: 'SHA1',
    digits:    6,
    period:    30,
    secret:    secret,
  });

  // delta=null means invalid; delta=0 means current window
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

// ── Backup codes ────────────────────────────────────────────────────────────

const BACKUP_CODE_COUNT = 8;

/**
 * Generate a set of one-time backup codes.
 * Returns plaintext codes (to show the user once) and hashed codes (to store).
 */
export async function generateBackupCodes(): Promise<{
  plaintextCodes: string[];
  hashedCodes: string[];
}> {
  const plaintextCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // 8-character alphanumeric code
    const code = randomBytes(4).toString('hex').toUpperCase();
    plaintextCodes.push(code);
    const hash = await bcrypt.hash(code, 10);
    hashedCodes.push(hash);
  }

  return { plaintextCodes, hashedCodes };
}

/**
 * Verify a backup code against the stored hashed codes.
 * Returns the index of the matched code (for removal), or -1 if none match.
 */
export async function verifyBackupCode(
  hashedCodes: string[],
  submittedCode: string,
): Promise<number> {
  const normalized = submittedCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

  for (let i = 0; i < hashedCodes.length; i++) {
    const isMatch = await bcrypt.compare(normalized, hashedCodes[i]);
    if (isMatch) return i;
  }
  return -1;
}
