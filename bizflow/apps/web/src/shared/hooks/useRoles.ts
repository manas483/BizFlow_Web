import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export function useRoles() {
  return useQuery<CustomRole[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await fetch('/api/roles');
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed to load roles');
      return data.data;
    },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; permissions: string[] }) => {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed to create role');
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; name?: string; description?: string; permissions?: string[] }) => {
      const res = await fetch('/api/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed to update role');
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/roles?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed to delete role');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}
