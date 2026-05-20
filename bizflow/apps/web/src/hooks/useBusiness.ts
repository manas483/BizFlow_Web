import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useBusiness() {
  return useQuery({
    queryKey: ["business"],
    queryFn: async () => {
      const res = await fetch("/api/business");
      if (!res.ok) throw new Error("Failed to fetch business info");
      return res.json();
    },
  });
}

export function useUpdateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update business info");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business"] }),
  });
}
