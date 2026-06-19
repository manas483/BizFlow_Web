/**
 * Indian Regulatory Validators — pure validation functions for
 * GSTIN, PAN, IFSC, HSN, and state codes.
 *
 * These are standalone validators designed to be wired into Zod schemas
 * via `.refine()`. No DB access, no side effects.
 *
 * References:
 * - GSTIN format: https://www.gst.gov.in
 * - PAN format: Income Tax Act, Section 139A
 * - IFSC format: RBI notification
 * - HSN: WCO Harmonized System (Indian GST turnover thresholds)
 */

import { INDIAN_STATE_CODES } from './gst-engine';

// ── Character Set for Mod-36 ─────────────────────────────────────────────────

/**
 * Character set used in the GSTIN mod-36 checksum algorithm.
 * 0-9 (indices 0–9) followed by A-Z (indices 10–35).
 */
const MOD36_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Factor table for the GSTIN checksum (mod-36 Luhn-like algorithm).
 * Each position in the GSTIN (0-indexed, positions 0–13) uses a
 * multiplier from this table. Position 14 is the checksum digit itself.
 */
const GSTIN_FACTOR = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2] as const;

// ── GSTIN Validation ─────────────────────────────────────────────────────────

/**
 * Validate a GSTIN (Goods and Services Tax Identification Number).
 *
 * Format: 15 characters
 *   - Chars 1–2:  State code (2 digits, must be in INDIAN_STATE_CODES)
 *   - Chars 3–12: PAN of the entity (5 letters + 4 digits + 1 letter)
 *   - Char 13:    Entity code (1-9 or A-Z)
 *   - Char 14:    Must be 'Z' (default)
 *   - Char 15:    Checksum digit (mod-36 algorithm)
 *
 * Validates:
 * 1. Length = 15
 * 2. Structural regex match
 * 3. State code exists in INDIAN_STATE_CODES
 * 4. Mod-36 checksum verification
 */
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin) return false;

  // Normalize to uppercase
  const g = gstin.toUpperCase().trim();

  // Check length
  if (g.length !== 15) return false;

  // Structural regex:
  // 2 digits (state) + 5 letters (PAN part 1) + 4 digits (PAN part 2) +
  // 1 letter (PAN part 3) + 1 alphanumeric (entity) + 'Z' + 1 alphanumeric (checksum)
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[A-Z\d]$/.test(g)) {
    return false;
  }

  // Validate state code
  const stateCode = g.substring(0, 2);
  if (!(stateCode in INDIAN_STATE_CODES)) {
    return false;
  }

  // Verify mod-36 checksum
  return verifyGSTINChecksum(g);
}

/**
 * Compute and verify the GSTIN checksum digit (position 14, 0-indexed).
 *
 * Algorithm (mod-36 Luhn-like):
 * 1. For each of the first 14 characters (positions 0–13):
 *    a. Get its index in MOD36_CHARS (0–35)
 *    b. Multiply by the factor at that position (alternating 1, 2)
 *    c. Compute: quotient = floor(product / 36), remainder = product % 36
 *    d. Add quotient + remainder to running total
 * 2. remainder = total % 36
 * 3. checkDigit = (36 - remainder) % 36
 * 4. Map checkDigit back to a character in MOD36_CHARS
 * 5. Compare with the actual 15th character
 */
function verifyGSTINChecksum(gstin: string): boolean {
  let total = 0;

  for (let i = 0; i < 14; i++) {
    const charIndex = MOD36_CHARS.indexOf(gstin[i]);
    if (charIndex === -1) return false;

    const product = charIndex * GSTIN_FACTOR[i];
    const quotient = Math.floor(product / 36);
    const remainder = product % 36;
    total += quotient + remainder;
  }

  const checkValue = (36 - (total % 36)) % 36;
  const expectedChar = MOD36_CHARS[checkValue];

  return gstin[14] === expectedChar;
}

// ── PAN Validation ───────────────────────────────────────────────────────────

/**
 * Validate a PAN (Permanent Account Number).
 *
 * Format: AAAAA9999A (10 characters)
 *   - Chars 1–5:  Letters (A-Z)
 *   - Chars 6–9:  Digits (0-9)
 *   - Char 10:    Letter (A-Z)
 *
 * The 4th character indicates the type of holder:
 *   C=Company, P=Person, H=HUF, F=Firm, A=AOP, T=Trust, etc.
 * We validate structure only, not the holder-type semantics.
 */
export function isValidPAN(pan: string): boolean {
  if (!pan) return false;
  const p = pan.toUpperCase().trim();
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(p);
}

// ── IFSC Validation ──────────────────────────────────────────────────────────

/**
 * Validate an IFSC (Indian Financial System Code).
 *
 * Format: AAAA0NNNNNN (11 characters)
 *   - Chars 1–4:  Bank code (4 letters)
 *   - Char 5:     Always '0' (reserved for future use)
 *   - Chars 6–11: Branch code (6 alphanumeric characters)
 */
export function isValidIFSC(ifsc: string): boolean {
  if (!ifsc) return false;
  const i = ifsc.toUpperCase().trim();
  return /^[A-Z]{4}0[A-Z\d]{6}$/.test(i);
}

// ── HSN Validation ───────────────────────────────────────────────────────────

/**
 * Validate an HSN (Harmonized System of Nomenclature) code.
 *
 * Per Indian GST rules:
 *   - Turnover < ₹1.5Cr: 4 digits required
 *   - Turnover ₹1.5–5Cr: 6 digits required
 *   - Turnover > ₹5Cr: 8 digits required
 *
 * At the validation layer, we accept all three lengths.
 * Turnover-based enforcement is a business rule, not a format constraint.
 */
export function isValidHSN(hsn: string): boolean {
  if (!hsn) return false;
  const h = hsn.trim();
  return /^\d{4}$|^\d{6}$|^\d{8}$/.test(h);
}

// ── State Code Validation ────────────────────────────────────────────────────

/**
 * Validate an Indian state code (2-digit string).
 * Must exist in the INDIAN_STATE_CODES registry from gst-engine.
 */
export function isValidStateCode(code: string): boolean {
  if (!code) return false;
  const c = code.trim();
  return c in INDIAN_STATE_CODES;
}
