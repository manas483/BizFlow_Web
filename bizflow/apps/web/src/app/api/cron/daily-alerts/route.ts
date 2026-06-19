import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { createNotification } from '@/shared/lib/notification-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily alerts cron job — runs once daily to generate:
 * - Payment due reminders (receivables past due)
 * - Loan EMI due reminders (schedule items due in 3 days)
 * - GST filing reminders (unfiled periods)
 * - Low stock alerts (products below reorder level)
 *
 * Protected by CRON_SECRET.
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const businesses = await prisma.business.findMany({
      select: { id: true, name: true },
    });

    let totalAlerts = 0;

    for (const business of businesses) {
      try {
        // 1. Payment due reminders
        const overdueReceivables = await prisma.accountsReceivable.findMany({
          where: {
            businessId: business.id,
            status: { in: ['OUTSTANDING', 'PARTIALLY_PAID'] },
            dueDate: { lt: new Date() },
          },
          include: { customer: { select: { name: true } } },
          take: 10,
        });

        for (const ar of overdueReceivables) {
          const outstanding = ar.amount - ar.paidAmount;
          await createNotification({
            businessId: business.id,
            type: 'warning',
            category: 'finance',
            priority: outstanding > 50000 ? 'urgent' : 'high',
            title: 'Payment Overdue',
            message: `₹${outstanding.toLocaleString('en-IN')} from ${ar.customer.name} (Ref: ${ar.invoiceRef}) is past due.`,
            sourceType: 'payment',
            sourceId: ar.id,
          });
          totalAlerts++;
        }

        // 2. Loan EMI due reminders (due in next 3 days)
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

        const upcomingEMIs = await prisma.loanSchedule.findMany({
          where: {
            status: 'PENDING',
            dueDate: { lte: threeDaysFromNow, gte: new Date() },
            loan: { businessId: business.id, status: 'ACTIVE' },
          },
          include: { loan: { select: { loanNumber: true, borrowerName: true } } },
          take: 10,
        });

        for (const emi of upcomingEMIs) {
          await createNotification({
            businessId: business.id,
            type: 'alert',
            category: 'finance',
            priority: 'high',
            title: 'EMI Due Soon',
            message: `EMI of ₹${emi.emiAmount.toLocaleString('en-IN')} for loan ${emi.loan.loanNumber} is due on ${emi.dueDate.toLocaleDateString('en-IN')}.`,
            sourceType: 'loan',
            sourceId: emi.id,
          });
          totalAlerts++;
        }

        // 3. GST filing reminders (unfiled periods)
        const unfiledGST = await prisma.gstReturn.findMany({
          where: {
            businessId: business.id,
            status: 'PENDING',
          },
          take: 3,
        });

        for (const gst of unfiledGST) {
          await createNotification({
            businessId: business.id,
            type: 'alert',
            category: 'gst',
            priority: 'normal',
            title: 'GST Return Pending',
            message: `${gst.returnType} for period ${gst.period} is pending filing.`,
            sourceType: 'gst',
            sourceId: gst.id,
          });
          totalAlerts++;
        }

        // 4. Low stock batch alerts
        const lowStockProducts = await prisma.product.findMany({
          where: { businessId: business.id },
          select: { id: true, name: true, stock: true, minStock: true, reorderLevel: true },
        });

        const criticalProducts = lowStockProducts.filter(p => {
          const threshold = p.reorderLevel > 0 ? p.reorderLevel : p.minStock;
          return p.stock <= threshold && p.stock > 0;
        });

        const outOfStock = lowStockProducts.filter(p => p.stock <= 0);

        if (outOfStock.length > 0) {
          await createNotification({
            businessId: business.id,
            type: 'alert',
            category: 'inventory',
            priority: 'urgent',
            title: `${outOfStock.length} Products Out of Stock`,
            message: `${outOfStock.slice(0, 3).map(p => p.name).join(', ')}${outOfStock.length > 3 ? ` and ${outOfStock.length - 3} more` : ''} are out of stock.`,
            sourceType: 'stock',
          });
          totalAlerts++;
        }

        if (criticalProducts.length > 0) {
          await createNotification({
            businessId: business.id,
            type: 'warning',
            category: 'inventory',
            priority: 'high',
            title: `${criticalProducts.length} Products Need Restocking`,
            message: `${criticalProducts.slice(0, 3).map(p => `${p.name} (${p.stock} left)`).join(', ')} — consider reordering.`,
            sourceType: 'stock',
          });
          totalAlerts++;
        }
      } catch (bizErr: any) {
        console.error(`[cron/daily-alerts] Failed for business ${business.id}:`, bizErr.message);
      }
    }

    // A-6 FIX: Clean up expired OTP verification records
    // Keeps the database lean by removing old verification attempts
    try {
      await prisma.emailVerification.deleteMany({
        where: { expiresAt: { lt: new Date() } }
      });
    } catch (cleanupErr) {
      console.error('[cron/daily-alerts] Failed to clean up expired OTPs:', cleanupErr);
    }

    return NextResponse.json({
      success: true,
      businessesProcessed: businesses.length,
      totalAlerts,
    });
  } catch (error: any) {
    console.error('[cron/daily-alerts] Fatal error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
