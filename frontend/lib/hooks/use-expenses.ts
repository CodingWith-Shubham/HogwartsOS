'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/auth-fetch';

export interface Expense {
  _id: string;
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
}

export function useExpenses(filters: ExpenseFilters) {
  const [data, setData] = useState<{ expenses: Expense[]; metrics: { totalExpense: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (filters.startDate) query.append('startDate', filters.startDate);
      if (filters.endDate) query.append('endDate', filters.endDate);
      if (filters.category && filters.category !== 'all') query.append('category', filters.category);

      const response = await authFetch(`/api/expenses?${query.toString()}`);
      const resData = await response.json();
      
      if (!response.ok || !resData.success) {
        throw new Error(resData.message || resData.error || 'Failed to fetch expenses');
      }
      const mappedExpenses = resData.data.expenses.map((exp: any) => ({
        ...exp,
        id: exp._id
      }));

      setData({
        expenses: mappedExpenses,
        metrics: resData.data.metrics
      });
    } catch (err) {
      console.error('Failed fetching expenses:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createExpense = async (expenseData: Partial<Expense>) => {
    const response = await authFetch('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData),
      headers: { 'Content-Type': 'application/json' },
    });
    const resData = await response.json();
    if (!response.ok || !resData.success) {
      throw new Error(resData.message || resData.error || 'Failed to create expense');
    }
    await fetchData();
    return resData.data;
  };

  const updateExpense = async (id: string, expenseData: Partial<Expense>) => {
    const response = await authFetch(`/api/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(expenseData),
      headers: { 'Content-Type': 'application/json' },
    });
    const resData = await response.json();
    if (!response.ok || !resData.success) {
      throw new Error(resData.message || resData.error || 'Failed to update expense');
    }
    await fetchData();
    return resData.data;
  };

  const deleteExpense = async (id: string) => {
    const response = await authFetch(`/api/expenses/${id}`, {
      method: 'DELETE',
    });
    const resData = await response.json();
    if (!response.ok || !resData.success) {
      throw new Error(resData.message || resData.error || 'Failed to delete expense');
    }
    await fetchData();
    return true;
  };

  return {
    data,
    loading,
    error,
    refresh: fetchData,
    createExpense,
    updateExpense,
    deleteExpense,
  };
}
