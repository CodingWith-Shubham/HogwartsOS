'use client';

import { authFetch } from '@/lib/auth-fetch';

import { useEffect, useMemo, useState, useRef } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManagerShimmer } from '@/components/shared/ShimmerLoader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Briefcase, Camera, Scissors, CheckCircle, ExternalLink,
} from 'lucide-react';
import { formatINR, formatDate } from '@/lib/formatter';
import { useWorkflow } from '@/hooks/use-workflow';
import { useAuth } from '@/lib/auth-context';
import type { EditingProject, Lead, Shoot } from '@/lib/sheets/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ManagerTaskBoard } from '@/components/manager/ManagerTaskBoard';
import { findAssignedSalespersonEmail, findClientEmail, isExtraRevisionNeeded, postWebhook } from '@/lib/editing';

const EDITOR_WORKLOAD_URL = 'https://n8n.hogwartsstudios.com/webhook/editor-workload';

const DELIVERABLE_FIELDS = [
  { key: 'podcastDraft', payloadKey: 'podcast_draft', label: 'Podcast Draft' },
  { key: 'podcastEdit', payloadKey: 'podcast_edit', label: 'Podcast Edit' },
  { key: 'reelDraft', payloadKey: 'reel_draft', label: 'Reel Draft' },
  { key: 'reelEdit', payloadKey: 'reel_edit', label: 'Reel Edit' },
  { key: 'longFormatVideo', payloadKey: 'long_format_video', label: 'Long Format Video' },
  { key: 'teaserDemo', payloadKey: 'teaser_demo', label: 'Teaser Demo' },
  { key: 'teaser', payloadKey: 'teaser', label: 'Teaser' },
  { key: 'thumbnail', payloadKey: 'thumbnail', label: 'Thumbnail' },
] as const;

type DeliverableKey = (typeof DELIVERABLE_FIELDS)[number]['key'];

type DeliverableValues = Record<DeliverableKey, string>;

type EditorWorkload = {
  editorName: string;
  activeProjects: number;
  totalDeliverables: number;
} & Partial<DeliverableValues>;

const DEFAULT_DELIVERABLES: DeliverableValues = {
  podcastDraft: '0',
  podcastEdit: '0',
  reelDraft: '0',
  reelEdit: '0',
  longFormatVideo: '0',
  teaserDemo: '0',
  teaser: '0',
  thumbnail: '0',
};

const ASSIGNMENT_DELIVERABLE_FIELDS = [
  { key: 'podcastEdit', label: 'Podcast Edit', taskType: 'podcast_edit' },
  { key: 'teaserEdit', label: 'Teaser Edit', taskType: 'teaser_edit' },
  { key: 'reelEdit', label: 'Reel Edit', taskType: 'reel_edit' },
  { key: 'thumbnailEdit', label: 'Thumbnail Edit', taskType: 'thumbnail_edit' },
  { key: 'longFormatVideo', label: 'Long Form Edit', taskType: 'long_format_video', durationKey: 'longFormatDuration' },
  { key: 'shortFormatVideo', label: 'Short Form Edit', taskType: 'short_format_video', durationKey: 'shortFormatDuration' },
] as const;

type AssignmentDeliverableKey = (typeof ASSIGNMENT_DELIVERABLE_FIELDS)[number]['key'];

type AssignmentDeliverableValues = Record<AssignmentDeliverableKey, string> & {
  longFormatDuration: string;
  shortFormatDuration: string;
};

const DEFAULT_ASSIGNMENT_DELIVERABLES: AssignmentDeliverableValues = {
  podcastEdit: '0',
  teaserEdit: '0',
  reelEdit: '0',
  thumbnailEdit: '0',
  longFormatVideo: '0',
  longFormatDuration: '',
  shortFormatVideo: '0',
  shortFormatDuration: '',
};

function normalizeQuantity(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return '0';
  return String(Math.floor(parsed));
}

function totalDeliverables(values: DeliverableValues) {
  return DELIVERABLE_FIELDS.reduce(
    (sum, field) => sum + Number(normalizeQuantity(values[field.key])),
    0
  );
}

function leadDeliverables(lead: Lead | undefined): DeliverableValues {
  if (!lead) return { ...DEFAULT_DELIVERABLES };
  return {
    podcastDraft: normalizeQuantity(lead.podcastDraft),
    podcastEdit: normalizeQuantity(lead.podcastEdit),
    reelDraft: normalizeQuantity(lead.reelDraft),
    reelEdit: normalizeQuantity(lead.reelEdit),
    longFormatVideo: normalizeQuantity(lead.longFormatVideo),
    teaserDemo: normalizeQuantity(lead.teaserDemo),
    teaser: normalizeQuantity(lead.teaser),
    thumbnail: normalizeQuantity(lead.thumbnail),
  };
}

