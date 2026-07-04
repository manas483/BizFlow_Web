import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { ok, internalError } from '@/shared/lib/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    
    const categories = await prisma.product.findMany({
      where: { businessId: session.user.businessId },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    const uniqueCategories = categories.map(c => c.category).filter(c => c.trim() !== '');

    return ok(uniqueCategories);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error('Failed to fetch categories:', e);
    return internalError();
  }
}
