/**
 * Test database utilities.
 * Seeds a test business + test user and provides cleanup helpers.
 *
 * Used by Playwright API tests (global-setup) and can be imported
 * by any test that needs a known database state.
 *
 * NOTE: Uses a standalone PrismaClient without the PrismaPg/Neon adapter
 * so it works with any PostgreSQL instance (local or CI).
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export const TEST_USER = {
  email: 'test-admin@bizflow.test',
  password: 'TestPass123!',
  name: 'Test Admin',
  role: 'SUPER_ADMIN' as const,
}

export const TEST_BUSINESS = {
  name: 'Test Business Pvt Ltd',
  ownerName: 'Test Owner',
  phone: '9876543210',
  businessType: 'retail',
  gstNumber: '29ABCDE1234F1Z5', // Karnataka — verified checksum
  stateCode: '29',
  state: 'Karnataka',
}

/**
 * Seeds the test database with a known business and super admin user.
 * Cleans any existing test data first to ensure idempotency.
 */
export async function seedTestDB() {
  // Clean existing test data (cascade handles related records)
  await cleanTestDB()

  // Create business
  const business = await prisma.business.create({
    data: {
      ...TEST_BUSINESS,
      onboardingCompleted: true,
    },
  })

  // Create user with hashed password
  const hashedPassword = await bcrypt.hash(TEST_USER.password, 10)
  const user = await prisma.user.create({
    data: {
      email: TEST_USER.email,
      name: TEST_USER.name,
      password: hashedPassword,
      role: TEST_USER.role,
      businessId: business.id,
      emailVerified: true,
    },
  })

  return { business, user }
}

/**
 * Removes the test business and all cascaded data.
 * Safe to call even if no test data exists.
 */
export async function cleanTestDB() {
  // Delete users first (no cascade from business to user in schema)
  await prisma.user.deleteMany({
    where: { email: TEST_USER.email },
  })
  await prisma.business.deleteMany({
    where: { name: TEST_BUSINESS.name },
  })
}

export { prisma as testPrisma }
