import { useQuery } from "@tanstack/react-query";

interface ReportParams {
  period: "daily" | "weekly" | "monthly" | "yearly" | "lifetime" | "custom";
  startDate?: string;
  endDate?: string;
}

export function useReports(params: ReportParams) {
  return useQuery({
    queryKey: ["reports", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("period", params.period);
      if (params.period === "custom") {
        if (params.startDate) searchParams.set("startDate", params.startDate);
        if (params.endDate) searchParams.set("endDate", params.endDate);
      }

      const res = await fetch(`/api/reports?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });
}
