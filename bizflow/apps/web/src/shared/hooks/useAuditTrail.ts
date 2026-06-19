import { useQuery } from '@tanstack/react-query';

interface AuditLogEntry {
  id: string;
  businessId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogFilters {
  page?: number;
  limit?: number;
  userId?: string;
  entityType?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: {
    entityTypes: string[];
    users: { id: string; name: string }[];
  };
}

export function useAuditTrail(filters: AuditLogFilters = {}) {
  const params = new URLSearchParams();
  if (filters.page)       params.set('page', String(filters.page));
  if (filters.limit)      params.set('limit', String(filters.limit));
  if (filters.userId)     params.set('userId', filters.userId);
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.action)     params.set('action', filters.action);
  if (filters.dateFrom)   params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo)     params.set('dateTo', filters.dateTo);
  if (filters.search)     params.set('search', filters.search);

  return useQuery<AuditLogResponse>({
    queryKey: ['audit-trail', filters],
    queryFn: async () => {
      const res = await fetch(`/api/audit-trail?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed to load audit trail');
      return data;
    },
    refetchInterval: 30000, // refresh every 30s
  });
}
