import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ── Chart of Accounts ─────────────────────────────────────────────────────────

export function useAccounts(filters?: { type?: string; parentId?: string }) {
  return useQuery({
    queryKey: ["accounting-accounts", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.type) params.append("type", filters.type);
      if (filters?.parentId) params.append("parentId", filters.parentId);
      const res = await fetch(`/api/accounting/accounts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return res.json();
    },
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/accounting/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create account"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-accounts"] }); },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/accounting/accounts/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to update account"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-accounts"] }); },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounting/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to delete account"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-accounts"] }); },
  });
}

// ── Journal Entries ───────────────────────────────────────────────────────────

export function useJournalEntries(filters?: { status?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ["accounting-journal-entries", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append("status", filters.status);
      if (filters?.from) params.append("from", filters.from);
      if (filters?.to) params.append("to", filters.to);
      const res = await fetch(`/api/accounting/journal-entries?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch journal entries");
      return res.json();
    },
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/accounting/journal-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create journal entry"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-journal-entries"] }); },
  });
}

export function useUpdateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/accounting/journal-entries/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to update journal entry"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-journal-entries"] }); },
  });
}

// ── General Ledger ────────────────────────────────────────────────────────────

export function useGeneralLedger(accountId: string | null, dateRange?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["accounting-ledger", accountId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (accountId) params.append("accountId", accountId);
      if (dateRange?.from) params.append("from", dateRange.from);
      if (dateRange?.to) params.append("to", dateRange.to);
      const res = await fetch(`/api/accounting/ledger?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch ledger");
      return res.json();
    },
    enabled: !!accountId,
  });
}

// ── Receivables & Payables ────────────────────────────────────────────────────

export function useReceivables(status?: string) {
  return useQuery({
    queryKey: ["accounting-receivables", status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      const res = await fetch(`/api/accounting/receivables?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch receivables");
      return res.json();
    },
  });
}

export function useCreateReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/accounting/receivables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create receivable"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-receivables"] }); },
  });
}

export function usePayables(status?: string) {
  return useQuery({
    queryKey: ["accounting-payables", status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      const res = await fetch(`/api/accounting/payables?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch payables");
      return res.json();
    },
  });
}

export function useCreatePayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/accounting/payables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create payable"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-payables"] }); },
  });
}

// ── Cash Book ─────────────────────────────────────────────────────────────────

export function useCashBook(filters?: { from?: string; to?: string; type?: string }) {
  return useQuery({
    queryKey: ["accounting-cash-book", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.from) params.append("from", filters.from);
      if (filters?.to) params.append("to", filters.to);
      if (filters?.type) params.append("type", filters.type);
      const res = await fetch(`/api/accounting/cash-book?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch cash book");
      return res.json();
    },
  });
}

export function useCreateCashBookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/accounting/cash-book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create cash book entry"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-cash-book"] }); },
  });
}

// ── Bank Accounts ─────────────────────────────────────────────────────────────

export function useBankAccounts() {
  return useQuery({
    queryKey: ["accounting-bank-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/bank-accounts");
      if (!res.ok) throw new Error("Failed to fetch bank accounts");
      return res.json();
    },
  });
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/accounting/bank-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create bank account"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-bank-accounts"] }); },
  });
}

export function useDeleteBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounting/bank-accounts/${id}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to delete bank account"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-bank-accounts"] }); },
  });
}

// ── Bank Book ─────────────────────────────────────────────────────────────────

export function useBankBook(filters?: { bankAccountId?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ["accounting-bank-book", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.bankAccountId) params.append("bankAccountId", filters.bankAccountId);
      if (filters?.from) params.append("from", filters.from);
      if (filters?.to) params.append("to", filters.to);
      const res = await fetch(`/api/accounting/bank-book?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch bank book");
      return res.json();
    },
  });
}

export function useCreateBankBookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/accounting/bank-book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create bank book entry"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting-bank-book"] });
      qc.invalidateQueries({ queryKey: ["accounting-bank-accounts"] });
    },
  });
}

// ── Bank Reconciliation ───────────────────────────────────────────────────────

export function useBankReconciliations(bankAccountId?: string) {
  return useQuery({
    queryKey: ["accounting-bank-reconciliation", bankAccountId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (bankAccountId) params.append("bankAccountId", bankAccountId);
      const res = await fetch(`/api/accounting/bank-reconciliation?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch reconciliations");
      return res.json();
    },
  });
}

export function useCreateBankReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/accounting/bank-reconciliation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create reconciliation"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting-bank-reconciliation"] });
      qc.invalidateQueries({ queryKey: ["accounting-bank-book"] });
    },
  });
}

// ── GST ───────────────────────────────────────────────────────────────────────

export function useGstReturns(filters?: { returnType?: string; status?: string }) {
  return useQuery({
    queryKey: ["accounting-gst", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.returnType) params.append("returnType", filters.returnType);
      if (filters?.status) params.append("status", filters.status);
      const res = await fetch(`/api/accounting/gst?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch GST returns");
      return res.json();
    },
  });
}

export function useCreateGstReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/accounting/gst", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create GST return"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-gst"] }); },
  });
}

// ── TDS ───────────────────────────────────────────────────────────────────────

export function useTdsEntries(filters?: { section?: string; status?: string }) {
  return useQuery({
    queryKey: ["accounting-tds", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.section) params.append("section", filters.section);
      if (filters?.status) params.append("status", filters.status);
      const res = await fetch(`/api/accounting/tds?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch TDS entries");
      return res.json();
    },
  });
}

export function useCreateTdsEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/accounting/tds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create TDS entry"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-tds"] }); },
  });
}

// ── Financial Reports ─────────────────────────────────────────────────────────

export function useProfitLoss(dateRange?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["accounting-profit-loss", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("from", dateRange.from);
      if (dateRange?.to) params.append("to", dateRange.to);
      const res = await fetch(`/api/accounting/reports/profit-loss?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch P&L");
      return res.json();
    },
  });
}

export function useBalanceSheet(asOf?: string) {
  return useQuery({
    queryKey: ["accounting-balance-sheet", asOf],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (asOf) params.append("asOf", asOf);
      const res = await fetch(`/api/accounting/reports/balance-sheet?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch balance sheet");
      return res.json();
    },
  });
}

export function useCashFlowStatement(dateRange?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["accounting-cash-flow", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("from", dateRange.from);
      if (dateRange?.to) params.append("to", dateRange.to);
      const res = await fetch(`/api/accounting/reports/cash-flow?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch cash flow");
      return res.json();
    },
  });
}
