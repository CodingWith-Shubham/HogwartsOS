'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/auth-fetch';

export interface FinanceFilters {
  startDate?: string;
  endDate?: string;
  clientId?: string;
  salesperson?: string;
  serviceType?: string;
  paymentStatus?: string;
}

export interface FinanceData {
  metrics: {
    totalCollected: number;
    pendingAmount: number;
    overdueAmount: number;
    totalInvoicesCount: number;
  };
  breakdowns: {
    revenueByService: { name: string; value: number }[];
    revenueByClient: { name: string; value: number }[];
    revenueBySalesperson: { name: string; value: number }[];
    upsellVsNewSale: { name: string; value: number }[];
    aging: { name: string; value: number }[];
  };
  invoices: any[];
}

export function useFinance(filters: FinanceFilters) {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (filters.startDate) query.append('startDate', filters.startDate);
      if (filters.endDate) query.append('endDate', filters.endDate);
      if (filters.clientId) query.append('clientId', filters.clientId);
      if (filters.salesperson && filters.salesperson !== 'all') query.append('salesperson', filters.salesperson);
      if (filters.serviceType && filters.serviceType !== 'all') query.append('serviceType', filters.serviceType);
      if (filters.paymentStatus && filters.paymentStatus !== 'all') query.append('paymentStatus', filters.paymentStatus);

      // Using the proxy setup in frontend/app/api/finance/dashboard/route.ts
      // Or we can create a Next.js route that proxies to backend.
      // Wait, let's create frontend/app/api/finance/dashboard/route.ts that fetches from backend/api/v1/finance/dashboard
      const response = await authFetch(`/api/finance/dashboard?${query.toString()}`);
      const resData = await response.json();
      
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to fetch finance data');
      }
      
      setData(resData.data);
    } catch (err) {
      console.error('Failed fetching finance data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh: fetchData,
  };
}
