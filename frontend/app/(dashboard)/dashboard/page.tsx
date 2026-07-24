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
import {
  Wallet, Briefcase, Camera, FileCheck, AlertCircle, ArrowRight, Plus, TrendingUp, Loader2,
} from 'lucide-react';
import { formatINR, formatDate, titleCase } from '@/lib/formatter';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
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
    { label: 'New Leads', count: leadsByStatus(['New Lead']), color: '#8B949E' },
    { label: 'In Proposal', count: leadsByStatus(['Proposal Sent', 'Proposal Accepted', 'Awaiting Payment']), color: '#D29922' },
    { label: 'In Production', count: leadsByStatus(['Shoot Scheduled', 'Footage Received', 'Payment Confirmed', 'Payment Verified']), color: '#58A6FF' },
    { label: 'In Editing', count: leadsByStatus(['Editing', 'Draft Sent']), color: '#E57C2B' },
    { label: 'Delivered', count: leadsByStatus(['Delivered', 'Closed']), color: '#3FB950' },
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
    .filter((s) => s.shootDate && s.shootDate >= todayStr && s.driveLinkUploaded.toLowerCase() !== 'true')
    .sort((a, b) => a.shootDate.localeCompare(b.shootDate))
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Operational overview of all active productions"
        actions={
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Lead
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard title="Revenue" value={formatINR(totalRevenue)} icon={Wallet} trend={{ value: 'Live', positive: true }} />
        <StatCard title="Active Projects" value={activeProjects} icon={Briefcase} />
        <StatCard title="Today's Shoots" value={todayShootsCount} icon={Camera} />
        <StatCard title="Pending Reviews" value={pendingReviews} icon={FileCheck} />
        <StatCard title="Pending Payments" value={pendingPayments} icon={AlertCircle} />
        <StatCard title="Editors Busy" value={`${busyEditors}/${totalEditors}`} icon={TrendingUp} />
      </div>

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
                      <stop offset="5%" stopColor="#58A6FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#58A6FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
                  <XAxis dataKey="month" stroke="#6E7681" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6E7681" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 100000}L`} />
                  <Tooltip
                    contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '6px', fontSize: '12px' }}
                    labelStyle={{ color: '#F0F6FC' }}
                    formatter={(v: number) => [formatINR(v), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#58A6FF" strokeWidth={2} fill="url(#revGrad)" />
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
    </div>
  );
}
