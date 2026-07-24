'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Invoice } from '@/lib/types';

export interface RealtimeAnalytics {
  totalRevenue: number;
  totalProjects: number;
  avgProject: number;
  conversionRate: number;
  REVENUE_DATA: Array<{ month: string; revenue: number; projects: number }>;
  SERVICE_DISTRIBUTION: Array<{ name: string; value: number; color: string }>;
  STATUS_DISTRIBUTION: Array<{ name: string; value: number; color: string }>;
  SALES_TREND: Array<{ month: string; leads: number; converted: number }>;
  EDITORS: Array<{
    id: string;
    name: string;
    initials: string;
    email: string;
    status: 'available' | 'busy' | 'offline';
    activeProjects: number;
    completedProjects: number;
    specialization: string[];
  }>;
}

export function useRealtimeData() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [analytics, setAnalytics] = useState<RealtimeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/realtime-data');
      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to fetch realtime data');
      }
      setInvoices(resData.invoices || []);
      setAnalytics(resData.analytics || null);
    } catch (err) {
      console.error('Failed fetching realtime data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    invoices,
    analytics,
    loading,
    error,
    refresh: fetchData,
  };
}