function leadAssignmentDeliverables(lead: Lead | undefined): AssignmentDeliverableValues {
  if (!lead) return { ...DEFAULT_ASSIGNMENT_DELIVERABLES };
  return {
    podcastEdit: normalizeQuantity(lead.podcastEdit),
    teaserEdit: normalizeQuantity(lead.teaserEdit),
    reelEdit: normalizeQuantity(lead.reelEdit),
    thumbnailEdit: normalizeQuantity(lead.thumbnailEdit),
    longFormatVideo: normalizeQuantity(lead.longFormatVideo),
    longFormatDuration: lead.longFormatDuration ?? '',
    shortFormatVideo: normalizeQuantity(lead.shortFormatVideo),
    shortFormatDuration: lead.shortFormatDuration ?? '',
  };
}

function workloadLevel(total: number) {
  if (total <= 0) return 'Free';
  if (total <= 5) return 'Low';
  if (total <= 15) return 'Medium';
  return 'High';
}

function workloadBadgeClass(level: string) {
  if (level === 'Free') return 'border-green-500/40 bg-green-500/15 text-green-600';
  if (level === 'Low') return 'border-blue-500/40 bg-blue-500/15 text-blue-600';
  if (level === 'Medium') return 'border-amber-500/40 bg-amber-500/15 text-amber-600';
  return 'border-red-500/40 bg-red-500/15 text-red-600';
}

function editorNameFromWorkload(item: Record<string, unknown>) {
  return String(item.editorName ?? item.editor_name ?? item.name ?? '').trim();
}

function workloadFromApi(item: Record<string, unknown>): EditorWorkload {
  const values = {
    podcastDraft: normalizeQuantity(item.podcastDraft ?? item.podcast_draft),
    podcastEdit: normalizeQuantity(item.podcastEdit ?? item.podcast_edit),
    reelDraft: normalizeQuantity(item.reelDraft ?? item.reel_draft),
    reelEdit: normalizeQuantity(item.reelEdit ?? item.reel_edit ?? item.reel),
    longFormatVideo: normalizeQuantity(item.longFormatVideo ?? item.long_format_video),
    teaserDemo: normalizeQuantity(item.teaserDemo ?? item.teaser_demo),
    teaser: normalizeQuantity(item.teaser),
    thumbnail: normalizeQuantity(item.thumbnail),
  };

  return {
    editorName: editorNameFromWorkload(item),
    activeProjects: Number(item.activeProjects ?? item.active_projects ?? 0) || 0,
    totalDeliverables: Number(item.totalDeliverables ?? item.total_deliverables) || totalDeliverables(values),
    ...values,
  };
}

function workloadForEditor(workloads: EditorWorkload[], editorName: string) {
  return workloads.find(
    (item) => item.editorName.trim().toLowerCase() === editorName.trim().toLowerCase()
  );
}

function isTrue(value: unknown) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function editorDropdownLabel(workloads: EditorWorkload[], editorName: string) {
  const workload = workloadForEditor(workloads, editorName);
  if (!workload) return editorName;

  const total = workload.totalDeliverables;
  const level = workloadLevel(total);
  return level === 'Free' ? `${editorName} (Free)` : `${editorName} (${level} - ${total})`;
}

function calculateWorkloadFromEditing(editingProjects: EditingProject[], editorsList: { name: string; email: string }[]): EditorWorkload[] {
  const activeStatuses = ['Editing', 'Extra Revision Approved', 'Revision Requested', 'Draft Sent', 'Draft Ready'];
  return editorsList.map((editor) => {
    const editorProjects = editingProjects.filter(
      (edit) =>
        edit.editorName.trim().toLowerCase() === editor.name.trim().toLowerCase() &&
        activeStatuses.includes(edit.status)
    );

    const values = {
      podcastDraft: '0',
      podcastEdit: '0',
      reelDraft: '0',
      reelEdit: '0',
      longFormatVideo: '0',
      teaserDemo: '0',
      teaser: '0',
      thumbnail: '0',
    };

    editorProjects.forEach((edit) => {
      values.podcastDraft = String(Number(values.podcastDraft) + Number(normalizeQuantity(edit.podcastDraft)));
      values.podcastEdit = String(Number(values.podcastEdit) + Number(normalizeQuantity(edit.podcastEdit)));
      values.reelDraft = String(Number(values.reelDraft) + Number(normalizeQuantity(edit.reelDraft)));
      values.reelEdit = String(Number(values.reelEdit) + Number(normalizeQuantity(edit.reel || edit.reelDraft)));
      values.longFormatVideo = String(Number(values.longFormatVideo) + Number(normalizeQuantity(edit.longFormatVideo)));
      values.teaserDemo = String(Number(values.teaserDemo) + Number(normalizeQuantity(edit.teaserDemo)));
      values.teaser = String(Number(values.teaser) + Number(normalizeQuantity(edit.teaser)));
      values.thumbnail = String(Number(values.thumbnail) + Number(normalizeQuantity(edit.thumbnail)));
    });

    const total = totalDeliverables(values);

    return {
      editorName: editor.name,
      activeProjects: editorProjects.length,
      totalDeliverables: total,
      ...values,
    };
  });
}

