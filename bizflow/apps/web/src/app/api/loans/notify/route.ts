export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const businessId = session.user.businessId;

    const now = new Date();
    // Normalize date to midnight for date-only comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Find all active loans with unpaid installments past due, and mark them as OVERDUE
    const overdueSchedules = await prisma.loanSchedule.findMany({
      where: {
        loan: { businessId, status: 'ACTIVE' },
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        dueDate: { lt: today },
      },
      include: { loan: true },
    });

    const loansToMarkOverdue = Array.from(new Set(overdueSchedules.map(s => s.loanId)));
    if (loansToMarkOverdue.length > 0) {
      await prisma.loanMaster.updateMany({
        where: { id: { in: loansToMarkOverdue } },
        data: { status: 'OVERDUE' },
      });
    }

    // 2. Fetch all loans and schedules to determine who to notify
    const activeAndOverdueLoans = await prisma.loanMaster.findMany({
      where: { businessId, status: { in: ['ACTIVE', 'OVERDUE'] } },
      include: {
        schedule: {
          where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        },
      },
    });

    let notificationsCreated = 0;

    for (const loan of activeAndOverdueLoans) {
      for (const inst of loan.schedule) {
        const dueDate = new Date(inst.dueDate);
        const dueMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        
        // Calculate difference in calendar days
        const diffTime = dueMidnight.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let shouldNotify = false;
        let title = '';
        let message = '';
        let type = 'INFO';

        if (diffDays === 7) {
          shouldNotify = true;
          title = 'Upcoming EMI Reminder (7 Days)';
          message = `EMI of ₹${inst.emiAmount.toFixed(2)} for Loan ${loan.loanNumber} (Borrower: ${loan.borrowerName}) is due in 7 days on ${dueMidnight.toLocaleDateString()}.`;
        } else if (diffDays === 1) {
          shouldNotify = true;
          title = 'EMI Due Tomorrow';
          message = `EMI of ₹${inst.emiAmount.toFixed(2)} for Loan ${loan.loanNumber} (Borrower: ${loan.borrowerName}) is due tomorrow.`;
        } else if (diffDays === -1) {
          // Just became overdue yesterday
          shouldNotify = true;
          title = 'EMI Overdue Alert';
          message = `EMI of ₹${inst.emiAmount.toFixed(2)} for Loan ${loan.loanNumber} (Borrower: ${loan.borrowerName}) is OVERDUE. It was due on ${dueMidnight.toLocaleDateString()}.`;
          type = 'WARNING';
        }

        if (shouldNotify) {
          // Check if notification already exists to prevent duplicates
          const exists = await prisma.notification.findFirst({
            where: {
              businessId,
              title,
              message,
            },
          });

          if (!exists) {
            await prisma.notification.create({
              data: {
                businessId,
                type,
                title,
                message,
                targetRole: 'SUPER_ADMIN',
              },
            });
            notificationsCreated++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      loansMarkedOverdue: loansToMarkOverdue.length,
      notificationsCreated,
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

