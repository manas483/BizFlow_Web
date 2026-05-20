"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  TrendingUp, ShoppingCart, Users, Receipt, Package, AlertTriangle,
  ArrowRight, Plus, FileText, BarChart2
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { formatCurrency, formatDate, exportToCSV } from "@/lib/utils";
import { useEffect, useState } from "react";
import NewSaleModal from "@/components/modals/NewSaleModal";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useProducts } from "@/hooks/useProducts";
import { useSales } from "@/hooks/useSales";
import { useReports } from "@/hooks/useReports";
import { useSession } from "next-auth/react";
import { useRecommendations, trackActivity } from "@/hooks/useRecommendations";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-primary/10 rounded-xl p-3 shadow-xl">
      <p className="text-primary/40 text-xs mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

const WeeklyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-primary/10 rounded-xl p-3 shadow-xl">
      <p className="text-primary/40 text-xs mb-1">{label}</p>
      <p className="text-xs font-semibold text-violet-400">{formatCurrency(payload[0]?.value)}</p>
    </div>
  );
};

// Derive hour-based greeting
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function DashboardPage() {
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const { data: stats } = useDashboardStats();
  const { data: productsPage } = useProducts(undefined, undefined, 1, 100);
  const { data: salesPage } = useSales(undefined, undefined, 1, 25);
  const { data: report } = useReports({ period: "yearly" });
  const { data: session } = useSession();
  const { data: recs } = useRecommendations();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const products = productsPage?.data ?? [];
  const sales    = salesPage?.data ?? [];
  const lowStock = products.filter((p: any) => p.stock <= p.minStock);
  const recentSales = sales.slice(0, 5);

  // Build chart data from reports API — M-16: use numeric month index as key
  const salesByMonthRaw: any[] = report?.salesByMonth ?? [];
  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthlyMap: Record<number, { month: string; sales: number; expenses: number; profit: number }> = {};

  // Pre-fill last 6 months using numeric index
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const idx = d.getMonth();
    monthlyMap[idx] = { month: MONTH_LABELS[idx], sales: 0, expenses: 0, profit: 0 };
  }

  for (const s of salesByMonthRaw) {
    const d = new Date(s.createdAt);
    const idx = d.getMonth();
    if (monthlyMap[idx]) {
      monthlyMap[idx].sales += s._sum?.total ?? 0;
    }
  }

  // Map exact expenses to the corresponding month
  const expensesByDateRaw: any[] = report?.expensesByDate ?? [];
  for (const e of expensesByDateRaw) {
    const d = new Date(e.date);
    const idx = d.getMonth();
    if (monthlyMap[idx]) {
      monthlyMap[idx].expenses += e._sum?.amount ?? 0;
    }
  }

  // Approximate COGS per month using the overall COGS margin
  const totalSalesAll = report?.summary?.totalSales || 1; // avoid division by zero
  const totalCogsAll = report?.summary?.cogs || 0;
  const cogsMargin = totalCogsAll / totalSalesAll;

  for (const idx of Object.keys(monthlyMap).map(Number)) {
    const monthlyCogs = monthlyMap[idx].sales * cogsMargin;
    monthlyMap[idx].profit = Math.max(0, monthlyMap[idx].sales - monthlyCogs - monthlyMap[idx].expenses);
  }

  // Chart data — M-16: values include month label from the map entry itself
  const chartData = Object.values(monthlyMap);

  // Category pie from real expenses categories
  const categoryColors = ["#8b5cf6", "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#06b6d4"];
  const categoryData = (report?.expensesByCategory ?? []).map((e: any, i: number) => ({
    name: e.category,
    value: e.amount,
    color: categoryColors[i % categoryColors.length],
  }));

  // Weekly chart: use last 7 sales as day approximation
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyMap: Record<string, number> = {};
  for (const sale of sales.slice(0, 50)) {
    const d = new Date(sale.createdAt);
    const key = weekDays[d.getDay()];
    weeklyMap[key] = (weeklyMap[key] ?? 0) + sale.total;
  }
  const weeklyData = weekDays.map((day) => ({ day, sales: weeklyMap[day] ?? 0 }));

  // Track page view
  useEffect(() => {
    if (session?.user?.businessId) {
      trackActivity("page_view", { page: "dashboard" });
    }
  }, [session?.user?.businessId]);

  const userName = session?.user?.name ?? "there";

  const handleExport = () => {
    if (!stats) return;
    const exportData = [
      { Metric: "Total Revenue", Value: stats.revenue },
      { Metric: "Total Sales", Value: stats.salesCount },
      { Metric: "Total Expenses", Value: stats.expenses },
      { Metric: "Total Customers", Value: stats.customerCount }
    ];
    exportToCSV(exportData, "dashboard_summary");
  };

  return (
    <DashboardLayout title="Dashboard">
      {/* Welcome banner */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-primary" suppressHydrationWarning>
            {mounted ? getGreeting() : "Welcome back"}, {userName.split(" ")[0]} 👋
          </h2>
          <p className="text-primary/40 text-sm mt-0.5">Here&apos;s what&apos;s happening with your store today.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<FileText size={14} />} onClick={handleExport}>
            Export Report
          </Button>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsNewSaleOpen(true)}>
            New Sale
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard
          label="Total Revenue"
          value={stats ? formatCurrency(stats.revenue) : "₹0"}
          change={stats?.changes?.revenue ?? 0}
          trend={(stats?.changes?.revenue ?? 0) >= 0 ? "up" : "down"}
          icon={<TrendingUp size={18} />}
          color="violet"
          subtitle="vs last month"
        />
        <StatCard
          label="Total Sales"
          value={stats?.salesCount?.toString() || "0"}
          change={stats?.changes?.sales ?? 0}
          trend={(stats?.changes?.sales ?? 0) >= 0 ? "up" : "down"}
          icon={<ShoppingCart size={18} />}
          color="emerald"
          subtitle="transactions"
        />
        <StatCard
          label="Customers"
          value={stats?.customerCount?.toString() || "0"}
          change={stats?.changes?.customers ?? 0}
          trend={(stats?.changes?.customers ?? 0) >= 0 ? "up" : "down"}
          icon={<Users size={18} />}
          color="blue"
          subtitle="registered"
        />
        <StatCard
          label="Total Expenses"
          value={stats ? formatCurrency(stats.expenses) : "₹0"}
          change={Math.abs(stats?.changes?.expenses ?? 0)}
          trend={(stats?.changes?.expenses ?? 0) > 0 ? "up" : "down"}
          icon={<Receipt size={18} />}
          color="rose"
          subtitle="vs last month"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        {/* Revenue Chart - 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-primary/40">
                <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" /> Sales
              </span>
              <span className="flex items-center gap-1.5 text-primary/40">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Expenses
              </span>
              <span className="flex items-center gap-1.5 text-primary/40">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Profit
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {mounted ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData.length > 0 ? chartData : [{ month: "—", sales: 0, expenses: 0, profit: 0 }]}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="sales" name="Sales" stroke="#8b5cf6" strokeWidth={2} fill="url(#salesGrad)" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="none" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} fill="url(#profitGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-primary/20 text-xs">Loading chart...</div>
            )}
          </CardContent>
        </Card>

        {/* Category Pie - 1/3 */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-center text-primary/40 text-xs py-8">No expense data yet</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryData.map((entry: any, index: number) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => [formatCurrency(v), ""]}
                      contentStyle={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {categoryData.slice(0, 4).map((cat: any) => (
                    <div key={cat.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-primary/40 text-xs">{cat.name}</span>
                      </div>
                      <span className="text-primary/40 text-xs font-medium">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Recent Sales */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <a
              href="/sales"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
            >
              View All <ArrowRight size={14} />
            </a>
          </CardHeader>
          <div className="divide-y divide-primary/10">
            {recentSales.length === 0 ? (
              <p className="text-center py-8 text-primary/40 text-sm">No sales yet. Create your first sale!</p>
            ) : recentSales.map((sale: any) => (
              <div key={sale.id} className="flex items-center justify-between px-5 py-3 hover:bg-primary/5 transition-colors">
                <div className="min-w-0">
                  <p className="text-primary text-sm font-medium truncate">{sale.customer?.name || "Walk-in"}</p>
                  <p className="text-primary/40 text-xs">{sale.invoiceNo} · {formatDate(sale.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <Badge
                    variant={
                      sale.status === "paid" ? "success" :
                      sale.status === "partial" ? "warning" : "danger"
                    }
                  >
                    {sale.status}
                  </Badge>
                  <span className="text-primary font-semibold text-sm">{formatCurrency(sale.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          {/* Weekly chart */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Sales</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {mounted ? (
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={weeklyData} barSize={18}>
                    <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<WeeklyTooltip />} cursor={{ fill: "rgba(139,92,246,0.08)" }} />
                    <Bar dataKey="sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[110px]" />
              )}
            </CardContent>
          </Card>

          {/* Low Stock Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Low Stock Alerts</CardTitle>
              <Badge variant="danger">{lowStock.length}</Badge>
            </CardHeader>
            {lowStock.length === 0 ? (
              <p className="text-center py-4 text-emerald-400 text-xs">All stocks are healthy</p>
            ) : (
              <div className="divide-y divide-primary/10">
                {lowStock.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={13} className="text-rose-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-primary/40 text-xs font-medium truncate">{p.name}</p>
                      <p className="text-rose-400 text-[10px]">{p.stock} left (min {p.minStock})</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsNewSaleOpen(true)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-primary/5
                  hover:bg-violet-500/15 hover:border-violet-500/30 border border-primary/10
                  transition-all duration-200 text-primary/40 hover:text-violet-400 group"
                suppressHydrationWarning
              >
                <div className="group-hover:scale-110 transition-transform"><ShoppingCart size={14} /></div>
                <span className="text-[10px] font-medium text-center leading-tight">New Sale</span>
              </button>
              {[
                { label: "Add Product", icon: <Package size={14} />, href: "/inventory" },
                { label: "Add Customer", icon: <Users size={14} />, href: "/customers" },
                { label: "View Reports", icon: <BarChart2 size={14} />, href: "/reports" },
              ].map((a) => (
                <a
                  key={a.label}
                  href={a.href}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-primary/5
                    hover:bg-violet-500/15 hover:border-violet-500/30 border border-primary/10
                    transition-all duration-200 text-primary/40 hover:text-violet-400 group"
                  suppressHydrationWarning
                >
                  <div className="group-hover:scale-110 transition-transform">{a.icon}</div>
                  <span className="text-[10px] font-medium text-center leading-tight">{a.label}</span>
                </a>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>


      {/* ── ML-Powered Panels ── */}
      {mounted && (recs?.insights?.length > 0 || recs?.reorderAlerts?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mt-4">

          {/* Smart Insights */}
          {recs.insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>🤖 Smart Insights</CardTitle>
                <Badge variant="default">ML</Badge>
              </CardHeader>
              <div className="divide-y divide-primary/10">
                {recs.insights.map((insight: any) => {
                  const colors: Record<string, { bg: string; border: string; dot: string }> = {
                    warning: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", dot: "#f59e0b" },
                    tip:     { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.25)", dot: "#8b5cf6" },
                    success: { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)", dot: "#10b981" },
                    info:    { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)", dot: "#3b82f6" },
                  };
                  const c = colors[insight.type] ?? colors.info;
                  return (
                    <div key={insight.id} className="px-5 py-3.5 flex items-start gap-3"
                      style={{ background: c.bg, borderLeft: `3px solid ${c.dot}` }}>
                      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: c.dot }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-primary text-sm font-medium">{insight.title}</p>
                        <p className="text-primary/40 text-xs mt-0.5">{insight.message}</p>
                        {insight.actionLabel && (
                          <a href={insight.actionHref} className="text-xs text-violet-400 font-medium mt-1 inline-block hover:text-violet-300">
                            {insight.actionLabel} →
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Reorder Alerts from ML */}
          {recs.reorderAlerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>⚡ Reorder Predictions</CardTitle>
                <Badge variant="danger">{recs.reorderAlerts.length}</Badge>
              </CardHeader>
              <div className="divide-y divide-primary/10">
                {recs.reorderAlerts.slice(0, 5).map((alert: any) => (
                  <div key={alert.productId} className="px-5 py-3 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Package size={13} className="text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-primary/80 text-sm font-medium truncate">{alert.name}</p>
                      <p className="text-primary/40 text-xs">{alert.reason}</p>
                    </div>
                    <a href="/inventory"
                      className="text-xs bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-lg font-medium hover:bg-amber-500/25 transition-colors flex-shrink-0">
                      Reorder
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <NewSaleModal open={isNewSaleOpen} onClose={() => setIsNewSaleOpen(false)} />
    </DashboardLayout>
  );
}
