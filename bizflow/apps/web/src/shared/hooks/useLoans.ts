import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useLoans(filters?: { status?: string; loanType?: string; lender?: string }) {
  return useQuery({
    queryKey: ["loans", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append("status", filters.status);
      if (filters?.loanType) params.append("loanType", filters.loanType);
      if (filters?.lender) params.append("lender", filters.lender);
      const res = await fetch(`/api/loans?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch loans");
      return res.json();
    },
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/loans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create loan"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loans"] }); },
  });
}

export function useLoan(id: string | null) {
  return useQuery({
    queryKey: ["loans", id],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${id}`);
      if (!res.ok) throw new Error("Failed to fetch loan");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUpdateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/loans/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to update loan"); }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["loans", vars.id] });
    },
  });
}

export function useDeleteLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/loans/${id}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to delete loan"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loans"] }); },
  });
}

export function useLoanSchedule(loanId: string | null) {
  return useQuery({
    queryKey: ["loans", loanId, "schedule"],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loanId}/schedule`);
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
    enabled: !!loanId,
  });
}

export function useLoanPayments(loanId: string | null) {
  return useQuery({
    queryKey: ["loans", loanId, "payments"],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loanId}/payments`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    enabled: !!loanId,
  });
}

export function useRecordLoanPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ loanId, data }: { loanId: string; data: any }) => {
      const res = await fetch(`/api/loans/${loanId}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to record payment"); }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["loans", vars.loanId] });
      qc.invalidateQueries({ queryKey: ["loans", vars.loanId, "schedule"] });
      qc.invalidateQueries({ queryKey: ["loans", vars.loanId, "payments"] });
    },
  });
}

export function useLoanDocuments(loanId: string | null) {
  return useQuery({
    queryKey: ["loans", loanId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loanId}/documents`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !!loanId,
  });
}

export function useUploadLoanDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ loanId, data }: { loanId: string; data: any }) => {
      const res = await fetch(`/api/loans/${loanId}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to upload document"); }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["loans", vars.loanId, "documents"] });
    },
  });
}

export function useForeclosure(loanId: string | null, chargesPercent: number) {
  return useQuery({
    queryKey: ["loans", loanId, "foreclosure", chargesPercent],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loanId}/foreclosure?chargesPercent=${chargesPercent}`);
      if (!res.ok) throw new Error("Failed to fetch foreclosure details");
      return res.json();
    },
    enabled: !!loanId,
  });
}

export function useExecuteForeclosure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ loanId, data }: { loanId: string; data: any }) => {
      const res = await fetch(`/api/loans/${loanId}/foreclosure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to execute foreclosure"); }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["loans", vars.loanId] });
      qc.invalidateQueries({ queryKey: ["loans", vars.loanId, "schedule"] });
      qc.invalidateQueries({ queryKey: ["loans", vars.loanId, "payments"] });
    },
  });
}
