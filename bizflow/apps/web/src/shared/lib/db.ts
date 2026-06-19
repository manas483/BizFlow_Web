import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma_v4: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  // A-2 FIX: Explicit pool configuration to prevent connection exhaustion
  // on serverless platforms (Vercel). Neon free tier allows ~10-20 concurrent
  // connections. Consider using Prisma Accelerate or Neon pooler for higher load.
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma =
  globalForPrisma.prisma_v4 ?? (globalForPrisma.prisma_v4 = createPrismaClient());

