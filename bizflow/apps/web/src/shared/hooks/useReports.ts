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
      
      let effectivePeriod = params.period;
      let effectiveStart = params.startDate;
      let effectiveEnd = params.endDate;

      // Fix Timezone Issue: calculate relative dates in the browser's local timezone
      if (["daily", "weekly", "monthly", "yearly"].includes(params.period)) {
        effectivePeriod = "custom";
        const now = new Date();
        let from: Date, to: Date;
        
        if (params.period === "daily") {
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        } else if (params.period === "weekly") {
          const day = now.getDay() || 7; 
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
          to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59, 999);
        } else if (params.period === "monthly") {
          from = new Date(now.getFullYear(), now.getMonth(), 1);
          to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else { // yearly
          from = new Date(now.getFullYear(), 0, 1);
          to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        }
        
        effectiveStart = from.toISOString();
        effectiveEnd = to.toISOString();
      }

      searchParams.set("period", effectivePeriod);
      if (effectivePeriod === "custom") {
        if (effectiveStart) searchParams.set("startDate", effectiveStart);
        if (effectiveEnd) searchParams.set("endDate", effectiveEnd);
      }

      const res = await fetch(`/api/reports?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });
}
