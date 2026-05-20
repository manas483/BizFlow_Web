import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useSales(search?: string, status?: string, page = 1, limit = 25) {
  return useQuery({
    queryKey: ["sales", search, status, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (status && status !== "All") params.append("status", status);
      params.append("page", String(page));
      params.append("limit", String(limit));
      const res = await fetch(`/api/sales?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json() as Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }>;
    }
  });
}


export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create sale");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete invoice");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

