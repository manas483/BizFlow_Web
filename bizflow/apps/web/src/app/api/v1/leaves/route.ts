export const dynamic = 'force-dynamic';
/**
 * GET  /api/v1/leaves   — paginated leave list (role-aware)
 * POST /api/v1/leaves   — employee applies for leave
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { ok, created, notFound, businessRule, validationError, internalError, parsePagination, buildPagination } from '@/shared/lib/response';
import { z } from 'zod';

const leaveSchema = z.object({
  type:      z.enum(['sick', 'casual', 'annual', 'unpaid', 'other']),
  startDate: z.string().min(1),
  endDate:   z.string().min(1),
  reason:    z.string().min(3, 'Reason must be at least 3 characters'),
});

export async function GET(req: NextRequest) {
  try {
    const session  = await requireAuth();
    const isAdmin  = session.user.role === 'SUPER_ADMIN';
    const sp       = new URL(req.url).searchParams;
    const { page, limit, skip, sortDir } = parsePagination(sp);
    const status   = sp.get('status') ?? '';

    const where: any = isAdmin
      ? { businessId: session.user.businessId, ...(status ? { status } : {}) }
      : await (async () => {
          const emp = await prisma.employee.findFirst({ where: { userId: session.user.id, businessId: session.user.businessId } });
          if (!emp) return null;
          return { employeeId: emp.id, businessId: session.user.businessId, ...(status ? { status } : {}) };
        })();

    if (!where) return notFound('Employee record not found');

    const [data, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: { employee: { select: { id: true, name: true, email: true, role: true, department: true } } },
        orderBy: { appliedAt: sortDir },
        skip,
        take: limit,
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return ok(data, { pagination: buildPagination(total, page, limit) });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const parsed  = leaveSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);
    const { type, startDate, endDate, reason } = parsed.data;

    let employee: any = await prisma.employee.findFirst({
      where:   { userId: session.user.id, businessId: session.user.businessId },
      include: { user: { select: { emailVerified: true } } },
    });

    if (!employee) {
      employee = await prisma.employee.findFirst({
        where:   { email: session.user.email!, businessId: session.user.businessId },
        include: { user: { select: { emailVerified: true } } },
      });
      if (employee) await prisma.employee.update({ where: { id: employee.id }, data: { userId: session.user.id } });
    }

    if (!employee)               return notFound('Employee record not found. Please contact your admin.');
    if (employee.status !== 'active' && !employee.user?.emailVerified) {
      return businessRule('Only active employees can apply for leave.');
    }

    const start = new Date(startDate);
    const end   = new Date(endDate);
    if (end < start) return businessRule('End date cannot be before start date');

    const overlap = await prisma.leaveRequest.findFirst({
      where: { employeeId: employee.id, status: { in: ['PENDING', 'APPROVED'] }, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] },
    });
    if (overlap) return businessRule(`You already have a ${overlap.status.toLowerCase()} leave overlapping these dates`);

    const leave = await prisma.$transaction(async (tx: any) => {
      const l = await tx.leaveRequest.create({
        data: { employeeId: employee.id, businessId: session.user.businessId, type, startDate: start, endDate: end, reason },
      });
      await tx.notification.create({
        data: { businessId: session.user.businessId, type: 'INFO', title: 'Leave Request Submitted', message: `${employee.name} applied for ${type} leave from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}.`, targetRole: 'SUPER_ADMIN' },
      }).catch(() => {});
      return l;
    });

    return created(leave);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

