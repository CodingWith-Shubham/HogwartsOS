'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from 'sonner';

export default function MarketingPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('assigned');

  const fetchTasks = async () => {
    try {
      const endpoint = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'manager' 
        ? `/api/marketing`
        : `/api/marketing?assignedToEmail=${user?.email}`;
      const res = await authFetch(endpoint);
      const data = await res.json();
      if (res.ok) {
        setTasks(data.data.tasks);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const updateStatus = async (taskId: string, status: string) => {
    try {
      const res = await authFetch(`/api/marketing/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Task marked as ${status}`);
        fetchTasks();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update task');
      }
    } catch (err) {
      toast.error('Failed to update task');
    }
  };

  const assignedTasks = tasks.filter(t => t.status === 'Assigned');
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress');
  const completedTasks = tasks.filter(t => t.status === 'Completed');

  const TaskCard = ({ task, actionLabel, nextStatus }: { task: any, actionLabel?: string, nextStatus?: string }) => (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-lg">{task.clientName}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong>Lead ID:</strong> {task.leadId}</p>
          <p><strong>Months:</strong> {task.months || 'N/A'}</p>
          <p><strong>Posts:</strong> {task.posts || 'N/A'}</p>
          <p><strong>Social Media Handles:</strong> {task.socialMediaHandles || 'N/A'}</p>
          {task.marketingNotes && <p><strong>Notes:</strong> {task.marketingNotes}</p>}
          <p><strong>Assigned To:</strong> {task.assignedToName}</p>
        </div>
        {actionLabel && nextStatus && (
          <div className="mt-4">
            <Button onClick={() => updateStatus(task.taskId, nextStatus)}>{actionLabel}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Marketing Dashboard" description="Manage your marketing tasks" />
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="assigned">Assigned ({assignedTasks.length})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({inProgressTasks.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assigned">
          {assignedTasks.length === 0 ? <p className="text-muted-foreground">No assigned tasks.</p> : assignedTasks.map(t => (
            <TaskCard key={t.taskId} task={t} actionLabel="Mark In Progress" nextStatus="In Progress" />
          ))}
        </TabsContent>

        <TabsContent value="in_progress">
          {inProgressTasks.length === 0 ? <p className="text-muted-foreground">No tasks in progress.</p> : inProgressTasks.map(t => (
            <TaskCard key={t.taskId} task={t} actionLabel="Mark Complete" nextStatus="Completed" />
          ))}
        </TabsContent>

        <TabsContent value="completed">
          {completedTasks.length === 0 ? <p className="text-muted-foreground">No completed tasks.</p> : completedTasks.map(t => (
            <TaskCard key={t.taskId} task={t} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
