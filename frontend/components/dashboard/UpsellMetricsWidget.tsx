'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { formatINR } from '@/lib/formatter';
import { authFetch } from '@/lib/auth-fetch';
import { Loader2 } from 'lucide-react';

interface MonthlyBreakdown {
  month: string;
  leads: number;
  upsells: number;
}

interface UpsellMetrics {
  totalLeads: number;
  totalUpsells: number;
  upsellPercentage: number;
  upsellConversionRate: number;
  revenueFromLeads: number;
  revenueFromUpsells: number;
  upsellRevenuePercentage: number;
  monthlyBreakdown: MonthlyBreakdown[];
}

export function UpsellMetricsWidget() {
  const [metrics, setMetrics] = useState<UpsellMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await authFetch('/api/v1/analytics/upsell-metrics');
        if (response.ok) {
          const data = await response.json();
          setMetrics(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch upsell metrics:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <Card className="w-full h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upsell Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Total Upsells</span>
            <span className="text-2xl font-bold">{metrics.totalUpsells}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Upsell %</span>
            <span className="text-2xl font-bold">{metrics.upsellPercentage}%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Upsell Revenue</span>
            <span className="text-2xl font-bold">{formatINR(metrics.revenueFromUpsells)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Rev % of Total</span>
            <span className="text-2xl font-bold">{metrics.upsellRevenuePercentage}%</span>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.monthlyBreakdown}>
              <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                cursor={{ fill: 'hsl(var(--muted))' }}
              />
              <Legend />
              <Bar dataKey="leads" name="New Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="upsells" name="Upsells" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
