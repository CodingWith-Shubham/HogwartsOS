'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { AuthContextValue, User } from './types';
import { SESSION_KEY } from './auth';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users || []);
      }
    } catch (e) {
      console.warn('Failed to fetch dynamic users list:', e);
    }
  }, []);

  const initAuth = useCallback(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }
    try {
      const session = window.localStorage.getItem(SESSION_KEY);
      if (session) {
        const parsedUser = JSON.parse(session);
        setUser(parsedUser);
        fetchUsers();
      }
    } catch (e) {
      console.warn('Failed to parse auth session:', e);
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
      const res = await fetch('/api/auth/login', {
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
      }
      setUser(authed);
      
      // Fetch users list right after login
      try {
        const usersRes = await fetch('/api/users');
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
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Failed to perform server logout:', e);
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_KEY);
    }
    setUser(null);
    setUsers([]);
    toast.info('Session Ended', { description: 'Logged out successfully' });
  }, []);

  const updateProfile = useCallback(async (data: { email: string; username: string; password?: string }) => {
    try {
      const res = await fetch('/api/auth/update-profile', {
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
