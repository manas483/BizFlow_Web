import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Returns the 32-byte encryption key from the environment.
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.BACKUP_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("BACKUP_ENCRYPTION_KEY environment variable is missing.");
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters).");
  }
  return key;
}

/**
 * Encrypts a buffer using AES-256-GCM.
 * The output format is: IV (16 bytes) + AuthTag (16 bytes) + Ciphertext
 */
export function encryptBuffer(data: Buffer | string): Buffer {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypts a buffer encrypted with `encryptBuffer`.
 */
export function decryptBuffer(encryptedData: Buffer): Buffer {
  const key = getEncryptionKey();
  
  if (encryptedData.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid backup payload: too short to contain IV and AuthTag.");
  }
  
  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (error) {
    throw new Error("Failed to decrypt backup. The encryption key may be incorrect or the data corrupted.");
  }
}
