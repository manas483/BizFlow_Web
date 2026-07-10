const { validateBackupManifest } = require('./validators/manifest-validator');
try {
  validateBackupManifest();
  console.log("SUCCESS: Backup Manifest is fully synchronized with Prisma Schema.");
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
