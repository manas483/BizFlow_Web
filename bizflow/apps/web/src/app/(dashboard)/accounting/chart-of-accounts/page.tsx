"use client";

import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardHeader, CardTitle } from "@/shared/ui/ui/Card";
import { Button } from "@/shared/ui/ui/Button";
import { Badge } from "@/shared/ui/ui/Badge";
import { useAccounts, useCreateAccount, useDeleteAccount } from "@/shared/hooks/useAccounting";
import { formatCurrency } from "@/shared/lib/utils";
import { Plus, Trash2, ChevronRight, FolderTree, Search, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import AddAccountModal from "@/shared/ui/modals/AddAccountModal";
import ConfirmDialog from "@/shared/ui/ui/ConfirmDialog";

const typeColors: Record<string, string> = {
  ASSET: "bg-blue-500/10 text-blue-400",
  LIABILITY: "bg-orange-500/10 text-orange-400",
  EQUITY: "bg-purple-500/10 text-purple-400",
  REVENUE: "bg-emerald-500/10 text-emerald-400",
  EXPENSE: "bg-rose-500/10 text-rose-400",
};

export default function ChartOfAccountsPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: accounts = [], isLoading } = useAccounts(filterType ? { type: filterType } : undefined);
  const deleteAccount = useDeleteAccount();

  // Filter by search term dynamically
  const filtered = accounts.filter((a: any) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase())
  );

  // Build hierarchical tree dynamically from flat list
  const rootAccounts = filtered.filter((a: any) => !a.parentId);
  const childMap = new Map<string, any[]>();
  for (const acc of filtered) {
    if (acc.parentId) {
      if (!childMap.has(acc.parentId)) childMap.set(acc.parentId, []);
      childMap.get(acc.parentId)!.push(acc);
    }
  }

  // Get unique account types from data
  const accountTypes = [...new Set(accounts.map((a: any) => a.accountType))] as string[];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAccount.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete account");
      setDeleteTarget(null);
    }
  };

  return (
    <DashboardLayout title="Chart of Accounts">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="p-2 w-9 h-9" aria-label="Go back" onClick={() => router.back()}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-primary">Chart of Accounts</h2>
            <p className="text-primary/40 text-sm mt-0.5">Manage your account hierarchy for double-entry bookkeeping</p>
          </div>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsModalOpen(true)}>Add Account</Button>
      </div>

      {/* Filters — dynamically built from data */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface border border-primary/10 text-sm text-primary placeholder:text-primary/30 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!filterType ? "bg-violet-500/20 text-violet-400" : "text-primary/40 hover:bg-primary/5"}`}
          >All</button>
          {accountTypes.map((type: string) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === type ? "bg-violet-500/20 text-violet-400" : "text-primary/40 hover:bg-primary/5"}`}
            >{type}</button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FolderTree size={16} /> Account Tree</CardTitle>
        </CardHeader>
        <div className="divide-y divide-primary/10">
          {isLoading ? (
            <div className="text-center py-12 text-primary/40 text-sm">Loading accounts...</div>
          ) : rootAccounts.length === 0 ? (
            <div className="text-center py-12 text-primary/40 text-sm">No accounts found. Create your first account to get started.</div>
          ) : rootAccounts.map((account: any) => (
            <AccountRow
              key={account.id}
              account={account}
              children={childMap.get(account.id) || []}
              depth={0}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      </Card>

      <AddAccountModal open={isModalOpen} onClose={() => setIsModalOpen(false)} accounts={accounts} />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Account"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteAccount.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </DashboardLayout>
  );
}

function AccountRow({ account, children, depth, onDelete }: {
  account: any; children: any[]; depth: number; onDelete: (target: { id: string; name: string }) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <>
      <div
        className="flex items-center justify-between px-5 py-3 hover:bg-primary/5 transition-colors group"
        style={{ paddingLeft: `${20 + depth * 24}px` }}
      >
        <div className="flex items-center gap-3">
          {children.length > 0 ? (
            <button onClick={() => setExpanded(!expanded)} className="p-0.5">
              <ChevronRight size={14} className={`text-primary/30 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <div className="w-[18px]" />
          )}
          <span className="text-xs font-mono text-primary/40 w-16">{account.code}</span>
          <span className="text-sm text-primary font-medium">{account.name}</span>
          <Badge variant={account.accountType === "REVENUE" || account.accountType === "ASSET" ? "success" : "violet"}>
            {account.accountType}
          </Badge>
          {!account.isActive && <Badge variant="default">Inactive</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-primary/60">{formatCurrency(account.openingBalance)}</span>
          {!account.isSystemAccount && (
            <button
              onClick={() => onDelete({ id: account.id, name: account.name })}
              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-primary/0 group-hover:text-primary/30 hover:!text-rose-400 transition-all"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      {expanded && children.map((child: any) => (
        <AccountRow key={child.id} account={child} children={[]} depth={depth + 1} onDelete={onDelete} />
      ))}
    </>
  );
}
