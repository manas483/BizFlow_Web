import { useQuery } from '@tanstack/react-query';

export interface BusinessInsight {
  id: string;
  type: 'warning' | 'tip' | 'success' | 'info';
  title: string;
  message: string;
  metric?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function useAiInsights() {
  return useQuery<BusinessInsight[]>({
    queryKey: ['ai-insights'],
    queryFn: async () => {
      const res = await fetch('/api/ai/insights');
      if (!res.ok) {
        if (res.status === 403) return []; // AI disabled
        throw new Error('Failed to fetch insights');
      }
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
