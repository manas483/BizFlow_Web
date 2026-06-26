import useSWR from 'swr';


export interface InventoryHealthMetrics {
  totalLayers: number;
  activeLayers: number;
  exhaustedLayers: number;
  negativeLayers: number;
  orphanConsumptions: number;
  driftProducts: number;
  lastValidationTime: string;
}

export function useInventoryHealth() {
  const { data, error, isLoading, mutate } = useSWR<{ data: InventoryHealthMetrics }>(
    '/api/admin/inventory-health',
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch inventory health');
      return res.json();
    },
    {
      refreshInterval: 60000, // Refresh every minute
    }
  );

  return {
    metrics: data?.data,
    isLoading,
    isError: error,
    mutate
  };
}
