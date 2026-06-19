import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface BackupRecord {
  id: string;
  businessId: string;
  type: string;
  status: string;
  fileSize: number | null;
  fileName: string | null;
  storageUrl: string | null;
  triggeredBy: string | null;
  notes: string | null;
  createdAt: string;
}

export function useBackupHistory(page = 1) {
  return useQuery<{
    data: BackupRecord[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ['backup-history', page],
    queryFn: async () => {
      const res = await fetch(`/api/backup/history?page=${page}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed to load backup history');
      return data;
    },
  });
}

export function useExportBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/backup/export', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error?.message ?? 'Backup export failed');
      }

      // Download the file
      const blob = await res.blob();
      const contentDisposition = res.headers.get('content-disposition');
      const fileName = contentDisposition?.match(/filename="(.+)"/)?.[1] ?? 'bizflow_backup.json';
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backup-history'] }),
  });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/backup/history?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed to delete backup');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backup-history'] }),
  });
}
