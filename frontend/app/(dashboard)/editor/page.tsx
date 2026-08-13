'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle, ExternalLink, FileText, HardDrive,
  Scissors, Send, UserCheck, GitFork, MessageSquare, RotateCcw,
  CheckSquare, XSquare, Clock, Loader2
} from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { postWebhook } from '@/lib/editing';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ClientProfileModal } from '@/components/client-profile/ClientProfileModal';

type EditingTask = {
  task_id: string; edit_id: string; client_name: string; client_email?: string; service_type: string; task_type: string; task_label: string;
  data_link: string; assigned_to_name: string; assigned_to_email?: string; status: string; draft_link: string;
  managerComment: string; deadline_at: string; final_delivered: string;
  revision_count?: string;
  max_free_revisions?: string;
  correction_count?: string;
  editor_comment?: string;
  pending_feedback_count?: number;
  revisions?: any[];
  shoot_date?: string;
  shoot_start_time?: string;
  shoot_end_time?: string;
};

type PendingRevision = {
  _id: string;
  feedback: string;
  revisionRound: number;
  clientName: string;
  feedbackGivenBy: string;
  feedbackDate: string;
  segregationType: string;
};

const statusClass: Record<string, string> = {
  Assigned: 'border-blue-500/40 bg-blue-500/15 text-blue-600',
  'In Progress': 'border-yellow-500/40 bg-yellow-500/15 text-yellow-600',
  'Draft Sent': 'border-purple-500/40 bg-purple-500/15 text-purple-600',
  'Correction Requested': 'border-red-500/40 bg-red-500/15 text-red-600',
  'In Revision': 'border-orange-500/40 bg-orange-500/15 text-orange-600',
  'Pending Segregation': 'border-amber-500/40 bg-amber-500/15 text-amber-700',
  'Pending Extra Revision Approval': 'border-rose-500/40 bg-rose-500/15 text-rose-700',
  'Extra Revision Approved': 'border-teal-500/40 bg-teal-500/15 text-teal-700',
  Delivered: 'border-green-500/40 bg-green-500/15 text-green-600',
};

