import { decryptBuffer } from '../encryption/encryption';
import crypto from 'crypto';

export interface CreationValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a newly created backup package for integrity and correctness.
 * - Decrypts the payload
 * - Verifies the SHA-256 checksum
 * - Attempts to parse the JSONL content to ensure readability
 */
export async function validateBackupCreation(
  encryptedPayload: Buffer,
  expectedChecksum: string,
  expectedRecordCount: number
): Promise<CreationValidationResult> {
  const errors: string[] = [];
  
  try {
    // 1. Decrypt the payload
    const unencryptedBuffer = decryptBuffer(encryptedPayload);

    // 2. Verify checksum
    const hash = crypto.createHash('sha256');
    hash.update(unencryptedBuffer);
    const actualChecksum = hash.digest('hex');

    if (actualChecksum !== expectedChecksum) {
      errors.push(`Checksum mismatch. Expected ${expectedChecksum}, got ${actualChecksum}`);
      return { isValid: false, errors }; // Critical failure, don't proceed
    }

    // 3. Parse JSONL to ensure data structure is intact
    const content = unencryptedBuffer.toString('utf-8');
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length !== expectedRecordCount) {
      errors.push(`Record count mismatch. Expected ${expectedRecordCount}, found ${lines.length} in package.`);
    }

    // Optional: sample the first and last line to ensure JSON parses correctly
    if (lines.length > 0) {
      try {
        JSON.parse(lines[0]);
        JSON.parse(lines[lines.length - 1]);
      } catch (e: any) {
        errors.push(`Failed to parse JSON lines: ${e.message}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };

  } catch (error: any) {
    errors.push(`Validation failed with exception: ${error.message}`);
    return { isValid: false, errors };
  }
}
