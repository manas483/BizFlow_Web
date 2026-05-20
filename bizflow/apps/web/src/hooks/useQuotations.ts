import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useQuotations(search?: string) {
  return useQuery({
    queryKey: ["quotations", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      
      const res = await fetch(`/api/quotations?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch quotations");
      return res.json();
    }
  });
}

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/quotations", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data) 
      });
      if (!res.ok) throw new Error("Failed to create quotation");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotations"] }),
  });
}
