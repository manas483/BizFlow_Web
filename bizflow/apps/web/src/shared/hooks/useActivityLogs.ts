import { useQuery } from '@tanstack/react-query';

interface ActivityLogEntry {
  id: string;
  businessId: string;
  userId: string;
  userName: string;
  eventType: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface ActivityFilters {
  page?: number;
  limit?: number;
  userId?: string;
  eventType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useActivityLogs(filters: ActivityFilters = {}) {
  const params = new URLSearchParams();
  if (filters.page)      params.set('page', String(filters.page));
  if (filters.limit)     params.set('limit', String(filters.limit));
  if (filters.userId)    params.set('userId', filters.userId);
  if (filters.eventType) params.set('eventType', filters.eventType);
  if (filters.dateFrom)  params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo)    params.set('dateTo', filters.dateTo);

  return useQuery<{
    data: ActivityLogEntry[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ['activity-logs', filters],
    queryFn: async () => {
      const res = await fetch(`/api/activity?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load activity logs');
      const data = await res.json();
      // Support both old (array) and new (paginated) response format
      if (Array.isArray(data)) {
        return { data, pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 } };
      }
      return data;
    },
    refetchInterval: 15000, // refresh every 15s
  });
}
