export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { employeeSchema } from '@/shared/lib/validations';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { sendEmployeeInvitationEmail } from '@/shared/lib/email';
import { logAudit } from '@/shared/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const department = searchParams.get('department');
    // M-10: pagination
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10));
    const skip  = (page - 1) * limit;

    const where = {
      businessId: session.user.businessId,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(department && department !== 'All' ? { department } : {}),
    };

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { 
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              emailVerified: true,
              role: true,
              createdAt: true,
              twoFactorEnabled: true,
              password: true,
            }
          }
        },
        skip,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    // ── Auto-sync stale statuses ────────────────────────────────────────────
    const staleIds = employees
      .filter((e) =>
        (e.status === 'INVITATION_SENT' || e.status === 'PENDING_VERIFICATION') &&
        (e.user?.emailVerified || e.user?.password)
      )
      .map((e) => e.id);

    if (staleIds.length > 0) {
      await prisma.employee.updateMany({ where: { id: { in: staleIds } }, data: { status: 'active' } });
      employees.forEach((e) => { if (staleIds.includes(e.id)) e.status = 'active'; });
    }

    // M-7: Compute dynamic attendance % from AttendanceRecord (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().split('T')[0]; // "YYYY-MM-DD" — string comparison works

    const attCounts = await prisma.attendanceRecord.groupBy({
      by: ['employeeId', 'status'],
      where: {
        businessId: session.user.businessId,
        employeeId: { in: employees.map(e => e.id) },
        date: { gte: cutoff },
      },
      _count: { id: true },
    });

    // Build map: employeeId -> { present, half_day, total }
    type AttMap = { present: number; half: number; total: number };
    const attMap: Record<string, AttMap> = {};
    for (const entry of attCounts) {
      if (!attMap[entry.employeeId]) attMap[entry.employeeId] = { present: 0, half: 0, total: 0 };
      const c = (entry._count as any).id ?? 0;
      if (entry.status === 'present') attMap[entry.employeeId].present += c;
      if (entry.status === 'half_day') attMap[entry.employeeId].half += c;
      attMap[entry.employeeId].total += c;
    }

    // Inject computed attendance% (fall back to stored value if no records)
    const enriched = employees.map(e => {
      if (e.user) {
        delete (e.user as any).password;
      }
      const rec = attMap[e.id];
      const pct = rec && rec.total > 0
        ? Math.round(((rec.present + rec.half * 0.5) / rec.total) * 100)
        : e.attendance; // stored fallback
      return { ...e, attendance: pct };
    });

    return NextResponse.json({ data: enriched, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}



export async function POST(req: NextRequest) {
  try {
    console.log("POST /api/employees: Starting request");
    const session = await requireAuth();
    
    if (session.user.role !== 'SUPER_ADMIN') {
      console.log("POST /api/employees: Unauthorized role", session.user.role);
      return NextResponse.json({ error: 'Only Super Admins can add employees' }, { status: 403 });
    }

    const body = await req.json();
    console.log("POST /api/employees: Body received", body.email);
    const validatedData = employeeSchema.parse(body);
    console.log("POST /api/employees: Validation passed");

    // Fetch business for name + isolation
    const business = await prisma.business.findUnique({ where: { id: session.user.businessId } });
    const businessName = business?.name ?? 'BizFlow';

    // ── DUPLICATE CHECK 1: same email already in THIS business ──────────────
    const existingEmployee = await prisma.employee.findUnique({
      where: {
        businessId_email: {
          businessId: session.user.businessId,
          email: validatedData.email,
        },
      },
    });
    if (existingEmployee) {
      return NextResponse.json(
        { error: 'An employee with this email address already exists in your organization.' },
        { status: 400 }
      );
    }

    // ── DUPLICATE CHECK 2: email belongs to a User in a DIFFERENT business ──
    // User.email is globally unique — one login identity per email across all tenants.
    const existingUser = await prisma.user.findUnique({ where: { email: validatedData.email } });
    if (existingUser) {
      if (existingUser.businessId !== session.user.businessId) {
        // The person already has a BizFlow account under another organization.
        // They cannot have two separate login identities in the same system.
        return NextResponse.json(
          {
            error:
              'This email address is already registered with another organization on BizFlow. ' +
              'Please ask the employee to use a different email address.',
          },
          { status: 409 }
        );
      }
      // Same business but User exists without an Employee record — edge case (orphan).
      // Block and show a clear message.
      return NextResponse.json(
        { error: 'An account with this email already exists in your organization.' },
        { status: 400 }
      );
    }

    // ── CLEAN UP: remove any stale invitation for this email+business ────────
    // (e.g. a previous invite that was never accepted before it was deleted as employee)
    await prisma.invitation.deleteMany({
      where: {
        businessId: session.user.businessId,
        email: validatedData.email,
      },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const employee = await prisma.$transaction(async (tx) => {
      // Create the User (login identity) — globally unique by email
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          name: validatedData.name,
          role: validatedData.role as any,
          businessId: session.user.businessId,
          emailVerified: false,
        },
      });

      // Create the Employee record (scoped to this business)
      const emp = await tx.employee.create({
        data: {
          ...validatedData,
          userId: user.id,
          joinDate: new Date(validatedData.joinDate),
          businessId: session.user.businessId,
        },
      });

      // Create the invitation token (scoped to this business)
      await tx.invitation.create({
        data: {
          email: validatedData.email,
          token,
          role: validatedData.role as any,
          businessId: session.user.businessId,
          expiresAt,
        },
      });

      // Audit log
      await tx.userActivity.create({
        data: {
          businessId: session.user.businessId,
          userId: session.user.id,
          eventType: 'EMPLOYEE_CREATED',
          metadata: {
            employeeId: emp.id,
            employeeName: emp.name,
            role: validatedData.role,
          },
        },
      });

      // In-app notification — admin only
      await tx.notification.create({
        data: {
          businessId: session.user.businessId,
          type: 'INFO',
          title: 'New Employee Added',
          message: `Employee ${emp.name} has been added as ${emp.role.replace('_', ' ')}. Invitation sent to ${emp.email}.`,
          targetRole: 'SUPER_ADMIN',
        },
      });

      return emp;
    });

    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const inviteLink = `${protocol}://${host}/accept-invitation?token=${token}`;

    console.log("POST /api/employees: Employee created, starting email send");
    sendEmployeeInvitationEmail(
      validatedData.email,
      validatedData.name,
      validatedData.role,
      inviteLink,
      businessName
    ).catch(err => console.error("POST /api/employees: Email failed", err));

    logAudit({
      session,
      action: 'CREATE',
      entityType: 'Employee',
      entityId: employee.id,
      entityLabel: employee.name,
    }).catch(err => console.error("POST /api/employees: Audit failed", err));

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;

    console.error('Employee creation error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

