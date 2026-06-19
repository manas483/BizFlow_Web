import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useNotifications(category?: string) {
  return useQuery({
    queryKey: ["notifications", category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.set('category', category);
      const res = await fetch(`/api/notifications${params.toString() ? '?' + params.toString() : ''}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

export function useNotificationCount() {
  return useQuery<{ count: number }>({
    queryKey: ["notifications", "count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/count");
      if (!res.ok) throw new Error("Failed to fetch count");
      return res.json();
    },
    refetchInterval: 15_000, // Poll every 15s for badge updates
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      const res = await fetch("/api/notifications/count", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark notifications as read");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete notification");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

