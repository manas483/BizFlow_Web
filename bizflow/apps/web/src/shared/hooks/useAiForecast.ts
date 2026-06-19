import { useQuery } from '@tanstack/react-query';

export interface DemandForecast {
  productName: string;
  expectedDemand: number;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  category: string;
}

export interface SalesForecast {
  period: string;
  expectedRevenue: number;
  growthPercent: number;
  confidence: number;
}

export interface ForecastResult {
  demandForecasts: DemandForecast[];
  salesForecasts: SalesForecast[];
  fastMoving: string[];
  slowMoving: string[];
  generatedAt: string;
}

export function useAiForecast() {
  return useQuery<ForecastResult>({
    queryKey: ['ai-forecast'],
    queryFn: async () => {
      const res = await fetch('/api/ai/forecast');
      if (!res.ok) {
        if (res.status === 403) return null; // AI disabled
        throw new Error('Failed to fetch forecast');
      }
      return res.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour — data is cached server-side for 24h anyway
    retry: 1,
  });
}
