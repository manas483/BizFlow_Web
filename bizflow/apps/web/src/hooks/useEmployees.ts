import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useEmployees(search?: string, department?: string, page = 1, limit = 25) {
  return useQuery({
    queryKey: ["employees", search, department, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (department && department !== "All") params.append("department", department);
      params.append("page", String(page));
      params.append("limit", String(limit));
      const res = await fetch(`/api/employees?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json() as Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }>;
    },
    refetchInterval: 30_000, // reduced from 5s — dynamic attendance computed server-side
  });
}


export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create employee");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update employee");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete employee");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useEmployeeAttendance(employeeId: string) {
  return useQuery({
    queryKey: ["attendance", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const res = await fetch(`/api/employees/${employeeId}/attendance`);
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
    enabled: !!employeeId,
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, date, status, note }: { employeeId: string; date: string; status: string; note?: string }) => {
      const res = await fetch(`/api/employees/${employeeId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, status, note })
      });
      if (!res.ok) throw new Error("Failed to mark attendance");
      return res.json();
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["attendance", variables.employeeId] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

export function useResendInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const res = await fetch(`/api/employees/${employeeId}/resend-invitation`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to resend invitation");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useSuspendEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const res = await fetch(`/api/employees/${employeeId}/suspend`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update employee status");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}
