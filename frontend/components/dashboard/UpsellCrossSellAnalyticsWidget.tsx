'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Shuffle, Percent, IndianRupee, Trophy, Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { formatINR } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import { UPSELL_PIPELINE, UPSELL_STATUS_META } from '@/components/clients/UpsellCrossSellPipeline';

interface RepBreakdownEntry {
  name: string;
  count: number;
  delivered: number;
  revenue: number;
}

interface MetricsSummary {
  totalUpsells: number;
  totalCrosssells: number;
  upsellConversionRate: number;
  crosssellConversionRate: number;
  revenueFromUpsells: number;
  revenueFromCrosssells: number;
  pipeline: { status: string; count: number }[];
  topAssignedRep: RepBreakdownEntry | null;
  repBreakdown: RepBreakdownEntry[];
}

const FUNNEL_COLORS = [
  'bg-slate-400',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-orange-500',
  'bg-purple-500',
  'bg-green-500',
];

export function UpsellCrossSellAnalyticsWidget() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await authFetch('/api/upsell-crosssell/metrics');
        const payload = await res.json();
        if (!active) return;
        if (payload.success && payload.data) {
          setMetrics(payload.data);
        }
      } catch (err) {
        console.error('Failed to load upsell/cross-sell metrics', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upsell &amp; Cross-Sell Analytics</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  const pipelineCount = (status: string) => metrics.pipeline.find((p) => p.status === status)?.count ?? 0;
  const maxCount = Math.max(...UPSELL_PIPELINE.map((s) => pipelineCount(s)), 1);
  const topRep = metrics.topAssignedRep;

  const statCards = [
    { label: 'Total Upsells', value: metrics.totalUpsells, icon: TrendingUp, iconClass: 'text-amber-500' },
    { label: 'Total Cross-Sells', value: metrics.totalCrosssells, icon: Shuffle, iconClass: 'text-sky-500' },
    { label: 'Upsell Conversion', value: `${metrics.upsellConversionRate}%`, icon: Percent, iconClass: 'text-amber-500' },
    { label: 'Cross-Sell Conversion', value: `${metrics.crosssellConversionRate}%`, icon: Percent, iconClass: 'text-sky-500' },
    { label: 'Upsell Revenue', value: formatINR(metrics.revenueFromUpsells), icon: IndianRupee, iconClass: 'text-amber-500' },
    { label: 'Cross-Sell Revenue', value: formatINR(metrics.revenueFromCrosssells), icon: IndianRupee, iconClass: 'text-sky-500' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Upsell &amp; Cross-Sell Analytics</CardTitle>
          {topRep && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
              <Trophy className="h-4 w-4 text-amber-500" />
              <div className="leading-tight">
                <p className="text-xs font-medium">{topRep.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  Top rep · {topRep.delivered} delivered · {formatINR(topRep.revenue)}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((stat) => (
            <div key={stat.label} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-1.5">
                <stat.icon className={cn('h-3.5 w-3.5', stat.iconClass)} />
                <p className="text-[11px] text-muted-foreground truncate">{stat.label}</p>
              </div>
              <p className="text-lg font-semibold mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Full pipeline funnel */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline Funnel</p>
          {UPSELL_PIPELINE.map((status, idx) => {
            const count = pipelineCount(status);
            const pct = Math.max(4, Math.round((count / maxCount) * 100));
            return (
              <div key={status} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-muted-foreground truncate">
                  {UPSELL_STATUS_META[status]?.label || status}
                </span>
                <div className="h-5 flex-1 rounded-sm bg-muted/50 overflow-hidden">
                  <div
                    className={cn('h-full rounded-sm transition-all', FUNNEL_COLORS[idx] || 'bg-primary')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-medium">{count}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
