export const dynamic = 'force-dynamic';
/**
 * GET  /api/v1/employees   — paginated employee list
 * POST /api/v1/employees   — onboard employee (invite flow via Resend)
 *
 * ?lightweight=true — returns only id, name, role, department, status
 *                     for mobile selectors (e.g. attendance marking)
 * ?barcode=<sku>    — not applicable here, see products
 * ?status=active|inactive|pending
 * ?department=<name>
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { employeeSchema }         from '@/shared/lib/validations';
import { ok, created, validationError, internalError, parsePagination, buildPagination } from '@/shared/lib/response';

export async function GET(req: NextRequest) {
  try {
    const session     = await requireAuth();
    const sp          = new URL(req.url).searchParams;
    const { page, limit, skip, sortBy, sortDir } = parsePagination(sp);
    const search      = sp.get('search')      ?? '';
    const status      = sp.get('status')      ?? '';
    const department  = sp.get('department')  ?? '';
    const lightweight = sp.get('lightweight') === 'true';

    const where: any = {
      businessId: session.user.businessId,
      ...(search     ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] } : {}),
      ...(status     ? { status }     : {}),
      ...(department ? { department } : {}),
    };

    const allowedSort = ['name', 'role', 'department', 'salary', 'joinDate', 'createdAt'];
    const orderField  = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        // lightweight omits salary and permission details for mobile list/selector screens
        select: lightweight
          ? { id: true, name: true, role: true, department: true, designation: true, status: true, email: true }
          : undefined,
        orderBy: { [orderField]: sortDir },
        skip,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    return ok(data, {
      pagination: buildPagination(total, page, limit),
      meta: { lightweight },
    });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    const parsed  = employeeSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);

    // Delegate to the existing v0 handler logic to avoid duplication
    const { name, email, role, department, designation, salary, joinDate, phone } = parsed.data as any;

    const existing = await prisma.employee.findFirst({
      where: { email, businessId: session.user.businessId },
    });
    if (existing) {
      return internalError('An employee with this email already exists');
    }

    const employee = await prisma.employee.create({
      data: {
        name, email, role: role || 'STAFF', department, designation,
        salary: salary != null ? parseFloat(String(salary)) : 0,
        phone,
        joinDate:   joinDate ? new Date(joinDate) : new Date(),
        businessId: session.user.businessId,
        status:     'pending',
      },
    });

    return created(employee, 'Employee created. Send them an invitation to activate their account.');
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

