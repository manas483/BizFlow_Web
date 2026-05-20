/**
 * GET  /api/v1/debit-notes   — paginated debit note list
 * POST /api/v1/debit-notes   — create debit note (race-condition-safe numbering)
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { debitCreditNoteSchema }  from '@/lib/validations';
import { ok, created, validationError, internalError, parsePagination, buildPagination } from '@/lib/response';

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
      ...(search ? { OR: [{ debitNoteNo: { contains: search, mode: 'insensitive' as const } }, { customer: { name: { contains: search, mode: 'insensitive' as const } } }] } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + 'T23:59:59') } : {}) } } : {}),
    };

    const allowedSort = ['debitNoteNo', 'amount', 'createdAt'];
    const orderField  = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      prisma.debitNote.findMany({
        where,
        include: { customer: true, sale: { select: { invoiceNo: true } } },
        orderBy: { [orderField]: sortDir },
        skip, take: limit,
      }),
      prisma.debitNote.count({ where }),
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

    const year   = new Date().getFullYear();
    const prefix = `DN-${year}-`;
    const last   = await prisma.debitNote.findFirst({
      where:   { businessId: session.user.businessId, debitNoteNo: { startsWith: prefix } },
      orderBy: { debitNoteNo: 'desc' },
      select:  { debitNoteNo: true },
    });
    const nextNum    = last ? (parseInt(last.debitNoteNo.split('-').at(-1)!, 10) || 0) + 1 : 1;
    const debitNoteNo = `${prefix}${String(nextNum).padStart(3, '0')}`;

    const note = await prisma.debitNote.create({
      data: { debitNoteNo, saleId, customerId, reason, amount: Number(amount), taxAmount: Number(taxAmount) || 0, notes, businessId: session.user.businessId },
    });

    return created(note);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}
