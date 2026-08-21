'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { Scissors, Clock, CheckCircle, RefreshCcw, AlertTriangle, Download } from 'lucide-react';
import { TableShimmer } from '@/components/shared/ShimmerLoader';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type EditingTask = {
  task_id: string;
  status: string;
  task_label: string;
  client_name: string;
  service_type: string;
  assigned_to_email: string;
  assigned_to_name: string;
  revision_count?: string;
  correction_count?: string;
  pending_feedback_count?: number;
};

const statusClass: Record<string, string> = {
  Assigned: 'border-blue-500/40 bg-blue-500/15 text-blue-600',
  'In Progress': 'border-yellow-500/40 bg-yellow-500/15 text-yellow-600',
  'Draft Sent': 'border-purple-500/40 bg-purple-500/15 text-purple-600',
  'Correction Requested': 'border-red-500/40 bg-red-500/15 text-red-600',
  'In Revision': 'border-orange-500/40 bg-orange-500/15 text-orange-600',
  'Pending Segregation': 'border-blue-400/50 bg-blue-500/15 text-blue-500',
  Delivered: 'border-green-500/40 bg-green-500/15 text-green-600',
};

export function EditorSummaryDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<EditingTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.email) return;
    try {
      const response = await authFetch('/api/editing', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) return;

      const mapped = (data.tasks || []).map((t: any) => ({
        task_id: t.taskId,
        status: t.status,
        task_label: t.taskLabel,
        client_name: t.clientName,
        service_type: t.serviceType,
        assigned_to_email: t.assignedToEmail,
        assigned_to_name: t.assignedToName,
        revision_count: t.revisionCount?.toString() || '0',
        correction_count: t.correctionCount?.toString() || '0',
        pending_feedback_count: t.pendingFeedbackCount || 0,
      })).filter((t: any) => {
        if (user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin') return true;
        return t.assigned_to_email?.trim().toLowerCase() === user?.email?.trim().toLowerCase();
      });
      setTasks(mapped);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    return {
      assigned: tasks.filter(t => t.status === 'Assigned' && parseInt(t.revision_count || '0') === 0).length,
      inProgress: tasks.filter(t => t.status === 'In Progress' && parseInt(t.revision_count || '0') === 0).length,
      corrections: tasks.filter(t => t.status === 'Correction Requested').length,
      revisions: tasks.filter(t => ['In Revision', 'Extra Revision Approved', 'Pending Extra Revision Approval'].includes(t.status) || (['Assigned', 'In Progress'].includes(t.status) && parseInt(t.revision_count || '0') > 0)).length,
      pendingSegregation: tasks.filter(t => t.status === 'Pending Segregation' || (t.pending_feedback_count ?? 0) > 0).length,
      delivered: tasks.filter(t => ['Delivered', 'Client Satisfied', 'Completed'].includes(t.status)).length,
      totalActive: tasks.filter(t => !['Delivered', 'Client Satisfied', 'Completed'].includes(t.status)).length,
    };
  }, [tasks]);

  if (loading) return (
    <div className="space-y-6">
      <PageHeader title="Editor Summary Dashboard" description="Overview of your editing workload" />
      <TableShimmer rows={4} cols={4} />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Editor Summary Dashboard" 
        description={`Welcome back, ${user?.name || 'Editor'}. Here is your workload overview.`} 
        actions={
          user?.role === 'super_admin' && (
            <Button size="sm" variant="outline" onClick={() => {
              import('@/lib/export').then(({ exportToExcel }) => exportToExcel(tasks, 'editor_data'));
            }}>
              <Download className="mr-1.5 h-4 w-4" />
              Export
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard 
          title="Total Active Tasks" 
          value={stats.totalActive} 
          icon={Scissors} 
          className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20"
        />
        <StatCard 
          title="Newly Assigned" 
          value={stats.assigned} 
          icon={Clock} 
          className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20"
        />
        <StatCard 
          title="In Progress" 
          value={stats.inProgress} 
          icon={RefreshCcw} 
          className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border-amber-500/20"
        />
        <StatCard 
          title="Corrections & Revisions" 
          value={stats.corrections + stats.revisions} 
          icon={AlertTriangle} 
          className="bg-gradient-to-br from-rose-500/10 to-red-500/10 border-rose-500/20"
        />
        <StatCard 
          title="Pending Segregation" 
          value={stats.pendingSegregation} 
          icon={AlertTriangle} 
          className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/20"
        />
        <StatCard 
          title="Completed" 
          value={stats.delivered} 
          icon={CheckCircle} 
          className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20"
        />
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Scissors className="mr-2 h-5 w-5 text-indigo-500" />
          Active Tasks Highlights
        </h3>
        {tasks.filter(t => !['Delivered', 'Client Satisfied', 'Completed'].includes(t.status)).length === 0 ? (
           <Card className="bg-muted/30 border-dashed border-2">
             <CardContent className="py-10 text-center text-muted-foreground">
               No active tasks right now. Great job!
             </CardContent>
           </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.filter(t => !['Delivered', 'Client Satisfied', 'Completed'].includes(t.status)).slice(0, 9).map(task => (
              <Card key={task.task_id} className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-sm truncate pr-2">{task.task_label || task.client_name}</h4>
                    <Badge className={cn('text-[10px] uppercase shadow-sm', statusClass[task.status] || 'bg-secondary text-foreground')}>
                      {task.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{task.service_type || 'Editing'}</p>
                  
                  <div className="flex gap-2">
                    {parseInt(task.revision_count || '0') > 0 && (
                      <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600 bg-orange-500/10">
                        {task.revision_count} Revisions
                      </Badge>
                    )}
                    {parseInt(task.correction_count || '0') > 0 && (
                      <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-600 bg-red-500/10">
                        {task.correction_count} Corrections
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      <div className="mt-4 flex justify-center">
         <Button variant="outline" asChild>
           <a href="/editor">View Detailed Task List</a>
         </Button>
      </div>
    </div>
  );
}
