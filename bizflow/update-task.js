const fs = require('fs');
const path = require('path');

const targetFile = 'C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\58d6378b-0514-4db1-a5f7-3a18623d4cb4\\task.md';

try {
  let content = fs.readFileSync(targetFile, 'utf8');

  // Replace Step 4 checklist with checked boxes
  content = content.replace(
    /### Step 4 — Validation & Indian Regulatory Tests \(\~29 cases\)[\s\S]*?---\s*\n\s*### Step 5/g,
    `### Step 4 — Validation & Indian Regulatory Tests (~29 cases)

- [x] **[NEW] Create [validations.test.ts](file:///c:/Users/sacha/Desktop/B/bizflow/apps/web/tests/unit/business-rules/validations.test.ts)**
  - [x] **Zod schema tests:**
    - [x] \`productSchema\` — valid data passes, negative price fails, missing name fails
    - [x] \`customerSchema\` — valid data passes, invalid phone fails
    - [x] \`saleSchema\` — at least 1 item required, negative qty rejected
    - [x] \`journalEntrySchema\` — debits ≠ credits → rejection (\`.refine()\` at line 196)
    - [x] \`registerSchema\` — password complexity (uppercase, lowercase, digit, special char), email lowercased
    - [x] \`loanMasterSchema\` — negative principal fails, 0 tenure fails, rate > 100 fails
  - [x] **GSTIN validation tests:**
    - [x] Valid GSTIN passes (\`29ABCDE1234F1ZW\`)
    - [x] Valid GSTIN Maharashtra passes (\`27AAPFU0939F1ZV\`)
    - [x] Invalid state code 99 fails
    - [x] Wrong length (14 chars) fails
    - [x] Empty string fails
    - [x] Lowercase input auto-normalized
    - [x] Valid format but wrong checksum digit fails
  - [x] **PAN validation tests:**
    - [x] Valid PAN passes (\`ABCDE1234F\`)
    - [x] Digit in wrong position fails
    - [x] 9 characters fails
  - [x] **IFSC validation tests:**
    - [x] Valid IFSC passes (\`SBIN0001234\`)
    - [x] 5th char not \`0\` fails
    - [x] Too short fails
  - [x] **HSN validation tests:**
    - [x] 4-digit passes, 6-digit passes, 8-digit passes
    - [x] 3-digit fails, 5-digit fails
    - [x] Non-numeric fails

---

### Step 5`
  );

  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('Successfully updated task.md for Step 4 in previous artifact directory');
} catch (e) {
  console.error('Failed to update file:', e);
}
