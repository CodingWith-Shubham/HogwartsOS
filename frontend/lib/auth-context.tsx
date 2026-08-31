'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { AuthContextValue, User } from './types';
import { SESSION_KEY, TOKEN_KEY } from './auth';
import { authFetch } from './auth-fetch';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await authFetch('/api/users');
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users || []);
      }
    } catch (e) {
      console.warn('Failed to fetch dynamic users list:', e);
    }
  }, []);

  const initAuth = useCallback(async () => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }
    try {
      const session = window.localStorage.getItem(SESSION_KEY);
      if (!session) {
        setIsLoading(false);
        return;
      }
      // We have a stored session — verify it's still valid with the backend
      const res = await authFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          // Refresh the stored session with the latest user data from server
          window.localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
          setUser(data.user);
          fetchUsers();
        } else {
          // Server responded but session is invalid — clear and go to login
          window.localStorage.removeItem(SESSION_KEY);
          window.localStorage.removeItem(TOKEN_KEY);
        }
      } else {
        // authFetch already tried to refresh the token automatically.
        // If we still get a non-ok response, the session is truly dead.
        window.localStorage.removeItem(SESSION_KEY);
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      console.warn('Failed to verify auth session with backend:', e);
      // On network error, fall back to the stored session so offline use still works
      try {
        const session = window.localStorage.getItem(SESSION_KEY);
        if (session) setUser(JSON.parse(session));
      } catch (_) {}
    } finally {
      setIsLoading(false);
    }
  }, [fetchUsers]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = useCallback(async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setIsLoading(false);
        toast.error('Authentication Failed', {
          description: data.error || 'Invalid email or password',
        });
        return false;
      }

      const authed: User = data.user;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(authed));
        if (data.token) {
          window.localStorage.setItem(TOKEN_KEY, data.token);
        }
      }
      setUser(authed);
      
      // Fetch users list right after login
      try {
        const usersRes = await authFetch('/api/users');
        const usersData = await usersRes.json();
        if (usersRes.ok && usersData.success) {
          setUsers(usersData.users || []);
        }
      } catch (e) {
        console.warn('Failed to fetch dynamic users list after login:', e);
      }

      setIsLoading(false);
      toast.success('Access Granted', {
        description: `Logged in as ${authed.name} (${authed.designation || authed.role})`,
      });
      return true;
    } catch (error) {
      setIsLoading(false);
      toast.error('Authentication Failed', {
        description: 'Failed to connect to the authentication server',
      });
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Failed to perform server logout:', e);
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
    }
    setUser(null);
    setUsers([]);
    toast.info('Session Ended', { description: 'Logged out successfully' });
  }, []);

  const updateProfile = useCallback(async (data: { email: string; username: string; password?: string }) => {
    try {
      const res = await authFetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        const updated: User = resData.user;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
        }
        setUser(updated);
        toast.success('Profile Updated', { description: 'Your profile has been successfully updated.' });
        fetchUsers(); // Refresh dynamic list
        return true;
      } else {
        toast.error('Update Failed', { description: resData.error || 'Failed to update profile' });
        return false;
      }
    } catch (e) {
      toast.error('Update Failed', { description: 'Failed to connect to the authentication server' });
      return false;
    }
  }, [fetchUsers]);

  return (
    <AuthContext.Provider value={{ user, users, isLoading, login, logout, initAuth, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
