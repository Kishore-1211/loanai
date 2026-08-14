'use client';
import { useAuthStore } from '@/lib/auth';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const isOwner = useAuthStore((s) => s.isOwner);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  return { user, accessToken, setAuth, clearAuth, isOwner, hasPermission };
}
