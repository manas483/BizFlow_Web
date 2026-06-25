"use client";
import toast from "react-hot-toast";

import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/ui/Card";
import { Badge } from "@/shared/ui/ui/Badge";
import { Button } from "@/shared/ui/ui/Button";
import { StatCard } from "@/shared/ui/ui/StatCard";
import ConfirmDialog from "@/shared/ui/ui/ConfirmDialog";
import { useExpenses, useDeleteExpense } from "@/shared/hooks/useExpenses";
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import { Receipt, Plus, TrendingDown, Repeat, Tag, Trash2, Pencil } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";
import { AddExpenseModal } from "@/shared/ui/modals/AddExpenseModal";
import { EditExpenseModal } from "@/shared/ui/modals/EditExpenseModal";

// L-10: generates a stable, distinct color for ANY category name
const KNOWN_COLORS: Record<string, string> = {
  Rent:        "#8b5cf6",
  Electricity: "#f59e0b",
  Salary:      "#10b981",
  Transport:   "#3b82f6",
  Misc:        "#ef4444",
};

function getCategoryColor(category: string): string {
  if (KNOWN_COLORS[category]) return KNOWN_COLORS[category];
  // Stable HSL from string hash — ensures unique colors for custom categories
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 62%, 52%)`;
}


// Aggregate expenses by category for the pie chart
function aggregateByCategory(expenses: any[]) {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    map[e.category] = (map[e.category] ?? 0) + e.amount;
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

export default function ExpensesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; category: string } | null>(null);

  const { data: expenses = [], isLoading } = useExpenses();
  const deleteExpense = useDeleteExpense();

  const total = expenses.reduce((s: number, e: any) => s + e.amount, 0);
  const recurring = expenses.filter((e: any) => e.recurring).reduce((s: number, e: any) => s + e.amount, 0);
  const oneTime = total - recurring;

  // Pie data aggregated by category (not one slice per entry)
  const pieData = aggregateByCategory(expenses);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpense.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
      toast.error("Failed to delete expense");
    }
  };

  return (
    <DashboardLayout title="Expenses">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">Expense Tracking</h2>
          <p className="text-primary/40 text-sm mt-0.5">Monitor and categorize all business expenses</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsModalOpen(true)}>Add Expense</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total Expenses" value={formatCurrency(total)} icon={<Receipt size={18} />} color="rose" />
        <StatCard label="Recurring Costs" value={formatCurrency(recurring)} icon={<Repeat size={18} />} color="amber" />
        <StatCard label="One-time Costs" value={formatCurrency(oneTime)} icon={<Tag size={18} />} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Expense List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All Expenses</CardTitle>
          </CardHeader>
          <div className="divide-y divide-primary/10">
            {isLoading ? (
              <div className="text-center py-12 text-primary/40 text-sm">Loading expenses...</div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-12 text-primary/40 text-sm">No expenses found</div>
            ) : expenses.map((expense: any) => (
              <div key={expense.id} className="flex items-center justify-between px-5 py-4 hover:bg-primary/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: `${getCategoryColor(expense.category)}20`, color: getCategoryColor(expense.category) }}
                  >
                    {expense.category[0]}
                  </div>
                  <div>
                    <p className="text-primary text-sm font-medium">{expense.category}</p>
                    <p className="text-primary/40 text-xs flex items-center gap-2 flex-wrap mt-0.5">
                      <span>{expense.note || formatDate(expense.date)}</span>
                      {expense.invoiceNumbers && expense.invoiceNumbers.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-violet-400 font-medium bg-violet-500/10 px-1.5 py-0.5 rounded">
                          Invoices: {expense.invoiceNumbers.join(", ")}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="text-primary/40 text-xs hidden sm:block">{formatDate(expense.date)}</span>
                  {expense.recurring && <Badge variant="violet">Recurring</Badge>}
                  <span className="text-rose-400 font-semibold text-sm">{formatCurrency(expense.amount)}</span>
                  {/* Edit + Delete buttons */}
                  <button
                    onClick={() => setEditExpense(expense)}
                    aria-label="Edit expense"
                    className="p-1.5 rounded-lg hover:bg-violet-500/10 text-primary/0 group-hover:text-primary/30 hover:!text-violet-400 transition-all"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: expense.id, category: expense.category })}
                    aria-label="Delete expense"
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-primary/0 group-hover:text-primary/30 hover:!text-rose-400 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader><CardTitle>By Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} paddingAngle={3} dataKey="value">
                  {pieData.map((entry: any, i: number) => (
                    <Cell key={i} fill={getCategoryColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) => [formatCurrency(v), ""]}
                  contentStyle={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {pieData.map((e: any, i: number) => (
                <div key={e.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(e.name) }} />
                    <span className="text-primary/40 text-xs">{e.name}</span>
                  </div>
                  <span className="text-primary/40 text-xs font-medium">{formatCurrency(e.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AddExpenseModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
      {editExpense && <EditExpenseModal expense={editExpense} onClose={() => setEditExpense(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Expense"
        message={`Delete this "${deleteTarget?.category}" expense? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteExpense.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </DashboardLayout>
  );
}
