import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useProducts(search?: string, category?: string, page = 1, limit = 25, isPicker = false) {
  return useQuery({
    queryKey: ["products", search, category, page, limit, isPicker],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (category && category !== "All" && category !== "All Categories") params.append("category", category);
      params.append("page", String(page));
      params.append("limit", String(limit));
      if (isPicker) params.append("picker", "true");
      const res = await fetch(`/api/inventory/products?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json() as Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number; stats?: { lowStock: number; totalValue: number; totalSellValue: number } }>;
    }
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: ["productCategories"],
    queryFn: async () => {
      const res = await fetch("/api/v1/products/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      const data = await res.json();
      return data.data as string[];
    }
  });
}
export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/inventory/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errorMessage = errorData.error || "Failed to create product";
        if (errorData.details && Array.isArray(errorData.details)) {
          errorMessage += ": " + errorData.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ');
        }
        throw new Error(errorMessage);
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/inventory/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errorMessage = errorData.error || "Failed to update product";
        if (errorData.details && Array.isArray(errorData.details)) {
          errorMessage += ": " + errorData.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ');
        }
        throw new Error(errorMessage);
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inventory/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete product");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}
