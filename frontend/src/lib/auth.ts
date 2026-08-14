import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'OWNER' | 'STAFF';
  permissions: string[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  isOwner: () => boolean;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      setAuth: (user, token) => {
        localStorage.setItem('accessToken', token);
        set({ user, accessToken: token });
      },
      clearAuth: () => {
        localStorage.removeItem('accessToken');
        set({ user: null, accessToken: null });
      },
      isOwner: () => get().user?.role === 'OWNER',
      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        if (user.role === 'OWNER') return true;
        return user.permissions.includes(permission);
      },
    }),
    { name: 'goldloan-auth', partialize: (state) => ({ user: state.user }) }
  )
);
