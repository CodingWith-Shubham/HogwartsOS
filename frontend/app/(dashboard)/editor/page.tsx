'use client';

import { authFetch } from '@/lib/auth-fetch';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { TableShimmer } from '@/components/shared/ShimmerLoader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  FileText,
  HardDrive,
  MessageSquare,
  Scissors,
  Send,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatter';
import { useAuth } from '@/lib/auth-context';
import type { EditingProject } from '@/lib/sheets/types';
import { postWebhook } from '@/lib/editing';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DELIVERABLE_FIELDS = [
  { key: 'podcastDraft', label: 'Podcast Draft', pill: '🎙 Podcast Drafts' },
  { key: 'podcastEdit', label: 'Podcast Edit', pill: '🎙 Podcast Edits' },
  { key: 'reelDraft', label: 'Reel Draft', pill: '🎬 Reel Drafts' },
  { key: 'reel', label: 'Reel Edit', pill: '🎬 Reel Edits' },
  { key: 'longFormatVideo', label: 'Long Format Video', pill: '📹 Long Format' },
  { key: 'teaserDemo', label: 'Teaser Demo', pill: '🎯 Teaser Demos' },
  { key: 'teaser', label: 'Teaser', pill: '🎯 Teasers' },
  { key: 'thumbnail', label: 'Thumbnail', pill: '🖼 Thumbnails' },
] as const;

type DeliverableKey = (typeof DELIVERABLE_FIELDS)[number]['key'];

