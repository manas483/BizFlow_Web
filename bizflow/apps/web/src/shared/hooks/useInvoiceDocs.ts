import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreditNotes() {
  return useQuery({
    queryKey: ["credit-notes"],
    queryFn: async () => {
      const res = await fetch("/api/credit-notes");
      if (!res.ok) throw new Error("Failed to fetch credit notes");
      return res.json();
    }
  });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create credit note");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit-notes"] })
  });
}

export function useDeleteCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/credit-notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete credit note");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit-notes"] }),
  });
}

export function useDebitNotes() {
  return useQuery({
    queryKey: ["debit-notes"],
    queryFn: async () => {
      const res = await fetch("/api/debit-notes");
      if (!res.ok) throw new Error("Failed to fetch debit notes");
      return res.json();
    }
  });
}

export function useCreateDebitNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/debit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create debit note");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debit-notes"] })
  });
}

export function useDeleteDebitNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/debit-notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete debit note");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debit-notes"] }),
  });
}

export function useBillsOfSupply() {
  return useQuery({
    queryKey: ["bills-of-supply"],
    queryFn: async () => {
      const res = await fetch("/api/bill-of-supply");
      if (!res.ok) throw new Error("Failed to fetch bills of supply");
      return res.json();
    }
  });
}

export function useCreateBillOfSupply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/bill-of-supply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create bill of supply");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills-of-supply"] })
  });
}
