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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Briefcase, Camera, Scissors, CheckCircle, ExternalLink, Loader2, HardDrive, Mail,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { formatINR, formatDate } from '@/lib/formatter';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { useWorkflow } from '@/hooks/use-workflow';
import { useAuth } from '@/lib/auth-context';
import type { EditingProject, Lead, Shoot } from '@/lib/sheets/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ManagerTaskBoard } from '@/components/manager/ManagerTaskBoard';
import { findAssignedSalespersonEmail, findClientEmail, isExtraRevisionNeeded, postWebhook } from '@/lib/editing';
import {
  UpsellCrossSellPipeline,
  type UpsellCrossSellEntry,
  type PendingAssignmentEntry,
} from '@/components/clients/UpsellCrossSellPipeline';
import { UpsellCrossSellAnalyticsWidget } from '@/components/dashboard/UpsellCrossSellAnalyticsWidget';

const EDITOR_WORKLOAD_URL = '/api/editing/workload';
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

function leadAssignmentDeliverables(lead: Lead | undefined, shoot?: Shoot): AssignmentDeliverableValues {
  if (!lead) return { ...DEFAULT_ASSIGNMENT_DELIVERABLES };
  
  // If we have a shoot with a deliverableSetIndex and the lead has deliverableSets array
  if (shoot && shoot.deliverableSetIndex != null && String(shoot.deliverableSetIndex) !== '') {
    let dsIndex = Number(shoot.deliverableSetIndex);
    if (dsIndex >= 100) dsIndex = dsIndex % 100;
    const deliverableSets = lead.deliverableSets || (lead as any).deliverable_sets;
    if (deliverableSets && deliverableSets[dsIndex]) {
      const set = deliverableSets[dsIndex];
      return {
        podcastEdit: normalizeQuantity(set.podcastEdit || '0'),
        teaserEdit: normalizeQuantity(set.teaserEdit || '0'),
        reelEdit: normalizeQuantity(set.reelEdit || '0'),
      thumbnailEdit: normalizeQuantity(set.thumbnailEdit || '0'),
      longFormatVideo: normalizeQuantity(set.longFormatVideo || '0'),
      longFormatDuration: set.longFormatDuration ?? '',
      shortFormatVideo: normalizeQuantity(set.shortFormatVideo || '0'),
      shortFormatDuration: set.shortFormatDuration ?? '',
    };
  }
}

// Fallback to legacy flat fields for old shoots
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


function workloadForEditor(workloads: EditorWorkload[], editorName: string) {
  return workloads.find(
    (item) => (item.editorName || '').trim().toLowerCase() === (editorName || '').trim().toLowerCase()
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
    const list = users.filter((u) => u.role === 'editor' && u.isActive !== false);
    return list.length > 0 ? list.map(u => ({ name: u.name, email: u.email })) : [
      { name: 'Shubham Singh Rana', email: 'mamgai75@gmail.com' },
      { name: 'Deepak Sharma', email: 'mamgai75@gmail.com' }
    ];
  }, [users]);

  const marketingMembers = useMemo(() => {
    const list = users.filter((u) => u.role === 'marketing' && u.isActive !== false);
    return list.map(u => ({ name: u.name, email: u.email }));
  }, [users]);

  const { triggerWorkflow, triggering } = useWorkflow();
  const [loading, setLoading] = useState(true);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [editing, setEditing] = useState<EditingProject[]>([]);
  const [marketingTasks, setMarketingTasks] = useState<any[]>([]);
  const [editorWorkload, setEditorWorkload] = useState<EditorWorkload[]>([]);
  const [assignShoot, setAssignShoot] = useState<Shoot | null>(null);
  const [assigningEditor, setAssigningEditor] = useState(false);
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);
  const [approvingExtraId, setApprovingExtraId] = useState<string | null>(null);
  const [feedbackTask, setFeedbackTask] = useState<any | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [confirmMarketingAssign, setConfirmMarketingAssign] = useState<{taskId: string, assigneeName: string} | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [extraCosts, setExtraCosts] = useState<Record<string, string>>({});
  const [extraFeedback, setExtraFeedback] = useState<Record<string, string>>({});
  type AssignmentSplit = { quantity: number; editorName: string };
  const [serviceAssignments, setServiceAssignments] = useState<Record<string, AssignmentSplit[]>>({});
  const [assignmentErrors, setAssignmentErrors] = useState<Record<string, string>>({});
  const [revisionRevenue, setRevisionRevenue] = useState(0);
  const [activeTab, setActiveTab] = useState('assign_editor');
  const [upsellEntries, setUpsellEntries] = useState<UpsellCrossSellEntry[]>([]);
  const [pendingUpsells, setPendingUpsells] = useState<PendingAssignmentEntry[]>([]);
  const [assignUpsell, setAssignUpsell] = useState<PendingAssignmentEntry | null>(null);
  const [upsellEditor, setUpsellEditor] = useState('');
  const [assigningUpsell, setAssigningUpsell] = useState(false);

  const [footageReadyPage, setFootageReadyPage] = useState(1);
  const [upsellPage, setUpsellPage] = useState(1);
  const [draftReadyPage, setDraftReadyPage] = useState(1);
  const [extraRevisionNeededPage, setExtraRevisionNeededPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  
  const [assignForm, setAssignForm] = useState({
    serviceType: '',
    dataLink: '',
    managerComment: '',
    ...DEFAULT_ASSIGNMENT_DELIVERABLES,
  });

  useEffect(() => {
    let mounted = true;

    async function fetchDashboardData() {
      try {
        const [shootResponse, editingResponse, leadResponse, revenueResponse, marketingResponse] = await Promise.all([
          fetch('/api/shoots?managerView=true', { cache: 'no-store' }),
          fetch('/api/editing?managerView=true', { cache: 'no-store' }),
          fetch('/api/clients?managerView=true', { cache: 'no-store' }),
          fetch('/api/dashboard/revenue', { cache: 'no-store' }),
          fetch('/api/marketing?status=Unassigned', { cache: 'no-store' }),
        ]);
        const [shootData, editingData, leadData, revenueData, marketingData] = await Promise.all([
          shootResponse.json(),
          editingResponse.json(),
          leadResponse.json(),
          revenueResponse.ok ? revenueResponse.json() : Promise.resolve(null),
          marketingResponse.ok ? marketingResponse.json() : Promise.resolve(null),
        ]);
        if (!mounted) return;
        if (shootResponse.ok) setShoots(shootData.shoots ?? []);
        if (editingResponse.ok) {
          const rawProjects = editingData.editingProjects ?? editingData.editing ?? [];
          const tasks = editingData.tasks ?? [];
          const parentEditIds = new Set(tasks.map((t: any) => t.editId));
          const projects = rawProjects.filter((p: any) => !parentEditIds.has(p.editId));
          const mappedTasks = tasks.map((t: any) => ({
            editId: t.taskId || t._id || Math.random().toString(),
            shootId: t.shootId || t.shoot_id || '',
            leadId: t.leadId || t.lead_id || '',
            emailId: t.emailId || t.email_id || t.clientEmailId || t.client_email_id || '',
            clientName: t.clientName || t.client_name || '',
            editorName: t.assignedToName || t.editor_name || '',
            serviceType: t.taskLabel || t.taskType || t.serviceType || t.task_type || '',
            status: t.status || 'Assigned',
            deadlineAt: t.deadlineAt || t.deadline_at || '',
            currentDraftLink: t.draftLink || t.draft_link || '',
            revisionCount: t.revisionCount || 0,
            maxFreeRevisions: t.maxFreeRevisions || 0,
            extraRevisionApproved: t.extraRevisionApproved || false,
            extraRevisionCost: t.extraRevisionCost || "0",
            editorComment: t.editorComment || ''
          }));
          setEditing([...projects, ...mappedTasks]);
        }
        if (leadResponse.ok) setLeads(leadData.leads ?? []);
        if (revenueData && revenueData.data && revenueData.data.metrics) {
          setRevisionRevenue(revenueData.data.metrics.revisionAddonRevenue ?? 0);
        }
        if (marketingData && marketingData.data && marketingData.data.tasks) {
          setMarketingTasks(marketingData.data.tasks);
        }
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
        const response = await authFetch(EDITOR_WORKLOAD_URL, { cache: 'no-store' });
        const data = await response.json();
        if (!mounted) return;

        if (response.ok && Array.isArray(data.workloads)) {
          setEditorWorkload(data.workloads);
        } else {
          setEditorWorkload([]);
        }
      } catch (error) {
        console.error('Failed to fetch editor workload:', error);
        if (mounted) {
          setEditorWorkload([]);
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

  // Upsell & Cross-Sell pipeline (isolated from the main CRM data)
  const refreshUpsells = async () => {
    try {
      const [listRes, pendingRes] = await Promise.all([
        authFetch('/api/upsell-crosssell', { cache: 'no-store' }),
        authFetch('/api/upsell-crosssell/pending-editor-assignment', { cache: 'no-store' }),
      ]);
      const listPayload = await listRes.json().catch(() => ({}));
      const pendingPayload = await pendingRes.json().catch(() => ({}));
      if (listRes.ok) setUpsellEntries(listPayload.data?.entries ?? []);
      if (pendingRes.ok) setPendingUpsells(pendingPayload.data?.entries ?? []);
    } catch (error) {
      console.error('Failed to fetch upsell/cross-sell entries:', error);
    }
  };

  useEffect(() => {
    refreshUpsells();
    const interval = setInterval(refreshUpsells, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAssignUpsellEditor = async () => {
    if (!assignUpsell || !upsellEditor) return;
    setAssigningUpsell(true);
    try {
      // Fire the same editor-assignment n8n webhook used by the regular shoot
      // flow first, then advance the upsell/cross-sell record in MongoDB.
      const editor = editors.find((item) => item.name === upsellEditor);
      const matchingShoot = shoots
        .filter((shoot) => shoot.leadId === assignUpsell.clientLeadId)
        .sort((a, b) => String(b.createdAt || b.shootDate).localeCompare(String(a.createdAt || a.shootDate)))[0];

      await postWebhook('/assign-editor-tasks', {
        shoot_id: matchingShoot?.shootId ?? '',
        lead_id: assignUpsell.clientLeadId,
        client_name: assignUpsell.clientName,
        email_id: assignUpsell.clientEmail ?? '',
        client_email: assignUpsell.clientEmail ?? '',
        data_link: assignUpsell.shootLink ?? '',
        service_type: assignUpsell.services.join(', '),
        tasks: [
          {
            task_type: 'editing',
            quantity: 1,
            task_label: `${assignUpsell.services.join(', ')} #1`,
            editor_name: editor?.name ?? upsellEditor,
            editor_email: editor?.email ?? '',
          },
        ],
        manager_comment: '',
        upsell_crosssell_id: assignUpsell._id,
      });

      const response = await authFetch(`/api/upsell-crosssell/${assignUpsell._id}/assign-editor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editorAssigned: upsellEditor }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to assign editor');
      toast.success('Editor assigned — deal moved to Editing');
      setAssignUpsell(null);
      setUpsellEditor('');
      await refreshUpsells();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to assign editor');
    } finally {
      setAssigningUpsell(false);
    }
  };

  const refreshEditing = async () => {
    const response = await authFetch('/api/editing', { cache: 'no-store' });
    const data = await response.json();
    if (response.ok) {
      const rawProjects = data.editingProjects ?? data.editing ?? [];
      const tasks = data.tasks ?? [];
      const parentEditIds = new Set(tasks.map((t: any) => t.editId));
      const projects = rawProjects.filter((p: any) => !parentEditIds.has(p.editId));
      const mappedTasks = tasks.map((t: any) => ({
        ...t,
        editId: t.taskId || t._id || Math.random().toString(),
        shootId: t.shootId || t.shoot_id,
        clientName: t.clientName || t.client_name || '',
        editorName: t.assignedToName || t.editor_name || '',
        serviceType: t.taskLabel || t.taskType || t.serviceType || t.task_type || '',
        status: t.status || 'Assigned',
        deadlineAt: t.deadlineAt || t.deadline_at || '',
        currentDraftLink: t.draftLink || t.draft_link || '',
        revisionCount: t.revisionCount || 0,
        maxFreeRevisions: t.maxFreeRevisions || 0,
        editorComment: t.editorComment || '',
      }));
      const mappedProjects = projects.map((p: any) => ({
        ...p,
        editId: p.editId || p._id || Math.random().toString(),
      }));
      setEditing([...mappedProjects, ...mappedTasks]);
    }
  };

  const refreshMarketing = async () => {
    const response = await authFetch('/api/marketing?status=Unassigned', { cache: 'no-store' });
    const data = await response.json();
    if (response.ok && data.data && data.data.tasks) {
      setMarketingTasks(data.data.tasks);
    }
  };

  const handleAssignMarketing = async (taskId: string, assigneeName: string) => {
    const member = marketingMembers.find((item) => item.name === assigneeName);
    if (!member) return;
    
    try {
      const response = await authFetch(`/api/marketing/${taskId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToName: member.name, assignedToEmail: member.email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to assign task');
      toast.success('Marketing task assigned');
      await refreshMarketing();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to assign marketing task');
    }
  };

  const openAssignShoot = (shoot: Shoot) => {
    const lead = leads.find((item) => item.leadId === shoot.leadId);
    
    let resolvedServiceType = lead?.servicePitched ?? '';
    if (shoot.deliverableSetIndex != null && String(shoot.deliverableSetIndex) !== '') {
      let dsIndex = Number(shoot.deliverableSetIndex);
      if (dsIndex >= 100) dsIndex = dsIndex % 100;
      const deliverableSets = lead?.deliverableSets || (lead as any)?.deliverable_sets || [];
      if (deliverableSets[dsIndex] && deliverableSets[dsIndex].serviceName) {
        resolvedServiceType = deliverableSets[dsIndex].serviceName;
      }
    }
    
    setAssignShoot(shoot);
    setAssignForm({
      serviceType: isTrue(shoot.isEditingOnly)
        ? (lead?.serviceNotes?.trim() || resolvedServiceType || 'Only Editing')
        : resolvedServiceType,
      dataLink: shoot.dataLink,
      managerComment: '',
      ...leadAssignmentDeliverables(lead, shoot),
    });
    setServiceAssignments({});
    setAssignmentErrors({});
  };

  const handleAssignEditor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignShoot) return;

    const activeServices = ASSIGNMENT_DELIVERABLE_FIELDS.filter((field) => Number(normalizeQuantity(assignForm[field.key])) > 0);
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
        let globalIndex = 1;
        splits.forEach((split) => {
          const editor = editors.find(e => e.name === split.editorName);
          for (let i = 0; i < split.quantity; i++) {
            tasks.push({
              task_type: field.taskType,
              quantity: 1,
              task_label: `${field.label} #${globalIndex}`,
              editor_name: editor?.name ?? '',
              editor_email: editor?.email ?? ''
            });
            globalIndex++;
          }
        });
      });


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

  const submitManagerFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackTask) return;
    setSubmittingFeedback(true);
    try {
      const response = await authFetch('/api/editing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: feedbackTask.editId,
          status: 'Correction Requested',
          managerComment: feedbackText.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to submit feedback');

      // Silently log a correction for tracking manager-to-editor feedback vs revisions
      await authFetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: feedbackTask.leadId || feedbackTask.editId,
          editingTaskId: feedbackTask.editId,
          editorId: feedbackTask.editorEmail || '',
          editorName: feedbackTask.editorName || '',
          note: feedbackText.trim()
        })
      }).catch(err => console.error('Failed to log correction', err));

      toast.success('Feedback submitted to editor!');
      setFeedbackTask(null);
      setFeedbackText('');
      await refreshEditing();
    } catch (error) {
      toast.error('Could not submit feedback', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSubmittingFeedback(false);
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

      // Update the status in the database so it persists across refreshes
      await authFetch('/api/editing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: edit.editId, status: 'Draft Sent' })
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
      const clientEmail = findClientEmail(edit, leads);
      const cost = Number(extraCosts[edit.editId] ?? edit.extraRevisionCost ?? 0);

      if (cost > 0) {
        await postWebhook('/revision-addon', {
          edit_id: edit.editId,
          lead_id: edit.leadId,
          client_name: edit.clientName,
          client_email: clientEmail,
          manager_email: user?.email,
          extra_revision_cost: cost,
          feedback: extraFeedback[edit.editId] ?? '',
        });
      }
      
      // Update the status in the database so it persists across refreshes
      await authFetch('/api/editing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          taskId: edit.editId, 
          status: cost > 0 ? 'Extra Revision Approved' : 'In Revision',
          extraRevisionApproved: cost > 0,
          extraRevisionCost: cost,
          addonPaymentStatus: cost > 0 ? 'price_set' : undefined,
          managerComment: extraFeedback[edit.editId] ?? ''
        })
      });

      toast.success(cost > 0 ? 'Extra revision approved, client notified for payment!' : 'Extra revision approved, editor notified!');
      setEditing((prev) =>
        prev.map((item) =>
          item.editId === edit.editId
            ? {
                ...item,
                status: cost > 0 ? 'Extra Revision Approved' : 'In Revision',
                extraRevisionApproved: cost > 0,
                addonPaymentStatus: cost > 0 ? 'price_set' : item.addonPaymentStatus,
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

  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [finalDraftLinks, setFinalDraftLinks] = useState<Record<string, string>>({});

  const sendFinalDelivery = async (edit: EditingProject, type: 'video' | 'hard_drive') => {
    setDeliveringId(edit.editId);
    try {
      await authFetch('/api/editing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: edit.editId,
          status: 'Completed'
        })
      });
      
      const draftLinkToSend = finalDraftLinks[edit.editId] ?? edit.currentDraftLink ?? edit.dataLink;
      const endpoint = type === 'video' ? '/send-final-video' : '/hard-drive-handover';
      await postWebhook(endpoint, {
        edit_id: edit.editId,
        client_name: edit.clientName,
        client_email: edit.emailId,
        service_type: edit.serviceType,
        editor_name: edit.editorName,
        draft_link: draftLinkToSend
      });
      
      toast.success(type === 'video' ? 'Final video email sent!' : 'Handover email sent!');
      await refreshEditing();
    } catch (error) {
      toast.error('Delivery failed', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setDeliveringId(null);
    }
  };

  const activeProjects = leads.filter(
    (lead) => lead.proposalAccepted && !['closed', 'delivered'].includes(lead.status?.trim().toLowerCase() || '')
  ).length;
  const pendingApprovals = editing.filter((edit) => edit.status === 'Draft Sent').length;
  const availableEditors = editorWorkload.filter((workload) => workloadLevel(workload.totalDeliverables) === 'Free').length;
  const scheduledShoots = shoots.filter((shoot) => !isTrue(shoot.isEditingOnly)).length;
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
  const inEditing = editing.filter((edit) => ['Editing', 'Assigned', 'In Progress', 'Correction Requested'].includes(edit.status));
  const draftReady = editing.filter((edit) => edit.status === 'Draft Ready');
  const extraRevisionNeeded = editing.filter(isExtraRevisionNeeded);

  if (loading) {
    return <ManagerShimmer />;
  }

  const renderPagination = (page: number, setPage: (p: number) => void, totalItems: number, pageSize: number = 10) => {
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) return null;
    return (
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={() => setPage(Math.max(1, page - 1))} className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
          </PaginationItem>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <PaginationItem key={p}>
              <PaginationLink isActive={page === p} onClick={() => setPage(p)} className="cursor-pointer">
                {p}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext onClick={() => setPage(Math.min(totalPages, page + 1))} className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div>
      <PageHeader title="Manager" description="Assignments and approvals" />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard title="Active Projects" value={activeProjects} icon={Briefcase} />
        <StatCard title="Pending Approvals" value={pendingApprovals} icon={CheckCircle} />
        <StatCard title="Scheduled Shoots" value={scheduledShoots} icon={Camera} />
        <StatCard title="Available Editors" value={availableEditors} icon={Scissors} />
        <StatCard title="Revision Revenue" value={formatINR(revisionRevenue)} icon={Briefcase} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="tabs-scroll-container mb-6">
          <TabsList className="flex w-max min-w-full h-auto gap-2 p-1 bg-transparent border">
            <TabsTrigger value="assign_editor" className="data-[state=active]:bg-muted relative shrink-0">
              Assign Editor
              {footageReady.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full shadow-sm shadow-blue-500/20">
                  {footageReady.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="assign_marketing" className="data-[state=active]:bg-muted relative shrink-0">
              Assign Marketing
              {marketingTasks.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full shadow-sm shadow-blue-500/20">
                  {marketingTasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upsell_crosssell" className="data-[state=active]:bg-muted relative shrink-0">
              Upsells &amp; Cross-Sells
              {(upsellEntries.length + pendingUpsells.length) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full shadow-sm shadow-blue-500/20">
                  {upsellEntries.length + pendingUpsells.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="task_board" className="data-[state=active]:bg-muted shrink-0">Task Board</TabsTrigger>
            <TabsTrigger value="editor_workload" className="data-[state=active]:bg-muted shrink-0">Editor Workload</TabsTrigger>
            <TabsTrigger value="verify_editor_work" className="data-[state=active]:bg-muted relative shrink-0">
              Verify Editor Work
              {draftReady.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full shadow-sm shadow-blue-500/20">
                  {draftReady.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="revision_approval" className="data-[state=active]:bg-muted relative shrink-0">
              Revision Approval
              {extraRevisionNeeded.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full shadow-sm shadow-blue-500/20">
                  {extraRevisionNeeded.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-muted relative shrink-0">
              Completed
              {editing.filter(edit => ['Client Satisfied', 'Completed'].includes(edit.status)).length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full shadow-sm shadow-blue-500/20">
                  {editing.filter(edit => ['Client Satisfied', 'Completed'].includes(edit.status)).length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="assign_editor" className="mt-0">
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
            footageReady.slice((footageReadyPage - 1) * 10, footageReadyPage * 10).map((shoot) => (
              <div
                key={shoot.id}
                className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{shoot.clientName || 'Untitled shoot'}</p>
                    {isTrue(shoot.isEditingOnly) && (
                      <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30">
                        Editing Only
                      </Badge>
                    )}
                    {isTrue(shoot.editedByShootTeam) && (
                      <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30">
                        Changes Made
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isTrue(shoot.isEditingOnly)
                      ? 'Editing-only project · No shoot required'
                      : `${formatDate(shoot.shootDate)} · ${shoot.shootMemberName || 'No shoot member'}`}
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
      {renderPagination(footageReadyPage, setFootageReadyPage, footageReady.length)}
    </TabsContent>

    <TabsContent value="assign_marketing" className="mt-0">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Unassigned Marketing Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {marketingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No marketing tasks waiting for assignment.
            </p>
          ) : (
            marketingTasks.map((task) => (
              <div
                key={task.taskId}
                className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{task.clientName || 'Untitled client'}</p>
                  <p className="text-xs text-muted-foreground">Lead ID: {task.leadId}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select onValueChange={(val) => setConfirmMarketingAssign({ taskId: task.taskId, assigneeName: val })}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Assign team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {marketingMembers.map((member) => (
                        <SelectItem key={member.name} value={member.name}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="upsell_crosssell" className="mt-0 space-y-6">
      <UpsellCrossSellAnalyticsWidget />
      <div>
        <UpsellCrossSellPipeline
          entries={upsellEntries.slice((upsellPage - 1) * 10, upsellPage * 10)}
        showClientName
        canDelete={['manager', 'admin', 'super_admin'].includes(user?.role || '')}
        pendingAssignment={pendingUpsells}
        onAssign={(entry) => {
          setAssignUpsell(entry);
          setUpsellEditor('');
        }}
        onRefresh={refreshUpsells}
      />
      {renderPagination(upsellPage, setUpsellPage, upsellEntries.length)}
      </div>
    </TabsContent>

    <TabsContent value="task_board" className="mt-0">
      <ManagerTaskBoard editors={editors} canReallocate={user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin'} />
    </TabsContent>

    <TabsContent value="editor_workload" className="mt-0">

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
    </TabsContent>

    <TabsContent value="verify_editor_work" className="mt-0">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Verify Editor Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {draftReady.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No drafts ready for manager review.</p>
          ) : (
            (() => {
              const grouped = draftReady.reduce((acc, edit) => {
                const client = edit.clientName || 'Unknown Client';
                if (!acc[client]) acc[client] = [];
                acc[client].push(edit);
                return acc;
              }, {} as Record<string, EditingProject[]>);
              
              const clientKeys = Object.keys(grouped);
              const paginatedKeys = clientKeys.slice((draftReadyPage - 1) * 10, draftReadyPage * 10);
              
              return (
                <div className="space-y-4">
                  <Accordion type="multiple" className="w-full space-y-4">
                    {paginatedKeys.map(client => {
                      const drafts = grouped[client];
                      return (
                <AccordionItem key={client} value={client} className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                    <div className="flex items-center gap-2 font-semibold">
                      {client}
                      <Badge variant="secondary" className="ml-2">{drafts.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 pt-2 border-t">
                    <div className="space-y-3">
                      {drafts.map((edit) => (
                        <div key={edit.editId} className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
                          <div>
                            <p className="text-sm font-medium">{edit.clientName}</p>
                            <p className="text-xs text-muted-foreground">{edit.editorName} · {edit.serviceType || 'Edit'}</p>
                            {edit.editorComment && (
                              <div className="flex items-start gap-2 mt-2 rounded-md border border-blue-500 bg-transparent px-3 py-2 max-w-sm">
                                <span className="text-[10px] mt-0.5">💬</span>
                                <p className="text-xs text-white leading-snug">
                                  <span className="font-semibold text-blue-400">Editor:</span> {edit.editorComment}
                                </p>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">Deadline: {edit.deadlineAt || '-'}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" asChild disabled={!edit.currentDraftLink}>
                              <a href={edit.currentDraftLink} target="_blank" rel="noreferrer">
                                View Draft <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                              </a>
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => { setFeedbackTask(edit); setFeedbackText(''); }}>
                              Provide Feedback
                            </Button>
                            {edit.status === 'Draft Sent' ? (
                              <Button size="sm" disabled variant="outline" className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-900/30 bg-green-50 dark:bg-green-900/10">
                                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                Sent to Client
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => sendDraftToClient(edit)} disabled={sendingDraftId === edit.editId}>
                                {sendingDraftId === edit.editId && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                Send to Client
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                  </Accordion>
                  {renderPagination(draftReadyPage, setDraftReadyPage, clientKeys.length)}
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="revision_approval" className="mt-0">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Extra Revision Approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {extraRevisionNeeded.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No extra revision approvals pending.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {extraRevisionNeeded.slice((extraRevisionNeededPage - 1) * 10, extraRevisionNeededPage * 10).map((edit) => (
              <div key={edit.editId} className="flex flex-col gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
                  <div>
                    <p className="text-sm font-medium">{edit.clientName}</p>
                    <p className="text-xs text-muted-foreground">{edit.editorName} · Revision {edit.revisionCount}/{edit.maxFreeRevisions}</p>
                  </div>
                  <Badge className="w-fit border-amber-500/40 bg-amber-500/15 text-amber-600">Sales confirmation needed</Badge>
                  <Button size="sm" onClick={() => approveExtraRevision(edit)} disabled={approvingExtraId === edit.editId}>
                    Approve Extra Revision
                  </Button>
                </div>
                <div className="space-y-1.5 border-t border-amber-500/10 pt-2.5">
                  <Label htmlFor={`extra-cost-${edit.editId}`} className="text-xs font-semibold text-muted-foreground">Additional Cost (INR)</Label>
                  <Input
                    id={`extra-cost-${edit.editId}`}
                    type="number"
                    placeholder="Enter cost (e.g. 1500) if applicable"
                    value={extraCosts[edit.editId] ?? ''}
                    onChange={(event) =>
                      setExtraCosts((prev) => ({ ...prev, [edit.editId]: event.target.value }))
                    }
                    className="text-xs bg-background"
                  />
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
            ))}
            </div>
            {renderPagination(extraRevisionNeededPage, setExtraRevisionNeededPage, extraRevisionNeeded.length)}
          </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="completed" className="mt-0">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Final Delivery & Completed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing.filter(edit => ['Client Satisfied', 'Completed'].includes(edit.status)).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No completed tasks pending final delivery.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {editing
                  .filter(edit => ['Client Satisfied', 'Completed'].includes(edit.status))
                  .slice((completedPage - 1) * 10, completedPage * 10)
                  .map((edit) => (
                <div key={edit.editId} className="flex flex-col gap-3 rounded-md border p-3 bg-muted/20">
                  <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_120px_auto] lg:items-center">
                    <div>
                      <p className="text-sm font-medium">{edit.clientName} - {edit.serviceType}</p>
                      <p className="text-xs text-muted-foreground">Editor: {edit.editorName}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Final Draft Link"
                          value={finalDraftLinks[edit.editId] ?? edit.currentDraftLink ?? ''}
                          onChange={(e) => setFinalDraftLinks(prev => ({ ...prev, [edit.editId]: e.target.value }))}
                          className="h-8 text-xs min-w-[200px]"
                        />
                        {(finalDraftLinks[edit.editId] || edit.currentDraftLink) && (
                          <Button size="sm" variant="outline" asChild className="shrink-0 h-8">
                            <a href={finalDraftLinks[edit.editId] || edit.currentDraftLink} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              Link
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                    <Badge className="w-fit">{edit.status}</Badge>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button size="sm" onClick={() => sendFinalDelivery(edit, 'video')} disabled={deliveringId === edit.editId}>
                        <Mail className="mr-1.5 h-3.5 w-3.5" />
                        {edit.status === 'Completed' ? 'Send Video Again' : 'Send Final Video'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => sendFinalDelivery(edit, 'hard_drive')} disabled={deliveringId === edit.editId}>
                        <HardDrive className="mr-1.5 h-3.5 w-3.5" />
                        Handover Hard Drive
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
              {renderPagination(completedPage, setCompletedPage, editing.filter(edit => ['Client Satisfied', 'Completed'].includes(edit.status)).length)}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>

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
                      if (requiredQty === 0) return null;
                      const splits = serviceAssignments[field.key] || [{ quantity: requiredQty, editorName: '' }];
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

      <Dialog open={!!feedbackTask} onOpenChange={(open) => !open && setFeedbackTask(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={submitManagerFeedback}>
            <DialogHeader>
              <DialogTitle>Provide Feedback</DialogTitle>
              <DialogDescription>
                Send this task back to the editor with your feedback.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="manager-feedback">Feedback</Label>
                  <Textarea
                    id="manager-feedback"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    onFocus={(e) => {
                      if (e.target.value === '') setFeedbackText('• ');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const target = e.target as HTMLTextAreaElement;
                        const start = target.selectionStart;
                        const val = target.value;
                        const before = val.substring(0, start);
                        const after = val.substring(target.selectionEnd);
                        
                        if (val.trim() === '') {
                          setFeedbackText('• ');
                        } else {
                          let newText = before + '\n• ' + after;
                          if (!before.startsWith('• ') && before.trim().length > 0 && before.indexOf('\n') === -1) {
                            newText = '• ' + before + '\n• ' + after;
                          }
                          setFeedbackText(newText);
                        }
                      }
                    }}
                    placeholder="• What needs to be changed?"
                    rows={6}
                    required
                  />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFeedbackTask(null)}>Cancel</Button>
              <Button type="submit" disabled={submittingFeedback || !feedbackText.trim()}>Submit Feedback</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upsell & Cross-Sell: assign editor */}
      <Dialog open={!!assignUpsell} onOpenChange={(open) => !open && setAssignUpsell(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Editor</DialogTitle>
            <DialogDescription>
              {assignUpsell
                ? `${assignUpsell.clientName} · ${assignUpsell.type === 'crosssell' ? 'Cross-sell' : 'Upsell'} · ${assignUpsell.services.join(', ')}. The deal moves into Editing.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="upsell-editor">Editor</Label>
              <Select value={upsellEditor} onValueChange={setUpsellEditor}>
                <SelectTrigger id="upsell-editor">
                  <SelectValue placeholder="Choose editor" />
                </SelectTrigger>
                <SelectContent>
                  {editors.map((editor) => (
                    <SelectItem key={editor.name} value={editor.name}>
                      {editorDropdownLabel(editorWorkload, editor.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assignUpsell?.shootLink && (
              <Button variant="outline" size="sm" asChild>
                <a href={assignUpsell.shootLink} target="_blank" rel="noreferrer">
                  View Material <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignUpsell(null)}>Cancel</Button>
            <Button onClick={handleAssignUpsellEditor} disabled={assigningUpsell || !upsellEditor}>
              {assigningUpsell ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scissors className="mr-2 h-4 w-4" />}
              Assign Editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Marketing Assignment */}
      <Dialog open={!!confirmMarketingAssign} onOpenChange={(open) => !open && setConfirmMarketingAssign(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Assignment</DialogTitle>
            <DialogDescription>
              Are you sure you want to assign this marketing task to <strong>{confirmMarketingAssign?.assigneeName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmMarketingAssign(null)}>Cancel</Button>
            <Button onClick={() => {
              if (confirmMarketingAssign) {
                handleAssignMarketing(confirmMarketingAssign.taskId, confirmMarketingAssign.assigneeName);
                setConfirmMarketingAssign(null);
              }
            }}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
