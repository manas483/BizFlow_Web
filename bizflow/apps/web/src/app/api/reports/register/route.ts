export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category'); // e.g. "Fertiliser", "Seed", etc.
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const businessId = session.user.businessId;

    const period = searchParams.get('period') || 'monthly';

    let from: Date;
    let to: Date;
    const now = new Date();

    if (period === 'daily') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'weekly') {
      const day = now.getDay() || 7; 
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59, 999);
    } else if (period === 'yearly') {
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (period === 'lifetime') {
      from = new Date(2000, 0, 1); 
      to = new Date(2099, 11, 31, 23, 59, 59, 999);
    } else if (period === 'custom' && startDateParam && endDateParam) {
      from = new Date(startDateParam);
      to = new Date(endDateParam);
      to.setHours(23, 59, 59, 999);
    } else { // 'monthly'
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // If category is provided, we filter products by category.
    // Otherwise, we might just return everything or just unique categories.
    if (!category) {
      // Just return available categories
      const categories = await prisma.product.findMany({
        where: { businessId },
        select: { category: true },
        distinct: ['category'],
      });
      return NextResponse.json({
        categories: categories.map(c => c.category).filter(Boolean),
      });
    }

    // Fetch Products in Category
    const products = await prisma.product.findMany({
      where: { businessId, category: { equals: category, mode: 'insensitive' } },
    });
    
    const productIds = products.map(p => p.id);

    // Fetch Sales
    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        createdAt: { gte: from, lte: to },
        status: { not: 'CANCELLED' },
        items: { some: { productId: { in: productIds } } }
      },
      include: {
        customer: true,
        items: {
          where: { productId: { in: productIds } },
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Fetch Stock Movements (Purchases/IN)
    const stockMovements = await prisma.stockMovement.findMany({
      where: {
        businessId,
        productId: { in: productIds },
        createdAt: { gte: from, lte: to },
        type: 'IN'
      },
      include: {
        product: true
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({
      period: { from, to },
      category,
      products,
      sales,
      stockMovements
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

