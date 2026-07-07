import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { createBackup } from '@/backup/engine';
import { logBackupAudit } from '@/backup/audit/backup-audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for creating a backup
const createBackupSchema = z.object({
  notes: z.string().optional(),
});

// GET /api/backup — list all backups for the business
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    const businessId = session.user.businessId;

    const backups = await prisma.backupRecord.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      // Optional: limit to last 50 backups for performance
      take: 50,
    });

    return NextResponse.json(backups);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('Failed to fetch backups:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/backup — trigger a new manual backup
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    const businessId = session.user.businessId;

    let body;
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }

    const parseResult = createBackupSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { notes } = parseResult.data;

    // Trigger backup
    const backupRecord = await createBackup({
      businessId,
      triggeredByUserId: session.user.id,
      backupType: 'MANUAL',
      notes,
    });

    // Log the audit event
    const ipAddress = req.headers.get('x-forwarded-for') || undefined;
    await logBackupAudit(
      businessId,
      session.user.id,
      session.user.name,
      'BACKUP_CREATED',
      backupRecord.id,
      `Backup created successfully: ${backupRecord.fileName}`,
      { fileSize: backupRecord.fileSize },
      ipAddress
    );

    return NextResponse.json(backupRecord, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('Failed to create backup:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
