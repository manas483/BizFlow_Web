"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardContent } from "@/shared/ui/ui/Card";
import { StatCard } from "@/shared/ui/ui/StatCard";
import { Button } from "@/shared/ui/ui/Button";
import { Badge } from "@/shared/ui/ui/Badge";
import { useLoans, useDeleteLoan } from "@/shared/hooks/useLoans";
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import { Landmark, Plus, Scale, ArrowUpRight, Search, Trash2, Eye, CircleDollarSign, AlertTriangle } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import AddLoanModal from "@/shared/ui/modals/AddLoanModal";
import RecordLoanPaymentModal from "@/shared/ui/modals/RecordLoanPaymentModal";
import ConfirmDialog from "@/shared/ui/ui/ConfirmDialog";
import { CustomSelect } from "@/shared/ui/ui/CustomSelect";

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "CLOSED", label: "Closed" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "FORECLOSED", label: "Foreclosed" },
  { value: "DEFAULTED", label: "Defaulted" },
  { value: "RESTRUCTURED", label: "Restructured" },
];

const loanTypeOptions = [
  { value: "", label: "All Loan Types" },
  { value: "TERM_LOAN", label: "Term Loan" },
  { value: "PERSONAL_LOAN", label: "Personal Loan" },
  { value: "BUSINESS_LOAN", label: "Business Loan" },
  { value: "HOME_LOAN", label: "Home Loan" },
  { value: "VEHICLE_LOAN", label: "Vehicle Loan" },
  { value: "GOLD_LOAN", label: "Gold Loan" },
  { value: "WORKING_CAPITAL", label: "Working Capital" },
  { value: "OTHER", label: "Other" },
];

