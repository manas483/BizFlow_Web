import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { sendMonthlyReportEmail } from '@/shared/lib/email';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Verify a secret token to prevent unauthorized calls
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const previousMonth = subMonths(new Date(), 1);
    const startDate = startOfMonth(previousMonth);
    const endDate = endOfMonth(previousMonth);
    const monthString = format(previousMonth, 'MMMM yyyy');

    const businesses = await prisma.business.findMany({
      include: {
        users: { where: { role: 'SUPER_ADMIN' }, take: 1 }
      }
    });

    const results: Array<{ businessId: string; email: string; success: boolean; error?: string }> = [];

    // H-N5 FIX: Individual try/catch per business — one failure does not stop others
    for (const business of businesses) {
      if (business.users.length === 0) continue;
      const adminEmail = business.users[0].email;

      try {
        const sales = await prisma.sale.aggregate({
          where: { businessId: business.id, createdAt: { gte: startDate, lte: endDate } },
          _sum: { total: true }
        });
        const totalSales = sales._sum.total || 0;

        const expenses = await prisma.expense.aggregate({
          where: { businessId: business.id, date: { gte: startDate, lte: endDate } },
          _sum: { amount: true }
        });
        const totalExpenses = expenses._sum.amount || 0;

        // H-N1 FIX: Removed phantom prisma.purchase query — Purchase model doesn't exist.
        // COGS tracking is a planned future feature. P&L = Sales - Expenses for now.
        const totalPurchases = 0;
        const profitOrLoss = totalSales - totalExpenses;

        const emailResult = await sendMonthlyReportEmail(
          adminEmail,
          business.name,
          monthString,
          totalSales,
          totalPurchases,
          totalExpenses,
          profitOrLoss
        );

        results.push({ businessId: business.id, email: adminEmail, success: emailResult.success });
      } catch (bizError: any) {
        // Log individual business failure; continue processing remaining businesses
        console.error(`[cron/monthly-report] Failed for business ${business.id}:`, bizError?.message);
        results.push({ businessId: business.id, email: adminEmail, success: false, error: bizError?.message });
      }
    }

    const failed = results.filter(r => !r.success);
    // Return 207 Multi-Status if there were partial failures
    const status = failed.length > 0 && failed.length < results.length ? 207 : 200;
    return NextResponse.json({ success: failed.length === 0, processed: results.length, failed: failed.length, results }, { status });
  } catch (error: any) {
    console.error('[cron/monthly-report] Fatal error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
