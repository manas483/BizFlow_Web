import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { executeRestore } from '@/backup/restorers/restore-engine';
import { logBackupAudit } from '@/backup/audit/backup-audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for restore request
const restoreSchema = z.object({
  backupRecordId: z.string(),
  dryRun: z.boolean().default(true), // Default to true for safety
});

// POST /api/backup/restore — trigger a restore (dry run or full)
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    const businessId = session.user.businessId;

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parseResult = restoreSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: parseResult.error.format() }, { status: 400 });
    }

    const { backupRecordId, dryRun } = parseResult.data;

    // Execute the restore process
    const result = await executeRestore({
      businessId,
      backupRecordId,
      dryRun,
    });

    // Log the audit event
    const ipAddress = req.headers.get('x-forwarded-for') || undefined;
    const action = dryRun ? 'RESTORE_DRY_RUN' : 'RESTORE_FULL';
    
    await logBackupAudit(
      businessId,
      session.user.id,
      session.user.name,
      action,
      backupRecordId,
      `Restore ${dryRun ? 'Dry Run' : 'Full'} completed.`,
      {
        success: result.success,
        recordsDeleted: result.recordsDeleted,
        recordsInserted: result.recordsInserted,
      },
      ipAddress
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('Failed to execute restore:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