export default function LoansPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [loanType, setLoanType] = useState<string>("");
  const [lenderFilter, setLenderFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; num: string } | null>(null);
  
  // Payment recording state
  const [paymentTarget, setPaymentTarget] = useState<{ id: string; num: string; borrower: string; outstanding: number; emi: number } | null>(null);

  useEffect(() => {
    // Silently trigger overdue calculations and notifications sync on dashboard load
    fetch("/api/loans/notify", { method: "POST" }).catch(err => console.error("Failed to sync loan notifications:", err));
  }, []);

  const { data = { loans: [], summary: { totalDisbursed: 0, totalOutstanding: 0, activeLoans: 0, overdueLoans: 0, overdueAmount: 0, monthlyEmiDue: 0, nextEmiDue: null, totalLoans: 0 } }, isLoading } = useLoans({
    status: status || undefined,
    loanType: loanType || undefined,
    lender: lenderFilter || undefined,
  });
  
  const deleteLoan = useDeleteLoan();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteLoan.mutateAsync(deleteTarget.id);
      toast.success(`Loan profile ${deleteTarget.num} deleted`);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete loan");
      setDeleteTarget(null);
    }
  };

  const filtered = data.loans.filter((l: any) =>
    !search ||
    l.borrowerName.toLowerCase().includes(search.toLowerCase()) ||
    l.loanNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout title="Loan & EMI Management">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">Loan & EMI Management</h2>
          <p className="text-primary/40 text-sm mt-0.5">Manage loan accounts, amortizations, EMI repayments, and outstanding liabilities</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsAddOpen(true)}>Create Loan Master</Button>
      </div>

      {/* Summary Cards (6 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6 font-medium">
        <StatCard label="Total Disbursed" value={formatCurrency(data.summary.totalDisbursed)} icon={<Landmark size={18} />} color="violet" />
        <StatCard label="Outstanding Balance" value={formatCurrency(data.summary.totalOutstanding)} icon={<Scale size={18} />} color="amber" />
        <StatCard label="Monthly EMI Due" value={formatCurrency(data.summary.monthlyEmiDue)} icon={<CircleDollarSign size={18} />} color="blue" />
        <StatCard label="Overdue Amount" value={formatCurrency(data.summary.overdueAmount)} icon={<AlertTriangle size={18} />} color="rose" />
        <StatCard label="Active Loans" value={data.summary.activeLoans} icon={<ArrowUpRight size={18} />} color="emerald" />
        <StatCard label="Next EMI Due" value={data.summary.nextEmiDue ? formatDate(data.summary.nextEmiDue) : "No Upcoming"} icon={<Plus size={18} />} color="violet" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30" />
          <input
            type="text"
            placeholder="Search borrower or loan number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-10 rounded-xl bg-surface border border-primary/10 text-sm text-primary placeholder:text-primary/30 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div className="relative min-w-[150px]">
          <Landmark size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30" />
          <input
            type="text"
            placeholder="Filter by lender..."
            value={lenderFilter}
            onChange={(e) => setLenderFilter(e.target.value)}
            className="w-full pl-9 pr-3 h-10 rounded-xl bg-surface border border-primary/10 text-sm text-primary placeholder:text-primary/30 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <CustomSelect
          value={status}
          onChange={setStatus}
          options={statusOptions}
          className="w-44"
        />
        <CustomSelect
          value={loanType}
          onChange={setLoanType}
          options={loanTypeOptions}
          className="w-48"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-primary/40 text-sm">Loading loans...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-primary/40 text-sm">No loans registered. Create one to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/5 text-xs text-primary/40 border-b border-primary/10">
                    <th className="py-3 px-5">Loan Number</th>
                    <th className="py-3 px-5">Borrower Name</th>
                    <th className="py-3 px-5">Lender</th>
                    <th className="py-3 px-5">Type</th>
                    <th className="py-3 px-5">Principal</th>
                    <th className="py-3 px-5">EMI (Monthly)</th>
                    <th className="py-3 px-5">Rate</th>
                    <th className="py-3 px-5">Outstanding</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {filtered.map((l: any) => {
                    const balance = l.outstandingBalance ?? l.amount;
                    return (
                      <tr key={l.id} className="hover:bg-primary/5 transition-colors font-medium">
                        <td className="py-3.5 px-5 text-violet-400 font-mono">{l.loanNumber}</td>
                        <td className="py-3.5 px-5 whitespace-nowrap">{l.borrowerName}</td>
                        <td className="py-3.5 px-5 whitespace-nowrap text-primary/60">{l.lender || "—"}</td>
                        <td className="py-3.5 px-5 text-xs uppercase text-primary/60">{l.loanType.replace("_", " ")}</td>
                        <td className="py-3.5 px-5 font-mono">{formatCurrency(l.amount)}</td>
                        <td className="py-3.5 px-5 font-mono text-violet-400">{formatCurrency(l.emiAmount ?? 0)}</td>
                        <td className="py-3.5 px-5 font-mono">{l.interestRate}%</td>
                        <td className="py-3.5 px-5 font-mono text-rose-400">{formatCurrency(balance)}</td>
                        <td className="py-3.5 px-5">
                          <Badge variant={
                            l.status === "ACTIVE" ? "success" :
                            l.status === "CLOSED" ? "violet" :
                            l.status === "FORECLOSED" ? "warning" :
                            l.status === "OVERDUE" ? "danger" :
                            l.status === "DEFAULTED" ? "danger" : "default"
                          }>
                            {l.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1.5">
                            <Link href={`/loans/${l.id}`}>
                              <button className="p-1.5 rounded-lg hover:bg-violet-500/10 text-primary/40 hover:text-violet-400 transition-colors" title="View Schedule">
                                <Eye size={14} />
                              </button>
                            </Link>
                            {(l.status === "ACTIVE" || l.status === "OVERDUE") && (
                              <button
                                onClick={() => setPaymentTarget({ id: l.id, num: l.loanNumber, borrower: l.borrowerName, outstanding: balance, emi: l.emiAmount ?? 0 })}
                                className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-primary/40 hover:text-emerald-400 transition-colors"
                                title="Record Payment"
                              >
                                <CircleDollarSign size={14} />
                              </button>
                            )}
                            {l._count?.payments === 0 && (
                              <button
                                onClick={() => setDeleteTarget({ id: l.id, num: l.loanNumber })}
                                className="p-1.5 rounded-lg hover:bg-rose-500/10 text-primary/40 hover:text-rose-400 transition-colors"
                                title="Delete Loan"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Loan Modal */}
      <AddLoanModal open={isAddOpen} onClose={() => setIsAddOpen(false)} />

      {/* Record Payment Modal */}
      {paymentTarget && (
        <RecordLoanPaymentModal
          open={!!paymentTarget}
          onClose={() => setPaymentTarget(null)}
          loanId={paymentTarget.id}
          loanNumber={paymentTarget.num}
          borrowerName={paymentTarget.borrower}
          outstandingBalance={paymentTarget.outstanding}
          suggestedAmount={paymentTarget.emi}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Loan Master Profile"
        message={`Are you sure you want to delete Loan ${deleteTarget?.num}? This will also delete the pre-computed EMI schedule.`}
        confirmLabel="Delete"
        loading={deleteLoan.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </DashboardLayout>
  );
}
