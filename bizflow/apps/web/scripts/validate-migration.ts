import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma', 'migrations');

const DESTRUCTIVE_PATTERNS = [
  /DROP\s+TABLE/i,
  /DROP\s+COLUMN/i,
  /TRUNCATE\s+TABLE/i,
  /DELETE\s+FROM/i, // Needs manual verification if it has a WHERE
  /ON\s+DELETE\s+CASCADE/i,
];

function scanSqlFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let hasErrors = false;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Allow overriding safety check per line with a comment
    if (line.includes('-- safety-ignore')) {
      continue;
    }

    for (const pattern of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(line)) {
        // Exception: DELETE FROM with a WHERE clause is slightly safer, but we still flag it for manual review
        // unless they put a -- safety-ignore
        console.error(`❌ Destructive pattern detected in ${path.basename(filePath)} at line ${i + 1}`);
        console.error(`   > ${line.trim()}`);
        console.error(`   Pattern: ${pattern.toString()}`);
        hasErrors = true;
      }
    }
  }
  
  return hasErrors;
}

function main() {
  console.log('🔍 Scanning migrations for destructive SQL patterns...');
  
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('ℹ️ No migrations directory found. Skipping.');
    process.exit(0);
  }

  const migrationFolders = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let totalErrors = 0;

  for (const folder of migrationFolders) {
    const sqlFile = path.join(MIGRATIONS_DIR, folder, 'migration.sql');
    if (fs.existsSync(sqlFile)) {
      const hasErrors = scanSqlFile(sqlFile);
      if (hasErrors) totalErrors++;
    }
  }

  if (totalErrors > 0) {
    console.error(`\n💥 Found destructive patterns in ${totalErrors} migration(s).`);
    console.error('To bypass, add "-- safety-ignore" to the end of the offending SQL line if you are absolutely sure.');
    process.exit(1);
  } else {
    console.log('✅ No destructive SQL patterns detected in migrations.');
    process.exit(0);
  }
}

main();
