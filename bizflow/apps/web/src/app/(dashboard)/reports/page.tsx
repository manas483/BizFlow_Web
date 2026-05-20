"use client";

import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { useReports } from "@/hooks/useReports";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { formatCurrency, exportToCSV } from "@/lib/utils";
import { BarChart2, TrendingUp, TrendingDown, DollarSign, Package, Users, Percent, Download, FileText, RefreshCw, AlertTriangle, Scale } from "lucide-react";
import { trackActivity } from "@/hooks/useRecommendations";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-primary/10 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-primary/40 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value.toString().includes('%') ? p.value : formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

const PIE_COLORS = ["#8b5cf6", "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#06b6d4"];
const GST_COLORS = ["#06b6d4", "#3b82f6", "#8b5cf6", "#f43f5e"];

const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "lifetime", label: "Lifetime" },
  { value: "custom", label: "Custom Range" },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState<"daily"|"weekly"|"monthly"|"yearly"|"lifetime"|"custom">("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    trackActivity("report_viewed", { period });
  }, [period]);

  const { data: report, isLoading, refetch } = useReports({
    period,
    ...(period === "custom" ? { startDate, endDate } : {})
  });

  const summary = report?.summary ?? { 
    totalSales: 0, cogs: 0, operatingExpenses: 0, grossProfit: 0, netProfit: 0, 
    outstandingDues: 0, collectedAmount: 0, pendingCollection: 0, 
    salesCount: 0, collectionEfficiency: 0, profitMargin: 0, inventoryValuation: 0 
  };
  const gstAnalytics = report?.gstAnalytics ?? { totalGstCollected: 0, gstBySlab: {}, gstPayable: 0, gstInputCredit: 0, taxSummaryByMonth: {} };
  const expensesByCategory: any[] = report?.expensesByCategory ?? [];
  const topProducts: any[] = report?.topProducts ?? [];
  const topCustomers: any[] = report?.topCustomers ?? [];
  const lowStockItems: any[] = report?.lowStockItems ?? [];
  const salesByMonthRaw: any[] = report?.salesByMonth ?? [];

  // Prepare trend data based on period
  const trendData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of salesByMonthRaw) {
      const d = new Date(s.createdAt);
      let key = "";
      if (period === "daily" || period === "weekly") {
        key = d.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" });
      } else if (period === "yearly" || period === "lifetime") {
        key = d.toLocaleDateString("default", { month: "short", year: "numeric" });
      } else {
        key = d.toLocaleDateString("default", { day: "numeric", month: "short" });
      }
      map[key] = (map[key] ?? 0) + (s._sum?.total ?? 0);
    }
    return Object.entries(map).map(([time, revenue]) => ({ time, revenue }));
  }, [salesByMonthRaw, period]);

  // Gross vs Net Profit Chart Data
  const profitComparisonData = [
    { name: "Total Sales", amount: summary.totalSales, fill: "#8b5cf6" },
    { name: "COGS", amount: summary.cogs, fill: "#ef4444" },
    { name: "Gross Profit", amount: summary.grossProfit, fill: "#3b82f6" },
    { name: "Op. Expenses", amount: summary.operatingExpenses, fill: "#f59e0b" },
    { name: "Net Profit", amount: summary.netProfit, fill: "#10b981" },
  ];

  // GST Slabs Data
  const gstSlabData = Object.entries(gstAnalytics.gstBySlab).map(([slab, amount]) => ({
    name: `${slab}% Slab`, amount
  })).filter(d => Number(d.amount) > 0);

  const handleExport = () => {
    if (!report) return;
    const exportData = [
      {
        Period: period.toUpperCase(),
        "Total Sales Revenue": summary.totalSales,
        "COGS": summary.cogs,
        "Operating Expenses": summary.operatingExpenses,
        "Gross Profit": summary.grossProfit,
        "Net Profit": summary.netProfit,
        "Margin %": summary.profitMargin.toFixed(1) + "%",
        "Collected Amount": summary.collectedAmount,
        "Outstanding Dues": summary.outstandingDues,
        "Pending Collection": summary.pendingCollection,
        "Inventory Valuation": summary.inventoryValuation,
        "GST Collected": gstAnalytics.totalGstCollected
      }
    ];
    exportToCSV(exportData, `financial_report_${period}`);
  };

  return (
    <DashboardLayout title="Financial Reports & Analytics">
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary">Financial Reports</h2>
          <p className="text-primary/40 text-sm mt-0.5">Comprehensive insights into your business performance</p>
        </div>
        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center bg-surface border border-primary/10 p-3 rounded-xl shadow-sm">
          <CustomSelect
            value={period}
            onChange={(v: any) => setPeriod(v)}
            options={PERIODS}
            className="w-40"
          />
          {period === "custom" && (
            <div className="flex gap-2 items-center">
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-violet-500"
              />
              <span className="text-primary/40 text-sm">to</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-violet-500"
              />
            </div>
          )}
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()} className="ml-auto">
            Refresh
          </Button>
          <Button variant="primary" size="sm" icon={<FileText size={14} />} onClick={handleExport}>
            Export Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="w-8 h-8 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-primary/40 text-sm animate-pulse">Analyzing financial data...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Sales / Revenue"
              value={formatCurrency(summary.totalSales)}
              icon={<TrendingUp size={18} />}
              color="violet"
            />
            <StatCard
              label="Gross Profit"
              value={formatCurrency(summary.grossProfit)}
              icon={<Scale size={18} />}
              color="blue"
            />
            <StatCard
              label="Net Profit"
              value={formatCurrency(summary.netProfit)}
              icon={<DollarSign size={18} />}
              color="emerald"
            />
            <StatCard
              label="Profit Margin"
              value={`${summary.profitMargin.toFixed(1)}%`}
              icon={<Percent size={18} />}
              color={summary.profitMargin > 15 ? "emerald" : summary.profitMargin > 0 ? "amber" : "rose"}
            />
            <StatCard
              label="Collected Amount"
              value={formatCurrency(summary.collectedAmount)}
              icon={<TrendingUp size={18} />}
              color="emerald"
            />
            <StatCard
              label="Outstanding Dues"
              value={formatCurrency(summary.outstandingDues)}
              icon={<TrendingDown size={18} />}
              color="rose"
            />
            <StatCard
              label="Collection Efficiency"
              value={`${summary.collectionEfficiency.toFixed(1)}%`}
              icon={<BarChart2 size={18} />}
              color={summary.collectionEfficiency > 80 ? "emerald" : "amber"}
            />
            <StatCard
              label="Inventory Valuation"
              value={formatCurrency(summary.inventoryValuation)}
              icon={<Package size={18} />}
              color="blue"
            />
          </div>

          {/* Core Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue Trend */}
            <Card className="lg:col-span-2 shadow-sm border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp size={16} className="text-violet-400" /> Revenue Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Profitability Waterfall / Comparison */}
            <Card className="shadow-sm border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Scale size={16} className="text-emerald-400" /> Gross vs Net Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={profitComparisonData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={20}>
                      {profitComparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Expense Breakdown */}
            <Card className="shadow-sm border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart2 size={16} className="text-rose-400" /> Expense Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {expensesByCategory.length === 0 ? (
                  <div className="flex items-center justify-center h-[240px] text-primary/40 text-sm">No expenses recorded</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={expensesByCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="amount">
                          {expensesByCategory.map((_: any, i: number) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="rgba(0,0,0,0.1)" />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => [formatCurrency(v), "Amount"]} contentStyle={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: "8px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-2 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">
                      {expensesByCategory.map((e: any, i: number) => (
                        <div key={e.category} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-primary/60 text-xs font-medium">{e.category}</span>
                          </div>
                          <span className="text-primary font-medium text-xs">{formatCurrency(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* GST Analytics Section */}
            <Card className="lg:col-span-2 shadow-sm border-primary/10 bg-gradient-to-br from-surface to-violet-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-violet-400">
                  <FileText size={16} /> GST Tax Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-surface border border-primary/10 rounded-xl p-3">
                    <p className="text-xs text-primary/40 mb-1">Total GST Collected</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(gstAnalytics.totalGstCollected)}</p>
                  </div>
                  <div className="bg-surface border border-primary/10 rounded-xl p-3">
                    <p className="text-xs text-primary/40 mb-1">GST Payable</p>
                    <p className="text-lg font-bold text-rose-400">{formatCurrency(gstAnalytics.gstPayable)}</p>
                  </div>
                  <div className="bg-surface border border-primary/10 rounded-xl p-3">
                    <p className="text-xs text-primary/40 mb-1 flex items-center gap-1">Input Credit <span className="text-[10px] bg-primary/10 px-1 rounded">Future</span></p>
                    <p className="text-lg font-bold text-emerald-400">{formatCurrency(gstAnalytics.gstInputCredit)}</p>
                  </div>
                  <div className="bg-surface border border-primary/10 rounded-xl p-3">
                    <p className="text-xs text-primary/40 mb-1">Net GST Liability</p>
                    <p className="text-lg font-bold text-violet-400">{formatCurrency(gstAnalytics.gstPayable - gstAnalytics.gstInputCredit)}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-primary/60 mb-3">GST Collection by Slab</h4>
                    {gstSlabData.length === 0 ? (
                      <p className="text-xs text-primary/40 italic">No GST data in this period.</p>
                    ) : (
                      <div className="space-y-3">
                        {gstSlabData.map((slab, i) => {
                          const pct = (Number(slab.amount) / gstAnalytics.totalGstCollected) * 100;
                          return (
                            <div key={slab.name}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-primary/80">{slab.name}</span>
                                <span className="text-primary">{formatCurrency(Number(slab.amount))}</span>
                              </div>
                              <div className="w-full bg-primary/10 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: GST_COLORS[i % GST_COLORS.length] }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-primary/60 mb-3">Tax Summary by Month</h4>
                    <div className="space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar pr-2">
                      {Object.entries(gstAnalytics.taxSummaryByMonth).map(([month, tax]) => (
                        <div key={month} className="flex justify-between items-center bg-surface border border-primary/5 p-2 rounded-lg">
                          <span className="text-xs text-primary/60">{month}</span>
                          <span className="text-xs font-bold text-primary">{formatCurrency(Number(tax))}</span>
                        </div>
                      ))}
                      {Object.keys(gstAnalytics.taxSummaryByMonth).length === 0 && (
                        <p className="text-xs text-primary/40 italic">No monthly tax data.</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top Selling Products */}
            <Card className="shadow-sm border-primary/10">
              <CardHeader className="pb-2 border-b border-primary/5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package size={16} className="text-blue-400" /> Top Products
                </CardTitle>
              </CardHeader>
              <div className="divide-y divide-primary/5">
                {topProducts.length === 0 ? (
                  <div className="text-center py-6 text-primary/40 text-xs">No sales data</div>
                ) : topProducts.map((tp: any, i: number) => (
                  <div key={tp.product?.id ?? i} className="flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors">
                    <div>
                      <p className="text-primary text-sm font-medium">{tp.product?.name ?? "Unknown"}</p>
                      <p className="text-primary/40 text-[10px] uppercase tracking-wider">{tp.product?.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-primary font-bold text-sm">{formatCurrency(tp.revenue)}</p>
                      <p className="text-primary/40 text-xs">{tp.qty} units</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top Customers */}
            <Card className="shadow-sm border-primary/10">
              <CardHeader className="pb-2 border-b border-primary/5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users size={16} className="text-amber-400" /> Top Customers
                </CardTitle>
              </CardHeader>
              <div className="divide-y divide-primary/5">
                {topCustomers.length === 0 ? (
                  <div className="text-center py-6 text-primary/40 text-xs">No customer sales data</div>
                ) : topCustomers.map((tc: any, i: number) => (
                  <div key={tc.customer?.id ?? i} className="flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors">
                    <div>
                      <p className="text-primary text-sm font-medium">{tc.customer?.name ?? "Unknown"}</p>
                      <p className="text-primary/40 text-xs">{tc.customer?.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-primary font-bold text-sm">{formatCurrency(tc.total)}</p>
                      <p className="text-emerald-400 text-[10px] uppercase tracking-wider">Revenue</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Low Stock Alerts */}
            <Card className="shadow-sm border-rose-500/20 bg-rose-500/5">
              <CardHeader className="pb-2 border-b border-rose-500/10">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-rose-400">
                  <AlertTriangle size={16} /> Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <div className="divide-y divide-rose-500/10">
                {lowStockItems.length === 0 ? (
                  <div className="text-center py-6 text-emerald-400 text-sm font-medium">✓ Inventory Healthy</div>
                ) : lowStockItems.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-primary text-sm font-medium">{p.name}</p>
                      <p className="text-primary/40 text-[10px] uppercase">{p.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-rose-400 font-bold text-sm">{p.stock} <span className="text-xs font-normal text-rose-400/70">left</span></p>
                      <p className="text-primary/40 text-[10px]">Min: {p.minStock}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

