import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useCustomers(search?: string, page = 1, limit = 25) {
  return useQuery({
    queryKey: ["customers", search, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      params.append("page", String(page));
      params.append("limit", String(limit));
      const res = await fetch(`/api/customers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json() as Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }>;
    }
  });
}


export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
          throw new Error(errorData.details[0].message);
        }
        throw new Error(errorData.error || "Failed to create customer");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
          throw new Error(errorData.details[0].message);
        }
        throw new Error(errorData.error || "Failed to update customer");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete customer");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}
