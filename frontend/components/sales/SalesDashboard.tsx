'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { LeadStatusBadge } from '@/components/shared/Badges';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SalesShimmer } from '@/components/shared/ShimmerLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Users, FileText, Wallet, TrendingUp, Send, RefreshCw, Loader2, Camera, ExternalLink, Edit, Trash2, ArrowUpCircle, Upload, Download, CheckCircle, XCircle, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { formatINR } from '@/lib/formatter';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import type { EditingProject, Lead, LeadFilterTab, Shoot } from '@/lib/sheets/types';
import type { PaymentInstallment } from '@/lib/types';
import {
  filterSalesLeads,
  isPendingPaymentVerification,
  isPaymentVerified,
  PAYMENT_STATUS,
} from '@/lib/sheets/payment-utils';
import { PaymentStatusIndicator } from '@/components/sales/PaymentStatusIndicator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { findAssignedSalespersonEmail, findClientEmail, isExtraRevisionNeeded, postWebhook } from '@/lib/editing';
import { SendProposalDialog } from '@/components/pipeline/SendProposalDialog';
import { ViewSentProposalDialog } from '@/components/pipeline/ViewSentProposalDialog';
import { SendPaymentLinkDialog } from '@/components/pipeline/SendPaymentLinkDialog';
import { ScheduleShootDialog } from '@/components/pipeline/ScheduleShootDialog';
import { SetAddonPriceDialog } from '@/components/sales/SetAddonPriceDialog';
import { SetRevisionPriceDialog } from '@/components/sales/SetRevisionPriceDialog';
import { UploadScreenshotDialog } from '@/components/sales/UploadScreenshotDialog';
import { SalesTargetTab } from '@/components/sales/SalesTargetTab';
import { SERVICE_NOTE_OPTIONS, parseCost, type ProposalFormValues } from '@/components/pipeline/stageDialogShared';
import type { ScheduleDialogPrefill } from '@/components/pipeline/ScheduleShootDialog';

const FINAL_PAYMENT_COMPLETED_WEBHOOK_URL =
  'https://n8n.hogwartsstudios.com/webhook/final-payment-completed';

const FALLBACK_SALES_MEMBERS = ['Isha Malhotra', 'Krishna Tiwari', 'Krishan Kunal Bagoria', 'Pallavi Srivastava'];
const DEFAULT_ASSIGNED_TO = FALLBACK_SALES_MEMBERS[0];

const FILTER_TABS: { value: LeadFilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new_leads', label: 'New Leads' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'upsells', label: 'Upsells' },
  { value: 'addons_payments', label: 'Addons Payments' },
];

interface SalesDashboardProps {
  initialLeads: Lead[];
  initialShoots: Shoot[];
  initialEditing: EditingProject[];
}



function isVerifiedInstallment(payment: PaymentInstallment): boolean {
  return payment.payment_mode === 'Cash' || ['payment verified', 'payment confirmed', 'confirmed', 'cash received'].includes(payment.payment_status.trim().toLowerCase());
}

// Editing-only leads ("Only editing" service note) skip the entire shoot flow:
// no shoot scheduling, no shoot team. Once payment is verified, the backend
// auto-creates a placeholder shoot so the project shows up directly in the
// manager dashboard's "Assign Editor" queue.
const EDITING_ONLY_SERVICE_REGEX = /only[\s-]*editing/i;

function hasShootService(servicesString: string) {
  if (!servicesString) return false;
  const services = servicesString.split(',').map(s => s.trim()).filter(Boolean);
  return services.some(s => !EDITING_ONLY_SERVICE_REGEX.test(s) && !MARKETING_ONLY_SERVICE_REGEX.test(s));
}

function isEditingOnlyLead(lead: Lead) {
  const pitchedServices = lead.servicePitched || '';
  const notesServices = lead.serviceNotes || '';
  
  const hasEditing = EDITING_ONLY_SERVICE_REGEX.test(pitchedServices) || EDITING_ONLY_SERVICE_REGEX.test(notesServices);
  const hasShoot = hasShootService(pitchedServices) || hasShootService(notesServices);

  return hasEditing && !hasShoot;
}

const MARKETING_ONLY_SERVICE_REGEX = /only[\s-]*marketing/i;

function isMarketingOnlyLead(lead: Lead) {
  const pitchedServices = lead.servicePitched || '';
  const notesServices = lead.serviceNotes || '';
  
  const hasMarketing = MARKETING_ONLY_SERVICE_REGEX.test(pitchedServices) || MARKETING_ONLY_SERVICE_REGEX.test(notesServices);
  const hasShoot = hasShootService(pitchedServices) || hasShootService(notesServices);

  return hasMarketing && !hasShoot;
}

function isEditingOnlyShoot(shoot: Shoot | undefined) {
  return String(shoot?.isEditingOnly ?? '').trim().toLowerCase() === 'true';
}

function salesDeliverableSummary(lead: Lead) {
  const podcast = Number(lead.podcastDraft || 0) + Number(lead.podcastEdit || 0);
  const reel = Number(lead.reelDraft || 0) + Number(lead.reelEdit || 0);
  const thumbnail = Number(lead.thumbnail || 0);

  return [
    podcast > 0 ? `🎙${podcast}` : '',
    reel > 0 ? `🎬${reel}` : '',
    thumbnail > 0 ? `🖼${thumbnail}` : '',
  ].filter(Boolean);
}

function isShootEligible(lead: Lead) {
  return ['Payment Confirmed', 'Payment Verified', 'Awaiting Shoot'].includes(lead.status);
}

function isPaymentComplete(lead: Lead) {
  const paymentStatus = lead.payment_status ?? lead.payment?.paymentStatus ?? '';
  return isShootEligible(lead) || ['Payment Confirmed', 'Payment Verified', 'Cash Received'].includes(paymentStatus);
}