function WorkloadBreakdown({ workload }: { workload: EditorWorkload }) {
  const items = [
    Number(workload.podcastDraft || 0) || Number(workload.podcastEdit || 0)
      ? `🎙 Podcast: ${workload.podcastDraft || '0'} drafts, ${workload.podcastEdit || '0'} edits`
      : '',
    Number(workload.reelDraft || 0) || Number(workload.reelEdit || 0)
      ? `🎬 Reels: ${workload.reelDraft || '0'} drafts, ${workload.reelEdit || '0'} edits`
      : '',
    Number(workload.longFormatVideo || 0)
      ? `📹 Long Format: ${workload.longFormatVideo}`
      : '',
    Number(workload.teaserDemo || 0) || Number(workload.teaser || 0)
      ? `🎯 Teasers: ${workload.teaserDemo || '0'} demos, ${workload.teaser || '0'} final`
      : '',
    Number(workload.thumbnail || 0) ? `🖼 Thumbnails: ${workload.thumbnail}` : '',
  ].filter(Boolean);

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">No active deliverables.</p>;
  }

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

export default function ManagerPage() {
  const { user, users } = useAuth();

  const editors = useMemo(() => {
    const list = users.filter((u) => u.role === 'editor');
    return list.length > 0 ? list.map(u => ({ name: u.name, email: u.email })) : [
      { name: 'Shubham Singh Rana', email: 'mamgai75@gmail.com' },
      { name: 'Deepak Sharma', email: 'mamgai75@gmail.com' }
    ];
  }, [users]);

  const { triggerWorkflow, triggering } = useWorkflow();
  const [loading, setLoading] = useState(true);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [editing, setEditing] = useState<EditingProject[]>([]);
  const [editorWorkload, setEditorWorkload] = useState<EditorWorkload[]>([]);
  const [assignShoot, setAssignShoot] = useState<Shoot | null>(null);
  const [assigningEditor, setAssigningEditor] = useState(false);
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);
  const [approvingExtraId, setApprovingExtraId] = useState<string | null>(null);
  const [extraCosts, setExtraCosts] = useState<Record<string, string>>({});
  const [extraFeedback, setExtraFeedback] = useState<Record<string, string>>({});
  type AssignmentSplit = { quantity: number; editorName: string };
  const [serviceAssignments, setServiceAssignments] = useState<Record<string, AssignmentSplit[]>>({});
  const [assignmentErrors, setAssignmentErrors] = useState<Record<string, string>>({});
  
  const [assignForm, setAssignForm] = useState({
    serviceType: '',
    dataLink: '',
    additionalProduct: '',
    additionalProductQuantity: '0',
    managerComment: '',
    ...DEFAULT_ASSIGNMENT_DELIVERABLES,
  });

  useEffect(() => {
    let mounted = true;

    async function fetchDashboardData() {
      try {
        const [shootResponse, editingResponse, leadResponse] = await Promise.all([
          fetch('/api/shoots', { cache: 'no-store' }),
          fetch('/api/editing', { cache: 'no-store' }),
          fetch('/api/clients', { cache: 'no-store' }),
        ]);
        const [shootData, editingData, leadData] = await Promise.all([
          shootResponse.json(),
          editingResponse.json(),
          leadResponse.json(),
        ]);
        if (!mounted) return;
        if (shootResponse.ok) setShoots(shootData.shoots ?? []);
        if (editingResponse.ok) setEditing(editingData.editing ?? []);
        if (leadResponse.ok) setLeads(leadData.leads ?? []);
      } catch (error) {
        console.error('Failed to fetch manager dashboard data:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const editingRef = useRef(editing);
  const editorsRef = useRef(editors);

  useEffect(() => {
    editingRef.current = editing;
    editorsRef.current = editors;
  }, [editing, editors]);

  useEffect(() => {
    let mounted = true;

    async function fetchEditorWorkload() {
      try {
        const response = await fetch(EDITOR_WORKLOAD_URL, { cache: 'no-store' });
        const data = await response.json().catch(() => []);
        if (!mounted) return;

        const rows = Array.isArray(data) ? data : data.workload ?? data.editors ?? [];
        const apiWorkloads = rows
          .map((item: Record<string, unknown>) => workloadFromApi(item))
          .filter((item: EditorWorkload) => item.editorName);

        if (response.ok && apiWorkloads.length > 0) {
          setEditorWorkload(apiWorkloads);
        } else {
          setEditorWorkload(calculateWorkloadFromEditing(editingRef.current, editorsRef.current));
        }
      } catch (error) {
        console.error('Failed to fetch editor workload, using local calculation:', error);
        if (mounted) {
          setEditorWorkload(calculateWorkloadFromEditing(editingRef.current, editorsRef.current));
        }
      }
    }

    fetchEditorWorkload();
    const interval = setInterval(fetchEditorWorkload, 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const refreshEditing = async () => {
    const response = await authFetch('/api/editing', { cache: 'no-store' });
    const data = await response.json();
    if (response.ok) setEditing(data.editing ?? []);
  };

  const openAssignShoot = (shoot: Shoot) => {
    const lead = leads.find((item) => item.leadId === shoot.leadId);
    setAssignShoot(shoot);
    setAssignForm({
      serviceType: lead?.servicePitched ?? '',
      dataLink: shoot.dataLink,
      additionalProduct: '',
      additionalProductQuantity: '0',
      managerComment: '',
      ...leadAssignmentDeliverables(lead),
    });
    setServiceAssignments({});
    setAssignmentErrors({});
  };

  const handleAssignEditor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignShoot) return;

    const activeServices = ASSIGNMENT_DELIVERABLE_FIELDS.filter((field) => Number(normalizeQuantity(assignForm[field.key])) > 0);
    const additionalQuantity = Number(normalizeQuantity(assignForm.additionalProductQuantity));
    let hasError = false;
    const newErrors: Record<string, string> = {};
    
    const validateSplits = (key: string, requiredQty: number) => {
      const splits = serviceAssignments[key] || [];
      if (splits.length === 0) {
        newErrors[key] = 'Assign an editor';
        hasError = true;
        return;
      }
      const sum = splits.reduce((acc, split) => acc + (Number(split.quantity) || 0), 0);
      if (sum !== requiredQty) {
        newErrors[key] = `Assigned total (${sum}) must match required (${requiredQty})`;
        hasError = true;
      }
      if (splits.some(s => !s.editorName)) {
        newErrors[key] = 'Choose an editor for all splits';
        hasError = true;
      }
    };

    activeServices.forEach(field => validateSplits(field.key, Number(normalizeQuantity(assignForm[field.key]))));
    if (additionalQuantity > 0) validateSplits('additionalProduct', additionalQuantity);

    if (hasError) {
      setAssignmentErrors(newErrors);
      toast.error('Please fix assignment errors');
      return;
    }

    setAssigningEditor(true);
    try {
      const tasks: { task_type: string; quantity: number; task_label?: string; editor_name: string; editor_email: string }[] = [];
      
      activeServices.forEach((field) => {
        const splits = serviceAssignments[field.key] || [];
        splits.forEach((split) => {
          const editor = editors.find(e => e.name === split.editorName);
          for (let i = 0; i < split.quantity; i++) {
            tasks.push({
              task_type: field.taskType,
              quantity: 1,
              task_label: `${field.label}${split.quantity > 1 || splits.length > 1 ? ` (${i + 1})` : ''}`,
              editor_name: editor?.name ?? '',
              editor_email: editor?.email ?? ''
            });
          }
        });
      });

      if (additionalQuantity > 0) {
        const splits = serviceAssignments['additionalProduct'] || [];
        splits.forEach((split) => {
          const editor = editors.find(e => e.name === split.editorName);
          for (let i = 0; i < split.quantity; i++) {
            tasks.push({
              task_type: 'additional_product',
              quantity: 1,
              task_label: `${assignForm.additionalProduct || 'Additional Product'}${split.quantity > 1 || splits.length > 1 ? ` (${i + 1})` : ''}`,
              editor_name: editor?.name ?? '',
              editor_email: editor?.email ?? ''
            });
          }
        });
      }
      await postWebhook('/assign-editor-tasks', {
        shoot_id: assignShoot.shootId,
        lead_id: assignShoot.leadId,
        client_name: assignShoot.clientName,
        email_id: assignShoot.emailId,
        client_email: assignShoot.emailId,
        data_link: assignForm.dataLink,
        service_type: assignForm.serviceType,
        tasks,
        manager_comment: assignForm.managerComment.trim(),
      });
      toast.success('Editor assigned!');
      setAssignShoot(null);
      await refreshEditing();
    } catch (error) {
      toast.error('Failed to assign editor', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setAssigningEditor(false);
    }
  };

  const sendDraftToClient = async (edit: EditingProject) => {
    const clientEmail = findClientEmail(edit, leads);
    if (!clientEmail) {
      toast.error('Client email is missing', {
        description: 'Add the client email to the lead or editing row before sending the draft.',
      });
      return;
    }

    setSendingDraftId(edit.editId);
    try {
      await postWebhook('/send-draft-to-client', {
        edit_id: edit.editId,
        client_name: edit.clientName,
        client_email: clientEmail,
        draft_link: edit.currentDraftLink,
        revision_count: edit.revisionCount,
        assigned_salesperson_email: findAssignedSalespersonEmail(edit, leads),
      });
      toast.success('Draft sent to client!');
      setEditing((prev) =>
        prev.map((item) => (item.editId === edit.editId ? { ...item, status: 'Draft Sent' } : item))
      );
      await refreshEditing();
    } catch (error) {
      toast.error('Failed to send draft', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSendingDraftId(null);
    }
  };

  const approveExtraRevision = async (edit: EditingProject) => {
    setApprovingExtraId(edit.editId);
    try {
      await postWebhook('/confirm-extra-revision', {
        edit_id: edit.editId,
        extra_revision_cost: extraCosts[edit.editId] ?? edit.extraRevisionCost,
        feedback: extraFeedback[edit.editId] ?? '',
      });
      toast.success('Extra revision approved, editor notified!');
      setEditing((prev) =>
        prev.map((item) =>
          item.editId === edit.editId
            ? {
                ...item,
                status: 'Extra Revision Approved',
                extraRevisionApproved: true,
                revisionFeedback: extraFeedback[edit.editId] ?? item.revisionFeedback,
              }
            : item
        )
      );
      setExtraFeedback((prev) => ({ ...prev, [edit.editId]: '' }));
      await refreshEditing();
    } catch (error) {
      toast.error('Failed to approve extra revision', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setApprovingExtraId(null);
    }
  };

  const activeProjects = leads.filter(
    (lead) => lead.proposalAccepted && !['closed', 'delivered'].includes(lead.status.trim().toLowerCase())
  ).length;
  const pendingApprovals = editing.filter((edit) => edit.status === 'Draft Sent').length;
  const availableEditors = editorWorkload.filter((workload) => workloadLevel(workload.totalDeliverables) === 'Free').length;
  const scheduledShoots = shoots.length;
  const footageReady = useMemo(
    () => {
      const assignedShootIds = new Set(editing.map((edit) => edit.shootId).filter(Boolean));
      return shoots.filter(
        (shoot) =>
          isTrue(shoot.driveLinkUploaded) &&
          !assignedShootIds.has(shoot.shootId)
      );
    },
    [editing, shoots]
  );
  const inEditing = editing.filter((edit) => edit.status === 'Editing');
  const draftReady = editing.filter((edit) => edit.status === 'Draft Ready');
  const extraRevisionNeeded = editing.filter(isExtraRevisionNeeded);

  if (loading) {
    return <ManagerShimmer />;
  }

  return (
    <div>
      <PageHeader title="Manager" description="Assignments and approvals" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Active Projects" value={activeProjects} icon={Briefcase} />
        <StatCard title="Pending Approvals" value={pendingApprovals} icon={CheckCircle} />
        <StatCard title="Scheduled Shoots" value={scheduledShoots} icon={Camera} />
        <StatCard title="Available Editors" value={availableEditors} icon={Scissors} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Footage Ready for Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {footageReady.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No uploaded footage waiting for review.
            </p>
          ) : (
            footageReady.map((shoot) => (
              <div
                key={shoot.id}
                className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{shoot.clientName || 'Untitled shoot'}</p>
                    {isTrue(shoot.editedByShootTeam) && (
                      <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30">
                        Changes Made
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(shoot.shootDate)} · {shoot.shootMemberName || 'No shoot member'}
                  </p>
                  {isTrue(shoot.editedByShootTeam) && (
                    <p className="text-xs text-orange-600">
                      Additional cost: {formatINR(Number(shoot.additionalCost || 0))}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild disabled={!shoot.dataLink}>
                    <a href={shoot.dataLink} target="_blank" rel="noreferrer">
                      View Footage <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button size="sm" onClick={() => openAssignShoot(shoot)}>
                    <Scissors className="mr-1.5 h-3.5 w-3.5" />
                    Assign Editor
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ManagerTaskBoard editors={editors} canReallocate={user?.role === 'manager' || user?.role === 'admin'} />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Editor Workload</CardTitle>
        </CardHeader>
        <CardContent>
          {editorWorkload.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No workload data available yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {editorWorkload.map((workload) => {
                const level = workloadLevel(workload.totalDeliverables);
                return (
                  <div key={workload.editorName} className="rounded-md border border-border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-semibold">{workload.editorName}</p>
                      <Badge className={workloadBadgeClass(level)}>{level}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Active projects: {workload.activeProjects}
                    </p>
                    <WorkloadBreakdown workload={workload} />
                    <p className="text-sm font-medium">
                      Total deliverables: {workload.totalDeliverables}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">In Editing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {inEditing.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No projects in editing.</p>
          ) : (
            inEditing.map((edit) => (
              <div key={edit.editId} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{edit.clientName}</p>
                  <p className="text-xs text-muted-foreground">{edit.editorName} · {edit.serviceType || 'Edit'}</p>
                </div>
                <Badge variant="outline">Deadline {edit.deadlineAt || '-'}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Verify Editor Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {draftReady.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No drafts ready for manager review.</p>
          ) : (
            draftReady.map((edit) => (
              <div key={edit.editId} className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                <div>
                  <p className="text-sm font-medium">{edit.clientName}</p>
                  <p className="text-xs text-muted-foreground">{edit.editorName} · {edit.serviceType || 'Edit'}</p>
                </div>
                <p className="text-xs text-muted-foreground">Deadline: {edit.deadlineAt || '-'}</p>
                <Button variant="outline" size="sm" asChild disabled={!edit.currentDraftLink}>
                  <a href={edit.currentDraftLink} target="_blank" rel="noreferrer">
                    View Draft <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button size="sm" onClick={() => sendDraftToClient(edit)} disabled={sendingDraftId === edit.editId}>
                  Send to Client
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Extra Revision Approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {extraRevisionNeeded.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No extra revision approvals pending.</p>
          ) : (
            extraRevisionNeeded.map((edit) => (
              <div key={edit.editId} className="flex flex-col gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_180px_auto] lg:items-center">
                  <div>
                    <p className="text-sm font-medium">{edit.clientName}</p>
                    <p className="text-xs text-muted-foreground">{edit.editorName} · Revision {edit.revisionCount}/{edit.maxFreeRevisions}</p>
                  </div>
                  <Badge className="w-fit border-amber-500/40 bg-amber-500/15 text-amber-600">Sales confirmation needed</Badge>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Extra cost"
                    value={extraCosts[edit.editId] ?? edit.extraRevisionCost}
                    onChange={(event) =>
                      setExtraCosts((prev) => ({ ...prev, [edit.editId]: event.target.value }))
                    }
                  />
                  <Button size="sm" onClick={() => approveExtraRevision(edit)} disabled={approvingExtraId === edit.editId}>
                    Approve Extra Revision
                  </Button>
                </div>
                <div className="space-y-1.5 border-t border-amber-500/10 pt-2.5">
                  <Label htmlFor={`extra-feedback-${edit.editId}`} className="text-xs font-semibold text-muted-foreground">Changes Required (Hand over to Editor)</Label>
                  <Textarea
                    id={`extra-feedback-${edit.editId}`}
                    placeholder="Describe the changes needed..."
                    rows={2}
                    value={extraFeedback[edit.editId] ?? ''}
                    onChange={(event) =>
                      setExtraFeedback((prev) => ({ ...prev, [edit.editId]: event.target.value }))
                    }
                    className="text-xs bg-background"
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>



      <Dialog open={Boolean(assignShoot)} onOpenChange={(open) => !open && setAssignShoot(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Editor</DialogTitle>
            <DialogDescription>Send footage to editing and notify the selected editor.</DialogDescription>
          </DialogHeader>
          {assignShoot && (
            <form onSubmit={handleAssignEditor} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assign-client">Client Name</Label>
                  <Input id="assign-client" value={assignShoot.clientName} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-type">Service Type</Label>
                  <Input
                    id="service-type"
                    required
                    value={assignForm.serviceType}
                    onChange={(event) => setAssignForm((prev) => ({ ...prev, serviceType: event.target.value }))}
                    placeholder="Podcast / Reel / Long Format"
                  />
                </div>
                <div className="space-y-3 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium">Deliverable Assignment</p>
                    <p className="text-xs text-muted-foreground">
                      Automatically fetched from the client proposal.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {ASSIGNMENT_DELIVERABLE_FIELDS.map((field) => {
                      const durationKey = 'durationKey' in field ? field.durationKey : null;
                      const requiredQty = Number(normalizeQuantity(assignForm[field.key]));
                      const splits = serviceAssignments[field.key] || (requiredQty > 0 ? [{ quantity: requiredQty, editorName: '' }] : [{ quantity: 0, editorName: '' }]);
                      const currentAssigned = splits.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);

                      return (
                        <div className="space-y-2" key={field.key}>
                          <div className="flex justify-between items-center">
                            <Label>{field.label} {requiredQty > 0 && <span className="text-muted-foreground font-normal">(Required: {requiredQty})</span>}</Label>
                          </div>
                          
                          {splits.map((split, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <Input 
                                type="number" 
                                min="1" 
                                max={requiredQty}
                                value={requiredQty === 0 ? 0 : (split.quantity || '')} 
                                onChange={(e) => {
                                  const newSplits = [...splits];
                                  newSplits[index].quantity = Number(e.target.value);
                                  setServiceAssignments(prev => ({ ...prev, [field.key]: newSplits }));
                                  setAssignmentErrors(prev => ({ ...prev, [field.key]: '' }));
                                }}
                                disabled={requiredQty === 0}
                                className="w-16 h-10 text-center px-2" 
                              />
                              <Select 
                                value={split.editorName || ''} 
                                onValueChange={(value) => { 
                                  const newSplits = [...splits];
                                  newSplits[index].editorName = value;
                                  setServiceAssignments(prev => ({ ...prev, [field.key]: newSplits })); 
                                  setAssignmentErrors(prev => ({ ...prev, [field.key]: '' })); 
                                }} 
                                disabled={requiredQty === 0}
                              >
                                <SelectTrigger className="h-10 flex-1"><SelectValue placeholder="Choose editor" /></SelectTrigger>
                                <SelectContent>{editors.map((editor) => <SelectItem key={editor.name} value={editor.name}>{editorDropdownLabel(editorWorkload, editor.name)}</SelectItem>)}</SelectContent>
                              </Select>
                              {splits.length > 1 && (
                                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-red-500 shrink-0" onClick={() => {
                                  const newSplits = splits.filter((_, i) => i !== index);
                                  setServiceAssignments(prev => ({ ...prev, [field.key]: newSplits }));
                                }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </Button>
                              )}
                            </div>
                          ))}
                          
                          {requiredQty > 0 && currentAssigned < requiredQty && (
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              className="w-full text-xs h-8 border-dashed"
                              onClick={() => {
                                const newSplits = [...splits, { quantity: requiredQty - currentAssigned, editorName: '' }];
                                setServiceAssignments(prev => ({ ...prev, [field.key]: newSplits }));
                              }}
                            >
                              + Add Split (Remaining: {requiredQty - currentAssigned})
                            </Button>
                          )}

                          {durationKey && <p className="text-xs text-muted-foreground">Duration: {assignForm[durationKey] || '-'}</p>}
                          {assignmentErrors[field.key] && <p className="text-xs text-red-500">{assignmentErrors[field.key]}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="additional-product">Additional Products</Label>
                  <Select
                    value={assignForm.additionalProduct}
                    onValueChange={(value) => setAssignForm((prev) => ({ ...prev, additionalProduct: value }))}
                  >
                    <SelectTrigger id="additional-product">
                      <SelectValue placeholder="Choose an additional product" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNMENT_DELIVERABLE_FIELDS.map((field) => (
                        <SelectItem key={field.key} value={field.label}>{field.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="additional-product-quantity">Additional Product Quantity</Label>
                  <Input
                    id="additional-product-quantity"
                    type="number"
                    min="0"
                    step="1"
                    value={assignForm.additionalProductQuantity}
                    onChange={(event) => setAssignForm((prev) => ({ ...prev, additionalProductQuantity: event.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Additional Product Editor</Label>
                  {(() => {
                    const requiredQty = Number(normalizeQuantity(assignForm.additionalProductQuantity));
                    if (requiredQty === 0) {
                        return (
                          <Select disabled>
                            <SelectTrigger className="h-10"><SelectValue placeholder="Choose editor" /></SelectTrigger>
                          </Select>
                        );
                    }
                    const splits = serviceAssignments['additionalProduct'] || [{ quantity: requiredQty, editorName: '' }];
                    const currentAssigned = splits.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);

                    return (
                      <div className="space-y-2">
                        {splits.map((split, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <Input 
                              type="number" 
                              min="1" 
                              max={requiredQty}
                              value={split.quantity || ''} 
                              onChange={(e) => {
                                const newSplits = [...splits];
                                newSplits[index].quantity = Number(e.target.value);
                                setServiceAssignments(prev => ({ ...prev, additionalProduct: newSplits }));
                                setAssignmentErrors(prev => ({ ...prev, additionalProduct: '' }));
                              }}
                              className="w-16 h-10 text-center px-2" 
                            />
                            <Select 
                              value={split.editorName || ''} 
                              onValueChange={(value) => { 
                                const newSplits = [...splits];
                                newSplits[index].editorName = value;
                                setServiceAssignments(prev => ({ ...prev, additionalProduct: newSplits })); 
                                setAssignmentErrors(prev => ({ ...prev, additionalProduct: '' })); 
                              }} 
                            >
                              <SelectTrigger className="h-10 flex-1"><SelectValue placeholder="Choose editor" /></SelectTrigger>
                              <SelectContent>{editors.map((editor) => <SelectItem key={editor.name} value={editor.name}>{editorDropdownLabel(editorWorkload, editor.name)}</SelectItem>)}</SelectContent>
                            </Select>
                            {splits.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-red-500 shrink-0" onClick={() => {
                                const newSplits = splits.filter((_, i) => i !== index);
                                setServiceAssignments(prev => ({ ...prev, additionalProduct: newSplits }));
                              }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                              </Button>
                            )}
                          </div>
                        ))}
                        
                        {currentAssigned < requiredQty && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-xs h-8 border-dashed"
                            onClick={() => {
                              const newSplits = [...splits, { quantity: requiredQty - currentAssigned, editorName: '' }];
                              setServiceAssignments(prev => ({ ...prev, additionalProduct: newSplits }));
                            }}
                          >
                            + Add Split (Remaining: {requiredQty - currentAssigned})
                          </Button>
                        )}
                        {assignmentErrors.additionalProduct && <p className="text-xs text-red-500">{assignmentErrors.additionalProduct}</p>}
                      </div>
                    );
                  })()}
                </div>
                <div className="space-y-2 sm:col-span-2 border border-border rounded-md p-3 bg-muted/30">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Editor Availability & Workload</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5">
                    {editors.map((editor) => {
                      const workload = workloadForEditor(editorWorkload, editor.name);
                      const total = workload?.totalDeliverables ?? 0;
                      const level = workloadLevel(total);
                      return (
                        <div
                          key={editor.name}
                          className="rounded-md border border-border bg-card p-2 text-left"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium">{editor.name}</span>
                            <Badge className={cn("text-[9px] px-1 py-0", workloadBadgeClass(level))}>
                              {level}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Projects: {workload?.activeProjects ?? 0}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Deliverables: {total}
                          </p>
                          {workload && total > 0 && (
                            <div className="mt-1 border-t border-border/50 pt-1 text-[9px] text-muted-foreground/80 space-y-0.5">
                              {Number(workload.podcastDraft || 0) > 0 && <div>🎙 Pod D: {workload.podcastDraft}</div>}
                              {Number(workload.podcastEdit || 0) > 0 && <div>🎙 Pod E: {workload.podcastEdit}</div>}
                              {Number(workload.reelDraft || 0) > 0 && <div>🎬 Reel D: {workload.reelDraft}</div>}
                              {Number(workload.reelEdit || 0) > 0 && <div>🎬 Reel E: {workload.reelEdit}</div>}
                              {Number(workload.longFormatVideo || 0) > 0 && <div>📹 Long: {workload.longFormatVideo}</div>}
                              {Number(workload.teaserDemo || 0) > 0 && <div>🎯 Teas D: {workload.teaserDemo}</div>}
                              {Number(workload.teaser || 0) > 0 && <div>🎯 Teas E: {workload.teaser}</div>}
                              {Number(workload.thumbnail || 0) > 0 && <div>🖼 Thumb: {workload.thumbnail}</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="data-link">Data Link</Label>
                  <Input
                    id="data-link"
                    required
                    value={assignForm.dataLink}
                    onChange={(event) => setAssignForm((prev) => ({ ...prev, dataLink: event.target.value }))}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="manager-comment">Manager Comment</Label>
                  <Textarea
                    id="manager-comment"
                    value={assignForm.managerComment}
                    onChange={(event) => setAssignForm((prev) => ({ ...prev, managerComment: event.target.value }))}
                    placeholder="Add any instructions for the editor..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAssignShoot(null)}>Cancel</Button>
                <Button type="submit" disabled={assigningEditor}>Assign Editor</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>


    </div>
  );
}
