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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { postWebhook } from '@/lib/editing';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type EditingTask = {
  task_id: string; edit_id: string; client_name: string; service_type: string; task_type: string; task_label: string;
  data_link: string; assigned_to_name: string; status: string; draft_link: string;
  managerComment: string; deadline_at: string; final_delivered: string;
  revision_count?: string;
  max_free_revisions?: string;
  revisions?: any[];
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
  const [checkedFeedback, setCheckedFeedback] = useState<Record<string, Set<number>>>({});

  const refresh = useCallback(async (silent = false) => {
    if (!user?.email) return;
    if (!silent) setRefreshing(true);
    try {
      const response = await authFetch('/api/editing', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to load tasks');
      const mapped = (data.tasks || []).map((t: any) => ({
        task_id: t.taskId, edit_id: t.editId, client_name: t.clientName, service_type: t.serviceType, task_type: t.taskType, task_label: t.taskLabel,
        data_link: t.dataLink, assigned_to_name: t.assignedToName, assigned_to_email: t.assignedToEmail, status: t.status, draft_link: t.draftLink,
        managerComment: t.managerComment, deadline_at: t.deadlineAt, final_delivered: t.finalDelivered, revision_count: t.revisionCount?.toString() || '0',
        max_free_revisions: t.maxFreeRevisions?.toString() || '2',
        revisions: (data.revisions || []).filter((r: any) => r.projectId === t.editId).sort((a: any, b: any) => b.revisionRound - a.revisionRound)
      })).filter((t: any) => {
        if (user?.role === 'manager' || user?.role === 'admin') return true;
        const tEmail = t.assigned_to_email?.trim().toLowerCase();
        const uEmail = user?.email?.trim().toLowerCase();
        const tName = t.assigned_to_name?.trim().toLowerCase();
        const uName = user?.name?.trim().toLowerCase();
        
        const emailMatch = tEmail && uEmail && tEmail === uEmail;
        const nameMatch = tName && uName && tName === uName;
        return emailMatch || nameMatch;
      });
      setTasks(mapped);
    } catch (error) { if (!silent) toast.error('Failed to load tasks', { description: error instanceof Error ? error.message : 'Unknown error' }); }
    finally { if (!silent) setRefreshing(false); }
  }, [user?.email]);

  useEffect(() => { refresh(true).finally(() => setLoading(false)); const interval = setInterval(() => refresh(true), 30000); return () => clearInterval(interval); }, [refresh]);

  const groups = useMemo(() => ({
    assigned: tasks.filter((task) => ['Assigned', 'In Progress'].includes(task.status) && parseInt(task.revision_count) === 0),
    drafts: tasks.filter((task) => ['Draft Ready', 'Draft Sent'].includes(task.status)),
    revisions: tasks.filter((task) => task.status === 'In Revision' || task.status === 'Extra Revision Approved' || (['Assigned', 'In Progress'].includes(task.status) && parseInt(task.revision_count) > 0)),
    delivered: tasks.filter((task) => task.status === 'Delivered'),
  }), [tasks]);

  const updateStatus = async (task: EditingTask, status: string, includeDraft = false) => {
    const draft_link = draftLinks[task.task_id]?.trim();
    if (includeDraft && !draft_link) { toast.error('Add a draft link first'); return; }

    if (status === 'Draft Sent' && task.managerComment) {
      const requiredChecks = task.managerComment.split('\n').filter(l => l.trim().length > 0).length;
      const checkedCount = checkedFeedback[task.task_id]?.size || 0;
      if (checkedCount < requiredChecks) {
        toast.error('Please check off all manager feedback points before submitting the new draft.');
        return;
      }
    }

    setSaving(task.task_id);
    try {
      const response = await authFetch('/api/editing', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: task.task_id, status, ...(includeDraft ? { draftLink: draft_link } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to update task');
      
      if (status === 'Draft Ready' && draft_link) {
        await postWebhook('/draft-ready', {
          edit_id: task.edit_id,
          draft_link: draft_link,
          revision_count: task.revision_count || '0'
        });
      }

      toast.success(status === 'In Progress' ? 'Task started' : 'Draft submitted');
      setDraftLinks((current) => ({ ...current, [task.task_id]: '' }));
      await refresh(true);
    } catch (error) { toast.error('Could not update task', { description: error instanceof Error ? error.message : 'Unknown error' }); }
    finally { setSaving(null); }
  };

  const TaskCard = ({ task }: { task: EditingTask }) => (
    <Card key={task.task_id}><CardContent className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="font-semibold">{task.task_label || task.task_type}</h3><p className="text-sm text-muted-foreground">{task.client_name} · {task.service_type || 'Edit'}</p></div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge className={cn('shrink-0', statusClass[task.status] ?? '')}>{task.status}</Badge>
          {parseInt(task.revision_count || '0') > 0 && (
            <span className="text-[10px] font-semibold tracking-wide text-white bg-red-500 px-1.5 py-0.5 rounded uppercase shadow-sm">
              {task.revision_count}/{task.max_free_revisions || '2'} Revisions
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Deadline: {deadline(task.deadline_at)}</p>
      {(user?.role === 'manager' || user?.role === 'admin') && <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Assigned to: {task.assigned_to_name || 'Unassigned'}</p>}
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild disabled={!task.data_link}><a href={task.data_link} target="_blank" rel="noreferrer"><HardDrive className="mr-1.5 h-3.5 w-3.5" />Data Link</a></Button>{task.draft_link && <Button size="sm" variant="outline" asChild><a href={task.draft_link} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />View Draft</a></Button>}</div>
      {task.managerComment && (
        <details className="rounded-md border border-border p-2 text-sm" open={task.status === 'In Revision'}>
          <summary className="cursor-pointer font-medium">Manager feedback</summary>
          <div className="mt-2 space-y-2">
            {task.managerComment.split('\n').filter(l => l.trim().length > 0).map((line, idx) => {
              const text = line.replace(/^•\s*/, '');
              const isChecked = checkedFeedback[task.task_id]?.has(idx) || false;
              return (
                <div key={idx} className="flex items-start gap-2">
                  <Checkbox 
                    id={`${task.task_id}-fb-${idx}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      setCheckedFeedback(prev => {
                        const next = new Set(prev[task.task_id] || []);
                        if (checked) next.add(idx);
                        else next.delete(idx);
                        return { ...prev, [task.task_id]: next };
                      });
                    }}
                  />
                  <label htmlFor={`${task.task_id}-fb-${idx}`} className="text-muted-foreground leading-snug cursor-pointer select-none">
                    {text}
                  </label>
                </div>
              );
            })}
          </div>
        </details>
      )}
      {task.revisions && task.revisions.length > 0 && (
        <div className="space-y-2 mt-2">
          {task.revisions.map((rev: any, index: number) => (
            <details key={rev.id || index} className="rounded-md border border-orange-200 bg-orange-50/50 dark:border-orange-900/30 dark:bg-orange-900/10 p-2 text-sm" open={['In Revision', 'In Progress', 'Extra Revision Approved'].includes(task.status) && parseInt(task.revision_count) > 0 && index === 0}>
              <summary className="cursor-pointer font-medium text-orange-700 dark:text-orange-400">
                Client Feedback (Round {rev.revisionRound})
              </summary>
              <div className="mt-2 space-y-2 text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {rev.feedback || 'No feedback text provided.'}
              </div>
            </details>
          ))}
        </div>
      )}
      {task.status === 'Assigned' && <Button size="sm" onClick={() => updateStatus(task, 'In Progress')} disabled={saving === task.task_id}>Mark In Progress</Button>}
      {['In Progress', 'In Revision', 'Extra Revision Approved'].includes(task.status) && (
        <div className="space-y-2 border-t border-border pt-3">
          <Input value={draftLinks[task.task_id] ?? ''} onChange={(event) => setDraftLinks((current) => ({ ...current, [task.task_id]: event.target.value }))} placeholder="https://drive.google.com/..." />
          <Button 
            size="sm" 
            onClick={() => updateStatus(task, 'Draft Ready', true)} 
            disabled={saving === task.task_id || Boolean(
              task.managerComment && 
              (checkedFeedback[task.task_id]?.size || 0) < task.managerComment.split('\n').filter(l => l.trim().length > 0).length
            )}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {task.status === 'In Revision' ? 'Upload Revised Draft' : 'Upload Draft Link'}
          </Button>
        </div>
      )}
      {task.status === 'Delivered' && <p className="flex items-center gap-1.5 text-sm text-green-600"><CheckCircle className="h-4 w-4" />Completed</p>}
    </CardContent></Card>
  );

  if (loading) return <div className="space-y-6"><PageHeader title="Editor" description={user?.role === 'manager' || user?.role === 'admin' ? "All editing tasks" : "Individual task queue"} /><TableShimmer rows={6} cols={4} /></div>;
  const panel = (items: EditingTask[], empty: string) => {
    if (items.length === 0) return <Card className="md:col-span-2"><CardContent className="py-12 text-center text-sm text-muted-foreground">{empty}</CardContent></Card>;
    const grouped = items.reduce((acc, task) => {
      const client = task.client_name || 'Unknown Client';
      if (!acc[client]) acc[client] = [];
      acc[client].push(task);
      return acc;
    }, {} as Record<string, EditingTask[]>);
    return (
      <Accordion type="multiple" className="w-full space-y-4" defaultValue={Object.keys(grouped)}>
        {Object.entries(grouped).map(([client, clientTasks]) => (
          <AccordionItem key={client} value={client} className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
              <div className="flex items-center gap-2 font-semibold">
                {client}
                <Badge variant="secondary" className="ml-2">{clientTasks.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-2 border-t">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {clientTasks.map((task) => TaskCard({ task }))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };
  return <div><PageHeader title="Editor" description={user?.role === 'manager' || user?.role === 'admin' ? "All editing tasks across editors" : "Your individual editing tasks"} actions={<Button variant="outline" size="sm" onClick={() => refresh()} disabled={refreshing}>Refresh</Button>} />
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title="Assigned" value={groups.assigned.filter((t) => t.status === 'Assigned').length} icon={Scissors} onClick={() => setActiveTab('assigned')} /><StatCard title="Drafts Sent" value={groups.drafts.length} icon={FileText} onClick={() => setActiveTab('drafts')} /><StatCard title="In Revision" value={groups.revisions.length} icon={AlertCircle} onClick={() => setActiveTab('revisions')} /><StatCard title="Delivered" value={groups.delivered.length} icon={CheckCircle} onClick={() => setActiveTab('delivered')} /></div>
    <Tabs value={activeTab} onValueChange={setActiveTab}><TabsList><TabsTrigger value="assigned">Assigned</TabsTrigger><TabsTrigger value="drafts">Drafts</TabsTrigger><TabsTrigger value="revisions">Revisions</TabsTrigger><TabsTrigger value="delivered">Delivered</TabsTrigger></TabsList><TabsContent value="assigned" className="mt-4">{panel(groups.assigned, 'No assigned tasks.')}</TabsContent><TabsContent value="drafts" className="mt-4">{panel(groups.drafts, 'No drafts sent yet.')}</TabsContent><TabsContent value="revisions" className="mt-4">{panel(groups.revisions, 'No revisions pending.')}</TabsContent><TabsContent value="delivered" className="mt-4">{panel(groups.delivered, 'No delivered tasks.')}</TabsContent></Tabs>
  </div>;
}
