"use client";

import { useState, use } from "react";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/ui/Card";
import { StatCard } from "@/shared/ui/ui/StatCard";
import { Badge } from "@/shared/ui/ui/Badge";
import { Button } from "@/shared/ui/ui/Button";
import { useLoan, useUpdateLoan } from "@/shared/hooks/useLoans";
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import { Landmark, ArrowLeft, IndianRupee, ShieldAlert, CheckCircle2, ListOrdered, Receipt, Scale, FileText } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import RecordLoanPaymentModal from "@/shared/ui/modals/RecordLoanPaymentModal";
import ForeclosureModal from "@/shared/ui/modals/ForeclosureModal";
import LoanDocumentsTab from "@/shared/ui/loans/LoanDocumentsTab";

export default function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<"schedule" | "payments" | "documents">("schedule");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isForeclosureOpen, setIsForeclosureOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { data: loan, isLoading } = useLoan(id);
  const updateLoan = useUpdateLoan();

  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      await updateLoan.mutateAsync({ id, data: { status: newStatus } });
      toast.success(`Loan status updated to ${newStatus}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to update loan status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Loan Details">
        <div className="text-center py-24 text-primary/40 text-sm">Loading loan details...</div>
      </DashboardLayout>
    );
  }

  if (!loan) {
    return (
      <DashboardLayout title="Loan Details">
        <div className="text-center py-24 text-primary/40 text-sm">
          <p>Loan not found.</p>
          <Link href="/loans" className="mt-4 inline-block">
            <Button size="sm" icon={<ArrowLeft size={14} />}>Back to Loans</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const outstanding = loan.outstandingBalance ?? loan.amount;
  const stats = loan.stats || {
    totalPaid: 0,
    paidInstallments: 0,
    overdueInstallments: 0,
    remainingInstallments: loan.tenure,
    nextEmi: null,
    completionPercentage: 0,
  };

  return (
    <DashboardLayout title={`Loan Profile — ${loan.loanNumber}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/loans">
            <button className="p-2 rounded-xl hover:bg-primary/5 text-primary/40 hover:text-primary transition-colors border border-primary/10 bg-surface">
              <ArrowLeft size={16} />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-primary">{loan.loanNumber}</h2>
              <Badge variant={
                loan.status === "ACTIVE" ? "success" :
                loan.status === "CLOSED" ? "violet" :
                loan.status === "FORECLOSED" ? "warning" :
                loan.status === "OVERDUE" ? "danger" :
                loan.status === "DEFAULTED" ? "danger" : "default"
              }>
                {loan.status}
              </Badge>
            </div>
            <p className="text-primary/40 text-sm mt-0.5">
              Borrower: {loan.borrowerName} • 
              Type: {loan.loanType.replace("_", " ")} • 
              Lender: {loan.lender || "—"} • 
              Purpose: {loan.purpose || "—"}
            </p>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {(loan.status === "ACTIVE" || loan.status === "OVERDUE") && (
            <>
              <Button size="sm" icon={<IndianRupee size={14} />} onClick={() => setIsPaymentOpen(true)}>Record Repayment</Button>
              <Button size="sm" variant="danger" icon={<Landmark size={14} />} onClick={() => setIsForeclosureOpen(true)}>Foreclosure Calc</Button>
            </>
          )}
          {loan.status !== "CLOSED" && loan.status !== "FORECLOSED" && (
            <select
              disabled={isUpdatingStatus}
              value={loan.status}
              onChange={e => handleUpdateStatus(e.target.value)}
              className="rounded-xl px-3 py-1.5 text-xs bg-surface border border-primary/10 text-primary focus:outline-none focus:border-violet-500/50 cursor-pointer font-semibold"
            >
              <option value="ACTIVE">Mark Active</option>
              <option value="OVERDUE">Mark Overdue</option>
              <option value="CLOSED">Mark Closed</option>
              <option value="FORECLOSED">Mark Foreclosed</option>
              <option value="DEFAULTED">Mark Defaulted</option>
              <option value="RESTRUCTURED">Mark Restructured</option>
            </select>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Disbursed Principal" value={formatCurrency(loan.amount)} icon={<Landmark size={18} />} color="violet" />
        <StatCard label="Outstanding Balance" value={formatCurrency(outstanding)} icon={<ShieldAlert size={18} />} color="amber" />
        <StatCard label="Total Interest Payables" value={formatCurrency(loan.totalInterest)} icon={<Scale size={18} />} color="blue" />
        <StatCard label="Paid Amount to Date" value={formatCurrency(stats.totalPaid)} icon={<CheckCircle2 size={18} />} color="emerald" />
      </div>

      {/* Amortization statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Repayment Progress Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center text-xs font-semibold text-primary/60">
              <span>Installments Paid: {stats.paidInstallments} of {loan.tenure}</span>
              <span>{stats.completionPercentage}% Complete</span>
            </div>
            {/* Custom styled progress bar */}
            <div className="w-full h-3 rounded-full bg-primary/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all duration-500" style={{ width: `${stats.completionPercentage}%` }} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="bg-primary/5 p-3 rounded-xl border border-primary/5 text-center">
                <span className="text-[10px] text-primary/40 block">EMIs Paid</span>
                <span className="text-sm font-bold text-primary">{stats.paidInstallments}</span>
              </div>
              <div className="bg-primary/5 p-3 rounded-xl border border-primary/5 text-center">
                <span className="text-[10px] text-primary/40 block">EMIs Remaining</span>
                <span className="text-sm font-bold text-primary">{stats.remainingInstallments}</span>
              </div>
              <div className="bg-primary/5 p-3 rounded-xl border border-primary/5 text-center">
                <span className="text-[10px] text-primary/40 block">Overdue EMIs</span>
                <span className="text-sm font-bold text-rose-400">{stats.overdueInstallments}</span>
              </div>
              <div className="bg-primary/5 p-3 rounded-xl border border-primary/5 text-center">
                <span className="text-[10px] text-primary/40 block">Annual Interest</span>
                <span className="text-sm font-bold text-primary">{loan.interestRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Scheduled EMI</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-between h-[120px]">
            {stats.nextEmi ? (
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-primary/60 font-medium">Installment #:</span>
                  <span className="font-bold text-primary">{stats.nextEmi.installmentNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-primary/60 font-medium">Due Date:</span>
                  <span className="font-bold text-primary">{formatDate(stats.nextEmi.dueDate)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-primary/60 font-medium">EMI Amount:</span>
                  <span className="font-bold text-violet-400 font-mono">{formatCurrency(stats.nextEmi.emiAmount)}</span>
                </div>
              </div>
            ) : (
              <div className="text-center text-xs text-primary/40 py-6 italic">
                No upcoming PENDING installments. The loan is fully paid or closed.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-primary/10 mb-6">
        <button
          onClick={() => setActiveTab("schedule")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "schedule" ? "border-violet-500 text-violet-400 font-bold" : "border-transparent text-primary/40 hover:text-primary/60"
          }`}
        >
          <ListOrdered size={15} /> Amortization Schedule
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "payments" ? "border-violet-500 text-violet-400 font-bold" : "border-transparent text-primary/40 hover:text-primary/60"
          }`}
        >
          <Receipt size={15} /> Repayment Ledger
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "documents" ? "border-violet-500 text-violet-400 font-bold" : "border-transparent text-primary/40 hover:text-primary/60"
          }`}
        >
          <FileText size={15} /> Documents
        </button>
      </div>

      {/* Tab Workspaces */}
      <Card>
        <CardContent className="p-0">
          {activeTab === "schedule" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/5 text-xs text-primary/40 border-b border-primary/10">
                    <th className="py-2.5 px-5">Installment #</th>
                    <th className="py-2.5 px-5">Due Date</th>
                    <th className="py-2.5 px-5 text-right">EMI Amount</th>
                    <th className="py-2.5 px-5 text-right">Principal Part</th>
                    <th className="py-2.5 px-5 text-right">Interest Part</th>
                    <th className="py-2.5 px-5 text-right">Closing Balance</th>
                    <th className="py-2.5 px-5">Status</th>
                    <th className="py-2.5 px-5">Paid Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {loan.schedule.map((row: any) => {
                    const isOverdue = row.status === "PENDING" && new Date(row.dueDate) < new Date();
                    return (
                      <tr key={row.id} className="hover:bg-primary/5 transition-colors font-medium">
                        <td className="py-3 px-5 text-violet-400 font-mono">{row.installmentNumber}</td>
                        <td className="py-3 px-5 whitespace-nowrap">{formatDate(row.dueDate)}</td>
                        <td className="py-3 px-5 text-right font-mono">{formatCurrency(row.emiAmount)}</td>
                        <td className="py-3 px-5 text-right font-mono text-emerald-400">{formatCurrency(row.principalAmount)}</td>
                        <td className="py-3 px-5 text-right font-mono text-primary/60">{formatCurrency(row.interestAmount)}</td>
                        <td className="py-3 px-5 text-right font-mono">{formatCurrency(row.closingBalance)}</td>
                        <td className="py-3 px-5">
                          <Badge variant={
                            row.status === "PAID" ? "success" :
                            row.status === "PARTIALLY_PAID" ? "violet" :
                            isOverdue ? "danger" : "default"
                          }>
                            {isOverdue ? "OVERDUE" : row.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-5 whitespace-nowrap">{row.paidDate ? formatDate(row.paidDate) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : activeTab === "payments" ? (
            <div className="overflow-x-auto">
              {loan.payments.length === 0 ? (
                <div className="text-center py-12 text-primary/40 text-sm">No repayment transactions logged yet.</div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-primary/5 text-xs text-primary/40 border-b border-primary/10">
                      <th className="py-2.5 px-5">Payment Date</th>
                      <th className="py-2.5 px-5">Txn Reference</th>
                      <th className="py-2.5 px-5">Type</th>
                      <th className="py-2.5 px-5 text-right">Repaid Principal</th>
                      <th className="py-2.5 px-5 text-right">Repaid Interest</th>
                      <th className="py-2.5 px-5 text-right">Total Amount</th>
                      <th className="py-2.5 px-5">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {loan.payments.map((txn: any) => (
                      <tr key={txn.id} className="hover:bg-primary/5 transition-colors font-medium">
                        <td className="py-3 px-5 whitespace-nowrap">{formatDate(txn.paymentDate)}</td>
                        <td className="py-3 px-5 font-mono text-violet-400">{txn.reference || "—"}</td>
                        <td className="py-3 px-5 text-xs uppercase text-primary/60">{txn.paymentType}</td>
                        <td className="py-3 px-5 text-right font-mono text-emerald-400">{formatCurrency(txn.principalPaid)}</td>
                        <td className="py-3 px-5 text-right font-mono text-primary/60">{formatCurrency(txn.interestPaid)}</td>
                        <td className="py-3 px-5 text-right font-mono text-emerald-400 font-bold">{formatCurrency(txn.amount)}</td>
                        <td className="py-3 px-5 max-w-xs truncate">{txn.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="p-5">
              <LoanDocumentsTab loanId={loan.id} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Repayment Modal */}
      {isPaymentOpen && (
        <RecordLoanPaymentModal
          open={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          loanId={loan.id}
          loanNumber={loan.loanNumber}
          borrowerName={loan.borrowerName}
          outstandingBalance={outstanding}
          suggestedAmount={loan.emiAmount ?? 0}
        />
      )}

      {/* Foreclosure Modal */}
      {isForeclosureOpen && (
        <ForeclosureModal
          open={isForeclosureOpen}
          onClose={() => setIsForeclosureOpen(false)}
          loanId={loan.id}
          loanNumber={loan.loanNumber}
          borrowerName={loan.borrowerName}
        />
      )}
    </DashboardLayout>
  );
}
