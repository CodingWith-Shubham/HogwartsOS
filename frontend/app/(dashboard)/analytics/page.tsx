'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatINR, formatPercent } from '@/lib/formatter';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Users, Target, Award, RefreshCw, Video, Layers, IndianRupee } from 'lucide-react';

const tooltipStyle = { background: '#161B22', border: '1px solid #30363D', borderRadius: '6px', fontSize: '12px' };
const labelStyle = { color: '#F0F6FC' };

export default function AnalyticsPage() {
  const { analytics, loading, error, refresh } = useRealtimeData();

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Revenue insights, service distribution, and performance metrics" />
        <Card className="border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-red-400 mb-4 font-medium">Failed to load real-time sheets data: {error}</p>
          <Button onClick={refresh} variant="outline" className="border-red-500/40 hover:bg-red-500/20 gap-2">
            <RefreshCw className="h-4 w-4" /> Retry Connection
          </Button>
        </Card>
      </div>
    );
  }

  if (loading || !analytics) {
    return (
      <div>
        <PageHeader title="Analytics" description="Revenue insights, service distribution, and performance metrics" />
        
        {/* Stat Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse bg-[#161B22]/50 border-[#30363D]">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-muted-foreground/20 rounded" />
                  <div className="h-6 w-24 bg-muted-foreground/30 rounded" />
                </div>
                <div className="h-8 w-8 rounded bg-muted-foreground/20" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Card className="animate-pulse bg-[#161B22]/50 border-[#30363D]">
            <CardHeader><div className="h-4 w-32 bg-muted-foreground/20 rounded" /></CardHeader>
            <CardContent><div className="h-[280px] bg-muted-foreground/10 rounded flex items-center justify-center text-xs text-muted-foreground">Loading Revenue Chart...</div></CardContent>
          </Card>
          <Card className="animate-pulse bg-[#161B22]/50 border-[#30363D]">
            <CardHeader><div className="h-4 w-32 bg-muted-foreground/20 rounded" /></CardHeader>
            <CardContent><div className="h-[280px] bg-muted-foreground/10 rounded flex items-center justify-center text-xs text-muted-foreground">Loading Service Distribution...</div></CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const {
    totalRevenue,
    totalProjects,
    avgProject,
    conversionRate,
    REVENUE_DATA,
    SERVICE_DISTRIBUTION,
    STATUS_DISTRIBUTION,
    SALES_TREND,
    EDITORS,
    salesMetrics,
    shootMetrics,
    editingMetrics,
  } = analytics;

  const topEditor = EDITORS.length > 0 ? [...EDITORS].sort((a, b) => b.completedProjects - a.completedProjects)[0] : null;

  // Shoot overview chart data
  const shootChartData = shootMetrics
    ? [
        { category: 'Today', count: shootMetrics.shootsToday, fill: '#58A6FF' },
        { category: 'Upcoming', count: shootMetrics.shootsFuture, fill: '#3FB950' },
        { category: 'Completed', count: shootMetrics.shootsPast, fill: '#6E7681' },
      ]
    : [];

  // Editing pipeline chart data
  const editingPipelineData = editingMetrics
    ? [
        { status: 'Total', count: editingMetrics.total, fill: '#8B949E' },
        { status: 'Not Started', count: editingMetrics.notStarted, fill: '#D29922' },
        { status: 'In Progress', count: editingMetrics.inProgress, fill: '#58A6FF' },
        { status: 'For Review', count: editingMetrics.sharedForReview, fill: '#A371F7' },
        { status: 'Delivered', count: editingMetrics.delivered, fill: '#3FB950' },
        { status: 'Out of TAT', count: editingMetrics.outOfTAT, fill: '#F85149' },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Analytics" description="Revenue insights, service distribution, and performance metrics" />

      {/* ── Top-level stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Total Revenue" value={formatINR(totalRevenue)} icon={TrendingUp} trend={{ value: '14.2%', positive: true }} />
        <StatCard title="Total Projects" value={totalProjects} icon={Target} trend={{ value: '9.1%', positive: true }} />
        <StatCard title="Avg Project Value" value={formatINR(avgProject)} icon={Users} />
        <StatCard title="Conversion Rate" value={formatPercent(conversionRate)} icon={Award} />
      </div>

      {/* ── Revenue & Service Distribution ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={REVENUE_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3FB950" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3FB950" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
                  <XAxis dataKey="month" stroke="#6E7681" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6E7681" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 100000}L`} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} formatter={(v: number) => [formatINR(v), 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#3FB950" strokeWidth={2} fill="url(#rev2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Service Distribution (by Lead Count)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={SERVICE_DISTRIBUTION} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {SERVICE_DISTRIBUTION.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="#161B22" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} formatter={(v: number, n: string) => [`${v}`, n]} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#8B949E' }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Sales Funnel & Status Distribution ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Sales Funnel</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SALES_TREND} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
                  <XAxis dataKey="month" stroke="#6E7681" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6E7681" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} iconType="circle" />
                  <Bar dataKey="leads" fill="#8B949E" radius={[3, 3, 0, 0]} name="Leads" />
                  <Bar dataKey="converted" fill="#3FB950" radius={[3, 3, 0, 0]} name="Converted" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Project Status Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={STATUS_DISTRIBUTION} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={2}>
                    {STATUS_DISTRIBUTION.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="#161B22" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} formatter={(v: number, n: string) => [v, n]} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Editor Performance (existing + enhanced) ─────────────────────── */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Editor Performance</CardTitle></CardHeader>
        <CardContent>
          {editingMetrics && editingMetrics.tasksPerEditor.length > 0 ? (
            /* Enhanced table when EditingTasks data is available */
            <div>
              <div className="grid grid-cols-6 text-xs text-muted-foreground pb-2 border-b border-border font-medium">
                <span className="col-span-2">Editor</span>
                <span className="text-center">Assigned</span>
                <span className="text-center">In Progress</span>
                <span className="text-center">Delivered</span>
                <span className="text-center">Out of TAT</span>
              </div>
              <div className="space-y-1 mt-2">
                {[...editingMetrics.tasksPerEditor]
                  .sort((a, b) => b.delivered - a.delivered)
                  .map((e) => (
                    <div key={e.editor_email || e.editor_name} className="grid grid-cols-6 text-xs py-1.5 items-center hover:bg-secondary/30 rounded px-1 transition-colors">
                      <div className="col-span-2 flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-medium shrink-0">
                          {e.editor_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium truncate">{e.editor_name}</span>
                      </div>
                      <span className="text-center tabular-nums text-[#D29922]">{e.assigned}</span>
                      <span className="text-center tabular-nums text-[#58A6FF]">{e.inProgress}</span>
                      <span className="text-center tabular-nums text-[#3FB950]">{e.delivered}</span>
                      <span className={`text-center tabular-nums ${e.outOfTAT > 0 ? 'text-[#F85149] font-semibold' : 'text-muted-foreground'}`}>
                        {e.outOfTAT}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* Fallback to old display when EditingTasks not available */
            <div className="space-y-3">
              {[...EDITORS].sort((a, b) => b.completedProjects - a.completedProjects).map((e, i) => (
                <div key={e.id} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground tabular-nums w-4">{i + 1}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary border border-border text-xs font-medium">{e.initials}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{e.completedProjects} completed · {e.activeProjects} active</p>
                  </div>
                  <div className="w-32 h-2 rounded-full bg-secondary overflow-hidden hidden sm:block">
                    <div className="h-full rounded-full bg-[#3FB950]" style={{ width: `${(e.completedProjects / (topEditor?.completedProjects || 1)) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium tabular-nums w-8 text-right">{e.completedProjects}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════
          NEW CHARTS
          ════════════════════════════════════════════════════════════════════ */}

      {/* ── Shoot Overview BarChart ──────────────────────────────────────── */}
      {shootMetrics && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4 text-[#58A6FF]" />
              Shoot Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-[#58A6FF]/10 border border-[#58A6FF]/30">
                <p className="text-2xl font-bold tabular-nums text-[#58A6FF]">{shootMetrics.shootsToday}</p>
                <p className="text-xs text-muted-foreground mt-1">Today</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-[#3FB950]/10 border border-[#3FB950]/30">
                <p className="text-2xl font-bold tabular-nums text-[#3FB950]">{shootMetrics.shootsFuture}</p>
                <p className="text-xs text-muted-foreground mt-1">Upcoming</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/50 border border-border">
                <p className="text-2xl font-bold tabular-nums">{shootMetrics.shootsPast}</p>
                <p className="text-xs text-muted-foreground mt-1">Completed</p>
              </div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shootChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
                  <XAxis dataKey="category" stroke="#6E7681" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6E7681" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} formatter={(v: number) => [v, 'Shoots']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {shootChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Extra Hours (Month)</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">{shootMetrics.shootExtraHoursSummary}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Extra Equipment Used</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">{shootMetrics.shootExtraEquipment} shoots</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Record Time</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">{shootMetrics.avgRecordTime}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Studio Time</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">{shootMetrics.avgStudioTime}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Service Distribution by Client Count PieChart ───────────────── */}
      {salesMetrics && salesMetrics.serviceWiseClients.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-[#3FB950]" />
              Service Distribution by Client Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesMetrics.serviceWiseClients}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {salesMetrics.serviceWiseClients.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.color} stroke="#161B22" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} formatter={(v: number, n: string) => [`${v} clients`, n]} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#8B949E' }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {[...salesMetrics.serviceWiseClients]
                  .sort((a: any, b: any) => b.count - a.count)
                  .map((s: any) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-sm text-muted-foreground">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden hidden sm:block">
                          <div
                            className="h-full rounded-full"
                            style={{
                              background: s.color,
                              width: `${(s.count / Math.max(...salesMetrics.serviceWiseClients.map((x: any) => x.count))) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold tabular-nums w-6 text-right">{s.count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Editing Pipeline BarChart ────────────────────────────────────── */}
      {editingMetrics && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#E57C2B]" />
              Editing Pipeline Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={editingPipelineData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262D" horizontal={false} />
                  <XAxis type="number" stroke="#6E7681" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="status" stroke="#6E7681" fontSize={11} tickLine={false} axisLine={false} width={80} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} formatter={(v: number) => [v, 'Tasks']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {editingPipelineData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Summary stats row */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 pt-4 border-t border-border">
              {editingPipelineData.map((item) => (
                <div key={item.status} className="text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: item.fill }}>{item.count}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{item.status}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
