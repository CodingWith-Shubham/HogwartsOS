'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, ExternalLink, FileText, HardDrive, Scissors, Send } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { TableShimmer } from '@/components/shared/ShimmerLoader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type EditingTask = {
  task_id: string; client_name: string; service_type: string; task_type: string; task_label: string;
  data_link: string; assigned_to_name: string; status: string; draft_link: string;
  manager_comment: string; deadline_at: string; final_delivered: string;
};

const statusClass: Record<string, string> = {
  Assigned: 'border-blue-500/40 bg-blue-500/15 text-blue-600',
  'In Progress': 'border-yellow-500/40 bg-yellow-500/15 text-yellow-600',
  'Draft Sent': 'border-purple-500/40 bg-purple-500/15 text-purple-600',
  'In Revision': 'border-orange-500/40 bg-orange-500/15 text-orange-600',
  Delivered: 'border-green-500/40 bg-green-500/15 text-green-600',
};

function deadline(value: string) {
  if (!value) return 'No deadline';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(date);
}

export default function EditorPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<EditingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('assigned');
  const [draftLinks, setDraftLinks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!user?.email) return;
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch(`/api/editor-tasks?email=${encodeURIComponent(user.email)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to load tasks');
      setTasks(data);
    } catch (error) { if (!silent) toast.error('Failed to load tasks', { description: error instanceof Error ? error.message : 'Unknown error' }); }
    finally { if (!silent) setRefreshing(false); }
  }, [user?.email]);

  useEffect(() => { refresh(true).finally(() => setLoading(false)); const interval = setInterval(() => refresh(true), 30000); return () => clearInterval(interval); }, [refresh]);

  const groups = useMemo(() => ({
    assigned: tasks.filter((task) => ['Assigned', 'In Progress'].includes(task.status)),
    drafts: tasks.filter((task) => task.status === 'Draft Sent'),
    revisions: tasks.filter((task) => task.status === 'In Revision'),
    delivered: tasks.filter((task) => task.status === 'Delivered'),
  }), [tasks]);

  const updateStatus = async (task: EditingTask, status: string, includeDraft = false) => {
    const draft_link = draftLinks[task.task_id]?.trim();
    if (includeDraft && !draft_link) { toast.error('Add a draft link first'); return; }
    setSaving(task.task_id);
    try {
      const response = await fetch('/api/update-task-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_id: task.task_id, status, ...(includeDraft ? { draft_link } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to update task');
      toast.success(status === 'In Progress' ? 'Task started' : 'Draft submitted');
      setDraftLinks((current) => ({ ...current, [task.task_id]: '' }));
      await refresh(true);
    } catch (error) { toast.error('Could not update task', { description: error instanceof Error ? error.message : 'Unknown error' }); }
    finally { setSaving(null); }
  };

  const TaskCard = ({ task }: { task: EditingTask }) => (
    <Card key={task.task_id}><CardContent className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{task.task_label || task.task_type}</h3><p className="text-sm text-muted-foreground">{task.client_name} · {task.service_type || 'Edit'}</p></div><Badge className={cn('shrink-0', statusClass[task.status] ?? '')}>{task.status}</Badge></div>
      <p className="text-xs text-muted-foreground">Deadline: {deadline(task.deadline_at)}</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild disabled={!task.data_link}><a href={task.data_link} target="_blank" rel="noreferrer"><HardDrive className="mr-1.5 h-3.5 w-3.5" />Data Link</a></Button>{task.draft_link && <Button size="sm" variant="outline" asChild><a href={task.draft_link} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />View Draft</a></Button>}</div>
      {task.manager_comment && <details className="rounded-md border border-border p-2 text-sm"><summary className="cursor-pointer font-medium">Manager comment</summary><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{task.manager_comment}</p></details>}
      {task.status === 'Assigned' && <Button size="sm" onClick={() => updateStatus(task, 'In Progress')} disabled={saving === task.task_id}>Mark In Progress</Button>}
      {['In Progress', 'In Revision'].includes(task.status) && <div className="space-y-2 border-t border-border pt-3"><Input value={draftLinks[task.task_id] ?? ''} onChange={(event) => setDraftLinks((current) => ({ ...current, [task.task_id]: event.target.value }))} placeholder="https://drive.google.com/..." /><Button size="sm" onClick={() => updateStatus(task, 'Draft Sent', true)} disabled={saving === task.task_id}><Send className="mr-1.5 h-3.5 w-3.5" />{task.status === 'In Revision' ? 'Upload Revised Draft' : 'Upload Draft Link'}</Button></div>}
      {task.status === 'Delivered' && <p className="flex items-center gap-1.5 text-sm text-green-600"><CheckCircle className="h-4 w-4" />Completed</p>}
    </CardContent></Card>
  );

  if (loading) return <div className="space-y-6"><PageHeader title="Editor" description="Individual task queue" /><TableShimmer rows={6} cols={4} /></div>;
  const panel = (items: EditingTask[], empty: string) => <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{items.map((task) => <TaskCard key={task.task_id} task={task} />)}{items.length === 0 && <Card className="md:col-span-2"><CardContent className="py-12 text-center text-sm text-muted-foreground">{empty}</CardContent></Card>}</div>;
  return <div><PageHeader title="Editor" description="Your individual editing tasks" actions={<Button variant="outline" size="sm" onClick={() => refresh()} disabled={refreshing}>Refresh</Button>} />
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title="Assigned" value={groups.assigned.filter((t) => t.status === 'Assigned').length} icon={Scissors} onClick={() => setActiveTab('assigned')} /><StatCard title="Drafts Sent" value={groups.drafts.length} icon={FileText} onClick={() => setActiveTab('drafts')} /><StatCard title="In Revision" value={groups.revisions.length} icon={AlertCircle} onClick={() => setActiveTab('revisions')} /><StatCard title="Delivered" value={groups.delivered.length} icon={CheckCircle} onClick={() => setActiveTab('delivered')} /></div>
    <Tabs value={activeTab} onValueChange={setActiveTab}><TabsList><TabsTrigger value="assigned">Assigned</TabsTrigger><TabsTrigger value="drafts">Drafts</TabsTrigger><TabsTrigger value="revisions">Revisions</TabsTrigger><TabsTrigger value="delivered">Delivered</TabsTrigger></TabsList><TabsContent value="assigned" className="mt-4">{panel(groups.assigned, 'No assigned tasks.')}</TabsContent><TabsContent value="drafts" className="mt-4">{panel(groups.drafts, 'No drafts sent yet.')}</TabsContent><TabsContent value="revisions" className="mt-4">{panel(groups.revisions, 'No revisions pending.')}</TabsContent><TabsContent value="delivered" className="mt-4">{panel(groups.delivered, 'No delivered tasks.')}</TabsContent></Tabs>
  </div>;
}
