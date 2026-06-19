import { NextResponse } from 'next/server';
import { requirePermission, withAuth, getRequestMeta } from '@/shared/lib/api-guard';
import { prisma } from '@/shared/lib/db';
import { logAudit } from '@/shared/lib/audit';

// POST /api/backup/export — generate a full data export
export const POST = withAuth(async () => {
  const session = await requirePermission('manage_backups');
  const businessId = session.user.businessId;

  // Create a backup record first
  const record = await prisma.backupRecord.create({
    data: {
      businessId,
      type:        'MANUAL',
      status:      'IN_PROGRESS',
      triggeredBy: session.user.id,
    },
  });

  try {
    // Fetch all business data in parallel
    const [
      business,
      products,
      customers,
      sales,
      expenses,
      employees,
      accounts,
      journalEntries,
      loans,
      quotations,
      creditNotes,
      debitNotes,
      bankAccounts,
      cashBookEntries,
      bankBookEntries,
      gstReturns,
      tdsEntries,
      accountsReceivable,
      accountsPayable,
    ] = await Promise.all([
      prisma.business.findUnique({ where: { id: businessId } }),
      prisma.product.findMany({ where: { businessId } }),
      prisma.customer.findMany({ where: { businessId } }),
      prisma.sale.findMany({ where: { businessId }, include: { items: true } }),
      prisma.expense.findMany({ where: { businessId } }),
      prisma.employee.findMany({ where: { businessId } }),
      prisma.account.findMany({ where: { businessId } }),
      prisma.journalEntry.findMany({ where: { businessId }, include: { lines: true } }),
      prisma.loanMaster.findMany({ where: { businessId }, include: { schedule: true, payments: true } }),
      prisma.quotation.findMany({ where: { businessId }, include: { items: true } }),
      prisma.creditNote.findMany({ where: { businessId } }),
      prisma.debitNote.findMany({ where: { businessId } }),
      prisma.bankAccount.findMany({ where: { businessId } }),
      prisma.cashBookEntry.findMany({ where: { businessId } }),
      prisma.bankBookEntry.findMany({ where: { businessId } }),
      prisma.gstReturn.findMany({ where: { businessId } }),
      prisma.tdsEntry.findMany({ where: { businessId } }),
      prisma.accountsReceivable.findMany({ where: { businessId } }),
      prisma.accountsPayable.findMany({ where: { businessId } }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version:    '1.0',
      business,
      products,
      customers,
      sales,
      expenses,
      // I-6 FIX: Explicitly strip sensitive fields from employee records
      employees: employees.map(({ userId, permissions, ...safe }) => ({
        ...safe,
        userId: undefined,       // Redact user account link
        permissions: undefined,  // Redact permission JSON (security-sensitive)
      })),
      accounts,
      journalEntries,
      loans,
      quotations,
      creditNotes,
      debitNotes,
      bankAccounts,
      cashBookEntries,
      bankBookEntries,
      gstReturns,
      tdsEntries,
      accountsReceivable,
      accountsPayable,
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const fileSize = Buffer.byteLength(jsonStr, 'utf-8');
    const fileName = `bizflow_backup_${new Date().toISOString().slice(0, 10)}.json`;

    // Update the backup record
    await prisma.backupRecord.update({
      where: { id: record.id },
      data: { status: 'COMPLETED', fileSize, fileName },
    });

    const meta = await getRequestMeta();
    await logAudit({
      session,
      action: 'CREATE',
      entityType: 'Backup',
      entityId: record.id,
      entityLabel: fileName,
      ...meta,
    });

    return new NextResponse(jsonStr, {
      status: 200,
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length':      fileSize.toString(),
      },
    });
  } catch (error) {
    // Mark backup as failed
    await prisma.backupRecord.update({
      where: { id: record.id },
      data: { status: 'FAILED', notes: String(error) },
    });

    return NextResponse.json(
      { success: false, error: { code: 'BACKUP_FAILED', message: 'Failed to generate backup' } },
      { status: 500 }
    );
  }
});
