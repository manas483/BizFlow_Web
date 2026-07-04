import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function main() {
  const args = process.argv.slice(2);
  const migrationName = args[0];

  if (!migrationName) {
    console.error('❌ Please provide the name of the migration to rollback.');
    console.error('Usage: tsx scripts/rollback-migration.ts <migration_name>');
    process.exit(1);
  }

  const rollbackFile = path.join(process.cwd(), 'prisma', 'rollbacks', migrationName, 'rollback.sql');
  if (!fs.existsSync(rollbackFile)) {
    console.error(`❌ Rollback script not found at ${rollbackFile}`);
    process.exit(1);
  }

  console.log(`⏪ Rolling back migration: ${migrationName}`);
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('❌ DATABASE_URL environment variable is not set.');
      process.exit(1);
    }
    
    // Execute raw SQL using Prisma db execute
    console.log('Executing rollback.sql...');
    execSync(`npx prisma db execute --file ${rollbackFile} --url ${dbUrl}`, { stdio: 'inherit' });
    console.log('✅ Rollback executed successfully.');

    // We also need to mark the migration as rolled back in the _prisma_migrations table
    // For safety, this should be done manually or via a separate raw query if needed,
    // but running the SQL manually reverses the schema.
    console.warn('⚠️ Remember to manually remove the migration folder if you plan to re-create it.');
  } catch (error) {
    console.error('💥 Rollback failed!', error);
    process.exit(1);
  }
}

main();
