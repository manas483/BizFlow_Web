import { NextResponse } from 'next/server';
import { requirePermission, withAuth } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';

// GET /api/backup/history — list backup history
export const GET = withAuth(async (req: Request) => {
  const session = await requirePermission('manage_backups');
  const { searchParams } = new URL(req.url);

  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));

  const where = { businessId: session.user.businessId };

  const [records, total] = await Promise.all([
    prisma.backupRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.backupRecord.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: records,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// DELETE /api/backup/history?id=xxx — delete a backup record
export const DELETE = withAuth(async (req: Request) => {
  const session = await requirePermission('manage_backups');
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Backup ID is required' } },
      { status: 400 }
    );
  }

  const existing = await prisma.backupRecord.findFirst({
    where: { id, businessId: session.user.businessId },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Backup not found' } },
      { status: 404 }
    );
  }

  await prisma.backupRecord.delete({ where: { id } });

  return NextResponse.json({ success: true });
});
