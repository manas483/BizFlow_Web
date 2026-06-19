import { NextResponse } from 'next/server';
import { requirePermission, withAuth, getRequestMeta } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';

// GET /api/audit-trail — paginated, filterable audit log query
export const GET = withAuth(async (req: Request) => {
  const session = await requirePermission('view_audit_trail');
  const { searchParams } = new URL(req.url);

  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit      = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')));
  const userId     = searchParams.get('userId');
  const entityType = searchParams.get('entityType');
  const action     = searchParams.get('action');
  const dateFrom   = searchParams.get('dateFrom');
  const dateTo     = searchParams.get('dateTo');
  const search     = searchParams.get('search');

  const where: any = { businessId: session.user.businessId };

  if (userId)     where.userId     = userId;
  if (entityType) where.entityType = entityType;
  if (action)     where.action     = action;

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo)   where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
  }

  if (search) {
    where.OR = [
      { entityLabel: { contains: search, mode: 'insensitive' } },
      { userName:    { contains: search, mode: 'insensitive' } },
      { entityType:  { contains: search, mode: 'insensitive' } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Fetch distinct entity types and users for filter dropdowns
  const [entityTypes, users] = await Promise.all([
    prisma.auditLog.findMany({
      where: { businessId: session.user.businessId },
      distinct: ['entityType'],
      select: { entityType: true },
    }),
    prisma.auditLog.findMany({
      where: { businessId: session.user.businessId },
      distinct: ['userId'],
      select: { userId: true, userName: true },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    filters: {
      entityTypes: entityTypes.map(e => e.entityType),
      users:       users.map(u => ({ id: u.userId, name: u.userName })),
    },
  });
});
