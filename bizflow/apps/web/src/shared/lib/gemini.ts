/**
 * Gemini AI Client — generates demand forecasts, sales forecasts, and
 * smart business insights using Google's Gemini API.
 *
 * Uses gemini-2.0-flash for cost efficiency (free tier: 15 RPM, 1M tokens/day).
 * Results are cached in the AiForecast table with 24h TTL.
 */

import { prisma } from '@/shared/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MonthlySales {
  month: string;   // "2026-01"
  revenue: number;
  quantity: number;
  topProducts: string[];
}

export interface DemandForecast {
  productName: string;
  expectedDemand: number;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  category: string;
}

export interface SalesForecast {
  period: string;
  expectedRevenue: number;
  growthPercent: number;
  confidence: number;
}

export interface BusinessInsight {
  id: string;
  type: 'warning' | 'tip' | 'success' | 'info';
  title: string;
  message: string;
  metric?: string;
  actionLabel?: string;
  actionHref?: string;
}

export interface ForecastResult {
  demandForecasts: DemandForecast[];
  salesForecasts: SalesForecast[];
  fastMoving: string[];
  slowMoving: string[];
  generatedAt: string;
}

// ── Gemini API Call ──────────────────────────────────────────────────────────

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
}

// ── Cache Layer ──────────────────────────────────────────────────────────────

async function getCachedForecast(businessId: string, type: string): Promise<any | null> {
  const cached = await prisma.aiForecast.findFirst({
    where: {
      businessId,
      type,
      expiresAt: { gt: new Date() },
    },
    orderBy: { generatedAt: 'desc' },
  });

  return cached?.data ?? null;
}

async function cacheForecast(
  businessId: string,
  type: string,
  period: string,
  data: any,
  confidence?: number,
  ttlHours: number = 24
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await prisma.aiForecast.create({
    data: {
      businessId,
      type,
      period,
      data,
      confidence,
      expiresAt,
    },
  });
}

// ── Forecast Generation ──────────────────────────────────────────────────────

/**
 * Generate demand + sales forecasts using Gemini.
 * Checks cache first — only calls API if expired.
 */
