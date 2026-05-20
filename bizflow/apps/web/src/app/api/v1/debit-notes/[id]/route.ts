/**
 * GET    /api/v1/debit-notes/[id]
 * DELETE /api/v1/debit-notes/[id]
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { ok, deleted, notFound, internalError } from '@/lib/response';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id }  = await params;
    const note    = await prisma.debitNote.findFirst({
      where:   { id, businessId: session.user.businessId },
      include: { customer: true, sale: { select: { invoiceNo: true, total: true } } },
    });
    if (!note) return notFound('Debit note not found');
    return ok(note);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const { id }  = await params;
    const exists  = await prisma.debitNote.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Debit note not found');
    await prisma.debitNote.delete({ where: { id } });
    return deleted(id);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}
