import { PrismaClient } from '@prisma/client';

let prismaTxInstance: PrismaClient | undefined;

export function getTransactionalPrisma(): PrismaClient {
  if (prismaTxInstance) {
    return prismaTxInstance;
  }

  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  connectionString = connectionString.replace(/^"|"$/g, '').trim();

  // If the URL is postgresql://, the standard Prisma engine accepts it.
  // We use the standard Prisma client WITHOUT the adapter because the HTTP adapter
  // doesn't support interactive transactions, and the Neon WebSocket Pool adapter 
  // is having configuration issues in this environment. Standard TCP connection 
  // works natively with transactions.
  const { Pool } = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');
  
  // Replace postgresql:// with postgres:// which is what pg pool expects
  connectionString = connectionString.replace('postgresql://', 'postgres://');
  
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  prismaTxInstance = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return prismaTxInstance;
}
