import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useSetup2FA() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed to start 2FA setup');
      return data.data as { qrCode: string; manualKey: string; backupCodes: string[] };
    },
  });
}

export function useVerify2FA() {
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Verification failed');
      return data;
    },
  });
}

export function useDisable2FA() {
  return useMutation({
    mutationFn: async (payload: { password: string; token?: string; backupCode?: string }) => {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed to disable 2FA');
      return data;
    },
  });
}

export function useVerify2FALogin() {
  return useMutation({
    mutationFn: async (payload: { userId: string; token?: string; backupCode?: string }) => {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Verification failed');
      return data.data as { verified: boolean; userId: string };
    },
  });
}
