import 'dotenv/config';
/**
 * Vitest test environment setup.
 * Sets a consistent timezone for all tests — critical for aging/date calculations
 * that depend on IST (India Standard Time) boundaries.
 */
process.env.TZ = 'Asia/Kolkata';
