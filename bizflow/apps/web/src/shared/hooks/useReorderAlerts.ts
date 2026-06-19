import { useQuery } from '@tanstack/react-query';

export interface ReorderAlert {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  reorderLevel: number;
  minStock: number;
  suggestedQty: number;
  preferredSupplier: string | null;
  category: string;
}

export function useReorderAlerts() {
  return useQuery<{ alerts: ReorderAlert[]; count: number }>({
    queryKey: ['reorder-alerts'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/reorder-alerts');
      if (!res.ok) throw new Error('Failed to fetch reorder alerts');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
