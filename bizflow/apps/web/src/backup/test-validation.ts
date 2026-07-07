import { BackupRecord } from '@prisma/client';
import crypto from 'crypto';
import { validateBackupPreRestore, validateRestoreIntegrity } from './validators/restore-validator';

async function runTests() {
  console.log("Running Phase 4 Validation Engine Tests...\n");

  // --- Test 1: Pre-Restore Validation (Checksum Mismatch) ---
  console.log("Test 1: Tampered Payload Checksum Mismatch");
  const fakePayload = Buffer.from("some fake tampered data", "utf-8");
  
  const mockBackupRecord: BackupRecord = {
    id: "test-id",
    businessId: "test-biz",
    fileName: "fake.enc",
    fileSize: 100,
    checksum: "original-checksum", // Doesn't match fakePayload
    status: "VERIFIED",
    backupType: "MANUAL",
    formatVersion: "1.0",
    schemaVersion: "1.0",
    storageUrl: "fake-url",
    notes: null,
    createdAt: new Date(),
    expiresAt: null,
    createdByUserId: null
  };

  const preValidation = validateBackupPreRestore(mockBackupRecord, fakePayload);
  if (!preValidation.isValid && preValidation.errors.some(e => e.includes('Checksum mismatch'))) {
    console.log("✅ PASS: Correctly rejected tampered payload due to checksum mismatch.");
  } else {
    console.error("❌ FAIL: Did not reject tampered payload checksum.");
    process.exit(1);
  }

  // --- Test 2: Pre-Restore Validation (Schema Version Mismatch) ---
  console.log("\nTest 2: Schema Version Mismatch");
  mockBackupRecord.schemaVersion = "0.9";
  
  const preValidation2 = validateBackupPreRestore(mockBackupRecord, fakePayload);
  if (!preValidation2.isValid && preValidation2.errors.some(e => e.includes('Incompatible schema version'))) {
    console.log("✅ PASS: Correctly rejected incompatible schema version.");
  } else {
    console.error("❌ FAIL: Did not reject incompatible schema version.");
    process.exit(1);
  }

  // --- Test 3: Post-Restore Integrity (Record Count Mismatch) ---
  console.log("\nTest 3: Post-Restore Integrity Record Count Mismatch");
  
  // Mock transaction object
  const mockTxPrisma = {
    Business: {
      count: async () => 1 // DB has 1 business
    },
    User: {
      count: async () => 2 // DB has 2 users
    }
    // other models will return undefined, which skips in our logic
  };

  // Parsed payload expects 3 users
  const mockParsedData = {
    Business: [ { id: "test-biz" } ],
    User: [ { id: "1" }, { id: "2" }, { id: "3" } ]
  };

  const postValidation = await validateRestoreIntegrity(mockTxPrisma, "test-biz", mockParsedData);
  
  if (!postValidation.isValid && postValidation.errors.some(e => e.includes('Record count mismatch for User'))) {
    console.log("✅ PASS: Correctly detected record count mismatch (Expected 3, got 2).");
  } else {
    console.error("❌ FAIL: Did not detect record count mismatch.");
    console.log(postValidation);
    process.exit(1);
  }

  console.log("\n🚀 All Validation Engine tests passed successfully!");
}

runTests().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
