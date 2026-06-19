import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface AutomationSettings {
  id: string;
  businessId: string;
  autoGst: boolean;
  autoJournal: boolean;
  autoStockUpdate: boolean;
  autoReorderAlert: boolean;
  aiForecast: boolean;
  aiInsights: boolean;
  emailNotifications: boolean;
  whatsappButton: boolean;
}

export function useAutomationSettings() {
  return useQuery<AutomationSettings>({
    queryKey: ['automation-settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings/automation');
      if (!res.ok) throw new Error('Failed to fetch automation settings');
      return res.json();
    },
  });
}

export function useUpdateAutomationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<AutomationSettings>) => {
      const res = await fetch('/api/settings/automation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update settings');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-settings'] });
    },
  });
}