function formatDeadline(value: string) {
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
  const [editorComments, setEditorComments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [checkedFeedback, setCheckedFeedback] = useState<Record<string, Set<number>>>({});
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileClientInfo, setProfileClientInfo] = useState<any>(null);
  // segregation state: track which pending revisions are being acted on
  const [segregating, setSegregating] = useState<Record<string, 'correction' | 'revision' | null>>({});

  const refresh = useCallback(async (silent = false) => {
    if (!user?.email) return;
    if (!silent) setRefreshing(true);
    try {
      const response = await authFetch('/api/editing', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to load tasks');
      const mapped = (data.tasks || []).map((t: any) => ({
        task_id: t.taskId, edit_id: t.editId, client_name: t.clientName, client_email: t.emailId,
        service_type: t.serviceType, task_type: t.taskType, task_label: t.taskLabel,
        data_link: t.dataLink, assigned_to_name: t.assignedToName, assigned_to_email: t.assignedToEmail,
        status: t.status, draft_link: t.draftLink,
        managerComment: t.managerComment, deadline_at: t.deadlineAt, final_delivered: t.finalDelivered,
        revision_count: t.revisionCount?.toString() || '0',
        max_free_revisions: t.maxFreeRevisions?.toString() || '2',
        correction_count: t.correctionCount?.toString() || '0',
        editor_comment: t.editorComment || '',
        pending_feedback_count: t.pendingFeedbackCount || 0,
        shoot_date: t.shootDate,
        shoot_start_time: t.shootStartTime,
        shoot_end_time: t.shootEndTime,
        revisions: (data.revisions || [])
          .filter((r: any) => r.projectId === t.editId || r.projectId === t.taskId || r.taskId === t.taskId)
          .sort((a: any, b: any) => b.revisionRound - a.revisionRound)
      })).filter((t: any) => {
        if (user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin') return true;
        const tEmail = t.assigned_to_email?.trim().toLowerCase();
        const uEmail = user?.email?.trim().toLowerCase();
        const tName = t.assigned_to_name?.trim().toLowerCase();
        const uName = user?.name?.trim().toLowerCase();
        const emailMatch = tEmail && uEmail && tEmail === uEmail;
        const nameMatch = tName && uName && tName === uName;
        return emailMatch || nameMatch;
      });
      setTasks(mapped);
    } catch (error) {
      if (!silent) toast.error('Failed to load tasks', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [user?.email]);

  useEffect(() => {
    refresh(true).finally(() => setLoading(false));
    const interval = setInterval(() => refresh(true), 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const groups = useMemo(() => ({
    assigned: tasks.filter((task) => ['Assigned', 'In Progress'].includes(task.status) && parseInt(task.revision_count || '0') === 0),
    corrections: tasks.filter((task) => task.status === 'Correction Requested'),
    drafts: tasks.filter((task) => ['Draft Ready', 'Draft Sent'].includes(task.status)),
    revisions: tasks.filter((task) =>
      task.status === 'In Revision' ||
      task.status === 'Extra Revision Approved' ||
      task.status === 'Pending Extra Revision Approval' ||
      (['Assigned', 'In Progress'].includes(task.status) && parseInt(task.revision_count || '0') > 0)
    ),
    segregate: tasks.filter((task) =>
      task.status === 'Pending Segregation' ||
      ((task.pending_feedback_count ?? 0) > 0)
    ),
    delivered: tasks.filter((task) => ['Delivered', 'Client Satisfied', 'Completed'].includes(task.status)),
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
      const payload: Record<string, unknown> = {
        taskId: task.task_id,
        status,
        ...(includeDraft ? { draftLink: draft_link } : {}),
        ...(editorComments[task.task_id]?.trim() ? { editorComment: editorComments[task.task_id].trim() } : {})
      };

      const response = await authFetch('/api/editing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to update task');

      if (status === 'Draft Ready' && draft_link) {
        await postWebhook('/draft-ready', {
          edit_id: task.edit_id,
          draft_link: draft_link,
          revision_count: task.revision_count || '0'
        });
      }

      toast.success(status === 'In Progress' ? 'Task started' : 'Draft submitted to manager');
      setDraftLinks((current) => ({ ...current, [task.task_id]: '' }));
      setEditorComments((current) => ({ ...current, [task.task_id]: '' }));
      await refresh(true);
    } catch (error) {
      toast.error('Could not update task', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setSaving(null);
    }
  };

  const handleSegregate = async (revisionId: string, type: 'correction' | 'revision', taskId: string) => {
    setSegregating(prev => ({ ...prev, [revisionId]: type }));
    try {
      const response = await authFetch('/api/editing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'segregate', revisionId, type, taskId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to classify feedback');

      if (data.extraRevisionNeeded) {
        toast.warning('⚠️ Revision limit reached! This has been flagged for manager approval.', { duration: 5000 });
      } else {
        toast.success(type === 'correction' ? '✅ Marked as Correction' : '🔄 Marked as Revision', {
          description: data.stillPendingCount > 0 ? `${data.stillPendingCount} more feedback item(s) to classify` : 'All feedback classified!'
        });
      }
      await refresh(true);
    } catch (error) {
      toast.error('Could not classify feedback', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setSegregating(prev => ({ ...prev, [revisionId]: null }));
    }
  };

  // ─── Segregate Card ──────────────────────────────────────────────────────────
  const SegregateCard = ({ task }: { task: EditingTask }) => {
    const pendingRevisions = (task.revisions || []).filter(
      (r: PendingRevision) => r.segregationType === 'pending' || !r.segregationType
    );

    if (pendingRevisions.length === 0) return null;

    return (
      <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700/40">
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-base">{task.task_label || task.task_type}</h3>
              <p className="text-sm text-muted-foreground">{task.client_name} · {task.service_type || 'Edit'}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-700 shrink-0">
                <Clock className="w-3 h-3 mr-1" />
                Pending Segregation
              </Badge>
              <span className="text-[10px] font-semibold tracking-wide text-amber-700 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded uppercase">
                {pendingRevisions.length} feedback item{pendingRevisions.length > 1 ? 's' : ''} to classify
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 px-2.5 py-1.5 rounded-md border border-red-200 dark:border-red-700/40">
              <CheckSquare className="w-3.5 h-3.5" />
              Corrections so far: {task.correction_count || 0}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1.5 rounded-md border border-orange-200 dark:border-orange-700/40">
              <RotateCcw className="w-3.5 h-3.5" />
              Revisions used: {task.revision_count || 0}/{task.max_free_revisions || 2}
            </div>
          </div>

          {/* Feedback items to classify */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Client Feedback — Classify Each Item:
            </p>
            {pendingRevisions.map((rev: PendingRevision, idx: number) => {
              const isBusy = segregating[rev._id] != null;
              return (
                <div
                  key={rev._id}
                  className="rounded-lg border border-amber-200 dark:border-amber-700/40 bg-white dark:bg-card p-3.5 space-y-3 shadow-sm"
                >
                  {/* Feedback meta */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Round {rev.revisionRound} · From {rev.feedbackGivenBy || 'Client'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {rev.feedbackDate ? new Date(rev.feedbackDate).toLocaleDateString('en-IN') : ''}
                    </span>
                  </div>

                  {/* Feedback text */}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground font-medium border-l-4 border-amber-400 pl-3">
                    {rev.feedback
                      ? rev.feedback.split(/(https?:\/\/[^\s]+)/g).map((part: string, i: number) =>
                          part.match(/^https?:\/\//)
                            ? <a key={i} href={part} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">{part}</a>
                            : part
                        )
                      : 'No feedback text provided.'}
                  </div>

                  {/* Classification buttons */}
                  <div className="flex gap-2 flex-wrap pt-1 border-t border-amber-100 dark:border-amber-700/30">
                    <p className="w-full text-[11px] text-muted-foreground mb-1">
                      Classify this feedback as:
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 flex-1"
                      disabled={isBusy}
                      onClick={() => handleSegregate(rev._id, 'correction', task.task_id)}
                    >
                      {segregating[rev._id] === 'correction'
                        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        : <CheckSquare className="w-3.5 h-3.5 mr-1.5" />}
                      Correction
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20 flex-1"
                      disabled={isBusy}
                      onClick={() => handleSegregate(rev._id, 'revision', task.task_id)}
                    >
                      {segregating[rev._id] === 'revision'
                        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
                      Revision
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    💡 <strong>Correction</strong> = change without using a free revision slot. &nbsp;
                    <strong>Revision</strong> = counts against your {task.max_free_revisions || 2} free revisions.
                  </p>
                </div>
              );
            })}
          </div>

          {/* Data link */}
          {task.data_link && (
            <Button size="sm" variant="outline" asChild>
              <a href={task.data_link} target="_blank" rel="noreferrer">
                <HardDrive className="mr-1.5 h-3.5 w-3.5" />Data Link
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  // ─── Regular Task Card ────────────────────────────────────────────────────────
  const TaskCard = ({ task }: { task: EditingTask }) => (
    <Card key={task.task_id}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{task.task_label || task.task_type}</h3>
            <p className="text-sm text-muted-foreground">{task.client_name} · {task.service_type || 'Edit'}</p>
            {(task.shoot_date || task.shoot_start_time) && (
              <p className="text-sm text-muted-foreground mt-0.5 font-medium">
                {task.shoot_date ? new Date(task.shoot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                {task.shoot_start_time ? ` · ${task.shoot_start_time}${task.shoot_end_time ? ` - ${task.shoot_end_time}` : ''}` : ''}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge className={cn('shrink-0', statusClass[task.status] ?? '')}>{task.status}</Badge>
            {parseInt(task.revision_count || '0') > 0 && (
              <span className="text-[10px] font-semibold tracking-wide text-white bg-orange-500 px-1.5 py-0.5 rounded uppercase shadow-sm">
                {task.revision_count}/{task.max_free_revisions || '2'} Revisions
              </span>
            )}
            {parseInt(task.correction_count || '0') > 0 && (
              <span className="text-[10px] font-semibold tracking-wide text-white bg-red-500 px-1.5 py-0.5 rounded uppercase shadow-sm">
                {task.correction_count} Correction{parseInt(task.correction_count || '0') > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Deadline: {formatDeadline(task.deadline_at)}</p>
        {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin') && (
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Assigned to: {task.assigned_to_name || 'Unassigned'}</p>
        )}

        {/* Editor's note to manager (shown when it exists) */}
        {task.editor_comment && (
          <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700/40 px-3 py-2">
            <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              <span className="font-semibold">Editor note:</span> {task.editor_comment}
            </p>
          </div>
        )}

        {/* Extra revision approval notice */}
        {task.status === 'Pending Extra Revision Approval' && (
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-700/40 px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-rose-500 shrink-0" />
            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
              Free revision limit reached. Awaiting manager approval for extra revision.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => { setProfileClientInfo({ name: task.client_name, email: task.client_email }); setProfileModalOpen(true); }}>
            <UserCheck className="mr-1.5 h-3.5 w-3.5" />Client Profile
          </Button>
          <Button size="sm" variant="outline" asChild disabled={!task.data_link}>
            <a href={task.data_link} target="_blank" rel="noreferrer"><HardDrive className="mr-1.5 h-3.5 w-3.5" />Data Link</a>
          </Button>
          {task.draft_link && (
            <Button size="sm" variant="outline" asChild>
              <a href={task.draft_link} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />View Draft</a>
            </Button>
          )}
        </div>

        {task.managerComment && (
          <details className="rounded-md border border-border p-2 text-sm" open={task.status === 'In Revision' || task.status === 'Correction Requested'}>
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
                          if (checked) next.add(idx); else next.delete(idx);
                          return { ...prev, [task.task_id]: next };
                        });
                      }}
                    />
                    <label htmlFor={`${task.task_id}-fb-${idx}`} className="text-muted-foreground leading-snug cursor-pointer select-none">{text}</label>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {task.revisions && task.revisions.filter((r: any) => r.segregationType !== 'pending').length > 0 && (
          <div className="space-y-2 mt-2">
            {task.revisions.filter((r: any) => r.segregationType !== 'pending').map((rev: any, index: number) => (
              <details key={rev._id || index} className="rounded-md border border-gray-200 bg-white dark:bg-card dark:border-border p-3 text-sm transition-all"
                open={['In Revision', 'In Progress', 'Extra Revision Approved', 'Correction Requested'].includes(task.status) && parseInt(task.revision_count || '0') > 0 && index === 0}>
                <summary className="cursor-pointer font-bold flex items-center select-none">
                  <span className="mr-2">
                    {rev.segregationType === 'correction' ? '🔧' : rev.segregationType === 'revision' ? '🔄' : '📝'}
                  </span>
                  Client Feedback (Round {rev.revisionRound})
                  {rev.segregationType && rev.segregationType !== 'pending' && (
                    <Badge className={cn('ml-2 text-[10px] uppercase', rev.segregationType === 'correction'
                      ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400')}>
                      {rev.segregationType}
                    </Badge>
                  )}
                </summary>
                <div className="mt-3 space-y-2 whitespace-pre-wrap leading-relaxed border-t border-gray-200 dark:border-border pt-3 font-medium">
                  {rev.feedback
                    ? rev.feedback.split(/(https?:\/\/[^\s]+)/g).map((part: string, i: number) =>
                        part.match(/^https?:\/\//)
                          ? <a key={i} href={part} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline break-all">{part}</a>
                          : part
                      )
                    : 'No feedback text provided.'}
                </div>
              </details>
            ))}
          </div>
        )}

        {task.status === 'Assigned' && (
          <Button size="sm" onClick={() => updateStatus(task, 'In Progress')} disabled={saving === task.task_id}>
            Mark In Progress
          </Button>
        )}

        {['In Progress', 'In Revision', 'Extra Revision Approved', 'Correction Requested'].includes(task.status) && (
          <div className="space-y-2 border-t border-border pt-3">
            <Input
              value={draftLinks[task.task_id] ?? ''}
              onChange={(event) => setDraftLinks((current) => ({ ...current, [task.task_id]: event.target.value }))}
              placeholder="https://drive.google.com/..."
            />
            {/* Optional editor comment for manager */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" />
                Note for Manager <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <Textarea
                value={editorComments[task.task_id] ?? ''}
                onChange={(e) => setEditorComments((current) => ({ ...current, [task.task_id]: e.target.value }))}
                placeholder="Describe what changes you made, e.g. added transitions, adjusted pacing..."
                rows={2}
                className="resize-none text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={() => updateStatus(task, 'Draft Ready', true)}
              disabled={saving === task.task_id || Boolean(
                task.managerComment &&
                (checkedFeedback[task.task_id]?.size || 0) < task.managerComment.split('\n').filter(l => l.trim().length > 0).length
              )}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {task.status === 'In Revision' || task.status === 'Correction Requested' ? 'Upload Revised Draft' : 'Upload Draft Link'}
            </Button>
          </div>
        )}

        {task.status === 'Delivered' && (
          <p className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />Completed
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (loading) return (
    <div className="space-y-6">
      <PageHeader
        title="Editor"
        description={user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin' ? 'All editing tasks' : 'Individual task queue'}
      />
      <TableShimmer rows={6} cols={4} />
    </div>
  );

  const panel = (items: EditingTask[], empty: string) => {
    if (items.length === 0) return (
      <Card className="md:col-span-2">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">{empty}</CardContent>
      </Card>
    );
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

  // Segregate panel — shows SegregateCard components
  const segregatePanel = (items: EditingTask[]) => {
    if (items.length === 0) return (
      <Card className="md:col-span-2">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          <GitFork className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
          No feedback pending classification. When clients submit feedback, it will appear here for you to segregate.
        </CardContent>
      </Card>
    );
    const grouped = items.reduce((acc, task) => {
      const client = task.client_name || 'Unknown Client';
      if (!acc[client]) acc[client] = [];
      acc[client].push(task);
      return acc;
    }, {} as Record<string, EditingTask[]>);
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/40 p-4 text-sm text-amber-800 dark:text-amber-300 flex gap-3 items-start">
          <GitFork className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold mb-1">Classify Client Feedback</p>
            <p className="text-amber-700 dark:text-amber-400">
              Client feedback has arrived. You must classify each item as either a <strong>Correction</strong> (no revision slot used) or a <strong>Revision</strong> (uses one of {groups.segregate[0]?.max_free_revisions || 2} free revision slots). After all items are classified, the task will move to the appropriate tab.
            </p>
          </div>
        </div>
        <Accordion type="multiple" className="w-full space-y-4" defaultValue={Object.keys(grouped)}>
          {Object.entries(grouped).map(([client, clientTasks]) => (
            <AccordionItem key={client} value={client} className="rounded-lg border border-amber-200 dark:border-amber-700/40 bg-card text-card-foreground shadow-sm overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-amber-50/50 dark:hover:bg-amber-950/20">
                <div className="flex items-center gap-2 font-semibold">
                  {client}
                  <Badge className="ml-2 bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400">{clientTasks.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-2 border-t border-amber-200 dark:border-amber-700/40">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {clientTasks.map((task) => <SegregateCard key={task.task_id} task={task} />)}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    );
  };

  const isManagerView = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div>
      <PageHeader
        title="Editor"
        description={isManagerView ? 'All editing tasks across editors' : 'Your individual editing tasks'}
        actions={<Button variant="outline" size="sm" onClick={() => refresh()} disabled={refreshing}>Refresh</Button>}
      />

      {/* Stat Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard title="Assigned" value={groups.assigned.filter((t) => t.status === 'Assigned').length} icon={Scissors} onClick={() => setActiveTab('assigned')} />
        <StatCard title="Corrections" value={groups.corrections.length} icon={AlertCircle} onClick={() => setActiveTab('corrections')} />
        <StatCard title="Drafts Sent" value={groups.drafts.length} icon={FileText} onClick={() => setActiveTab('drafts')} />
        <StatCard title="In Revision" value={groups.revisions.length} icon={RotateCcw} onClick={() => setActiveTab('revisions')} />
        <StatCard
          title="Segregate"
          value={groups.segregate.length}
          icon={GitFork}
          onClick={() => setActiveTab('segregate')}
        />
        <StatCard title="Delivered" value={groups.delivered.length} icon={CheckCircle} onClick={() => setActiveTab('delivered')} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="assigned">Assigned</TabsTrigger>
          <TabsTrigger value="corrections">Corrections</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
          <TabsTrigger value="revisions">Revisions</TabsTrigger>
          <TabsTrigger value="segregate" className="relative">
            Segregate Feedback
            {groups.segregate.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-amber-500 rounded-full">
                {groups.segregate.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
        </TabsList>

        <TabsContent value="assigned" className="mt-4">{panel(groups.assigned, 'No assigned tasks.')}</TabsContent>
        <TabsContent value="corrections" className="mt-4">{panel(groups.corrections, 'No corrections pending.')}</TabsContent>
        <TabsContent value="drafts" className="mt-4">{panel(groups.drafts, 'No drafts sent yet.')}</TabsContent>
        <TabsContent value="revisions" className="mt-4">{panel(groups.revisions, 'No revisions pending.')}</TabsContent>
        <TabsContent value="segregate" className="mt-4">{segregatePanel(groups.segregate)}</TabsContent>
        <TabsContent value="delivered" className="mt-4">{panel(groups.delivered, 'No delivered tasks.')}</TabsContent>
      </Tabs>

      <ClientProfileModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        clientInfo={profileClientInfo}
      />
    </div>
  );
}
