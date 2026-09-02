'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { LeadStatusBadge } from '@/components/shared/Badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardShimmer } from '@/components/shared/ShimmerLoader';
import { Loader2, Plus, Wallet, FileText, CheckCircle, Clock, Video, FileAudio, Users, Briefcase, Handshake, MonitorPlay, Camera, FileCheck, AlertCircle, ArrowRight, TrendingUp, IndianRupee, Zap, Timer, Layers } from 'lucide-react';
import { CorrectionsVsRevisionsWidget } from '@/components/dashboard/CorrectionsVsRevisionsWidget';
import { UpsellMetricsWidget } from '@/components/dashboard/UpsellMetricsWidget';
import { formatINR, formatDate, titleCase } from '@/lib/formatter';
import { useAuth } from '@/lib/auth-context';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function isTrue(value: unknown) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [realtimeData, setRealtimeData] = useState<any>(null);
  const [shoots, setShoots] = useState<any[]>([]);
  const [editing, setEditing] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const [realtimeRes, shootsRes, editingRes, clientsRes] = await Promise.all([
          fetch('/api/realtime-data', { cache: 'no-store' }),
          fetch('/api/shoots', { cache: 'no-store' }),
          fetch('/api/editing', { cache: 'no-store' }),
          fetch('/api/clients', { cache: 'no-store' }),
        ]);

        const [realtimeJson, shootsJson, editingJson, clientsJson] = await Promise.all([
          realtimeRes.json(),
          shootsRes.json(),
          editingRes.json(),
          clientsRes.json(),
        ]);

        if (!mounted) return;

        if (realtimeRes.ok) setRealtimeData(realtimeJson);
        if (shootsRes.ok) setShoots(shootsJson.shoots ?? []);
        if (editingRes.ok) setEditing(editingJson.editing ?? []);
        if (clientsRes.ok) setLeads(clientsJson.leads ?? []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    }
    fetchData();

    const interval = setInterval(fetchData, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return <DashboardShimmer />;
  }

  // 1. Stats calculations
  const totalRevenue = realtimeData?.analytics?.totalRevenue ?? 0;
  const activeProjects = leads.filter((l) => l.proposalAccepted && !['closed', 'delivered'].includes((l.status || '').toLowerCase())).length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayShootsCount = shoots.filter((s) => s.shootDate === todayStr).length;
  const pendingReviews = editing.filter((e) => e.status === 'Draft Ready').length;
  const pendingPayments = realtimeData?.invoices?.filter((i: any) => ['unpaid', 'partial', 'overdue'].includes(i.status)).length ?? 0;
  const busyEditors = realtimeData?.analytics?.EDITORS?.filter((e: any) => e.status === 'busy').length ?? 0;
  const totalEditors = realtimeData?.analytics?.EDITORS?.length ?? 0;

  // 2. Charts & distributions
  const revenueData = realtimeData?.analytics?.REVENUE_DATA ?? [];

  const leadsByStatus = (statusList: string[]) => {
    return leads.filter((l) => statusList.some(s => (l.status || '').trim().toLowerCase() === s.toLowerCase())).length;
  };

  const pipelineStages = [
    { label: 'New Leads', count: leadsByStatus(['New Lead']), color: 'hsl(var(--muted-foreground))' },
    { label: 'In Proposal', count: leadsByStatus(['Proposal Sent', 'Proposal Accepted', 'Awaiting Payment']), color: 'hsl(var(--theme-warning))' },
    { label: 'In Production', count: leadsByStatus(['Shoot Scheduled', 'Footage Received', 'Payment Confirmed', 'Payment Verified']), color: 'hsl(var(--theme-accent))' },
    { label: 'In Editing', count: leadsByStatus(['Editing', 'Draft Sent']), color: 'hsl(var(--chart-4))' },
    { label: 'Delivered', count: leadsByStatus(['Delivered', 'Closed']), color: 'hsl(var(--success))' },
  ];

  // 3. Recent Projects (leads where proposalAccepted === true)
  const recentProjects = leads
    .filter((l) => l.proposalAccepted)
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA || b.leadId.localeCompare(a.leadId);
    })
    .slice(0, 5);

  // 4. Upcoming Shoots
  const upcomingShoots = shoots
    .filter((s) => s.shootDate && s.shootDate >= todayStr && !isTrue(s.driveLinkUploaded))
    .sort((a, b) => {
      const cmp = a.shootDate.localeCompare(b.shootDate);
      return cmp !== 0 ? cmp : (a.shootStartTime || '').localeCompare(b.shootStartTime || '');
    })
    .slice(0, 4);

  // 5. New metric groups from realtime-data
  const salesMetrics = realtimeData?.analytics?.salesMetrics;
  const shootMetrics = realtimeData?.analytics?.shootMetrics;
  const editingMetrics = realtimeData?.analytics?.editingMetrics;

  const editingPipeline = editingMetrics
    ? [
        { label: 'Not Started', value: editingMetrics.notStarted, color: 'hsl(var(--muted-foreground))', bg: 'hsl(var(--muted-foreground) / 0.15)' },
        { label: 'In Progress', value: editingMetrics.inProgress, color: 'hsl(var(--theme-accent))', bg: 'hsl(var(--theme-accent) / 0.15)' },
        { label: 'For Review', value: editingMetrics.sharedForReview, color: 'hsl(var(--chart-5))', bg: 'hsl(var(--chart-5) / 0.15)' },
        { label: 'Delivered', value: editingMetrics.delivered, color: 'hsl(var(--success))', bg: 'hsl(var(--success) / 0.15)' },
        { label: 'Out of TAT', value: editingMetrics.outOfTAT, color: 'hsl(var(--danger))', bg: 'hsl(var(--danger) / 0.15)' },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Operational overview of all active productions"
      />

      {/* ── Top-level stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard title="Revenue" value={formatINR(totalRevenue)} icon={Wallet} trend={{ value: 'Live', positive: true }} />
        <StatCard title="Active Projects" value={activeProjects} icon={Briefcase} />
        <StatCard title="Today's Shoots" value={todayShootsCount} icon={Camera} />
        <StatCard title="Pending Reviews" value={pendingReviews} icon={FileCheck} />
        <StatCard title="Ready for Review" value={editingMetrics ? editingMetrics.sharedForReview : 0} icon={FileText} trend={{ value: '-2%', positive: false }} />
        <StatCard title="Active Editors" value={editingMetrics ? editingMetrics.activeEditors : 0} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <CorrectionsVsRevisionsWidget />
      </div>

      {/* ── Upsell Metrics (Manager/Admin Only) ─────────────────────────── */}
      {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin') && (
        <div className="mb-6">
          <UpsellMetricsWidget />
        </div>
      )}

      {/* ── Revenue chart + Pipeline ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Revenue Trend</CardTitle>
            <Link href="/analytics" className="text-xs text-muted-foreground hover:text-foreground">
              View analytics →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--theme-accent))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--theme-accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 100000}L`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(v: number) => [formatINR(v), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--theme-accent))" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Project Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {pipelineStages.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                </div>
                <span className="text-sm font-medium tabular-nums">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Projects ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent Projects</CardTitle>
            <Link href="/manager" className="text-xs text-muted-foreground hover:text-foreground">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No active projects found.</p>
            ) : (
              recentProjects.map((p, index) => (
                <Link
                  key={p.leadId}
                  href={`/manager`}
                  className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary border border-border text-xs font-medium shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.servicePitched}</p>
                  </div>
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-medium tabular-nums">{p.cost ? formatINR(parseFloat(p.cost) || 0) : '—'}</p>
                    <p className="text-xs text-muted-foreground">{p.assignedTo}</p>
                  </div>
                  <LeadStatusBadge status={p.status} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Upcoming Shoots ──────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upcoming Shoots</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingShoots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No upcoming shoots scheduled.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {upcomingShoots.map((p) => (
                <div key={p.id} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatDate(p.shootDate)}</span>
                    <Badge variant="outline">{p.shootStartTime || 'TBD'}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate">{p.clientName}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.shootMemberName || 'No crew assigned'}</p>
                  </div>
                  {(p.camera || p.teleprompter) && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Camera className="h-3 w-3" />
                      <span className="truncate">{[p.camera, p.teleprompter].filter(Boolean).join(' · ')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════
          NEW SECTIONS BELOW
          ════════════════════════════════════════════════════════════════════ */}

      {/* ── Sales Metrics Section ────────────────────────────────────────── */}
      {salesMetrics && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-success" />
            Sales Overview
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            {/* Total Collection Value */}
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Collected</p>
                <p className="text-xl font-bold tabular-nums text-success">
                  {formatINR(salesMetrics.totalCollectionValue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Verified payments</p>
              </CardContent>
            </Card>
            {/* Total Pending Amount */}
            <Card className="border-theme-warning/30 bg-theme-warning/5">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Pending Amount</p>
                <p className="text-xl font-bold tabular-nums text-theme-warning">
                  {formatINR(salesMetrics.totalPendingAmount)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Remaining balance</p>
              </CardContent>
            </Card>
            {/* New Clients This Month */}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">New Clients (Month)</p>
                <p className="text-xl font-bold tabular-nums">{salesMetrics.newClientsAdded}</p>
                <p className="text-xs text-muted-foreground mt-1">Proposals accepted</p>
              </CardContent>
            </Card>
            {/* Total Sales Value */}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Sales Value</p>
                <p className="text-xl font-bold tabular-nums">{formatINR(salesMetrics.totalSalesValue)}</p>
                <p className="text-xs text-muted-foreground mt-1">All converted clients</p>
              </CardContent>
            </Card>
          </div>

          {/* Service-wise client breakdown pills */}
          {salesMetrics.serviceWiseClients.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-3 font-medium">Clients by Service</p>
                <div className="flex flex-wrap gap-2">
                  {salesMetrics.serviceWiseClients
                    .sort((a: any, b: any) => b.count - a.count)
                    .map((s: any) => (
                      <span
                        key={s.name}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border"
                        style={{
                          background: s.color + '20',
                          borderColor: s.color + '50',
                          color: s.color,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: s.color }}
                        />
                        {s.name}: {s.count}
                      </span>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Shoot Metrics Section ─────────────────────────────────────────── */}
      {shootMetrics && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Video className="h-4 w-4 text-theme-accent" />
            Shoot Overview
          </h2>

          {/* Today / Future / Past */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Card className="border-theme-accent/30 bg-theme-accent/5">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Today</p>
                <p className="text-3xl font-bold tabular-nums text-theme-accent">{shootMetrics.shootsToday}</p>
                <p className="text-xs text-muted-foreground mt-1">shoots scheduled</p>
              </CardContent>
            </Card>
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Upcoming</p>
                <p className="text-3xl font-bold tabular-nums text-success">{shootMetrics.shootsFuture}</p>
                <p className="text-xs text-muted-foreground mt-1">future shoots</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Completed</p>
                <p className="text-3xl font-bold tabular-nums">{shootMetrics.shootsPast}</p>
                <p className="text-xs text-muted-foreground mt-1">past shoots</p>
              </CardContent>
            </Card>
          </div>

          {/* Extra hours / equipment + Avg times */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="h-3.5 w-3.5 text-[hsl(var(--chart-4))]" />
                  <p className="text-xs text-muted-foreground">Extra Hours (Month)</p>
                </div>
                <p className="text-lg font-bold tabular-nums">{shootMetrics.shootExtraHoursSummary}h</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-3.5 w-3.5 text-[hsl(var(--chart-5))]" />
                  <p className="text-xs text-muted-foreground">Extra Equipment (Month)</p>
                </div>
                <p className="text-lg font-bold tabular-nums">{shootMetrics.shootExtraEquipment} shoots</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-3.5 w-3.5 text-theme-accent" />
                  <p className="text-xs text-muted-foreground">Avg Record Time</p>
                </div>
                <p className="text-lg font-bold tabular-nums">{shootMetrics.avgRecordTime}h</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-3.5 w-3.5 text-success" />
                  <p className="text-xs text-muted-foreground">Avg Studio Time</p>
                </div>
                <p className="text-lg font-bold tabular-nums">{shootMetrics.avgStudioTime}h</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Editing Metrics Section ──────────────────────────────────────── */}
      {editingMetrics && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-[hsl(var(--chart-4))]" />
            Editing Pipeline
          </h2>

          {/* 5-column pipeline bar */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {editingPipeline.map((bucket) => (
              <Card
                key={bucket.label}
                className="text-center"
                style={{ borderColor: bucket.color + '40', background: bucket.bg }}
              >
                <CardContent className="p-3">
                  <p className="text-2xl font-bold tabular-nums" style={{ color: bucket.color }}>
                    {bucket.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{bucket.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Load Capacity Table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-theme-accent" />
                  Editor Load Capacity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {editingMetrics.loadCapacity.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">No editor data available.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 text-xs text-muted-foreground pb-1 border-b border-border">
                      <span>Editor</span>
                      <span className="text-center">Active</span>
                      <span className="text-center">Delivered</span>
                      <span className="text-center">Out of TAT</span>
                    </div>
                    {editingMetrics.tasksPerEditor
                      .sort((a: any, b: any) => (b.assigned + b.inProgress) - (a.assigned + a.inProgress))
                      .map((e: any) => (
                        <div key={e.editor_email || e.editor_name} className="grid grid-cols-4 text-xs py-1 items-center">
                          <span className="font-medium truncate pr-2">{e.editor_name}</span>
                          <span className="text-center tabular-nums font-semibold text-theme-accent">
                            {e.assigned + e.inProgress}
                          </span>
                          <span className="text-center tabular-nums text-success">{e.delivered}</span>
                          <span className={`text-center tabular-nums ${e.outOfTAT > 0 ? 'text-danger font-semibold' : 'text-muted-foreground'}`}>
                            {e.outOfTAT}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Aging List — Top 10 oldest non-delivered */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-theme-warning" />
                  Aging Tasks (Non-Delivered)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {editingMetrics.aging.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">All tasks delivered! 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {editingMetrics.aging.slice(0, 10).map((t: any) => (
                      <div key={t.task_id} className="flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{t.client_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{t.task_label} · {t.assigned_to_name}</p>
                        </div>
                        <span
                          className={`shrink-0 text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${
                            t.days > 7
                              ? 'bg-danger/15 text-danger'
                              : t.days > 3
                              ? 'bg-theme-warning/15 text-theme-warning'
                              : 'bg-muted/15 text-[hsl(var(--muted-foreground))]'
                          }`}
                        >
                          {t.days}d
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