function isFinalPaymentCompleted(lead: Lead) {
  const statuses = [lead.status, lead.payment_status, lead.payment?.paymentStatus]
    .filter((status): status is string => Boolean(status))
    .map((status) => status.trim().toLowerCase());

  return statuses.some((status) =>
    ['final payment completed', 'full payment completed', 'payment completed'].includes(status)
  );
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function SalesCalendar({ shoots }: { shoots: Shoot[] }) {
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<Shoot | null>(null);
  const days = useMemo(() => buildMonthDays(month), [month]);
  const shootsByDate = useMemo(() => {
    const grouped = new Map<string, Shoot[]>();
    shoots.forEach((shoot) => {
      grouped.set(shoot.shootDate, [...(grouped.get(shoot.shootDate) ?? []), shoot]);
    });
    return grouped;
  }, [shoots]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            >
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            >
              Next
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 border border-border rounded-md overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="bg-secondary px-2 py-2 text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {days.map((day) => {
              const key = dateKey(day);
              const items = shootsByDate.get(key) ?? [];
              const muted = day.getMonth() !== month.getMonth();
              return (
                <div key={key} className="min-h-[60px] sm:min-h-[110px] border-t border-border p-1.5 sm:p-2">
                  <div className={cn('text-xs font-medium mb-1', muted && 'text-muted-foreground')}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {items.map((shoot) => (
                      <button
                        type="button"
                        key={shoot.id}
                        onClick={() => setSelected(shoot)}
                        className="w-full rounded bg-blue-500/15 border border-blue-500/30 px-2 py-1 text-left text-[11px] text-blue-600 hover:bg-blue-500/20"
                      >
                        <span className="block truncate font-medium">{shoot.clientName}</span>
                        <span className="block truncate">{shoot.shootStartTime || '-'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.clientName}</DialogTitle>
                <DialogDescription>Scheduled shoot details</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Contact:</span> {selected.contactNum || '-'}</div>
                <div><span className="text-muted-foreground">Email:</span> {selected.emailId || '-'}</div>
                <div><span className="text-muted-foreground">Date:</span> {selected.shootDate || '-'}</div>
                <div><span className="text-muted-foreground">Time:</span> {selected.shootStartTime} - {selected.shootEndTime}</div>
                <div><span className="text-muted-foreground">Camera:</span> {selected.camera || '1'}</div>
                <div><span className="text-muted-foreground">Teleprompter:</span> {selected.teleprompter || 'No'}</div>
                <div><span className="text-muted-foreground">BTS:</span> {selected.bts || 'No'}</div>
                <div><span className="text-muted-foreground">Member:</span> {selected.shootMemberName || '-'}</div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SalesDashboard({ initialLeads, initialShoots, initialEditing }: SalesDashboardProps) {
  const { user, users } = useAuth();

  const salesMembers = useMemo(() => {
    const list = users.filter((u) => (u.role === 'sales' || u.role === 'manager' || u.role === 'admin' || u.role === 'super_admin') && u.isActive !== false);
    return list.length > 0 ? list.map(u => u.name) : FALLBACK_SALES_MEMBERS;
  }, [users]);


  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [shoots, setShoots] = useState<Shoot[]>(initialShoots);
  const [editing, setEditing] = useState<EditingProject[]>(initialEditing);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const [reachoutDone, setReachoutDone] = useState<'yes' | 'no'>('no');

  // Bulk upload state
  const [leadSheetMode, setLeadSheetMode] = useState<'manual' | 'bulk'>('manual');
  type BulkLeadRow = {
    company: string;
    contact: string;
    whatsapp?: string;
    clientEmail?: string;
    cost?: string;
    assignedTo?: string;
    reachoutDone?: string;
    _status?: 'pending' | 'uploading' | 'success' | 'error';
    _error?: string;
  };
  const [bulkRows, setBulkRows] = useState<BulkLeadRow[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkParsing, setBulkParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assignedTo, setAssignedTo] = useState<string>(DEFAULT_ASSIGNED_TO);

  useEffect(() => {
    if (salesMembers.length > 0 && assignedTo === FALLBACK_SALES_MEMBERS[0]) {
      setAssignedTo(salesMembers[0]);
    }
  }, [salesMembers, assignedTo]);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [viewProposalOpen, setViewProposalOpen] = useState(false);
  const [viewProposalLead, setViewProposalLead] = useState<Lead | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [editLeadOpen, setEditLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [filterTab, setFilterTab] = useState<LeadFilterTab>('all');
  const [proposalDefaults, setProposalDefaults] = useState<Partial<ProposalFormValues>>({});
  const [schedulePrefill, setSchedulePrefill] = useState<ScheduleDialogPrefill>({});
  const [paymentLinkOpen, setPaymentLinkOpen] = useState(false);
  const [paymentLead, setPaymentLead] = useState<Lead | null>(null);
  const [verifyingLeadId, setVerifyingLeadId] = useState<string | null>(null);
  const [completingFinalPaymentId, setCompletingFinalPaymentId] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleLead, setScheduleLead] = useState<Lead | null>(null);
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);
  const [approvingExtraId, setApprovingExtraId] = useState<string | null>(null);
  const [handoverId, setHandoverId] = useState<string | null>(null);
  const [extraCosts, setExtraCosts] = useState<Record<string, string>>({});
  const [extraFeedback, setExtraFeedback] = useState<Record<string, string>>({});
  const [handoverNotes, setHandoverNotes] = useState<Record<string, string>>({});
  const [paymentHistoryLead, setPaymentHistoryLead] = useState<Lead | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Record<string, PaymentInstallment[]>>({});
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(false);

  const [addonPriceOpen, setAddonPriceOpen] = useState(false);
  const [addonShoot, setAddonShoot] = useState<Shoot | null>(null);
  const [verifyingAddonId, setVerifyingAddonId] = useState<string | null>(null);

  const [revisionPriceOpen, setRevisionPriceOpen] = useState(false);
  const [revisionAddon, setRevisionAddon] = useState<EditingProject | null>(null);
  const [verifyingRevisionId, setVerifyingRevisionId] = useState<string | null>(null);

  const [uploadSSOpen, setUploadSSOpen] = useState(false);
  const [uploadSSPayment, setUploadSSPayment] = useState<PaymentInstallment | null>(null);

  const refreshLeads = useCallback(async (silent = false, forceFresh = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await authFetch(`/api/clients${forceFresh ? '?fresh=1' : ''}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to refresh leads');
      }
      setLeads(data.leads ?? []);
      window.dispatchEvent(new CustomEvent('leads-updated'));
    } catch (error) {
      if (!silent) {
        toast.error('Failed to refresh leads', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  const refreshShoots = useCallback(async (silent = false) => {
    try {
      const response = await authFetch('/api/shoots', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to refresh shoots');
      }
      setShoots(data.shoots ?? []);
    } catch (error) {
      if (!silent) {
        toast.error('Failed to refresh shoots', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }, []);

  const refreshEditing = useCallback(async (silent = false) => {
    try {
      const response = await authFetch('/api/editing', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to refresh editing rows');
      }
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
      }));
      
      const mappedProjects = projects.map((p: any) => ({
        ...p,
        editId: p.editId || p._id || Math.random().toString(),
      }));
      
      setEditing([...mappedProjects, ...mappedTasks]);
    } catch (error) {
      if (!silent) {
        toast.error('Failed to refresh editing rows', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }, []);

  const refreshPaymentHistory = useCallback(async (silent = false) => {
    try {
      // We now fetch ALL payments so they show in the 'Total collected' history,
      // but the paymentSummary calculation explicitly ignores upsell payments for the 'Remaining' balance.
      const response = await authFetch('/api/payments', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to refresh payment history');

      const grouped = (data.payments ?? []).reduce((history: Record<string, PaymentInstallment[]>, payment: any) => {
        // Normalize to snake_case for the PaymentInstallment interface
        // MongoDB returns camelCase; n8n / legacy data may use snake_case
        const normalized: PaymentInstallment = {
          payment_id: payment.paymentId ?? payment.payment_id ?? '',
          lead_id: payment.leadId ?? payment.lead_id ?? '',
          client_name: payment.clientName ?? payment.client_name ?? '',
          installment_label: (payment.installmentLabel ?? payment.installment_label ?? 'Custom') as any,
          amount: Number(payment.amount ?? 0),
          payment_mode: (payment.paymentMode ?? payment.payment_mode ?? 'Online') as any,
          cash_collected_by: payment.cashCollectedBy ?? payment.cash_collected_by,
          payment_status: payment.paymentStatus ?? payment.payment_status ?? '',
          payment_link_sent_at: payment.paymentLinkSentAt ?? payment.payment_link_sent_at,
          verified_at: payment.verifiedAt ?? payment.verified_at,
          total_cost: Number(payment.totalCost ?? payment.total_cost ?? 0),
          remaining_amount: Number(payment.remainingAmount ?? payment.remaining_amount ?? 0),
          payment_completed: Boolean(payment.paymentCompleted ?? payment.payment_completed),
          screenshot_url: payment.screenshotUrl ?? payment.screenshot_url,
          utr_number: payment.utrNumber ?? payment.utr_number,
          upsell_crosssell_id: payment.upsellCrossSellId ?? payment.upsell_crosssell_id,
        };
        const key = normalized.lead_id;
        (history[key] ??= []).push(normalized);
        return history;
      }, {});
      setPaymentHistory(grouped);
    } catch (error) {
      if (!silent) {
        toast.error('Failed to load payment history', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }, []);

  useEffect(() => {
    // Server component data may have been produced from a short-lived cache
    // Reconcile immediately on entry.
    Promise.all([
      refreshLeads(true, true),
      refreshShoots(true),
      refreshEditing(true),
      refreshPaymentHistory(true),
    ]).finally(() => setLoading(false));
  }, [refreshLeads, refreshShoots, refreshEditing, refreshPaymentHistory]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshLeads(true);
      refreshShoots(true);
      refreshEditing(true);
      refreshPaymentHistory(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshEditing, refreshLeads, refreshPaymentHistory, refreshShoots]);

  useEffect(() => {
    setLoadingPaymentHistory(Boolean(paymentHistoryLead));
    void refreshPaymentHistory().finally(() => setLoadingPaymentHistory(false));
  }, [paymentHistoryLead, refreshPaymentHistory]);

  const shootsByLeadId = useMemo(() => {
    const map = new Map<string, Shoot>();
    shoots.forEach((shoot) => {
      if (shoot.leadId) {
        const existing = map.get(shoot.leadId);
        // Prefer a real shoot over an editing-only placeholder for the same lead
        if (!existing || isEditingOnlyShoot(existing)) map.set(shoot.leadId, shoot);
      }
      if (shoot.shootId) map.set(shoot.shootId, shoot);
    });
    return map;
  }, [shoots]);

  // Remove standalone totalHours to fix build error
  const salesLeads = useMemo(() => {
    return filterSalesLeads(leads, user?.name, user?.role);
  }, [leads, user?.name, user?.role]);

  const visibleEditing = useMemo(() => {
    const role = user?.role?.toLowerCase();
    if (role === 'manager' || role === 'admin' || role === 'super_admin') return editing;
    const leadIds = new Set(salesLeads.map((lead) => lead.leadId));
    return editing.filter((edit) => leadIds.has(edit.leadId));
  }, [editing, salesLeads, user?.role]);

  const draftReadyEdits = visibleEditing.filter((edit) => edit.status === 'Draft Ready');
  const deliveredEdits = visibleEditing.filter(
    (edit) => edit.status === 'Delivered' && edit.finalDelivered
  );
  const extraRevisionNeeded = visibleEditing.filter(isExtraRevisionNeeded);

  const filteredLeads = useMemo(() => {
    switch (filterTab) {
      case 'new_leads':
        return salesLeads.filter((lead) => lead.status === 'New Lead' && lead.leadType !== 'upsell');
      case 'proposal_sent':
        return salesLeads.filter((lead) => lead.status === 'Proposal Sent');
      case 'revoked':
        return salesLeads.filter((lead) => lead.status === 'Proposal Revoked');
      case 'accepted':
        return salesLeads.filter((lead) => lead.proposalAccepted);
      case 'upsells':
        return salesLeads.filter((lead) => lead.leadType === 'upsell');
      default:
        return salesLeads;
    }
  }, [salesLeads, filterTab]);
  const shootsWithAddons = useMemo(() => {
    return shoots.filter((shoot) => {
      return String(shoot.addonHasAddons).toLowerCase() === 'true' || String(shoot.addonHasAddons).toLowerCase() === 'yes';
    });
  }, [shoots]);

  const revisionWithAddons = useMemo(() => {
    const filtered = editing.filter((edit) => {
      if (edit.extraRevisionApproved) return true;
      if (edit.extraRevisionCost && Number(edit.extraRevisionCost) > 0) return true;
      if (edit.addonPaymentStatus && edit.addonPaymentStatus.trim() !== '') return true;
      return false;
    });

    // Deduplicate by leadId + taskLabel to hide old dummy testing records
    const latestPerTask = new Map<string, EditingProject>();
    for (const edit of filtered) {
      const key = `${edit.leadId}-${edit.serviceType || 'Unknown'}`;
      const existing = latestPerTask.get(key);
      if (!existing || (new Date((edit as any).updatedAt || (edit as any).createdAt || 0) > new Date((existing as any).updatedAt || (existing as any).createdAt || 0))) {
        latestPerTask.set(key, edit);
      }
    }
    return Array.from(latestPerTask.values());
  }, [editing]);

  const paymentSummary = (lead: Lead) => {
    const payments = paymentHistory[lead.leadId] ?? [];
    const totalCost = parseCost(lead.cost);
    const verifiedPayments = payments.filter(isVerifiedInstallment);
    const totalCollected = verifiedPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const baseCollected = verifiedPayments
      .filter((p) => {
        // Exclude Addons, Revision Addons, and Upsell/CrossSell/NewSale payments from the original client's remaining math
        const isAddon = p.installment_label === 'Addon Payment' || p.installment_label === 'Addon' || p.installment_label === 'Revision Addon';
        const isUpsell = Boolean(p.upsell_crosssell_id && p.upsell_crosssell_id.trim() !== '');
        return !isAddon && !isUpsell;
      })
      .reduce((sum, payment) => sum + payment.amount, 0);

    const remaining = isFinalPaymentCompleted(lead)
      ? 0
      : payments.length > 0
      ? Math.max(0, totalCost - baseCollected)
      : totalCost;

    return { payments, totalCollected, remaining };
  };

  const openProposalModal = (lead: Lead) => {
    const shoot = shootsByLeadId.get(lead.leadId);
    setSelected(lead);
    setProposalDefaults({
      clientEmail: lead.clientEmail,
      cost: lead.cost,
      podcastEdit: lead.podcastEdit || '0',
      reelEdit: lead.reelEdit || '0',
      longFormatVideo: lead.longFormatVideo || '0',
      shortFormatVideo: lead.shortFormatVideo || '0',
      teaserEdit: lead.teaserEdit || lead.teaserDemo || '0',
      thumbnailEdit: lead.thumbnailEdit || lead.thumbnail || '0',
      serviceNotes: lead.serviceNotes 
        ? lead.serviceNotes.split(',').map(s => s.trim()).filter(s => SERVICE_NOTE_OPTIONS.includes(s as any))
        : [],
      salesNotes: lead.salesNotes || '',
      longFormatDuration: lead.longFormatDuration || '',
      shortFormatDuration: lead.shortFormatDuration || '',
      camera: lead.camera || '',
      recordTime: lead.recordTime || '',
      studioTime: lead.studioTime || '',
    });
    setProposalOpen(true);
  };

  const openScheduleModal = (lead: Lead) => {
    if (isEditingOnlyLead(lead)) {
      toast.info('Editing-only project — no shoot scheduling needed. It reaches Assign Editor automatically after payment verification.');
      return;
    }
    const leadShoots = shoots.filter((s) => s.leadId === lead.leadId && !isEditingOnlyShoot(s) && !(s.upsellCrossSellId && s.upsellCrossSellId.trim() !== ''));
    const latestShoot = leadShoots[leadShoots.length - 1];
    
    const scheduledIndices = new Set(leadShoots.map(s => Number(s.deliverableSetIndex || 0)));
    const deliverableSets = lead.deliverableSets || (lead as any).deliverable_sets || [];
    const totalInstances = deliverableSets.length || 1;
    let nextIndex = 0;
    while (nextIndex < totalInstances && scheduledIndices.has(nextIndex)) {
      nextIndex++;
    }

    setScheduleLead(lead);
    setSchedulePrefill({
      shootCount: 1,
      deliverableSetIndex: Math.min(nextIndex, Math.max(0, totalInstances - 1)),
      camera: lead.camera || latestShoot?.camera || '1',
      recordTime: lead.recordTime || latestShoot?.recordTime || '',
      studioTime: lead.studioTime || latestShoot?.studioTime || '',
    });
    setScheduleOpen(true);
  };

  const handleLeadOpenChange = (open: boolean) => {
    setLeadOpen(open);
    if (open) {
      setReachoutDone('no');
      setAssignedTo(DEFAULT_ASSIGNED_TO);
      setLeadSheetMode('manual');
      setBulkRows([]);
      setBulkProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExcelFile = async (file: File) => {
    setBulkParsing(true);
    setBulkRows([]);
    try {
      const { read, utils } = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, any>[] = utils.sheet_to_json(ws, { defval: '' });

      const HEADER_MAP: Record<string, keyof BulkLeadRow> = {
        'company name': 'company',
        'company': 'company',
        'name': 'company',
        'contact number': 'contact',
        'contact': 'contact',
        'phone': 'contact',
        'phone number': 'contact',
        'whatsapp username': 'whatsapp',
        'whatsapp': 'whatsapp',
        'client email': 'clientEmail',
        'email': 'clientEmail',
        'cost': 'cost',
        'cost in ₹': 'cost',
        'cost (₹)': 'cost',
        'assigned to': 'assignedTo',
        'assign to': 'assignedTo',
        'reachout done': 'reachoutDone',
        'reachout': 'reachoutDone',
      };

      const mapped: BulkLeadRow[] = raw.map((row) => {
        const result: BulkLeadRow = { company: '', contact: '', _status: 'pending' };
        for (const [rawKey, rawVal] of Object.entries(row)) {
          const normalized = String(rawKey).trim().toLowerCase();
          const field = HEADER_MAP[normalized];
          if (field) (result as any)[field] = String(rawVal ?? '').trim();
        }
        return result;
      }).filter((r) => r.company || r.contact);

      if (mapped.length === 0) {
        toast.error('No valid rows found', { description: 'Make sure the Excel has Company Name and Contact Number columns.' });
      }
      setBulkRows(mapped);
    } catch {
      toast.error('Failed to parse Excel file', { description: 'Ensure the file is a valid .xlsx or .xls file.' });
    } finally {
      setBulkParsing(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['Company Name', 'Contact Number', 'WhatsApp Username', 'Client Email', 'Cost in ₹', 'Assigned To', 'Reachout Done'];
    const example = ['Acme Corp', '+919999999999', '@acmecorp', 'contact@acme.com', '15000', salesMembers[0] || 'Sales Member', 'No'];
    const csvContent = [headers.join(','), example.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkUpload = async () => {
    if (bulkRows.length === 0) return;
    const invalid = bulkRows.filter(r => !r.company.trim() || !r.contact.trim() || !r.clientEmail?.trim());
    if (invalid.length > 0) {
      toast.error(`${invalid.length} row(s) missing required fields`, {
        description: 'Company Name, Contact Number and Client Email are all mandatory.',
      });
      return;
    }
    setBulkUploading(true);
    setBulkProgress(0);
    let successCount = 0;
    let errorCount = 0;

    const updatedRows = [...bulkRows];
    for (let i = 0; i < updatedRows.length; i++) {
      updatedRows[i] = { ...updatedRows[i], _status: 'uploading' };
      setBulkRows([...updatedRows]);
      try {
        const row = updatedRows[i];
        const response = await authFetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.company,
            phoneNumber: row.contact,
            whatsapp: row.whatsapp || '',
            clientEmail: row.clientEmail || '',
            cost: row.cost || '0',
            assignedTo: row.assignedTo || salesMembers[0] || DEFAULT_ASSIGNED_TO,
            reachoutDone: row.reachoutDone || 'No',
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          updatedRows[i] = { ...updatedRows[i], _status: 'error', _error: data.error || 'Failed' };
          errorCount++;
        } else {
          updatedRows[i] = { ...updatedRows[i], _status: 'success' };
          successCount++;
        }
      } catch {
        updatedRows[i] = { ...updatedRows[i], _status: 'error', _error: 'Network error' };
        errorCount++;
      }
      setBulkRows([...updatedRows]);
      setBulkProgress(Math.round(((i + 1) / updatedRows.length) * 100));
    }

    setBulkUploading(false);
    if (successCount > 0) {
      toast.success(`${successCount} lead(s) created successfully!`, {
        description: errorCount > 0 ? `${errorCount} lead(s) failed — check the table for details.` : undefined,
      });
      await refreshLeads(true);
    } else {
      toast.error('All leads failed to upload', { description: 'Check the error details in the table.' });
    }
  };

  const handleCreateLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    const email = (form.get('clientEmail') as string || '').trim();
    const phone = (form.get('contact') as string || '').trim();

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error('Invalid Email', { description: 'Please enter a valid email address.' });
        return;
      }
    }

    if (phone) {
      const phoneRegex = /^\+?[\d\s-]{10,}$/;
      if (!phoneRegex.test(phone)) {
        toast.error('Invalid Phone Number', { description: 'Please enter a valid phone number with at least 10 digits.' });
        return;
      }
    }

    setCreatingLead(true);
    try {
      const response = await authFetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('company'),
          phoneNumber: form.get('contact'),
          whatsapp: form.get('whatsapp'),
          assignedTo,
          clientEmail: form.get('clientEmail'),
          cost: form.get('cost'),
          reachoutDone,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create lead');
      }

      formEl.reset();
      setReachoutDone('no');
      setAssignedTo(DEFAULT_ASSIGNED_TO);
      setLeadOpen(false);
      toast.success('Lead Created', { description: 'New lead added to Google Sheets' });
      await refreshLeads(true);
    } catch (error) {
      toast.error('Failed to create lead', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setCreatingLead(false);
    }
  };

  const handleEditLeadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLead) return;
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    const email = (form.get('clientEmail') as string || '').trim();
    const phone = (form.get('contact') as string || '').trim();

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error('Invalid Email', { description: 'Please enter a valid email address.' });
        return;
      }
    }

    if (phone) {
      const phoneRegex = /^\+?[\d\s-]{10,}$/;
      if (!phoneRegex.test(phone)) {
        toast.error('Invalid Phone Number', { description: 'Please enter a valid phone number with at least 10 digits.' });
        return;
      }
    }

    try {
      const response = await authFetch('/api/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: editingLead.leadId,
          name: form.get('company'),
          phoneNumber: form.get('contact'),
          whatsapp: form.get('whatsapp'),
          service: form.get('service'),
          assignedTo: form.get('assignTo'),
          clientEmail: form.get('clientEmail'),
          cost: form.get('cost'),
          reachoutDone: form.get('reachoutDone'),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update lead');
      }

      setEditLeadOpen(false);
      setEditingLead(null);
      toast.success('Lead Updated');
      await refreshLeads(true);
    } catch (error) {
      toast.error('Failed to update lead', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleDeleteLead = async (lead: Lead) => {
    if (!confirm(`Are you sure you want to delete lead for ${lead.name}?`)) return;
    setDeletingLeadId(lead.leadId);
    try {
      const response = await authFetch('/api/clients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.leadId })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to delete lead');
      }
      toast.success('Lead deleted');
      await refreshLeads(true);
    } catch (error) {
      toast.error('Failed to delete lead', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setDeletingLeadId(null);
    }
  };

  const handleVerifyPayment = async (lead: Lead) => {
    if (!user) return;

    const paymentId = lead.payment?.paymentId?.trim();
    if (!paymentId) {
      toast.error('Payment ID is missing for this pending payment');
      return;
    }

    setVerifyingLeadId(lead.leadId);
    try {
      // Call the backend directly — bypasses n8n's GET webhook which
      // can be accidentally triggered by Gmail's link prefetcher
      const response = await authFetch(`/api/payments/${paymentId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: 'Payment Verified',
          verifiedBy: user.name,
          verifiedAt: new Date().toISOString(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to verify payment');
      }

      // Optimistically update local state
      setLeads((prev) =>
        prev.map((item) =>
          item.leadId === lead.leadId
            ? {
                ...item,
                payment_status: PAYMENT_STATUS.VERIFIED,
                payment: item.payment
                  ? {
                      ...item.payment,
                      paymentStatus: PAYMENT_STATUS.VERIFIED,
                      verifiedBy: user.name,
                    }
                  : null,
              }
            : item
        )
      );

      toast.success('Payment verified!');
      await Promise.all([refreshLeads(true), refreshPaymentHistory(true)]);
    } catch (error) {
      toast.error('Failed to verify payment', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setVerifyingLeadId(null);
    }
  };

  const handleFinalPaymentCompleted = async (lead: Lead) => {
    const totalCost = parseCost(lead.cost);

    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      toast.error('A valid project cost is required before completing the final payment');
      return;
    }

    setCompletingFinalPaymentId(lead.leadId);
    try {
      const response = await fetch(FINAL_PAYMENT_COMPLETED_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.leadId,
          total_cost: totalCost,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark final payment as completed');
      }

      setLeads((prev) =>
        prev.map((item) =>
          item.leadId === lead.leadId
            ? { ...item, payment_status: 'Final Payment Completed' }
            : item
        )
      );
      toast.success('Final Payment Marked as Completed');
      await refreshLeads(true);
    } catch (error) {
      toast.error('Failed to mark final payment as completed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setCompletingFinalPaymentId(null);
    }
  };

  const handleAcceptProposal = async (lead: Lead) => {
    try {
      const upsellCrosssellId = lead.isUpsell ? (lead as any).upsell_crosssell_id : '';
      const url = `https://n8n.hogwartsstudios.com/webhook/proposal-accept?lead_id=${lead.leadId}&client_email=${lead.clientEmail}&upsell_crosssell_id=${upsellCrosssellId || ''}`;
      
      await fetch(url, { mode: 'no-cors' });
      toast.success('Proposal accepted successfully!');
      
      setLeads((prev) =>
        prev.map((l) => (l.leadId === lead.leadId ? { ...l, status: 'Proposal Accepted', proposalAccepted: true } : l))
      );
      await refreshLeads(true);
    } catch (error) {
      toast.error('Failed to accept proposal', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleRejectProposal = async (lead: Lead) => {
    try {
      const upsellCrosssellId = lead.isUpsell ? (lead as any).upsell_crosssell_id : '';
      await postWebhook('/proposal-revoke', {
        lead_id: lead.leadId,
        client_email: lead.clientEmail,
        client_name: lead.name,
        feedback: 'Rejected by Sales Rep on behalf of client',
        upsell_crosssell_id: upsellCrosssellId || '',
      });
      toast.success('Proposal revoked successfully!');
      
      setLeads((prev) =>
        prev.map((l) => (l.leadId === lead.leadId ? { ...l, status: 'Proposal Revoked', proposalAccepted: false, proposalSent: 'false' } : l))
      );
      await refreshLeads(true);
    } catch (error) {
      toast.error('Failed to revoke proposal', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const renderProposalAction = (lead: Lead) => {
    if (lead.proposalAccepted) {
      return (
        <span className="inline-flex items-center rounded-full border border-green-500/40 bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-600">
          ✅ Client Accepted
        </span>
      );
    }

    if (lead.status === 'New Lead' || lead.status === 'Proposal Revoked') {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openProposalModal(lead);
          }}
        >
          <Send className="mr-1 h-3 w-3" />
          Send Proposal
        </Button>
      );
    }

    if (lead.status === 'Proposal Sent' || String(lead.proposalSent).toLowerCase() === 'true') {
      return (
        <div className="flex flex-col gap-1.5 w-full">
          <div className="flex items-center gap-1.5 w-full">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 text-xs px-2"
              onClick={(e) => {
                e.stopPropagation();
                setViewProposalLead(lead);
                setViewProposalOpen(true);
              }}
            >
              <FileText className="mr-1 h-3 w-3" />
              View
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 text-xs px-2"
              onClick={(e) => {
                e.stopPropagation();
                openProposalModal(lead);
              }}
            >
              <Send className="mr-1 h-3 w-3" />
              Resend
            </Button>
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 h-7 text-xs border-green-500/20"
              onClick={(e) => {
                e.stopPropagation();
                handleAcceptProposal(lead);
              }}
            >
              <CheckCircle className="mr-1 h-3 w-3" />
              Accept
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 bg-red-500/10 text-red-600 hover:bg-red-500/20 hover:text-red-700 h-7 text-xs border-red-500/20"
              onClick={(e) => {
                e.stopPropagation();
                handleRejectProposal(lead);
              }}
            >
              <XCircle className="mr-1 h-3 w-3" />
              Reject
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderPaymentAction = (lead: Lead) => {
    const { payments, remaining } = paymentSummary(lead);
    const hasPaymentAwaitingVerification = payments.some((payment) =>
      ['link sent', 'payment link sent', 'pending verification', 'screenshot uploaded - pending verification', 'screenshot received', 'screenshot uploaded'].includes(payment.payment_status.trim().toLowerCase())
    );

    if (lead.proposalAccepted && remaining <= 0) {
      return (
        <Button variant="outline" size="sm" disabled className="text-muted-foreground">
          Payment Completed ✓
        </Button>
      );
    }

    if (lead.proposalAccepted && hasPaymentAwaitingVerification) {
      const pendingPayment = payments.find(p => ['link sent', 'payment link sent', 'pending verification', 'screenshot uploaded - pending verification', 'screenshot received', 'screenshot uploaded'].includes(p.payment_status.trim().toLowerCase()));
      return (
        <div className="flex flex-col gap-1 w-full">
          <Button variant="outline" size="sm" disabled className="text-muted-foreground w-full">
            Awaiting Verification
          </Button>
          {pendingPayment && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setUploadSSPayment(pendingPayment);
                setUploadSSOpen(true);
              }}
            >
              <Upload className="mr-1 h-3 w-3" />
              Upload SS
            </Button>
          )}
        </div>
      );
    }

    if (lead.proposalAccepted && remaining > 0) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            setPaymentLead(lead);
            setPaymentLinkOpen(true);
          }}
        >
          <Wallet className="mr-1 h-3 w-3" />
          Send Payment Link
        </Button>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            <Button variant="outline" size="sm" disabled className="text-muted-foreground">
              <Wallet className="mr-1 h-3 w-3" />
              Payment
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Waiting for client to accept proposal</TooltipContent>
      </Tooltip>
    );
  };

  const renderVerifyButton = (lead: Lead) => {
    if (!isPendingPaymentVerification(lead) || isPaymentVerified(lead)) return null;

    const isVerifying = verifyingLeadId === lead.leadId;

    return (
      <Button
        variant="outline"
        size="sm"
        className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10 h-7 text-xs"
        disabled={isVerifying}
        onClick={(e) => {
          e.stopPropagation();
          handleVerifyPayment(lead);
        }}
      >
        {isVerifying ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : null}
        Verify Payment
      </Button>
    );
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
        assigned_salesperson_email: findAssignedSalespersonEmail(edit, leads, user?.email ?? ''),
      });
      toast.success('Draft sent to client!');
      setEditing((prev) =>
        prev.map((item) => (item.editId === edit.editId ? { ...item, status: 'Draft Sent' } : item))
      );
      await refreshEditing(true);
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
      await refreshEditing(true);
    } catch (error) {
      toast.error('Failed to approve extra revision', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setApprovingExtraId(null);
    }
  };

  const updateHandover = async (edit: EditingProject) => {
    setHandoverId(edit.editId);
    try {
      await postWebhook('/update-handover', {
        edit_id: edit.editId,
        handover_to_client: handoverNotes[edit.editId] ?? edit.handoverToClient,
      });
      toast.success('Handover notes updated!');
      await refreshEditing(true);
    } catch (error) {
      toast.error('Failed to update handover notes', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setHandoverId(null);
    }
  };

  const renderScheduleAction = (lead: Lead) => {
    // Include upsell shoots in the count because the user expects all shoots for this client 
    // to satisfy the main lead's shoot requirements.
    const leadShoots = shoots.filter((s) => s.leadId === lead.leadId && !isEditingOnlyShoot(s));
    const deliverableSets = lead.deliverableSets || (lead as any).deliverable_sets || [];
    const shootSets = deliverableSets.filter((set: any) => {
      const sName = (set.serviceName || '').toLowerCase();
      return !/only[\s-]*editing/i.test(sName) && !/only[\s-]*marketing/i.test(sName);
    });
    const totalInstances = shootSets.length || 1;
    const scheduledCount = leadShoots.length;
    const isAlreadyScheduled = scheduledCount >= totalInstances;

    // Editing-only leads bypass the shoot flow entirely
    if (isEditingOnlyLead(lead) && !isAlreadyScheduled) {
      return (
        <Button variant="outline" size="sm" disabled className="text-muted-foreground">
          Editing Only · No Shoot
        </Button>
      );
    }

    // Marketing-only leads bypass the shoot flow entirely
    if (isMarketingOnlyLead(lead) && !isAlreadyScheduled) {
      return (
        <Button variant="outline" size="sm" disabled className="text-muted-foreground">
          No shoot required (Marketing Only)
        </Button>
      );
    }

    if (!isPaymentComplete(lead)) return null;

    if (isAlreadyScheduled) {
      return (
        <Button variant="outline" size="sm" disabled className="text-muted-foreground">
          {lead.status === 'Shoot Done' ? 'Shoot Done' : `All ${totalInstances} Scheduled`}
        </Button>
      );
    }

    return (
      <div className="flex flex-col gap-1 items-start w-full">
        <Button
          size="sm"
          className="bg-blue-600 text-white hover:bg-blue-700 w-full"
          onClick={(e) => {
            e.stopPropagation();
            openScheduleModal(lead);
          }}
        >
          <Camera className="mr-1 h-3 w-3" />
          {scheduledCount === 0 ? 'Schedule Shoot' : 'Schedule Next'}
        </Button>
        {totalInstances > 1 && (
          <span className="text-[10px] text-muted-foreground text-center w-full mt-0.5">
            {scheduledCount} of {totalInstances} scheduled
          </span>
        )}
      </div>
    );
  };

  const renderFinalPaymentAction = (lead: Lead) => {
    return null;
  };

  const renderStatusCell = (lead: Lead) => (
    <div className="flex flex-col gap-1.5">
      <LeadStatusBadge status={lead.status} />
      {lead.status === 'Proposal Revoked' && (
        <span className="max-w-56 text-xs italic text-muted-foreground">
          Reason: {lead.proposalRevokeReason || 'No reason provided'}
        </span>
      )}
      {(lead.status === 'Proposal Sent' || String(lead.proposalSent).toLowerCase() === 'true') &&
        salesDeliverableSummary(lead).length > 0 && (
          <span className="text-xs text-muted-foreground">
            {salesDeliverableSummary(lead).join(' ')}
          </span>
        )}
      <div className="flex flex-wrap items-center gap-1.5">
        <PaymentStatusIndicator lead={lead} />
        {renderVerifyButton(lead)}
      </div>
    </div>
  );

  const renderActions = (lead: Lead) => {
    const isVerified = isPaymentVerified(lead);
    const validStatuses = ['New Lead', 'Proposal Sent', 'Proposal Revoked', 'Awaiting Payment'];
    const canEdit = validStatuses.includes(lead.status) || lead.proposalAccepted || isVerified;
    const canDelete = (validStatuses.includes(lead.status) || lead.proposalAccepted) && !isVerified;

    return (
      <div className="flex flex-col gap-1.5 items-start min-w-0">
        {canEdit && (
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 min-h-touch"
              onClick={(e) => {
                e.stopPropagation();
                setEditingLead(lead);
                setEditLeadOpen(true);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10 min-h-touch"
                disabled={deletingLeadId === lead.leadId}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteLead(lead);
                }}
              >
                {deletingLeadId === lead.leadId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        )}
        {renderProposalAction(lead)}
        {renderPaymentAction(lead)}
        {renderFinalPaymentAction(lead)}
        {renderScheduleAction(lead)}
      </div>
    );
  };

  const columns: Column<Lead>[] = [
    {
      key: 'serialNo',
      header: 'S.No',
      sortable: true,
      sortValue: (lead) => lead.serialNo,
      cell: (lead) => (
        <span className="text-muted-foreground tabular-nums">{lead.serialNo}</span>
      ),
      className: 'w-16',
      hideOnMobile: true,
    },
    {
      key: 'client',
      header: 'Client',
      sortable: true,
      sortValue: (lead) => lead.name,
      cell: (lead: any) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {lead.profileImage ? (
              <img src={lead.profileImage} alt={lead.name} className="h-full w-full object-cover" />
            ) : (
              <AvatarFallback className="bg-secondary border border-border text-xs">
                {lead.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <p className="font-medium">{lead.name}</p>
            <p className="text-xs text-muted-foreground">{lead.phoneNumber}</p>
          </div>
        </div>
      ),
      mobilePrimary: true,
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      sortable: true,
      sortValue: (lead) => lead.assignedTo,
      cell: (lead) => <span className="text-sm">{lead.assignedTo || '—'}</span>,
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (lead) => renderStatusCell(lead),
      mobileHighlight: true,
    },
    {
      key: 'remaining',
      header: 'Remaining',
      cell: (lead) => <span className="tabular-nums">{formatINR(paymentSummary(lead).remaining)}</span>,
      hideOnMobile: true,
    },
    {
      key: 'action',
      header: 'Actions',
      cell: (lead) => renderActions(lead),
      className: 'w-auto',
      mobileFooter: true,
    },
  ];

  const addonColumns: Column<Shoot>[] = [
    {
      key: 'client',
      header: 'Client / Shoot',
      sortable: true,
      sortValue: (shoot) => shoot.clientName,
      mobilePrimary: true,
      cell: (shoot) => (
        <div>
          <p className="font-medium">{shoot.clientName}</p>
          <p className="text-xs text-muted-foreground">{shoot.shootDate}</p>
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Addon Details',
      cell: (shoot) => (
        <div className="text-xs space-y-0.5">
          {shoot.extraCamera && shoot.extraCamera !== '0' && <p>Extra Camera: {shoot.extraCamera}</p>}
          {shoot.extraTeleprompter && shoot.extraTeleprompter !== '0' && <p>Teleprompter: {shoot.extraTeleprompter}</p>}
          {shoot.extraDurationHours && shoot.extraDurationHours !== '0' && <p>Extra Hrs: {shoot.extraDurationHours}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      mobileHighlight: true,
      cell: (shoot) => {
        const status = (shoot.addonPaymentStatus || 'pending').toLowerCase();
        let badgeVariant: 'default' | 'outline' | 'secondary' = 'outline';
        let label = 'Pending Price';
        if (status === 'price_set') { badgeVariant = 'secondary'; label = 'Price Set'; }
        if (status === 'screenshot_received') { badgeVariant = 'default'; label = 'Screenshot Uploaded'; }
        if (status === 'verified') { badgeVariant = 'default'; label = 'Verified'; }

        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={badgeVariant}>{label}</Badge>
            {shoot.additionalCost && shoot.additionalCost !== '0' && (
              <span className="text-xs font-medium tabular-nums">{formatINR(Number(shoot.additionalCost))}</span>
            )}
            {shoot.addonScreenshot && (
              <a href={shoot.addonScreenshot} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-blue-500 hover:underline inline-flex items-center">
                <ExternalLink className="h-3 w-3 mr-0.5" /> View SS
              </a>
            )}
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      mobileFooter: true,
      cell: (shoot) => {
        const status = (shoot.addonPaymentStatus || 'pending').toLowerCase();
        return (
          <div className="flex flex-wrap gap-2">
            {(status === 'pending' || status === 'price_set') && (
              <Button 
                size="sm" 
                variant="outline" 
                disabled={status === 'price_set'}
                onClick={(e) => { e.stopPropagation(); setAddonShoot(shoot); setAddonPriceOpen(true); }}
              >
                {status === 'price_set' ? 'Addon Price Set' : 'Set Addon Price'}
              </Button>
            )}
            {status === 'screenshot_received' && user && ['manager', 'sales', 'admin', 'super_admin'].includes((user.role ?? '').toLowerCase()) && (
              <Button size="sm" variant="outline" className="border-green-500/40 text-green-600 hover:bg-green-500/10 text-xs h-8"
                disabled={verifyingAddonId === shoot.shootId}
                onClick={async (e) => {
                  e.stopPropagation();
                  setVerifyingAddonId(shoot.shootId);
                  try {
                    const res = await authFetch(`/api/shoots`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ shootId: shoot.shootId, addonPaymentStatus: 'verified', verified_by: user.name, verified_at: new Date().toISOString() })
                    });
                    if (!res.ok) throw new Error('Failed to verify addon');
                    toast.success('Addon verified!');
                    await refreshShoots(true);
                  } catch (error) {
                    toast.error('Failed to verify addon');
                  } finally {
                    setVerifyingAddonId(null);
                  }
                }}
              >
                {verifyingAddonId === shoot.shootId ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                Verify Addon
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  const revisionAddonColumns: Column<EditingProject>[] = [
    {
      key: 'client',
      header: 'Client Info',
      mobilePrimary: true,
      cell: (edit) => (
        <div>
          <p className="font-medium">{edit.clientName}</p>
          <p className="text-xs text-muted-foreground">{edit.serviceType}</p>
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Revision Details',
      cell: (edit) => {
        const displayCost = Number(edit.extraRevisionCost || 0);

        return (
          <div className="text-xs space-y-0.5">
            <p>Revisions: {edit.revisionCount} / {edit.maxFreeRevisions || 2}</p>
            {displayCost > 0 && <p>Cost: {formatINR(displayCost)}</p>}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      mobileHighlight: true,
      cell: (edit) => {
        let status = (edit.addonPaymentStatus || 'pending').toLowerCase();
        
        let badgeVariant: 'default' | 'outline' | 'secondary' = 'outline';
        let label = 'Pending Price';
        if (status === 'price_set') { badgeVariant = 'secondary'; label = 'Link Sent'; }
        if (status === 'screenshot_received') { badgeVariant = 'default'; label = 'Screenshot Uploaded'; }
        if (status === 'verified') { badgeVariant = 'default'; label = 'Verified'; }

        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={badgeVariant}>{label}</Badge>
            {edit.addonScreenshot && status !== 'verified' && (
              <a href={edit.addonScreenshot} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-blue-500 hover:underline inline-flex items-center">
                <ExternalLink className="h-3 w-3 mr-0.5" /> View SS
              </a>
            )}
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      mobileFooter: true,
      cell: (edit) => {
        let status = (edit.addonPaymentStatus || 'pending').toLowerCase();

        return (
          <div className="flex flex-col gap-2">
            {(status === 'pending' || status === 'price_set') && (
              <Button 
                size="sm" 
                variant="outline" 
                disabled={status === 'price_set'}
                onClick={(e) => { e.stopPropagation(); setRevisionAddon(edit); setRevisionPriceOpen(true); }}
              >
                {status === 'price_set' ? 'Link Sent' : 'Send Payment Link'}
              </Button>
            )}
            {status === 'screenshot_received' && user && ['manager', 'sales', 'admin', 'super_admin'].includes((user.role ?? '').toLowerCase()) && (
              <Button size="sm" variant="outline" className="border-green-500/40 text-green-600 hover:bg-green-500/10 text-xs h-8"
                disabled={verifyingRevisionId === edit.editId}
                onClick={async (e) => {
                  e.stopPropagation();
                  setVerifyingRevisionId(edit.editId);
                  try {
                    const res = await authFetch(`/api/editing`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ taskId: edit.editId, addonPaymentStatus: 'verified', addonVerifiedBy: user.name, addonVerifiedAt: new Date().toISOString() })
                    });
                    if (!res.ok) throw new Error('Failed to verify revision payment');
                    toast.success('Revision payment verified!');
                    await refreshEditing(true);
                  } catch (error) {
                    toast.error('Failed to verify revision payment');
                  } finally {
                    setVerifyingRevisionId(null);
                  }
                }}
              >
                {verifyingRevisionId === edit.editId ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                Verify Payment
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  const totalLeads = salesLeads.length;
  const proposalsSent = salesLeads.filter(
    (lead) => lead.status === 'Proposal Sent' || String(lead.proposalSent).toLowerCase() === 'true'
  ).length;
  const totalPipeline = salesLeads.reduce((sum, lead) => sum + parseCost(lead.cost), 0);
  const acceptedValue = salesLeads
    .reduce((sum, lead) => sum + paymentSummary(lead).totalCollected, 0);

  const totalUpsells = salesLeads.filter((l) => l.leadType === 'upsell').length;
  const upsellPercentage = totalLeads > 0 ? ((totalUpsells / totalLeads) * 100).toFixed(1) : 0;

  const pipelineStatuses = [
    'New Lead',
    'Proposal Sent',
    'Proposal Accepted',
    'Shoot Scheduled',
    'Editing',
    'Draft Sent',
    'Delivered',
  ];

  if (loading) return <SalesShimmer />;

  return (
    <TooltipProvider delayDuration={200}>
    <div>
      <PageHeader
        title="Sales"
        description="Lead intake, proposals, and payment tracking"
        actions={
          <div className="flex items-center gap-2">
            {user?.role === 'super_admin' && (
              <Button size="sm" variant="outline" onClick={() => {
                import('@/lib/export').then(({ exportToExcel }) => exportToExcel(leads, 'sales_data'));
              }}>
                <Download className="mr-1.5 h-4 w-4" />
                Export
              </Button>
            )}
            <Button size="sm" onClick={() => setLeadOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Lead
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard title="Total Leads" value={totalLeads} icon={Users} />
        <StatCard title="Proposals Sent" value={proposalsSent} icon={FileText} />
        <StatCard title="Pipeline Value" value={formatINR(totalPipeline)} icon={TrendingUp} />
        <StatCard title="Collected" value={formatINR(acceptedValue)} icon={Wallet} />
      </div>

      <Tabs defaultValue="leads">
        <div className="tabs-scroll-container">
          <TabsList className="flex w-max min-w-full">
            <TabsTrigger value="leads" className="shrink-0">Leads</TabsTrigger>
            <TabsTrigger value="pipeline" className="shrink-0">Pipeline</TabsTrigger>
            <TabsTrigger value="payments" className="shrink-0">Payments</TabsTrigger>
            <TabsTrigger value="calendar" className="shrink-0">Calendar</TabsTrigger>
            <TabsTrigger value="sales-target" className="shrink-0">Sales Target</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="leads" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="tabs-scroll-container rounded-lg border border-border p-1">
              <div className="flex gap-1 w-max">
              {FILTER_TABS.map((tab) => {
                let count = 0;
                let showCount = false;
                
                if (tab.value === 'addons_payments') {
                  const needsAction = (item: any) => {
                    const status = (item.addonPaymentStatus || 'pending').toLowerCase();
                    return status === 'pending' || status === 'screenshot_received';
                  };
                  count = shootsWithAddons.filter(needsAction).length + revisionWithAddons.filter(needsAction).length;
                  showCount = true;
                } else if (tab.value === 'all') {
                  count = salesLeads.filter(l => isPendingPaymentVerification(l)).length;
                  showCount = true;
                }

                return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFilterTab(tab.value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors relative flex items-center',
                    filterTab === tab.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  {tab.label}
                  {showCount && count > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full shadow-sm shadow-blue-500/20">
                      {count}
                    </span>
                  )}
                </button>
                );
              })}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => refreshLeads(false, true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn('mr-1.5 h-4 w-4', refreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {filterTab === 'addons_payments' ? (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-medium mb-3">Shoot Addons</h3>
                <DataTable
                  data={shootsWithAddons}
                  columns={addonColumns}
                  searchKeys={['clientName']}
                  searchPlaceholder="Search shoot addons..."
                />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-3">Revision Addons</h3>
                <DataTable
                  data={revisionWithAddons}
                  columns={revisionAddonColumns}
                  searchKeys={['clientName']}
                  searchPlaceholder="Search revision addons..."
                />
              </div>
            </div>
          ) : (
            <DataTable
              data={filteredLeads}
              columns={columns}
              searchKeys={['name', 'phoneNumber']}
              searchPlaceholder="Search by client name or phone..."
              onRowClick={setPaymentHistoryLead}
            />
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {pipelineStatuses.map((status) => {
              const items = salesLeads.filter((lead) => lead.status === status);
              return (
                <Card key={status}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{status}</CardTitle>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {items.length}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No items</p>
                    ) : (
                      items.map((lead) => (
                        <div
                          key={lead.id}
                          className="rounded-md border border-border p-2.5 cursor-pointer hover:bg-secondary/50 transition-colors"
                          onClick={() => openProposalModal(lead)}
                        >
                          <p className="text-sm font-medium truncate">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lead.servicePitched || 'No service pitched'}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs tabular-nums">
                              {lead.cost ? formatINR(parseCost(lead.cost)) : '—'}
                            </span>
                            <LeadStatusBadge status={lead.status} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                            Remaining: {formatINR(paymentSummary(lead).remaining)}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={salesLeads.filter((lead) => parseCost(lead.cost) > 0)}
                columns={[
                  {
                    key: 'client',
                    header: 'Client',
                    mobilePrimary: true,
                    cell: (lead) => <span className="font-medium">{lead.name}</span>,
                  },
                  {
                    key: 'cost',
                    header: 'Quoted Cost',
                    cell: (lead) => (
                      <span className="tabular-nums">{formatINR(parseCost(lead.cost))}</span>
                    ),
                    hideOnMobile: true,
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    mobileHighlight: true,
                    cell: (lead) => renderStatusCell(lead),
                  },
                  {
                    key: 'accepted',
                    header: 'Proposal',
                    cell: (lead) =>
                      lead.proposalAccepted ? (
                        <span className="text-xs font-medium text-green-600">✅ Accepted</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending</span>
                      ),
                    hideOnMobile: true,
                  },
                ]}
                searchKeys={['name', 'phoneNumber']}
                searchPlaceholder="Search..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <SalesCalendar shoots={shoots} />
        </TabsContent>

        <TabsContent value="sales-target" className="mt-4">
          <SalesTargetTab salesMembers={salesMembers} />
        </TabsContent>

      </Tabs>

      <SendProposalDialog
        open={proposalOpen}
        onOpenChange={setProposalOpen}
        lead={selected}
        defaults={proposalDefaults}
        onSuccess={async () => {
          await refreshLeads(true);
        }}
      />

      <ViewSentProposalDialog
        open={viewProposalOpen}
        onOpenChange={setViewProposalOpen}
        lead={viewProposalLead}
      />

      <SendPaymentLinkDialog
        open={paymentLinkOpen}
        onOpenChange={setPaymentLinkOpen}
        lead={paymentLead}
        summary={paymentLead ? paymentSummary(paymentLead) : null}
        onSuccess={async () => {
          await refreshLeads(true);
          await refreshPaymentHistory(true);
        }}
      />

      <SetAddonPriceDialog
        open={addonPriceOpen}
        onOpenChange={setAddonPriceOpen}
        shoot={addonShoot}
        onSuccess={async () => {
          await refreshShoots(true);
        }}
      />

      <SetRevisionPriceDialog
        open={revisionPriceOpen}
        onOpenChange={setRevisionPriceOpen}
        project={revisionAddon}
        onSuccess={async () => {
          await refreshEditing(true);
        }}
      />

      <Dialog open={Boolean(paymentHistoryLead)} onOpenChange={(open) => !open && setPaymentHistoryLead(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              {paymentHistoryLead ? `${paymentHistoryLead.name} • ${formatINR(parseCost(paymentHistoryLead.cost))}` : ''}
            </DialogDescription>
          </DialogHeader>
          {paymentHistoryLead && (() => {
            const { payments, totalCollected, remaining } = paymentSummary(paymentHistoryLead);
            return (
              <div className="space-y-4">
                {loadingPaymentHistory ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : payments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No payment installments recorded yet.</p>
                ) : (
                  <div className="space-y-4 border-l-2 border-border ml-2 pl-5">
                    {payments.map((payment, index) => {
                      const date = payment.verified_at || payment.payment_link_sent_at;
                      return (
                        <div key={payment.payment_id || `${payment.lead_id}-${index}`} className="relative rounded-md border border-border p-3">
                          <span className="absolute -left-[1.85rem] top-4 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{payment.installment_label}</p>
                              <p className="text-xs text-muted-foreground">{date ? new Date(date).toLocaleDateString('en-IN') : 'Date unavailable'}</p>
                            </div>
                            <p className="font-medium tabular-nums">{formatINR(payment.amount)}</p>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                             <Badge variant={payment.payment_mode === 'Cash' ? 'secondary' : 'outline'}>{payment.payment_mode}</Badge>
                             <Badge variant="outline">{payment.payment_status || 'Pending'}</Badge>
                           </div>
                           {payment.cash_collected_by && (
                             <p className="mt-2 text-xs text-muted-foreground">Collected by: {payment.cash_collected_by}</p>
                           )}
                           {payment.utr_number && payment.utr_number !== 'Not provided' && (
                             <p className="mt-1 text-xs text-muted-foreground">UTR / Ref: {payment.utr_number}</p>
                           )}
                           {payment.screenshot_url && (
                             <a
                               href={payment.screenshot_url}
                               target="_blank"
                               rel="noopener noreferrer"
                               onClick={(e) => e.stopPropagation()}
                               className="mt-2 inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/20 transition-colors"
                             >
                               <ExternalLink className="h-3 w-3" />
                               View Payment Screenshot
                             </a>
                           )}
                           {/* Show Verify button for installments pending verification */}
                           {['screenshot received', 'screenshot uploaded', 'pending verification', 'screenshot uploaded - pending verification'].includes(
                             (payment.payment_status ?? '').trim().toLowerCase()
                           ) && user && ['manager', 'sales', 'admin', 'super_admin'].includes((user.role ?? '').toLowerCase()) && (
                             <Button
                               size="sm"
                               variant="outline"
                               className="mt-2 h-7 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 text-xs"
                               disabled={verifyingLeadId === paymentHistoryLead?.leadId}
                               onClick={async (e) => {
                                 e.stopPropagation();
                                 if (!paymentHistoryLead || !payment.payment_id) return;
                                 setVerifyingLeadId(paymentHistoryLead.leadId);
                                 try {
                                   const res = await authFetch(`/api/payments/${payment.payment_id}/verify`, {
                                     method: 'PUT',
                                     headers: { 'Content-Type': 'application/json' },
                                     body: JSON.stringify({
                                       paymentStatus: 'Payment Verified',
                                       verifiedBy: user.name,
                                       verifiedAt: new Date().toISOString(),
                                     }),
                                   });
                                   if (!res.ok) throw new Error('Failed to verify');
                                   toast.success('Payment verified!');
                                   await Promise.all([refreshLeads(true), refreshPaymentHistory(true)]);
                                 } catch {
                                   toast.error('Failed to verify payment');
                                 } finally {
                                   setVerifyingLeadId(null);
                                 }
                               }}
                             >
                               {verifyingLeadId === paymentHistoryLead?.leadId ? (
                                 <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                               ) : null}
                               Verify Payment
                             </Button>
                           )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 rounded-md bg-muted p-3 text-sm tabular-nums">
                  <div><p className="text-muted-foreground">Total collected</p><p className="font-medium">{formatINR(totalCollected)}</p></div>
                  <div><p className="text-muted-foreground">Remaining</p><p className="font-medium">{formatINR(remaining)}</p></div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <ScheduleShootDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        lead={scheduleLead}
        prefill={schedulePrefill}
        existingShoots={shoots}
        onSuccess={async () => {
          await Promise.all([refreshLeads(true), refreshShoots(true)]);
        }}
      />

      <Sheet open={leadOpen} onOpenChange={handleLeadOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Lead</SheetTitle>
            <SheetDescription>Capture a new lead from WhatsApp Business</SheetDescription>
          </SheetHeader>

          {/* Mode toggle */}
          <div className="flex mt-5 mb-1 rounded-lg border border-border p-1 gap-1">
            <button
              type="button"
              onClick={() => setLeadSheetMode('manual')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors',
                leadSheetMode === 'manual'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Manual Entry
            </button>
            <button
              type="button"
              onClick={() => setLeadSheetMode('bulk')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors',
                leadSheetMode === 'bulk'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Bulk Upload
            </button>
          </div>

          {/* ── MANUAL ENTRY ── */}
          {leadSheetMode === 'manual' && (
            <form onSubmit={handleCreateLead} className="space-y-4 mt-5">
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input id="company" name="company" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact Number</Label>
                <Input id="contact" name="contact" placeholder="+91 ..." required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp Username</Label>
                <Input id="whatsapp" name="whatsapp" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientEmail">Client Email</Label>
                <Input id="clientEmail" name="clientEmail" type="email" placeholder="client@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Cost in ₹</Label>
                <Input id="cost" name="cost" type="number" min="0" step="0.01" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignTo">Assign To</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo} name="assignTo" required>
                  <SelectTrigger id="assignTo">
                    <SelectValue placeholder="Select sales member" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesMembers.map((member) => (
                      <SelectItem key={member} value={member}>
                        {member}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reachoutDone">Reachout Done</Label>
                <Select value={reachoutDone} onValueChange={(v) => setReachoutDone(v as 'yes' | 'no')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <SheetFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setLeadOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creatingLead}>
                  {creatingLead ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
                  Create Lead
                </Button>
              </SheetFooter>
            </form>
          )}

          {/* ── BULK UPLOAD ── */}
          {leadSheetMode === 'bulk' && (
            <div className="mt-5 space-y-5">
              {/* Info banner */}
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-medium flex items-center gap-1.5"><AlertCircle className="h-4 w-4 shrink-0" />Required columns</p>
                <p className="text-xs leading-relaxed">
                  <span className="font-semibold">Company Name</span>, <span className="font-semibold">Contact Number</span>, <span className="font-semibold">Client Email</span> — mandatory<br />
                  WhatsApp Username, Cost in ₹, Assigned To, Reachout Done — optional
                </p>
              </div>

              {/* Template download */}
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadTemplate}>
                <Download className="h-4 w-4" />
                Download Template (CSV)
              </Button>

              {/* File drop zone */}
              <div
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 gap-3 transition-colors cursor-pointer',
                  bulkParsing ? 'border-primary/60 bg-primary/5' : 'border-border hover:border-primary/60 hover:bg-muted/40'
                )}
                onClick={() => !bulkParsing && !bulkUploading && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleExcelFile(file);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleExcelFile(file);
                  }}
                />
                {bulkParsing ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Parsing file…</p>
                  </>
                ) : (
                  <>
                    <div className="rounded-full bg-primary/10 p-3">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Click or drag & drop your Excel / CSV file</p>
                      <p className="text-xs text-muted-foreground mt-0.5">.xlsx, .xls, .csv supported</p>
                    </div>
                  </>
                )}
              </div>

              {/* Preview table */}
              {bulkRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {bulkRows.length} lead{bulkRows.length !== 1 ? 's' : ''} ready to upload
                    </p>
                    {!bulkUploading && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => { setBulkRows([]); setBulkProgress(0); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Progress bar */}
                  {bulkUploading && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Uploading…</span>
                        <span>{bulkProgress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${bulkProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground w-6">#</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Company</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Contact</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map((row, idx) => (
                          <tr key={idx} className={cn('border-t border-border', row._status === 'error' && 'bg-red-500/5')}>
                            <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium max-w-[120px] truncate">
                              {row.company || <span className="text-red-500">Missing</span>}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[110px] truncate">
                              {row.contact || <span className="text-red-500">Missing</span>}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">
                              {row.clientEmail ? row.clientEmail : <span className="text-red-500 font-medium">Missing</span>}
                            </td>
                            <td className="px-3 py-2">
                              {row._status === 'pending' && <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />}
                              {row._status === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                              {row._status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                              {row._status === 'error' && (
                                <span title={row._error}>
                                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Error summary */}
                  {bulkRows.some(r => r._status === 'error') && (
                    <div className="space-y-1">
                      {bulkRows.filter(r => r._status === 'error').map((r, i) => (
                        <p key={i} className="text-xs text-red-500">
                          Row {bulkRows.indexOf(r) + 1} ({r.company}): {r._error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <SheetFooter className="mt-2">
                <Button type="button" variant="outline" onClick={() => setLeadOpen(false)} disabled={bulkUploading}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={bulkRows.length === 0 || bulkUploading || bulkParsing}
                  onClick={handleBulkUpload}
                >
                  {bulkUploading ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Uploading…</>
                  ) : (
                    <><Upload className="mr-1.5 h-4 w-4" />Upload {bulkRows.length > 0 ? `${bulkRows.length} Lead${bulkRows.length !== 1 ? 's' : ''}` : 'Leads'}</>
                  )}
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={editLeadOpen} onOpenChange={setEditLeadOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Lead</SheetTitle>
            <SheetDescription>Update lead details</SheetDescription>
          </SheetHeader>
          {editingLead && (
            <form onSubmit={handleEditLeadSubmit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="edit-company">Company Name</Label>
                <Input id="edit-company" name="company" defaultValue={editingLead.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-contact">Contact Number</Label>
                <Input id="edit-contact" name="contact" defaultValue={editingLead.phoneNumber} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-whatsapp">WhatsApp Username</Label>
                <Input id="edit-whatsapp" name="whatsapp" defaultValue={editingLead.whatsapp} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-clientEmail">Client Email</Label>
                <Input id="edit-clientEmail" name="clientEmail" type="email" defaultValue={editingLead.clientEmail} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cost">Cost in ₹</Label>
                <Input id="edit-cost" name="cost" type="number" min="0" step="0.01" defaultValue={editingLead.cost} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-assignTo">Assign To</Label>
                <Select name="assignTo" defaultValue={editingLead.assignedTo || DEFAULT_ASSIGNED_TO} required>
                  <SelectTrigger id="edit-assignTo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {salesMembers.map((member) => (
                      <SelectItem key={member} value={member}>
                        {member}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-reachoutDone">Reachout Done</Label>
                <Select name="reachoutDone" defaultValue={(editingLead.reachoutDone?.toLowerCase() || 'no') as 'yes' | 'no'}>
                  <SelectTrigger id="edit-reachoutDone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <SheetFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setEditLeadOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Edit className="mr-1.5 h-4 w-4" />
                  Save Changes
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <UploadScreenshotDialog 
        open={uploadSSOpen}
        onOpenChange={setUploadSSOpen}
        payment={uploadSSPayment}
        onSuccess={() => {
          refreshLeads(true);
          refreshPaymentHistory(true);
        }}
      />
    </div>
    </TooltipProvider>
  );
}