export async function generateForecast(businessId: string): Promise<ForecastResult> {
  // Check cache
  const cached = await getCachedForecast(businessId, 'demand') as ForecastResult;
  if (cached && (cached.demandForecasts?.length > 0 || cached.salesForecasts?.length > 0)) {
    return cached;
  }

  // Gather data
  const salesHistory = await gatherSalesHistory(businessId);
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { businessType: true, name: true },
  });

  if (salesHistory.length === 0) {
    return {
      demandForecasts: [],
      salesForecasts: [],
      fastMoving: [],
      slowMoving: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const prompt = `You are a business analytics AI. Analyze the following sales data for a "${business?.businessType || 'general'}" business and provide forecasts.

SALES HISTORY (last 12 months):
${JSON.stringify(salesHistory, null, 2)}

Respond with ONLY valid JSON in this exact format:
{
  "demandForecasts": [
    { "productName": "...", "expectedDemand": 120, "confidence": 87, "trend": "increasing", "category": "..." }
  ],
  "salesForecasts": [
    { "period": "Next Month", "expectedRevenue": 875000, "growthPercent": 12, "confidence": 82 },
    { "period": "Next Quarter", "expectedRevenue": 2800000, "growthPercent": 8, "confidence": 75 }
  ],
  "fastMoving": ["Product A", "Product B"],
  "slowMoving": ["Product C", "Product D"]
}

Provide top 5 demand forecasts, 2 sales forecasts (monthly + quarterly), and top 3 fast/slow moving products.
Base confidence on data volume and consistency. Use realistic numbers based on the trends.`;

  try {
    let responseText = await callGemini(prompt);
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(responseText);

    const forecast: ForecastResult = {
      demandForecasts: result.demandForecasts || [],
      salesForecasts: result.salesForecasts || [],
      fastMoving: result.fastMoving || [],
      slowMoving: result.slowMoving || [],
      generatedAt: new Date().toISOString(),
    };

    // Cache for 24 hours if valid
    if (forecast.demandForecasts.length > 0 || forecast.salesForecasts.length > 0) {
      const period = new Date().toISOString().substring(0, 7); // "2026-06"
      await cacheForecast(businessId, 'demand', period, forecast, 80);
    }

    return forecast;
  } catch (err) {
    console.error('[Gemini] Forecast generation failed:', err);
    return {
      demandForecasts: [],
      salesForecasts: [],
      fastMoving: [],
      slowMoving: [],
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Generate smart business insights using Gemini.
 */
export async function generateInsights(businessId: string): Promise<BusinessInsight[]> {
  // Check cache
  const cached = await getCachedForecast(businessId, 'insight');
  if (cached) return cached as BusinessInsight[];

  // Gather data
  const [salesSummary, stockSummary, receivablesSummary, expensesSummary] = await Promise.all([
    gatherRecentSalesSummary(businessId),
    gatherStockSummary(businessId),
    gatherReceivablesSummary(businessId),
    gatherExpensesSummary(businessId),
  ]);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { businessType: true, name: true },
  });

  const prompt = `You are an AI business assistant for "${business?.name || 'this business'}" (type: ${business?.businessType || 'general'}).

Analyze the following data and provide 5 actionable business insights:

RECENT SALES: ${JSON.stringify(salesSummary)}
STOCK LEVELS: ${JSON.stringify(stockSummary)}
RECEIVABLES: ${JSON.stringify(receivablesSummary)}
EXPENSES: ${JSON.stringify(expensesSummary)}

Respond with ONLY valid JSON — an array of insights:
[
  {
    "id": "insight_1",
    "type": "warning",
    "title": "Short, punchy headline",
    "message": "Detailed explanation with specific numbers from the data",
    "metric": "+18%",
    "actionLabel": "View Details",
    "actionHref": "/sales"
  }
]

Types: "warning" (risks), "tip" (opportunities), "success" (good trends), "info" (neutral observations).
Make insights specific and data-driven. Use ₹ for currency. Be concise.`;

  try {
    let responseText = await callGemini(prompt);
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const insights: BusinessInsight[] = JSON.parse(responseText);

    // Cache for 24 hours
    await cacheForecast(businessId, 'insight', 'daily', insights);

    return insights;
  } catch (err) {
    console.error('[Gemini] Insight generation failed:', err);
    return [];
  }
}

/**
 * Parse an uploaded PDF invoice using Gemini Vision.
 */
export async function parseInvoicePdf(base64Pdf: string): Promise<any> {
  const prompt = `You are a data extraction assistant for an inventory management system.
Extract invoice details from this PDF document.
If the document is not an invoice, or is completely unreadable, return {"error": "Not a valid invoice"}.

Respond ONLY with valid JSON in this exact format (no markdown, no backticks):
{
  "invoiceNumber": "INV-12345",
  "supplier": "Supplier Name Ltd.",
  "purchaseDate": "2024-01-25",
  "products": [
    {
      "name": "Exact Product Name",
      "sku": "SKU if available, otherwise empty string",
      "category": "Inferred Category",
      "stock": 10,
      "unitsPerBag": 1,
      "basePurchasePrice": 100.50,
      "purchasePrice": 118.59,
      "sellingPrice": 150.00,
      "unit": "pcs",
      "gstRate": 18,
      "hsnCode": "1234"
    }
  ]
}

Instructions for extraction:
- 'stock' is the quantity purchased.
- 'purchasePrice' should ideally be the final landed cost per unit including taxes. 'basePurchasePrice' is cost before tax.
- 'sellingPrice' is MRP if available, else 0.
- Ensure numeric values are numbers, not strings.
- Try to infer the 'category' based on the product name and supplier context.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'application/pdf', data: base64Pdf } }
        ]
      }],
      generationConfig: {
        temperature: 0.1, // low temperature for extraction
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Vision API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  
  try {
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse Gemini response:", rawText);
    throw new Error("Failed to parse invoice data from AI response.");
  }
}

// ── Data Gatherers ───────────────────────────────────────────────────────────

async function gatherSalesHistory(businessId: string): Promise<MonthlySales[]> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const sales = await prisma.sale.findMany({
    where: { businessId, createdAt: { gte: twelveMonthsAgo } },
    include: { items: { include: { product: { select: { name: true } } } } },
    orderBy: { createdAt: 'asc' },
  });

  // Group by month
  const monthMap = new Map<string, { revenue: number; quantity: number; products: Map<string, number> }>();

  for (const sale of sales) {
    const month = sale.createdAt.toISOString().substring(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, { revenue: 0, quantity: 0, products: new Map() });
    }
    const entry = monthMap.get(month)!;
    entry.revenue += sale.total;

    for (const item of sale.items) {
      entry.quantity += item.qty;
      const name = item.product.name;
      entry.products.set(name, (entry.products.get(name) ?? 0) + item.qty);
    }
  }

  return Array.from(monthMap.entries()).map(([month, data]) => ({
    month,
    revenue: Math.round(data.revenue),
    quantity: data.quantity,
    topProducts: Array.from(data.products.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name),
  }));
}

async function gatherRecentSalesSummary(businessId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [thisMonth, lastMonth] = await Promise.all([
    prisma.sale.aggregate({
      where: { businessId, createdAt: { gte: thirtyDaysAgo } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: {
        businessId,
        createdAt: {
          gte: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
          lt: thirtyDaysAgo,
        },
      },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  return {
    last30DaysRevenue: thisMonth._sum.total ?? 0,
    last30DaysCount: thisMonth._count,
    previous30DaysRevenue: lastMonth._sum.total ?? 0,
    previous30DaysCount: lastMonth._count,
  };
}

async function gatherStockSummary(businessId: string) {
  const products = await prisma.product.findMany({
    where: { businessId },
    select: { name: true, stock: true, minStock: true, reorderLevel: true, sellingPrice: true },
    orderBy: { stock: 'asc' },
    take: 10,
  });

  const lowStock = products.filter(p => p.stock <= (p.reorderLevel || p.minStock));
  const outOfStock = products.filter(p => p.stock <= 0);

  return {
    totalProducts: await prisma.product.count({ where: { businessId } }),
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    criticalItems: lowStock.slice(0, 5).map(p => ({
      name: p.name,
      stock: p.stock,
      threshold: p.reorderLevel || p.minStock,
    })),
  };
}

async function gatherReceivablesSummary(businessId: string) {
  const receivables = await prisma.accountsReceivable.findMany({
    where: { businessId, status: { not: 'PAID' } },
    select: { amount: true, paidAmount: true, dueDate: true },
  });

  const totalOutstanding = receivables.reduce((s, r) => s + (r.amount - r.paidAmount), 0);
  const overdue = receivables.filter(r => new Date(r.dueDate) < new Date());
  const overdueAmount = overdue.reduce((s, r) => s + (r.amount - r.paidAmount), 0);

  // Also check customer dues
  const customerDues = await prisma.customer.aggregate({
    where: { businessId, dues: { gt: 0 } },
    _sum: { dues: true },
    _count: true,
  });

  return {
    totalOutstanding: Math.round(totalOutstanding),
    overdueCount: overdue.length,
    overdueAmount: Math.round(overdueAmount),
    customersWithDues: customerDues._count,
    totalCustomerDues: Math.round(customerDues._sum.dues ?? 0),
  };
}

async function gatherExpensesSummary(businessId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const expenses = await prisma.expense.findMany({
    where: { businessId, date: { gte: thirtyDaysAgo } },
    select: { category: true, amount: true },
  });

  const byCategory = new Map<string, number>();
  let total = 0;
  for (const e of expenses) {
    total += e.amount;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }

  return {
    totalLast30Days: Math.round(total),
    byCategory: Object.fromEntries(byCategory),
  };
}