function quantity(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function projectDeliverables(edit: EditingProject) {
  return DELIVERABLE_FIELDS.map((field) => ({
    ...field,
    count: quantity(String(edit[field.key] ?? '0')),
  })).filter((item) => item.count > 0);
}

function isSameEditor(edit: EditingProject, name = '', email = '') {
  const editorName = edit.editorName.trim().toLowerCase();
  const editorEmail = edit.editorEmail.trim().toLowerCase();
  return editorName === name.trim().toLowerCase() || editorEmail === email.trim().toLowerCase();
}

function hoursUntil(value: string) {
  if (!value) return null;
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return null;
  return (deadline.getTime() - Date.now()) / 36e5;
}

function DeadlineBadge({ deadlineAt }: { deadlineAt: string }) {
  const hours = hoursUntil(deadlineAt);
  if (hours === null) {
    return <Badge variant="outline">Deadline {deadlineAt || '-'}</Badge>;
  }

  const urgent = hours <= 6;
  const label =
    hours <= 0 ? 'Deadline passed' : `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m left`;

  return (
    <Badge
      className={cn(
        'w-fit',
        urgent
          ? 'animate-pulse border-red-500/40 bg-red-500/15 text-red-600'
          : 'border-blue-500/40 bg-blue-500/15 text-blue-600'
      )}
    >
      {label}
    </Badge>
  );
}

function DeliverableTracking({
  edit,
  done,
  onToggle,
}: {
  edit: EditingProject;
  done: Partial<Record<DeliverableKey, boolean>>;
  onToggle: (key: DeliverableKey, checked: boolean) => void;
}) {
  const deliverables = projectDeliverables(edit);

  if (deliverables.length === 0) return null;

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-1.5">
        {deliverables.map((item) => (
          <Badge key={item.key} variant="outline" className="text-xs">
            {item.pill} {item.count}
          </Badge>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Progress</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {deliverables.map((item) => {
            const checked = Boolean(done[item.key]);
            return (
              <label
                key={item.key}
                htmlFor={`done-${edit.editId}-${item.key}`}
                className={cn(
                  'flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm',
                  checked && 'bg-green-500/10 text-green-600 border-green-500/30'
                )}
              >
                <Checkbox
                  id={`done-${edit.editId}-${item.key}`}
                  checked={checked}
                  onCheckedChange={(value) => onToggle(item.key, Boolean(value))}
                />
                {item.label} ({item.count}) {checked ? 'Done' : ''}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RevisionText(edit: EditingProject) {
  return `Revision ${edit.revisionCount}/${edit.maxFreeRevisions}`;
}

export default function EditorPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingProject[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [draftLinks, setDraftLinks] = useState<Record<string, string>>({});
  const [submittingDraftId, setSubmittingDraftId] = useState<string | null>(null);
  const [arrangingCallId, setArrangingCallId] = useState<string | null>(null);
  const [deliverableDone, setDeliverableDone] = useState<Record<string, Partial<Record<DeliverableKey, boolean>>>>({});
  // Keep the previous server snapshot outside render state. `revisions` is a
  // newly filtered array on every render, so storing it in state here would
  // trigger this effect again indefinitely.
  const prevRevisionsRef = useRef<EditingProject[] | null>(null);

  const refreshEditing = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await authFetch('/api/editing', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to refresh editing rows');
      }
      setEditing(data.editing ?? []);
    } catch (error) {
      if (!silent) {
        toast.error('Failed to refresh editing rows', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function init() {
      await refreshEditing(true);
      if (mounted) setLoading(false);
    }
    init();
    const interval = setInterval(() => refreshEditing(true), 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshEditing]);

  const editorEdits = editing;

  const assigned = editorEdits.filter((edit) =>
    ['Editing', 'Extra Revision Approved'].includes(edit.status)
  );
  const drafts = editorEdits.filter((edit) => edit.status === 'Draft Sent');
  const revisions = editorEdits.filter((edit) => edit.status === 'Revision Requested');
  const delivered = editorEdits.filter((edit) => edit.status === 'Delivered' && edit.finalDelivered);

  useEffect(() => {
    const prevRevisions = prevRevisionsRef.current;
    if (prevRevisions !== null && revisions.length > prevRevisions.length) {
      const newRev = revisions.find((r) => {
        const prev = prevRevisions.find((p) => p.editId === r.editId);
        return !prev || r.revisionCount > prev.revisionCount;
      });
      const editorName = newRev?.editorName || 'an editor';
      toast.error(`New revision requested for ${editorName}!`, {
        description: `Project "${newRev?.clientName || 'Untitled'}" (${newRev?.serviceType || 'Video'}) has a pending revision.`,
        duration: 8000,
      });
    }
    prevRevisionsRef.current = revisions;
  }, [revisions]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Editor" description="Deliverables queue and status tracking" />
        <TableShimmer rows={6} cols={5} />
      </div>
    );
  }

  const markDraftReady = async (edit: EditingProject) => {
    const draftLink = draftLinks[edit.editId] ?? '';
    if (!draftLink) return;

    setSubmittingDraftId(edit.editId);
    try {
      await postWebhook('/draft-ready', {
        edit_id: edit.editId,
        draft_link: draftLink,
        revision_count: edit.revisionCount,
      });
      toast.success(edit.status === 'Revision Requested' ? 'Revision marked done!' : 'Draft marked ready!');
      setDraftLinks((prev) => ({ ...prev, [edit.editId]: '' }));
      await refreshEditing(true);
    } catch (error) {
      toast.error('Failed to mark draft ready', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSubmittingDraftId(null);
    }
  };

  const arrangeCall = async (edit: EditingProject) => {
    setArrangingCallId(edit.editId);
    try {
      await postWebhook('/arrange-call', {
        edit_id: edit.editId,
        editor_name: edit.editorName,
      });
      toast.success('Sales rep has been notified to arrange a call.');
    } catch (error) {
      toast.error('Failed to request call', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setArrangingCallId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Editor"
        description="Post-production queue, drafts, and revisions"
        actions={
          <Button variant="outline" size="sm" onClick={() => refreshEditing()} disabled={refreshing}>
            Refresh
          </Button>
        }
      />

      {revisions.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-600 flex items-start gap-3 animate-pulse">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm">Revision(s) Pending Attention</h4>
            <p className="text-xs text-red-500/90 mt-1">
              You have {revisions.length} project(s) currently requiring revisions. Please switch to the **Revisions** tab to check the feedback and submit your updated draft links.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Assigned" value={assigned.length} icon={Scissors} />
        <StatCard title="Drafts Sent" value={drafts.length} icon={FileText} />
        <StatCard title="In Revision" value={revisions.length} icon={AlertCircle} />
        <StatCard title="Delivered" value={delivered.length} icon={CheckCircle} />
      </div>

      <Tabs defaultValue="assigned">
        <TabsList>
          <TabsTrigger value="assigned">Assigned</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
          <TabsTrigger value="revisions">Revisions</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
        </TabsList>

        <TabsContent value="assigned" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assigned.map((edit) => (
              <Card key={edit.editId}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{edit.clientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {edit.serviceType || 'Edit'}
                        {edit.editorName && ` · Editor: ${edit.editorName}`}
                      </p>
                    </div>
                    <Badge variant="outline">{edit.status}</Badge>
                  </div>
                  <DeadlineBadge deadlineAt={edit.deadlineAt} />
                  <Button variant="outline" size="sm" asChild disabled={!edit.dataLink}>
                    <a href={edit.dataLink} target="_blank" rel="noreferrer">
                      <HardDrive className="mr-1.5 h-3.5 w-3.5" />
                      View Footage
                    </a>
                  </Button>
                  <DeliverableTracking
                    edit={edit}
                    done={deliverableDone[edit.editId] ?? {}}
                    onToggle={(key, checked) =>
                      setDeliverableDone((prev) => ({
                        ...prev,
                        [edit.editId]: {
                          ...(prev[edit.editId] ?? {}),
                          [key]: checked,
                        },
                      }))
                    }
                  />
                  <div className="space-y-2 border-t border-border pt-3">
                    <Label htmlFor={`draft-${edit.editId}`}>Draft Link</Label>
                    <Input
                      id={`draft-${edit.editId}`}
                      value={draftLinks[edit.editId] ?? ''}
                      onChange={(event) =>
                        setDraftLinks((prev) => ({ ...prev, [edit.editId]: event.target.value }))
                      }
                      placeholder="https://drive.google.com/..."
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => markDraftReady(edit)}
                      disabled={!draftLinks[edit.editId] || submittingDraftId === edit.editId}
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Mark Draft Ready
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {assigned.length === 0 && (
              <Card className="md:col-span-2">
                <CardContent className="py-12 text-center">
                  <Scissors className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No assigned edits for this editor.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="drafts" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {drafts.map((edit) => (
              <Card key={edit.editId}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{edit.clientName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Editor: {edit.editorName || 'Unassigned'}
                      </p>
                    </div>
                    <Badge variant="outline">{RevisionText(edit)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sent {edit.assignedAt ? formatRelativeTime(edit.assignedAt) : 'to client'}
                  </p>
                  <Button variant="outline" size="sm" asChild disabled={!edit.currentDraftLink}>
                    <a href={edit.currentDraftLink} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      View Draft
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
            {drafts.length === 0 && (
              <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No drafts awaiting client review.</p></CardContent></Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="revisions" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {revisions.map((edit) => (
              <Card key={edit.editId}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{edit.clientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {edit.serviceType || 'Edit'}
                        {edit.editorName && ` · Editor: ${edit.editorName}`}
                      </p>
                    </div>
                    <Badge className="border-red-500/40 bg-red-500/15 text-red-600">
                      {RevisionText(edit)}
                    </Badge>
                  </div>
                  {edit.revisionFeedback ? (
                    <div className="rounded-md bg-muted p-2.5 text-sm border border-border">
                      <p className="font-medium text-xs text-muted-foreground mb-1">Client / Manager Revision Feedback:</p>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{edit.revisionFeedback}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600/80 italic">
                      No feedback submitted yet. Please arrange a call with the client if clarification is needed.
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor={`revision-draft-${edit.editId}`}>Updated Draft Link</Label>
                    <Input
                      id={`revision-draft-${edit.editId}`}
                      value={draftLinks[edit.editId] ?? ''}
                      onChange={(event) =>
                        setDraftLinks((prev) => ({ ...prev, [edit.editId]: event.target.value }))
                      }
                      placeholder="https://drive.google.com/updated..."
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => markDraftReady(edit)}
                      disabled={!draftLinks[edit.editId] || submittingDraftId === edit.editId}
                    >
                      Mark Revision Done
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => arrangeCall(edit)} disabled={arrangingCallId === edit.editId}>
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                      Arrange Call
                    </Button>
                  </div>
                  </CardContent>
              </Card>
            ))}
            {revisions.length === 0 && (
              <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No revisions requested.</p></CardContent></Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="delivered" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {delivered.map((edit) => (
              <Card key={edit.editId}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{edit.clientName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {edit.serviceType || 'Completed project'}
                        {edit.editorName && ` · Editor: ${edit.editorName}`}
                      </p>
                    </div>
                    <Badge className="border-green-500/40 bg-green-500/15 text-green-600">Delivered</Badge>
                  </div>
                  {edit.currentDraftLink && (
                    <a href={edit.currentDraftLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#58A6FF] hover:underline">
                      <CheckCircle className="h-3 w-3" />
                      Final delivery
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
            {delivered.length === 0 && (
              <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No delivered edits yet.</p></CardContent></Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
