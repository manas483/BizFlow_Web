"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/ui/Card";
import { Button } from "@/shared/ui/ui/Button";
import { useProfitLoss, useBalanceSheet, useCashFlowStatement } from "@/shared/hooks/useAccounting";
import { formatCurrency } from "@/shared/lib/utils";
import { FileBarChart, Calendar, ChevronRight, ArrowLeft } from "lucide-react";

export default function FinancialReportsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"pl" | "bs" | "cf">("pl");
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0], // Jan 1st of current year
    to: new Date().toISOString().split("T")[0],
  });
  const [asOf, setAsOf] = useState(new Date().toISOString().split("T")[0]);

  // Fetch report data conditionally based on tabs
  const { data: plData, isLoading: loadingPl } = useProfitLoss(
    activeTab === "pl" ? dateRange : undefined
  );
  const { data: bsData, isLoading: loadingBs } = useBalanceSheet(
    activeTab === "bs" ? asOf : undefined
  );
  const { data: cfData, isLoading: loadingCf } = useCashFlowStatement(
    activeTab === "cf" ? dateRange : undefined
  );

  return (
    <DashboardLayout title="Financial Reports">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="p-2 w-9 h-9" aria-label="Go back" onClick={() => router.back()}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-primary">Financial Statements</h2>
            <p className="text-primary/40 text-sm mt-0.5">Generate GAAP/IFRS-compliant financial statements dynamically</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-primary/10 mb-6">
        {[
          { id: "pl", label: "Profit & Loss (Income Statement)" },
          { id: "bs", label: "Balance Sheet" },
          { id: "cf", label: "Cash Flow Statement" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === t.id
                ? "border-violet-500 text-violet-400 font-bold"
                : "border-transparent text-primary/40 hover:text-primary/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Report Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-6 bg-primary/5 p-4 rounded-xl border border-primary/5">
        {activeTab !== "bs" ? (
          <>
            <div>
              <label className="text-xs font-semibold text-primary/40 block mb-1">From Date</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="rounded-xl px-3.5 py-2 text-sm bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-primary/40 block mb-1">To Date</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="rounded-xl px-3.5 py-2 text-sm bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="text-xs font-semibold text-primary/40 block mb-1">As Of Date</label>
            <input
              type="date"
              value={asOf}
              onChange={e => setAsOf(e.target.value)}
              className="rounded-xl px-3.5 py-2 text-sm bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50"
            />
          </div>
        )}
      </div>

      {/* Report Content */}
      <Card className="p-6">
        {activeTab === "pl" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <FileBarChart size={18} className="text-violet-400" /> Income Statement (Profit & Loss)
              </h3>
              <span className="text-xs text-primary/40 font-semibold font-mono">
                {new Date(dateRange.from).toLocaleDateString()} – {new Date(dateRange.to).toLocaleDateString()}
              </span>
            </div>

            {loadingPl ? (
              <div className="text-center py-12 text-primary/40 text-sm">Loading statement...</div>
            ) : !plData ? (
              <div className="text-center py-12 text-primary/40 text-sm">No data available.</div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto">
                {/* Revenue Section */}
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-primary/10 pb-2 mb-3">Revenue (Inflow)</h4>
                  <div className="space-y-2.5">
                    {plData.revenue.map((item: any) => (
                      <div key={item.accountId} className="flex justify-between items-center pl-4 text-sm font-medium">
                        <span className="text-primary/70">{item.code} - {item.name}</span>
                        <span className="font-mono text-primary">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    {plData.revenue.length === 0 && (
                      <div className="text-xs text-primary/30 italic pl-4">No revenue recorded in this period.</div>
                    )}
                    <div className="flex justify-between items-center border-t border-primary/5 pt-2 font-bold text-sm bg-primary/5 p-2 rounded-lg">
                      <span className="text-primary">Total Revenue</span>
                      <span className="font-mono text-emerald-400">{formatCurrency(plData.totalRevenue)}</span>
                    </div>
                  </div>
                </div>

                {/* Expenses Section */}
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-primary/10 pb-2 mb-3">Operating Expenses (Outflow)</h4>
                  <div className="space-y-2.5">
                    {plData.expenses.map((item: any) => (
                      <div key={item.accountId} className="flex justify-between items-center pl-4 text-sm font-medium">
                        <span className="text-primary/70">{item.code} - {item.name}</span>
                        <span className="font-mono text-primary">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    {plData.expenses.length === 0 && (
                      <div className="text-xs text-primary/30 italic pl-4">No expenses recorded in this period.</div>
                    )}
                    <div className="flex justify-between items-center border-t border-primary/5 pt-2 font-bold text-sm bg-primary/5 p-2 rounded-lg">
                      <span className="text-primary">Total Operating Expenses</span>
                      <span className="font-mono text-rose-400">{formatCurrency(plData.totalExpenses)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Income */}
                <div className="border-t-2 border-primary/15 pt-4 flex justify-between items-center bg-violet-500/10 p-4 rounded-xl font-bold text-base border border-violet-500/10">
                  <span className="text-violet-400">Net Profit / (Loss)</span>
                  <span className={`font-mono ${plData.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatCurrency(plData.netProfit)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "bs" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <FileBarChart size={18} className="text-violet-400" /> Balance Sheet
              </h3>
              <span className="text-xs text-primary/40 font-semibold font-mono">
                As of {new Date(asOf).toLocaleDateString()}
              </span>
            </div>

            {loadingBs ? (
              <div className="text-center py-12 text-primary/40 text-sm">Loading balance sheet...</div>
            ) : !bsData ? (
              <div className="text-center py-12 text-primary/40 text-sm">No data available.</div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto">
                {/* Assets */}
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-primary/10 pb-2 mb-3">Assets</h4>
                  <div className="space-y-2.5">
                    {bsData.assets.map((item: any) => (
                      <div key={item.accountId} className="flex justify-between items-center pl-4 text-sm font-medium">
                        <span className="text-primary/70">{item.code} - {item.name}</span>
                        <span className="font-mono text-primary">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-t border-primary/5 pt-2 font-bold text-sm bg-primary/5 p-2 rounded-lg">
                      <span className="text-primary">Total Assets</span>
                      <span className="font-mono text-emerald-400">{formatCurrency(bsData.totalAssets)}</span>
                    </div>
                  </div>
                </div>

                {/* Liabilities */}
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-primary/10 pb-2 mb-3">Liabilities</h4>
                  <div className="space-y-2.5">
                    {bsData.liabilities.map((item: any) => (
                      <div key={item.accountId} className="flex justify-between items-center pl-4 text-sm font-medium">
                        <span className="text-primary/70">{item.code} - {item.name}</span>
                        <span className="font-mono text-primary">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-t border-primary/5 pt-2 font-bold text-sm bg-primary/5 p-2 rounded-lg">
                      <span className="text-primary">Total Liabilities</span>
                      <span className="font-mono text-rose-400">{formatCurrency(bsData.totalLiabilities)}</span>
                    </div>
                  </div>
                </div>

                {/* Equity */}
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-primary/10 pb-2 mb-3">Equity</h4>
                  <div className="space-y-2.5">
                    {bsData.equity.map((item: any) => (
                      <div key={item.accountId} className="flex justify-between items-center pl-4 text-sm font-medium">
                        <span className="text-primary/70">{item.code} - {item.name}</span>
                        <span className="font-mono text-primary">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-t border-primary/5 pt-2 font-bold text-sm bg-primary/5 p-2 rounded-lg">
                      <span className="text-primary">Total Equity</span>
                      <span className="font-mono text-emerald-400">{formatCurrency(bsData.totalEquity)}</span>
                    </div>
                  </div>
                </div>

                {/* Accounting Equation Verification: Assets = Liabilities + Equity */}
                <div className="border-t-2 border-primary/15 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3 bg-violet-500/10 p-4 rounded-xl text-sm font-bold border border-violet-500/10">
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[10px] text-primary/40 block uppercase">Total Assets</span>
                      <span className="font-mono text-primary">{formatCurrency(bsData.totalAssets)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-primary/40 block uppercase">Liabilities + Equity</span>
                      <span className="font-mono text-primary">{formatCurrency(bsData.totalLiabilities + bsData.totalEquity)}</span>
                    </div>
                  </div>
                  <div>
                    {Math.abs(bsData.totalAssets - (bsData.totalLiabilities + bsData.totalEquity)) < 0.01 ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                        Balanced (A = L + E)
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/10">
                        Equation Out of Balance
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "cf" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <FileBarChart size={18} className="text-violet-400" /> Cash Flow Statement
              </h3>
              <span className="text-xs text-primary/40 font-semibold font-mono">
                {new Date(dateRange.from).toLocaleDateString()} – {new Date(dateRange.to).toLocaleDateString()}
              </span>
            </div>

            {loadingCf ? (
              <div className="text-center py-12 text-primary/40 text-sm">Loading cash flows...</div>
            ) : !cfData ? (
              <div className="text-center py-12 text-primary/40 text-sm">No data available.</div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto">
                {/* Operating */}
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-primary/10 pb-2 mb-3">Operating Activities</h4>
                  <div className="space-y-2.5">
                    {cfData.operating.map((item: any) => (
                      <div key={item.accountId} className="flex justify-between items-center pl-4 text-sm font-medium">
                        <span className="text-primary/70">{item.name}</span>
                        <span className={`font-mono ${item.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {item.amount >= 0 ? "+" : ""}{formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-t border-primary/5 pt-2 font-bold text-sm bg-primary/5 p-2 rounded-lg">
                      <span className="text-primary">Net Cash from Operating Activities</span>
                      <span className="font-mono text-emerald-400">{formatCurrency(cfData.totalOperating)}</span>
                    </div>
                  </div>
                </div>

                {/* Investing */}
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-primary/10 pb-2 mb-3">Investing Activities</h4>
                  <div className="space-y-2.5">
                    {cfData.investing.map((item: any) => (
                      <div key={item.accountId} className="flex justify-between items-center pl-4 text-sm font-medium">
                        <span className="text-primary/70">{item.name}</span>
                        <span className={`font-mono ${item.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {item.amount >= 0 ? "+" : ""}{formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                    {cfData.investing.length === 0 && (
                      <div className="text-xs text-primary/30 italic pl-4">No investing activities.</div>
                    )}
                    <div className="flex justify-between items-center border-t border-primary/5 pt-2 font-bold text-sm bg-primary/5 p-2 rounded-lg">
                      <span className="text-primary">Net Cash from Investing Activities</span>
                      <span className="font-mono text-emerald-400">{formatCurrency(cfData.totalInvesting)}</span>
                    </div>
                  </div>
                </div>

                {/* Financing */}
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-primary/10 pb-2 mb-3">Financing Activities</h4>
                  <div className="space-y-2.5">
                    {cfData.financing.map((item: any) => (
                      <div key={item.accountId} className="flex justify-between items-center pl-4 text-sm font-medium">
                        <span className="text-primary/70">{item.name}</span>
                        <span className={`font-mono ${item.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {item.amount >= 0 ? "+" : ""}{formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                    {cfData.financing.length === 0 && (
                      <div className="text-xs text-primary/30 italic pl-4">No financing activities.</div>
                    )}
                    <div className="flex justify-between items-center border-t border-primary/5 pt-2 font-bold text-sm bg-primary/5 p-2 rounded-lg">
                      <span className="text-primary">Net Cash from Financing Activities</span>
                      <span className="font-mono text-emerald-400">{formatCurrency(cfData.totalFinancing)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Cash Flow */}
                <div className="border-t-2 border-primary/15 pt-4 flex justify-between items-center bg-violet-500/10 p-4 rounded-xl font-bold text-base border border-violet-500/10">
                  <span className="text-violet-400">Net Increase / (Decrease) in Cash</span>
                  <span className={`font-mono ${cfData.netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatCurrency(cfData.netCashFlow)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}
