'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export function CorrectionsVsRevisionsWidget() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!['manager', 'admin', 'super_admin'].includes(user?.role ?? '')) return;

    const fetchData = async () => {
      try {
        const res = await fetch('/api/dashboard/corrections-vs-revisions');
        const json = await res.json();
        if (res.ok && json.data) {
          setData(json.data);
        }
      } catch (error) {
        console.error('Failed to fetch corrections vs revisions data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (!['manager', 'admin', 'super_admin'].includes(user?.role ?? '')) return null;

  return (
    <Card className="col-span-1 lg:col-span-3 mb-6">
      <CardHeader>
        <CardTitle>Corrections vs Revisions — by Project</CardTitle>
        <CardDescription>
          Tracking internal corrections (Manager → Editor) vs external revisions (Client requests)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] w-full animate-pulse bg-muted/50 rounded-md" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No data available.</p>
        ) : (
          <div className="space-y-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.slice(0, 15)} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="projectName" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
                  />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '8px' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="correctionCount" name="Internal Corrections" fill="hsl(var(--theme-warning))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revisionCount" name="Client Revisions" fill="hsl(var(--theme-accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-md">Project</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Editor</th>
                    <th className="px-4 py-3 text-center">Corrections</th>
                    <th className="px-4 py-3 text-center">Revisions</th>
                    <th className="px-4 py-3 text-center rounded-tr-md">Open Corrections</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.projectId} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{row.projectName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.clientName}</td>
                      <td className="px-4 py-3">{row.editorName || '-'}</td>
                      <td className="px-4 py-3 text-center tabular-nums font-medium text-theme-warning">{row.correctionCount}</td>
                      <td className="px-4 py-3 text-center tabular-nums font-medium text-theme-accent">{row.revisionCount}</td>
                      <td className="px-4 py-3 text-center">
                        {row.openCorrections > 0 ? (
                          <Badge variant="outline" className="bg-theme-warning/10 text-theme-warning border-theme-warning/30">
                            {row.openCorrections} Open
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
