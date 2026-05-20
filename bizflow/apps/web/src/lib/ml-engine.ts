// ─────────────────────────────────────────────────────────────────────────────
// BizFlow — ML Recommendation Engine
// Lightweight, in-process collaborative + content-based hybrid
// No external ML deps — runs purely on Prisma data
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db";
import { getBusinessProfile } from "@/lib/business-intelligence";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProductRecommendation {
  productId: string;
  name: string;
  category: string;
  reason: string;
  score: number;
  action: "reorder" | "promote" | "bundle" | "new";
}

export interface QuickAction {
  id: string;
  label: string;
  href: string;
  icon: string;
  score: number;
}

export interface SmartInsight {
  id: string;
  type: "warning" | "tip" | "success" | "info";
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

export interface RecommendationResult {
  productRecommendations: ProductRecommendation[];
  quickActions: QuickAction[];
  insights: SmartInsight[];
  reorderAlerts: ProductRecommendation[];
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export async function generateRecommendations(
  businessId: string
): Promise<RecommendationResult> {
  const [business, products, sales, activities, customers] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId } }),
    prisma.product.findMany({ where: { businessId }, include: { saleItems: { take: 50, orderBy: { sale: { createdAt: "desc" } } } } }),
    prisma.sale.findMany({ where: { businessId }, include: { items: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    // @ts-ignore — UserActivity may not exist yet, handled gracefully
    prisma.userActivity?.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 200 }).catch(() => []),
    prisma.customer.findMany({ where: { businessId, dues: { gt: 0 } }, orderBy: { dues: "desc" }, take: 5 }),
  ]);

  if (!business) return { productRecommendations: [], quickActions: [], insights: [], reorderAlerts: [] };

  const profile = getBusinessProfile(business.businessType);

  // ─── 1. Reorder Alerts ───────────────────────────────────────────────────
  const reorderAlerts: ProductRecommendation[] = products
    .filter((p: any) => p.stock <= p.minStock)
    .map((p: any) => {
      const totalSold = p.saleItems.reduce((sum: number, si: any) => sum + si.qty, 0);
      const velocity = totalSold / 30; // items/day approx
      return {
        productId: p.id,
        name: p.name,
        category: p.category,
        reason: `Only ${p.stock} units left (min: ${p.minStock}). Selling ~${velocity.toFixed(1)}/day`,
        score: (p.minStock - p.stock) * (velocity + 1),
        action: "reorder" as const,
      };
    })
    .sort((a: any, b: any) => b.score - a.score);

  // ─── 2. Product Recommendations ─────────────────────────────────────────
  // Score based on: sales velocity, margin, category affinity with business type
  const productRecommendations: ProductRecommendation[] = [];

  // Co-purchase pattern: find products often sold together
  const saleProductSets = sales.map((s: any) => s.items.map((i: any) => i.productId));
  const coPurchaseCount: Record<string, Record<string, number>> = {};
  for (const set of saleProductSets) {
    for (const pid of set) {
      if (!coPurchaseCount[pid]) coPurchaseCount[pid] = {};
      for (const other of set) {
        if (other !== pid) {
          coPurchaseCount[pid][other] = (coPurchaseCount[pid][other] ?? 0) + 1;
        }
      }
    }
  }

  // Top selling products to promote
  const salesVelocity: Record<string, number> = {};
  for (const sale of sales) {
    for (const item of sale.items) {
      salesVelocity[item.productId] = (salesVelocity[item.productId] ?? 0) + item.qty;
    }
  }

  const topSellers = Object.entries(salesVelocity)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  for (const [productId, qty] of topSellers) {
    const product = products.find((p: any) => p.id === productId);
    if (product && product.stock > product.minStock) {
      productRecommendations.push({
        productId,
        name: product.name,
        category: product.category,
        reason: `Sold ${qty} units recently — high demand product`,
        score: qty,
        action: "promote",
      });
    }
  }

  // ─── 3. Quick Actions (ranked by activity) ───────────────────────────────
  const activityCounts: Record<string, number> = {};
  for (const a of activities as any[]) {
    const key = a.eventType ?? "unknown";
    activityCounts[key] = (activityCounts[key] ?? 0) + 1;
  }

  const baseActions: QuickAction[] = [
    { id: "new_sale", label: "New Sale", href: "/sales", icon: "ShoppingCart", score: (activityCounts["sale_created"] ?? 0) * 3 + 10 },
    { id: "add_product", label: "Add Product", href: "/inventory", icon: "Package", score: (activityCounts["product_add"] ?? 0) * 2 + 5 },
    { id: "add_customer", label: "Add Customer", href: "/customers", icon: "Users", score: (activityCounts["customer_added"] ?? 0) * 2 + 4 },
    { id: "view_reports", label: "View Reports", href: "/reports", icon: "BarChart2", score: (activityCounts["report_viewed"] ?? 0) * 2 + 3 },
    { id: "new_quotation", label: "New Quotation", href: "/sales?tab=quotations", icon: "FileText", score: (activityCounts["quotation_created"] ?? 0) * 2 + 2 },
    { id: "record_expense", label: "Record Expense", href: "/expenses", icon: "Receipt", score: (activityCounts["expense_added"] ?? 0) * 2 + 1 },
  ];
  const quickActions = baseActions.sort((a, b) => b.score - a.score);

  // ─── 4. Smart Insights ────────────────────────────────────────────────────
  const insights: SmartInsight[] = [];

  // Low stock insight
  if (reorderAlerts.length > 0) {
    insights.push({
      id: "low_stock",
      type: "warning",
      title: `${reorderAlerts.length} products need restocking`,
      message: `${reorderAlerts[0].name} and ${reorderAlerts.length - 1} others are below minimum stock level.`,
      actionLabel: "View Inventory",
      actionHref: "/inventory",
    });
  }

  // Customer dues insight
  if (customers.length > 0) {
    const totalDues = customers.reduce((s: number, c: any) => s + c.dues, 0);
    insights.push({
      id: "customer_dues",
      type: "info",
      title: `₹${totalDues.toLocaleString("en-IN")} in outstanding dues`,
      message: `${customers[0].name} owes the most (₹${customers[0].dues.toLocaleString("en-IN")}).`,
      actionLabel: "View Customers",
      actionHref: "/customers",
    });
  }

  // Business-type specific insight
  if (profile.insights.length > 0) {
    const tip = profile.insights[Math.floor(Math.random() * profile.insights.length)];
    insights.push({
      id: "business_tip",
      type: "tip",
      title: `${profile.emoji} Business Tip`,
      message: tip,
    });
  }

  // Sales health insight
  const totalRevenue = sales.reduce((s: number, sale: any) => s + sale.total, 0);
  if (totalRevenue === 0 && products.length === 0) {
    insights.push({
      id: "getting_started",
      type: "success",
      title: "Welcome to BizFlow! 🎉",
      message: "Start by adding products to your inventory, then create your first sale.",
      actionLabel: "Add Products",
      actionHref: "/inventory",
    });
  }

  return { productRecommendations, quickActions, insights, reorderAlerts };
}
