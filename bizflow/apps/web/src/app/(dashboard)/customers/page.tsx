"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/ui/Card";
import { Badge } from "@/shared/ui/ui/Badge";
import { Button } from "@/shared/ui/ui/Button";
import { StatCard } from "@/shared/ui/ui/StatCard";
import ConfirmDialog from "@/shared/ui/ui/ConfirmDialog";
import Pagination from "@/shared/ui/ui/Pagination";
import { useCustomers, useDeleteCustomer } from "@/shared/hooks/useCustomers";
import { exportToCSV, formatCurrency, formatDate, getInitials } from "@/shared/lib/utils";
import { Users, Plus, Search, TrendingUp, AlertCircle, UserCheck, Phone, Pencil, Trash2, Download, ShoppingBag } from "lucide-react";
import AddCustomerModal from "@/shared/ui/modals/AddCustomerModal";
import EditCustomerModal from "@/shared/ui/modals/EditCustomerModal";

function getFrequencyLabel(count: number): { label: string; variant: "success" | "warning" | "violet" | "default" | "danger" } {
  if (count === 0) return { label: "New", variant: "default" };
  if (count === 1) return { label: "One-time", variant: "warning" };
  if (count <= 5) return { label: "Occasional", variant: "violet" };
  return { label: "Regular", variant: "success" };
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: paged, isLoading } = useCustomers(search, page);
  const customers = paged?.data ?? [];
  const deleteCustomer = useDeleteCustomer();

  // Stats use all customers from current page (reset to page 1 on search)
  const totalDues = customers.reduce((s: number, c: any) => s + c.dues, 0);
  const totalPurchaseCount = customers.reduce((s: number, c: any) => s + (c.purchaseCount || 0), 0);
  const now = new Date();
  const newThisMonth = customers.filter((c: any) => {
    const d = new Date(c.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const totalPurchases = customers.reduce((s: number, c: any) => s + (c.computedTotalPurchases || c.totalPurchases || 0), 0);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomer.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
      toast.error("Failed to delete customer");
    }
  };

  const handleExport = () => {
    const data = customers.map((c: any) => ({
      "Name": c.name,
      "Email": c.email || "",
      "Phone": c.phone || "",
      "City": c.city || "",
      "Total Purchases (₹)": c.computedTotalPurchases || c.totalPurchases,
      "Purchase Count": c.purchaseCount || 0,
      "Dues (₹)": c.dues,
      "Frequency": getFrequencyLabel(c.purchaseCount || 0).label,
      "Joined": formatDate(c.createdAt),
    }));
    exportToCSV(data, "customers_export");
  };

  return (
    <DashboardLayout title="Customers">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">Customer Management</h2>
          <p className="text-primary/40 text-sm mt-0.5">Manage your customer relationships and dues</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExport}>Export CSV</Button>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsAddOpen(true)}>Add Customer</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total Customers" value={customers.length.toString()} icon={<Users size={18} />} color="blue" />
        <StatCard label="New This Month" value={newThisMonth.toString()} icon={<UserCheck size={18} />} color="emerald" />
        <StatCard label="Total Purchases" value={formatCurrency(totalPurchases)} icon={<TrendingUp size={18} />} color="violet" />
        <StatCard label="Total Dues" value={formatCurrency(totalDues)} icon={<AlertCircle size={18} />} color="rose" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-3.5 h-3.5" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..."
              className="w-full bg-primary/5 border border-primary/10 rounded-lg pl-8 pr-3 py-1.5 text-xs
                text-primary placeholder:text-primary/40 focus:outline-none focus:border-violet-500/50" />
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-primary/10">
                {["Customer", "Phone", "City", "Purchases", "Amount", "Dues", "Joined", "Frequency", ""].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-primary/40 text-xs font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-12 text-primary/40 text-sm">Loading customers...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-primary/40 text-sm">No customers found</td></tr>
              ) : customers.map((customer: any) => {
                const freq = getFrequencyLabel(customer.purchaseCount || 0);
                return (
                <tr key={customer.id} className="hover:bg-primary/5 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-700/30
                        flex items-center justify-center text-violet-400 text-xs font-bold flex-shrink-0">
                        {getInitials(customer.name)}
                      </div>
                      <div>
                        <p className="text-primary text-sm font-medium">{customer.name}</p>
                        <p className="text-primary/40 text-xs">{customer.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-primary/40 text-xs">
                      <Phone size={11} />{customer.phone}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-primary/40 text-sm">{customer.city || "—"}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-primary text-sm font-semibold">
                      <ShoppingBag size={12} className="text-violet-400" />
                      {customer.purchaseCount || 0}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-primary font-semibold text-sm">{formatCurrency(customer.computedTotalPurchases || customer.totalPurchases)}</td>
                  <td className="px-5 py-3.5 text-sm font-medium">
                    {customer.dues > 0
                      ? <span className="text-rose-400">{formatCurrency(customer.dues)}</span>
                      : <span className="text-emerald-400">Cleared</span>}
                  </td>
                  <td className="px-5 py-3.5 text-primary/40 text-xs">{formatDate(customer.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant={freq.variant}>{freq.label}</Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditCustomer(customer)}
                        aria-label={`Edit ${customer.name}`}
                        className="p-1.5 rounded-lg hover:bg-violet-500/10 text-primary/40 hover:text-violet-400 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteTarget({ id: customer.id, name: customer.name })}
                        aria-label={`Delete ${customer.name}`}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-primary/40 hover:text-rose-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {paged && paged.totalPages > 1 && (
        <Pagination
          page={paged.page}
          totalPages={paged.totalPages}
          total={paged.total}
          limit={paged.limit}
          onPage={(p) => { setPage(p); }}
        />
      )}

      <AddCustomerModal open={isAddOpen} onClose={() => setIsAddOpen(false)} />
      {editCustomer && <EditCustomerModal customer={editCustomer} onClose={() => setEditCustomer(null)} />}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Customer"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All their sales history will also be removed.`}
        confirmLabel="Delete Customer"
        loading={deleteCustomer.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </DashboardLayout>
  );
}
