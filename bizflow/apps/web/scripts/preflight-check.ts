import { runSystemPreflightChecks } from '../src/shared/lib/system-checks';

async function main() {
  console.log('🚀 Running System Preflight Checks...\n');
  const report = await runSystemPreflightChecks();

  let failedCount = 0;

  for (const check of report.checks) {
    if (check.passed) {
      console.log(`✅ [PASS] ${check.name}`);
    } else {
      console.error(`❌ [FAIL] ${check.name} - ${check.error}`);
      failedCount++;
    }
  }

  console.log('\n-----------------------------------');
  if (report.success) {
    console.log('🎉 ALL PREFLIGHT CHECKS PASSED. Ready for deployment.');
    process.exit(0);
  } else {
    console.error(`💥 PREFLIGHT FAILED. ${failedCount} checks did not pass. Deployment blocked.`);
    process.exit(1);
  }
}

main();
