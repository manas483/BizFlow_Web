import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') ?? 'monthly';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const businessId = session.user.businessId;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { gstInclusive: true }
    });
    const gstInclusive = business?.gstInclusive ?? false;

    // Build date range
    let from: Date, to: Date;
    const now = new Date();
    
    // For backwards compatibility, if year/month passed instead of period
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');

    if (yearParam && !searchParams.has('period')) {
      const year = parseInt(yearParam);
      if (monthParam) {
        from = new Date(year, parseInt(monthParam) - 1, 1);
        to = new Date(year, parseInt(monthParam), 0, 23, 59, 59, 999);
      } else {
        from = new Date(year, 0, 1);
        to = new Date(year, 11, 31, 23, 59, 59, 999);
      }
    } else {
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
    }

    const [
      salesAgg,
      expensesAgg,
      salesByMonth,
      expensesByCategory,
      topProducts,
      lowStockItems,
      cogsItems,
      topCustomers,
      customersAgg,
      inventoryProducts,
      creditNotesAgg,
      expensesByDate
    ] = await Promise.all([
      // Total revenue & count (excluding CANCELLED)
      prisma.sale.aggregate({
        where: { businessId, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
        _sum: { total: true, paid: true },
        _count: true,
      }),

      // Total operating expenses
      prisma.expense.aggregate({
        where: { businessId, date: { gte: from, lte: to } },
        _sum: { amount: true },
      }),

      // Monthly sales breakdown (for charts)
      prisma.sale.groupBy({
        by: ['createdAt'],
        where: { businessId, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
        _sum: { total: true, paid: true },
      }),

      // Expenses by category
      prisma.expense.groupBy({
        by: ['category'],
        where: { businessId, date: { gte: from, lte: to } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),

      // Top selling products
      prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { businessId, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } } },
        _sum: { qty: true, price: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: 5,
      }),

      // Low stock alerts
      prisma.product.findMany({
        where: { businessId },
        select: { id: true, name: true, stock: true, minStock: true, category: true },
      }),

      // COGS calculation & GST calculation
      prisma.saleItem.findMany({
        where: { sale: { businessId, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } } },
        select: { qty: true, price: true, purchasePrice: true, gstRate: true, discount: true, sale: { select: { createdAt: true } } },
      }),

      // Top customers by revenue
      prisma.sale.groupBy({
        by: ['customerId'],
        where: { businessId, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),

      // Pending collection (Total unpaid customer balances)
      prisma.customer.aggregate({
        where: { businessId },
        _sum: { dues: true }
      }),

      // Inventory Valuation
      prisma.product.findMany({
        where: { businessId },
        select: { stock: true, purchasePrice: true }
      }),

      // Credit Notes (Refunds/Returns)
      prisma.creditNote.aggregate({
        where: { businessId, createdAt: { gte: from, lte: to } },
        _sum: { amount: true, taxAmount: true }
      }),
      
      // Expenses by date (for charts)
      prisma.expense.groupBy({
        by: ['date'],
        where: { businessId, date: { gte: from, lte: to } },
        _sum: { amount: true },
      })
    ]);

    // Calculate COGS
    const cogs = cogsItems.reduce((acc: number, item: any) => acc + (item.qty * (item.purchasePrice || 0)), 0);

    // Calculate Sales & Profits
    const grossSales = salesAgg._sum.total ?? 0;
    const returnedAmount = creditNotesAgg._sum.amount ?? 0;
    const totalSales = Math.max(0, grossSales - returnedAmount);
    
    const collectedAmount = salesAgg._sum.paid ?? 0;
    const opExpenses = expensesAgg._sum.amount ?? 0;
    
    const grossProfit = totalSales - cogs;
    const netProfit = grossProfit - opExpenses;
    const outstandingDues = totalSales - collectedAmount;
    const pendingCollection = customersAgg._sum.dues ?? 0;
    
    const collectionEfficiency = totalSales > 0 ? (collectedAmount / totalSales) * 100 : 0;
    const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
    const inventoryValuation = inventoryProducts.reduce((acc, p) => acc + (Math.max(0, p.stock) * p.purchasePrice), 0);

    // GST Analytics
    let totalGstCollected = 0;
    const gstBySlab: Record<string, number> = { '5': 0, '12': 0, '18': 0, '28': 0 };
    const taxSummaryByMonth: Record<string, number> = {};

    cogsItems.forEach((item: any) => {
      const qty = Number(item.qty) || 0;
      const grossAmt = (qty * item.price) - (item.discount || 0);
      const rate = item.gstRate || 0;
      let tax = 0;

      if (rate > 0) {
        if (gstInclusive) {
          const taxable = grossAmt / (1 + rate / 100);
          tax = grossAmt - taxable;
        } else {
          tax = grossAmt * (rate / 100);
        }

        totalGstCollected += tax;
        
        // Add to slab
        const slabKey = String(rate);
        if (gstBySlab[slabKey] !== undefined) {
          gstBySlab[slabKey] += tax;
        } else {
          gstBySlab[slabKey] = tax;
        }

        // Add to monthly summary
        const monthKey = new Date(item.sale.createdAt).toLocaleString("default", { month: "short", year: "numeric" });
        taxSummaryByMonth[monthKey] = (taxSummaryByMonth[monthKey] || 0) + tax;
      }
    });
    
    // Reduce GST collected by Credit Note tax amount
    const returnedTax = creditNotesAgg._sum.taxAmount ?? 0;
    totalGstCollected = Math.max(0, totalGstCollected - returnedTax);

    const gstPayable = totalGstCollected; // Simplification, no input credit tracked currently
    const gstInputCredit = 0;

    // Enrich top products with names
    const productIds = topProducts.map((p: any) => p.productId);
    const productsInfo = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId },
      select: { id: true, name: true, category: true },
    });
    const productMap = Object.fromEntries(productsInfo.map((p: any) => [p.id, p]));

    // Enrich top customers
    const customerIds = topCustomers.map((c: any) => c.customerId);
    const customersInfo = await prisma.customer.findMany({
      where: { id: { in: customerIds }, businessId },
      select: { id: true, name: true, phone: true }
    });
    const customerMap = Object.fromEntries(customersInfo.map((c: any) => [c.id, c]));

    // Filter low stock
    const filteredLowStock = lowStockItems
      .filter((p: any) => p.stock <= p.minStock)
      .slice(0, 10);

    const mappedExpenses = expensesByCategory.map((e: any) => ({
      category: e.category,
      amount: e._sum.amount ?? 0,
    }));

    return NextResponse.json({
      period: { from, to, period },
      summary: {
        totalSales,
        cogs,
        operatingExpenses: opExpenses,
        grossProfit,
        netProfit,
        outstandingDues,
        collectedAmount,
        pendingCollection,
        salesCount: salesAgg._count,
        collectionEfficiency,
        profitMargin,
        inventoryValuation
      },
      gstAnalytics: {
        totalGstCollected,
        gstBySlab,
        gstPayable,
        gstInputCredit,
        taxSummaryByMonth
      },
      salesByMonth,
      expensesByDate,
      expensesByCategory: mappedExpenses,
      topProducts: topProducts.map((tp: any) => ({
        product: productMap[tp.productId],
        qty: tp._sum.qty ?? 0,
        revenue: tp._sum.price ?? 0,
      })),
      topCustomers: topCustomers.map((tc: any) => ({
        customer: customerMap[tc.customerId],
        total: tc._sum.total ?? 0
      })),
      lowStockItems: filteredLowStock,
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
