/**
 * GET  /api/v1/credit-notes   — paginated credit note list
 * POST /api/v1/credit-notes   — create credit note (race-condition-safe numbering)
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { debitCreditNoteSchema }  from '@/shared/lib/validations';
import { ok, created, validationError, internalError, parsePagination, buildPagination } from '@/shared/lib/response';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const sp      = new URL(req.url).searchParams;
    const { page, limit, skip, sortBy, sortDir } = parsePagination(sp);
    const search = sp.get('search') ?? '';
    const from   = sp.get('from');
    const to     = sp.get('to');

    const where: any = {
      businessId: session.user.businessId,
      ...(search ? { OR: [{ creditNoteNo: { contains: search, mode: 'insensitive' as const } }, { customer: { name: { contains: search, mode: 'insensitive' as const } } }] } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + 'T23:59:59') } : {}) } } : {}),
    };

    const allowedSort = ['creditNoteNo', 'amount', 'createdAt'];
    const orderField  = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      prisma.creditNote.findMany({
        where,
        include: { customer: true, sale: { select: { invoiceNo: true } } },
        orderBy: { [orderField]: sortDir },
        skip, take: limit,
      }),
      prisma.creditNote.count({ where }),
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
    const parsed  = debitCreditNoteSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);
    const { saleId, customerId, reason, amount, taxAmount, notes } = parsed.data;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: session.user.businessId },
      select: { id: true }
    });
    if (!customer) throw new Error('Customer not found or access denied');

    if (saleId) {
      const sale = await prisma.sale.findFirst({
        where: { id: saleId, businessId: session.user.businessId },
        select: { id: true }
      });
      if (!sale) throw new Error('Sale not found or access denied');
    }

    // ── Collision-safe numbering (same pattern as invoices) ───────────────────
    const year   = new Date().getFullYear();
    const prefix = `CN-${year}-`;
    const last   = await prisma.creditNote.findFirst({
      where:   { businessId: session.user.businessId, creditNoteNo: { startsWith: prefix } },
      orderBy: { creditNoteNo: 'desc' },
      select:  { creditNoteNo: true },
    });
    const nextNum     = last ? (parseInt(last.creditNoteNo.split('-').at(-1)!, 10) || 0) + 1 : 1;
    const creditNoteNo = `${prefix}${String(nextNum).padStart(3, '0')}`;

    const note = await prisma.creditNote.create({
      data: { creditNoteNo, saleId, customerId, reason, amount: Number(amount), taxAmount: Number(taxAmount) || 0, notes, businessId: session.user.businessId },
    });

    return created(note);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}
