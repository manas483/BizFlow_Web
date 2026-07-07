"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";

async function downloadPdf(url: string, filename: string) {
  try {
    const separator = url.includes('?') ? '&' : '?';
    const fetchUrl = `${url}${separator}t=${Date.now()}`;
    const res = await fetch(fetchUrl, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text();
      let errorMsg = "Failed to download PDF";
      try {
        const json = JSON.parse(text);
        errorMsg = json.error || json.message || errorMsg;
      } catch {}
      toast.error(errorMsg);
      return;
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/pdf")) {
      const text = await res.text();
      let errorMsg = "Failed to download PDF";
      try {
        const json = JSON.parse(text);
        errorMsg = json.error || json.message || errorMsg;
      } catch {}
      toast.error(errorMsg);
      return;
    }

    const disposition = res.headers.get('content-disposition');
    let finalFilename = filename;
    if (disposition && disposition.indexOf('attachment') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) {
        finalFilename = matches[1].replace(/['"]/g, '');
      }
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err: any) {
    toast.error(err.message || "Failed to download PDF");
  }
}
import { Card, CardHeader, CardTitle } from "@/shared/ui/ui/Card";
import { Badge } from "@/shared/ui/ui/Badge";
import { Button } from "@/shared/ui/ui/Button";
import { StatCard } from "@/shared/ui/ui/StatCard";
import { useSales } from "@/shared/hooks/useSales";
import { useQuotations } from "@/shared/hooks/useQuotations";
import { useCreditNotes, useDebitNotes, useBillsOfSupply } from "@/shared/hooks/useInvoiceDocs";
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import { Search, FileText, Download, TrendingUp, Clock, CheckCircle, AlertCircle, Plus, FileDown, FileUp, FileMinus, Trash2, RefreshCw, MessageSquare, Pencil, CreditCard, XCircle, FileArchive, Loader2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import NewSaleModal from "@/shared/ui/modals/NewSaleModal";
import NewCreditNoteModal from "@/shared/ui/modals/NewCreditNoteModal";
import NewDebitNoteModal from "@/shared/ui/modals/NewDebitNoteModal";
import NewBillOfSupplyModal from "@/shared/ui/modals/NewBillOfSupplyModal";
import NewQuotationModal from "@/shared/ui/modals/NewQuotationModal";
import ConfirmDialog from "@/shared/ui/ui/ConfirmDialog";
import Pagination from "@/shared/ui/ui/Pagination";
import { useDeleteSale } from "@/shared/hooks/useSales";
import { useDeleteCreditNote, useDeleteDebitNote } from "@/shared/hooks/useInvoiceDocs";
import { generateWhatsAppUrl, formatInvoiceMessage } from "@/shared/lib/whatsapp";
import { formatCurrency as fc } from "@/shared/lib/utils";

function pctChange(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return parseFloat((((cur - prev) / prev) * 100).toFixed(1));
}

export default function SalesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'SUPER_ADMIN' || (session?.user as any)?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState("invoices");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [cnModalOpen, setCnModalOpen] = useState(false);
  const [dnModalOpen, setDnModalOpen] = useState(false);
  const [bosModalOpen, setBosModalOpen] = useState(false);
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [deleteInvoiceTarget, setDeleteInvoiceTarget] = useState<{ id: string; invoiceNo: string } | null>(null);
  const [deleteCnTarget, setDeleteCnTarget] = useState<{ id: string; no: string } | null>(null);
  const [deleteDnTarget, setDeleteDnTarget] = useState<{ id: string; no: string } | null>(null);
  const [editSaleId, setEditSaleId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [salePayTarget, setSalePayTarget] = useState<{ id: string; total: number; paid: number; invoiceNo: string } | null>(null);
  const [salePayInput, setSalePayInput] = useState("");
  const [bosPayTarget, setBosPayTarget] = useState<{ id: string; total: number; paid: number; billNo: string } | null>(null);
  const [bosPayInput, setBosPayInput] = useState("");
  const [exporting, setExporting] = useState(false);
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const deleteSale = useDeleteSale();
  const deleteCreditNote = useDeleteCreditNote();
  const deleteDebitNote = useDeleteDebitNote();

  const { data: salesPaged, isLoading: salesLoading } = useSales(search, filter, page);
  const sales = salesPaged?.data ?? [];
  const { data: allSalesPaged } = useSales("", "all", 1, 100);
  const allSales = allSalesPaged?.data ?? [];
  const { data: creditNotes = [], isLoading: cnLoading } = useCreditNotes();
  const { data: debitNotes = [], isLoading: dnLoading } = useDebitNotes();
  const { data: bills = [], isLoading: bosLoading } = useBillsOfSupply();
  const { data: quotations = [], isLoading: quotationsLoading } = useQuotations(search);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

  const isThisMonth = (d: string) => new Date(d) >= thisMonthStart;
  const isLastMonth = (d: string) => { const dt = new Date(d); return dt >= lastMonthStart && dt <= lastMonthEnd; };

  const validSales = allSales.filter((s: any) => s.workflowState !== "draft");
  const totalRevenue   = validSales.reduce((s: number, sale: any) => s + sale.paid, 0);
  const totalDues      = validSales.reduce((s: number, sale: any) => s + (sale.total - sale.paid), 0);
  const paidCount      = validSales.filter((s: any) => s.status === "paid").length;
  const unpaidCount    = validSales.filter((s: any) => s.status !== "paid").length;

  const revThis  = validSales.filter((s: any) => isThisMonth(s.createdAt)).reduce((a: number, s: any) => a + s.paid, 0);
  const revLast  = validSales.filter((s: any) => isLastMonth(s.createdAt)).reduce((a: number, s: any) => a + s.paid, 0);
  const dueThis  = validSales.filter((s: any) => isThisMonth(s.createdAt)).reduce((a: number, s: any) => a + (s.total - s.paid), 0);
  const dueLast  = validSales.filter((s: any) => isLastMonth(s.createdAt)).reduce((a: number, s: any) => a + (s.total - s.paid), 0);
  const paidThis = validSales.filter((s: any) => isThisMonth(s.createdAt) && s.status === "paid").length;
  const paidLast = validSales.filter((s: any) => isLastMonth(s.createdAt) && s.status === "paid").length;
  const unpaidThis = validSales.filter((s: any) => isThisMonth(s.createdAt) && s.status !== "paid").length;
  const unpaidLast = validSales.filter((s: any) => isLastMonth(s.createdAt) && s.status !== "paid").length;

  const revChange    = pctChange(revThis, revLast);
  const dueChange    = pctChange(dueThis, dueLast);
  const paidChange   = pctChange(paidThis, paidLast);
  const unpaidChange = pctChange(unpaidThis, unpaidLast);

  const handleConvertQuotation = async (q: any) => {
    setConvertingId(q.id);
    try {
      const res = await fetch(`/api/quotations/${q.id}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Conversion failed");
      toast.success(`Quotation converted to Invoice ${data.invoiceNo}`);
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      setActiveTab("invoices");
    } catch (err: any) {
      toast.error(err.message || "Failed to convert quotation");
    } finally {
      setConvertingId(null);
    }
  };

  const handleBoSPayUpdate = async () => {
    if (!bosPayTarget) return;
    try {
      const res = await fetch(`/api/bill-of-supply/${bosPayTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: parseFloat(bosPayInput) || 0 }),
      });
      if (!res.ok) throw new Error("Failed to update payment");
      await queryClient.invalidateQueries({ queryKey: ['bills-of-supply'] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update payment");
    } finally {
      setBosPayTarget(null);
    }
  };

  const handleSalePayUpdate = async () => {
    if (!salePayTarget) return;
    const newPaid = parseFloat(salePayInput) || 0;
    let newStatus = "unpaid";
    if (newPaid >= salePayTarget.total) newStatus = "paid";
    else if (newPaid > 0) newStatus = "partial";

    try {
      const res = await fetch(`/api/sales/${salePayTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: newPaid, status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update payment");
      }
      toast.success("Payment recorded successfully");
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update payment");
    } finally {
      setSalePayTarget(null);
    }
  };

  const handleApprovalAction = async (saleId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/sales/${saleId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} sale`);
      }
      toast.success(`Sale ${action}d successfully`);
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleExportAll = async (copy: string) => {
    setExporting(true);
    try {
      const filterParam = filter !== 'all' ? `&filter=${filter}` : '';
      await downloadPdf(
        `/api/sales/export-all?copy=${copy}${filterParam}`,
        `All-Invoices_${copy}_${new Date().toISOString().slice(0, 10)}.pdf`
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout title="Sales & Billing">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary">Sales & Billing</h2>
            <p className="text-primary/40 text-sm mt-0.5">Manage GST invoices, notes, and bills of supply</p>
          </div>
          {/* Export All Button */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                title="Export all invoices as merged PDF"
              >
                {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileArchive size={15} />}
                {exporting ? 'Exporting…' : 'Export All'}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-[9999] min-w-[180px] bg-surface-2 border border-primary/10 rounded-xl p-1 shadow-xl text-sm"
                style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border)' }}
              >
                <DropdownMenu.Item
                  className="px-3 py-2 text-primary/80 hover:text-primary hover:bg-primary/5 rounded-lg cursor-pointer outline-none transition-colors"
                  onClick={() => handleExportAll('original')}
                >
                  Original (Buyer)
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="px-3 py-2 text-primary/80 hover:text-primary hover:bg-primary/5 rounded-lg cursor-pointer outline-none transition-colors"
                  onClick={() => handleExportAll('duplicate')}
                >
                  Duplicate (Transporter)
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="px-3 py-2 text-primary/80 hover:text-primary hover:bg-primary/5 rounded-lg cursor-pointer outline-none transition-colors"
                  onClick={() => handleExportAll('triplicate')}
                >
                  Triplicate (Supplier)
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        {/* Action buttons — scrollable row on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {activeTab === "invoices" && selectedSaleIds.length > 0 ? (
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleteInvoiceTarget({ id: "bulk-delete", invoiceNo: `${selectedSaleIds.length} selected invoices` })} className="whitespace-nowrap flex-shrink-0">Delete Selected ({selectedSaleIds.length})</Button>
          ) : null}
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setSaleModalOpen(true)} className="whitespace-nowrap flex-shrink-0">Tax Invoice</Button>
          <Button variant="secondary" size="sm" icon={<FileText size={14} />} onClick={() => setQuotationModalOpen(true)} className="whitespace-nowrap flex-shrink-0">Quotation</Button>
          <Button variant="secondary" size="sm" icon={<FileDown size={14} />} onClick={() => setCnModalOpen(true)} className="whitespace-nowrap flex-shrink-0">Credit Note</Button>
          <Button variant="secondary" size="sm" icon={<FileUp size={14} />} onClick={() => setDnModalOpen(true)} className="whitespace-nowrap flex-shrink-0">Debit Note</Button>
          <Button variant="secondary" size="sm" icon={<FileMinus size={14} />} onClick={() => setBosModalOpen(true)} className="whitespace-nowrap flex-shrink-0">Bill of Supply</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} change={Math.abs(revChange)} trend={revChange >= 0 ? "up" : "down"} icon={<TrendingUp size={18} />} color="violet" subtitle="vs last month" />
        <StatCard label="Pending Dues" value={formatCurrency(totalDues)} change={Math.abs(dueChange)} trend={dueChange > 0 ? "up" : "down"} icon={<Clock size={18} />} color="amber" subtitle="vs last month" />
        <StatCard label="Paid Invoices" value={paidCount.toString()} change={Math.abs(paidChange)} trend={paidChange >= 0 ? "up" : "down"} icon={<CheckCircle size={18} />} color="emerald" subtitle="vs last month" />
        <StatCard label="Unpaid Invoices" value={unpaidCount.toString()} change={Math.abs(unpaidChange)} trend={unpaidChange > 0 ? "up" : "down"} icon={<AlertCircle size={18} />} color="rose" subtitle="vs last month" />
      </div>

      <Card>
        {/* Tabs — horizontally scrollable on mobile */}
        <div className="flex border-b border-primary/10 px-2 sm:px-4 overflow-x-auto scrollbar-hide">
          {[
            { id: "invoices", label: "Tax Invoices" },
            { id: "quotations", label: "Quotations" },
            { id: "credit", label: "Credit Notes" },
            { id: "debit", label: "Debit Notes" },
            { id: "bos", label: "Bills of Supply" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === t.id ? "border-violet-500 text-violet-400" : "border-transparent text-primary/40 hover:text-primary hover:border-primary/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "invoices" && (
          <>
            <CardHeader>
              {/* Search + filters — wraps on mobile */}
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[140px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-3.5 h-3.5" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full bg-primary/5 border border-primary/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-primary placeholder:text-primary/40 focus:outline-none focus:border-violet-500/50" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {["all", "paid", "partial", "unpaid", "draft", "awaiting_approval"].map((f) => (
                    <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all flex-shrink-0 ${filter === f ? "bg-violet-600 text-primary" : "bg-primary/5 text-primary/40 hover:text-primary hover:bg-primary/10"}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-primary/10">
                    <th className="text-left px-4 py-3 w-10">
                      <input type="checkbox"
                        checked={sales.length > 0 && selectedSaleIds.length === sales.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSaleIds(sales.map((s: any) => s.id));
                          else setSelectedSaleIds([]);
                        }}
                        className="rounded border-primary/20 bg-transparent text-violet-500 focus:ring-violet-500/20 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    {["Invoice ID", "Customer", "Date", "Items", "Total", "Paid", "Due", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-primary/40 text-xs font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {salesLoading ? (
                    <tr><td colSpan={10} className="text-center py-12 text-primary/40 text-sm">Loading sales...</td></tr>
                  ) : sales.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-12 text-primary/40 text-sm">No invoices found</td></tr>
                  ) : sales.map((sale: any) => {
                    const due = sale.total - sale.paid;
                    return (
                      <tr key={sale.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3.5 w-10">
                          <input type="checkbox"
                            checked={selectedSaleIds.includes(sale.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedSaleIds(prev => [...prev, sale.id]);
                              else setSelectedSaleIds(prev => prev.filter(id => id !== sale.id));
                            }}
                            className="rounded border-primary/20 bg-transparent text-violet-500 focus:ring-violet-500/20 w-4 h-4 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-violet-400 text-xs font-mono">{sale.invoiceNo}</td>
                        <td className="px-4 py-3.5 text-primary text-sm font-medium">{sale.customer?.name || "Walk-in"}</td>
                        <td className="px-4 py-3.5 text-primary/40 text-xs">{formatDate(sale.invoiceDate || sale.createdAt)}</td>
                        <td className="px-4 py-3.5 text-primary/40 text-sm text-center">{sale.items?.length || 0}</td>
                        <td className="px-4 py-3.5 text-primary font-semibold text-sm">{formatCurrency(sale.total)}</td>
                        <td className="px-4 py-3.5 text-emerald-400 text-sm font-medium">{formatCurrency(sale.paid)}</td>
                        <td className="px-4 py-3.5 text-sm font-medium">
                          {due > 0 ? <span className="text-rose-400">{formatCurrency(due)}</span> : <span className="text-primary/40">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {sale.workflowState === "awaiting_approval" ? (
                            <Badge variant="warning">Pending Approval</Badge>
                          ) : sale.workflowState === "rejected" ? (
                            <Badge variant="danger">Rejected</Badge>
                          ) : (
                            <Badge variant={sale.status === "paid" ? "success" : sale.status === "partial" ? "warning" : "danger"}>{sale.status}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex gap-1 items-center">
                            {/* Approvals (Admins only) */}
                            {isAdmin && sale.workflowState === "awaiting_approval" && (
                              <>
                                <button onClick={() => handleApprovalAction(sale.id, 'approve')} aria-label="Approve sale" className="p-1.5 rounded-lg hover:bg-emerald-500/15 text-primary/40 hover:text-emerald-400 transition-all" title="Approve">
                                  <CheckCircle size={14} />
                                </button>
                                <button onClick={() => handleApprovalAction(sale.id, 'reject')} aria-label="Reject sale" className="p-1.5 rounded-lg hover:bg-rose-500/15 text-primary/40 hover:text-rose-400 transition-all" title="Reject">
                                  <XCircle size={14} />
                                </button>
                              </>
                            )}

                            {/* Edit Invoice */}
                            {sale.workflowState !== "rejected" && (
                              <button onClick={() => { setEditSaleId(sale.id); setSaleModalOpen(true); }} aria-label="Edit invoice" className="p-1.5 rounded-lg hover:bg-blue-500/15 text-primary/40 hover:text-blue-400 transition-all" title="Edit Invoice">
                                <Pencil size={14} />
                              </button>
                            )}
                            
                            {/* Pay Icon */}
                            {sale.status !== "paid" && sale.workflowState === "posted" && (
                              <button
                                onClick={() => { setSalePayTarget({ id: sale.id, total: sale.total, paid: sale.paid, invoiceNo: sale.invoiceNo }); setSalePayInput(String(sale.paid)); }}
                                className="p-1.5 rounded-lg hover:bg-emerald-500/15 text-primary/40 hover:text-emerald-400 transition-all"
                                title="Record Payment"
                              >
                                <CreditCard size={14} />
                              </button>
                            )}

                            {/* Download Dropdown */}
                            {sale.workflowState === "posted" && (
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <button className="p-1.5 rounded-lg hover:bg-violet-500/15 text-primary/40 hover:text-violet-400 transition-all" title="Download Invoice">
                                    <Download size={14} />
                                  </button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                  align="end"
                                  className="z-[9999] min-w-[160px] max-w-[calc(100vw-2rem)] bg-surface-2 border border-primary/10 rounded-xl p-1 shadow-xl text-sm"
                                  style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border)' }}
                                >
                                  <DropdownMenu.Item
                                    className="px-3 py-2 text-primary/80 hover:text-primary hover:bg-primary/5 rounded-lg cursor-pointer outline-none transition-colors"
                                    onClick={() => downloadPdf(`/api/sales/${sale.id}/pdf?copy=original`, `Invoice-${sale.invoiceNo}_original.pdf`)}
                                  >
                                    Original (Buyer)
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    className="px-3 py-2 text-primary/80 hover:text-primary hover:bg-primary/5 rounded-lg cursor-pointer outline-none transition-colors"
                                    onClick={() => downloadPdf(`/api/sales/${sale.id}/pdf?copy=duplicate`, `Invoice-${sale.invoiceNo}_duplicate.pdf`)}
                                  >
                                    Duplicate (Transporter)
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    className="px-3 py-2 text-primary/80 hover:text-primary hover:bg-primary/5 rounded-lg cursor-pointer outline-none transition-colors"
                                    onClick={() => downloadPdf(`/api/sales/${sale.id}/pdf?copy=triplicate`, `Invoice-${sale.invoiceNo}_triplicate.pdf`)}
                                  >
                                    Triplicate (Supplier)
                                  </DropdownMenu.Item>
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                            )}

                            {/* Delete invoice */}
                            <button onClick={() => setDeleteInvoiceTarget({ id: sale.id, invoiceNo: sale.invoiceNo })} aria-label={`Delete invoice ${sale.invoiceNo}`} className="p-1.5 rounded-lg hover:bg-rose-500/15 text-primary/40 hover:text-rose-400 transition-all" title="Delete Invoice"><Trash2 size={14} /></button>
                            
                            {/* WhatsApp Share */}
                            {sale.customer?.phone && (
                              <button
                                onClick={() => {
                                  const msg = formatInvoiceMessage({
                                    customerName: sale.customer?.name || 'Customer',
                                    invoiceNo: sale.invoiceNo,
                                    amount: sale.total,
                                    companyName: 'BizFlow',
                                  });
                                  window.open(generateWhatsAppUrl(sale.customer.phone, msg), '_blank');
                                }}
                                className="p-1.5 rounded-lg hover:bg-emerald-500/15 text-primary/40 hover:text-emerald-400 transition-all"
                                title="Send via WhatsApp"
                              >
                                <MessageSquare size={14} />
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
          </>
        )}

        {activeTab === "invoices" && salesPaged && salesPaged.totalPages > 1 && (
          <div className="px-4 pb-4">
            <Pagination
              page={salesPaged.page}
              totalPages={salesPaged.totalPages}
              total={salesPaged.total}
              limit={salesPaged.limit}
              onPage={(p) => setPage(p)}
            />
          </div>
        )}

        {activeTab === "quotations" && (
          <>
            <CardHeader>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-3.5 h-3.5" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quotations..." className="w-full bg-primary/5 border border-primary/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-primary placeholder:text-primary/40 focus:outline-none focus:border-violet-500/50" />
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-primary/10">
                    {["Quotation No", "Customer", "Date", "Valid Until", "Items", "Total", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-primary/40 text-xs font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {quotationsLoading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-primary/40 text-sm">Loading quotations...</td></tr>
                  ) : quotations.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-primary/40 text-sm">No quotations found</td></tr>
                  ) : quotations.map((q: any) => (
                    <tr key={q.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3.5 text-violet-400 text-xs font-mono">{q.quotationNo}</td>
                      <td className="px-4 py-3.5 text-primary text-sm font-medium">{q.customer?.name || "Walk-in"}</td>
                      <td className="px-4 py-3.5 text-primary/40 text-xs">{formatDate(q.createdAt)}</td>
                      <td className="px-4 py-3.5 text-primary/40 text-xs">{q.validUntil ? formatDate(q.validUntil) : "—"}</td>
                      <td className="px-4 py-3.5 text-primary/40 text-sm text-center">{q.items?.length || 0}</td>
                      <td className="px-4 py-3.5 text-primary font-semibold text-sm">{formatCurrency(q.total)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1 items-center">
                          <button onClick={() => downloadPdf(`/api/quotations/${q.id}/pdf`, `Quotation-${q.quotationNo}.pdf`)} className="p-1.5 rounded-lg hover:bg-violet-500/15 text-primary/40 hover:text-violet-400 transition-all" title="Download"><Download size={13} /></button>
                          <button
                            onClick={() => handleConvertQuotation(q)}
                            disabled={convertingId === q.id}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-all disabled:opacity-50"
                            title="Convert to Tax Invoice"
                          >
                            {convertingId === q.id ? <RefreshCw size={11} className="animate-spin" /> : <FileText size={11} />}
                            Convert
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === "credit" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-primary/10">
                  {["CN No", "Date", "Original Invoice", "Customer", "Reason", "Credit Amt", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-primary/40 text-xs font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {cnLoading ? <tr><td colSpan={7} className="text-center py-12 text-primary/40 text-sm">Loading...</td></tr>
                : creditNotes.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-primary/40 text-sm">No credit notes found</td></tr>
                : creditNotes.map((cn: any) => (
                  <tr key={cn.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-3.5 text-emerald-400 text-xs font-mono">{cn.creditNoteNo}</td>
                    <td className="px-4 py-3.5 text-primary/40 text-xs">{formatDate(cn.createdAt)}</td>
                    <td className="px-4 py-3.5 text-primary/40 text-xs font-mono">{cn.sale?.invoiceNo}</td>
                    <td className="px-4 py-3.5 text-primary text-sm">{cn.customer?.name}</td>
                    <td className="px-4 py-3.5 text-primary/60 text-xs capitalize">{cn.reason.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3.5 text-emerald-400 font-semibold text-sm">{formatCurrency(cn.amount + cn.taxAmount)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1 items-center">
                        <button onClick={() => downloadPdf(`/api/credit-notes/${cn.id}/pdf`, `CreditNote-${cn.creditNoteNo}.pdf`)} className="p-1.5 rounded-lg hover:bg-emerald-500/15 text-primary/40 hover:text-emerald-400" title="Download" aria-label="Download credit note PDF"><Download size={13} /></button>
                        <button onClick={() => setDeleteCnTarget({ id: cn.id, no: cn.creditNoteNo })} className="p-1.5 rounded-lg hover:bg-rose-500/15 text-primary/40 hover:text-rose-400" title="Delete" aria-label={`Delete credit note ${cn.creditNoteNo}`}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "debit" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-primary/10">
                  {["DN No", "Date", "Original Invoice", "Customer", "Reason", "Debit Amt", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-primary/40 text-xs font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {dnLoading ? <tr><td colSpan={7} className="text-center py-12 text-primary/40 text-sm">Loading...</td></tr>
                : debitNotes.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-primary/40 text-sm">No debit notes found</td></tr>
                : debitNotes.map((dn: any) => (
                  <tr key={dn.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-3.5 text-amber-400 text-xs font-mono">{dn.debitNoteNo}</td>
                    <td className="px-4 py-3.5 text-primary/40 text-xs">{formatDate(dn.createdAt)}</td>
                    <td className="px-4 py-3.5 text-primary/40 text-xs font-mono">{dn.sale?.invoiceNo}</td>
                    <td className="px-4 py-3.5 text-primary text-sm">{dn.customer?.name}</td>
                    <td className="px-4 py-3.5 text-primary/60 text-xs capitalize">{dn.reason.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3.5 text-amber-400 font-semibold text-sm">{formatCurrency(dn.amount + dn.taxAmount)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1 items-center">
                        <button onClick={() => downloadPdf(`/api/debit-notes/${dn.id}/pdf`, `DebitNote-${dn.debitNoteNo}.pdf`)} className="p-1.5 rounded-lg hover:bg-amber-500/15 text-primary/40 hover:text-amber-400" title="Download" aria-label="Download debit note PDF"><Download size={13} /></button>
                        <button onClick={() => setDeleteDnTarget({ id: dn.id, no: dn.debitNoteNo })} className="p-1.5 rounded-lg hover:bg-rose-500/15 text-primary/40 hover:text-rose-400" title="Delete" aria-label={`Delete debit note ${dn.debitNoteNo}`}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "bos" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="border-b border-primary/10">
                  {["Bill No", "Date", "Customer", "Type", "Total", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-primary/40 text-xs font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {bosLoading ? <tr><td colSpan={7} className="text-center py-12 text-primary/40 text-sm">Loading...</td></tr>
                : bills.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-primary/40 text-sm">No bills of supply found</td></tr>
                : bills.map((b: any) => (
                  <tr key={b.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-3.5 text-blue-400 text-xs font-mono">{b.billNo}</td>
                    <td className="px-4 py-3.5 text-primary/40 text-xs">{formatDate(b.createdAt)}</td>
                    <td className="px-4 py-3.5 text-primary text-sm">{b.customer?.name}</td>
                    <td className="px-4 py-3.5"><Badge variant="default" className="capitalize">{b.supplyType}</Badge></td>
                    <td className="px-4 py-3.5 text-blue-400 font-semibold text-sm">{formatCurrency(b.total)}</td>
                    <td className="px-4 py-3.5"><Badge variant={b.status === "paid" ? "success" : b.status === "partial" ? "warning" : "danger"}>{b.status}</Badge></td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1 items-center">
                        <button onClick={() => downloadPdf(`/api/bill-of-supply/${b.id}/pdf`, `BillOfSupply-${b.billNo}.pdf`)} className="p-1.5 rounded-lg hover:bg-blue-500/15 text-primary/40 hover:text-blue-400" title="Download"><Download size={13} /></button>
                        {b.status !== "paid" && (
                          <button
                            onClick={() => { setBosPayTarget({ id: b.id, total: b.total, paid: b.paid, billNo: b.billNo }); setBosPayInput(String(b.paid)); }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                            title="Update Payment"
                          >
                            <RefreshCw size={11} /> Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewSaleModal open={saleModalOpen} onClose={() => { setSaleModalOpen(false); setEditSaleId(null); }} editSaleId={editSaleId || undefined} />
      <NewQuotationModal open={quotationModalOpen} onClose={() => setQuotationModalOpen(false)} />
      <NewCreditNoteModal open={cnModalOpen} onClose={() => setCnModalOpen(false)} />
      <NewDebitNoteModal open={dnModalOpen} onClose={() => setDnModalOpen(false)} />
      <NewBillOfSupplyModal open={bosModalOpen} onClose={() => setBosModalOpen(false)} />

      <ConfirmDialog
        open={!!deleteInvoiceTarget}
        title="Delete Invoice"
        message={`Delete invoice ${deleteInvoiceTarget?.invoiceNo}? Stock will be restored and this cannot be undone.`}
        confirmLabel="Delete Invoice"
        loading={deleteSale.isPending}
        onConfirm={async () => {
          if (!deleteInvoiceTarget) return;
          try {
            if (deleteInvoiceTarget.id === "bulk-delete") {
              for (const id of selectedSaleIds) {
                await deleteSale.mutateAsync(id);
              }
              setSelectedSaleIds([]);
              toast.success(`Deleted ${selectedSaleIds.length} invoices`);
            } else {
              await deleteSale.mutateAsync(deleteInvoiceTarget.id);
              toast.success("Invoice deleted");
            }
          } catch (err: any) { toast.error(err.message || "Failed to delete invoice(s)"); }
          setDeleteInvoiceTarget(null);
        }}
        onCancel={() => setDeleteInvoiceTarget(null)}
      />

      {/* H-4: Delete CN confirm */}
      <ConfirmDialog
        open={!!deleteCnTarget}
        title="Delete Credit Note"
        message={`Delete credit note ${deleteCnTarget?.no}? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteCreditNote.isPending}
        onConfirm={async () => {
          if (!deleteCnTarget) return;
          try { await deleteCreditNote.mutateAsync(deleteCnTarget.id); } catch { toast.error("Failed to delete credit note"); }
          setDeleteCnTarget(null);
        }}
        onCancel={() => setDeleteCnTarget(null)}
      />

      {/* H-4: Delete DN confirm */}
      <ConfirmDialog
        open={!!deleteDnTarget}
        title="Delete Debit Note"
        message={`Delete debit note ${deleteDnTarget?.no}? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteDebitNote.isPending}
        onConfirm={async () => {
          if (!deleteDnTarget) return;
          try { await deleteDebitNote.mutateAsync(deleteDnTarget.id); } catch { toast.error("Failed to delete debit note"); }
          setDeleteDnTarget(null);
        }}
        onCancel={() => setDeleteDnTarget(null)}
      />

      {/* H-5: BoS payment update dialog */}
      {bosPayTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl p-5 sm:p-6 w-[calc(100vw-2rem)] sm:w-80 max-w-sm space-y-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <p className="text-primary font-semibold">Update BoS Payment — {bosPayTarget.billNo}</p>
            <p className="text-primary/40 text-xs">Total: ₹{bosPayTarget.total.toLocaleString()}</p>
            <div>
              <label className="text-primary/40 text-xs mb-1.5 block">Amount Paid (₹)</label>
              <input
                type="number" min={0} max={bosPayTarget.total}
                value={bosPayInput}
                onChange={e => setBosPayInput(e.target.value)}
                className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setBosPayTarget(null)} className="flex-1 py-2 rounded-xl text-sm text-primary/60 hover:text-primary hover:bg-primary/5 transition-all">Cancel</button>
              <button onClick={handleBoSPayUpdate} className="flex-1 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all">Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice payment update dialog */}
      {salePayTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl p-5 sm:p-6 w-[calc(100vw-2rem)] sm:w-80 max-w-sm space-y-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <p className="text-primary font-semibold">Record Payment — {salePayTarget.invoiceNo}</p>
            <p className="text-primary/40 text-xs">Invoice Total: ₹{salePayTarget.total.toLocaleString()}</p>
            <div>
              <label className="text-primary/40 text-xs mb-1.5 block">Amount Received (₹)</label>
              <input
                type="number" min={0} max={salePayTarget.total}
                value={salePayInput}
                onChange={e => setSalePayInput(e.target.value)}
                className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setSalePayTarget(null)} className="flex-1 py-2 rounded-xl text-sm text-primary/60 hover:text-primary hover:bg-primary/5 transition-all">Cancel</button>
              <button onClick={handleSalePayUpdate} className="flex-1 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all">Record</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
