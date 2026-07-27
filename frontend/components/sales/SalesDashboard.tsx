'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { LeadStatusBadge } from '@/components/shared/Badges';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Users, FileText, Wallet, TrendingUp, Send, RefreshCw, Loader2, Camera, ExternalLink } from 'lucide-react';
import { formatINR } from '@/lib/formatter';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import type { EditingProject, Lead, LeadFilterTab, Shoot } from '@/lib/sheets/types';
import type { InstallmentLabel, PaymentInstallment, PaymentMode, User } from '@/lib/types';
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

const SCHEDULE_SHOOT_WEBHOOK_URL =
  'https://n8n.hogwartsstudios.com/webhook/schedule-shoot';
const FINAL_PAYMENT_COMPLETED_WEBHOOK_URL =
  'https://n8n.hogwartsstudios.com/webhook/final-payment-completed';

const FALLBACK_SALES_MEMBERS = ['Isha Malhotra', 'Krishna Tiwari', 'Krishan Kunal Bagoria'];
const DEFAULT_ASSIGNED_TO = FALLBACK_SALES_MEMBERS[0];
const SERVICE_NOTE_OPTIONS = [
  'Podcast',
  'Solo content shoot',
  'Outdoor shoot',
  'Product',
  'Fashion',
  'Only space',
  'Only editing',
  'Only marketing',
  'End to End',
] as const;

const FILTER_TABS: { value: LeadFilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new_leads', label: 'New Leads' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'accepted', label: 'Accepted' },
];

interface SalesDashboardProps {
  initialLeads: Lead[];
  initialShoots: Shoot[];
  initialEditing: EditingProject[];
}

const FALLBACK_SHOOT_MEMBERS = [
  { name: 'Mayank Saxena', email: 'mayank@hogwartsstudios.com' },
];

const DELIVERABLE_FIELDS = [
  { key: 'podcastEdit', payloadKey: 'podcast_edit', label: 'Podcast Edit' },
  { key: 'reelEdit', payloadKey: 'reel_edit', label: 'Reel Edit' },
  { key: 'longFormatVideo', payloadKey: 'long_format_video', label: 'Long Format Video', durationKey: 'longFormatDuration' },
  { key: 'shortFormatVideo', payloadKey: 'short_format_video', label: 'Short Format Video', durationKey: 'shortFormatDuration' },
  { key: 'teaserEdit', payloadKey: 'teaser_edit', label: 'Teaser Edit' },
  { key: 'thumbnailEdit', payloadKey: 'thumbnail_edit', label: 'Thumbnail Edit' },
] as const;

const TIME_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const TIME_MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const TIME_PERIODS = ['AM', 'PM'] as const;
const INSTALLMENT_LABELS: InstallmentLabel[] = ['Advance', 'Day Before Shoot', 'Post Shoot', 'Custom'];

type TimePeriod = (typeof TIME_PERIODS)[number];
type DeliverableKey = (typeof DELIVERABLE_FIELDS)[number]['key'];

function getAssignedSalespersonName(assignedTo: string, users: User[]) {
  const normalizedAssignee = assignedTo.trim().toLowerCase();
  if (!normalizedAssignee) return assignedTo;

  const salesperson = users.find((user) => {
    if (user.role !== 'sales' && user.role !== 'manager') return false;
    return (
      user.name.trim().toLowerCase() === normalizedAssignee ||
      user.email.trim().toLowerCase() === normalizedAssignee ||
      user.username.trim().toLowerCase() === normalizedAssignee ||
      user.name.trim().toLowerCase().split(/\s+/)[0] === normalizedAssignee
    );
  });

  return salesperson?.name ?? assignedTo;
}

function isVerifiedInstallment(payment: PaymentInstallment): boolean {
  return payment.payment_mode === 'Cash' || ['payment verified', 'payment confirmed', 'confirmed', 'cash received'].includes(payment.payment_status.trim().toLowerCase());
}

type ProposalForm = {
  clientEmail: string;
  cost: string;
  serviceNotes: string;
  salesNotes: string;
  camera: string;
  recordTime: string;
  studioTime: string;
  longFormatDuration: string;
  shortFormatDuration: string;
} & Record<DeliverableKey, string>;

const DEFAULT_DELIVERABLES: Record<DeliverableKey, string> = {
  podcastEdit: '0',
  reelEdit: '0',
  longFormatVideo: '0',
  shortFormatVideo: '0',
  teaserEdit: '0',
  thumbnailEdit: '0',
};

function normalizeQuantity(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return '0';
  return String(Math.floor(parsed));
}

function totalDeliverables(values: Record<DeliverableKey, string>) {
  return DELIVERABLE_FIELDS.reduce(
    (sum, field) => sum + Number(normalizeQuantity(values[field.key])),
    0
  );
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

function parseTimeParts(value: string) {
  if (!value) return { hour: '', minute: '', period: '' };
  const [rawHour, rawMinute] = value.split(':').map(Number);
  if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) {
    return { hour: '', minute: '', period: '' };
  }

  const period: TimePeriod = rawHour >= 12 ? 'PM' : 'AM';
  const hour = rawHour % 12 || 12;

  return {
    hour: String(hour),
    minute: String(rawMinute).padStart(2, '0'),
    period,
  };
}

function buildTimeValue(hour: string, minute: string, period: string) {
  if (!hour || !minute || !period) return '';
  let nextHour = Number(hour);
  const nextMinute = Number(minute);

  if (
    Number.isNaN(nextHour) ||
    Number.isNaN(nextMinute) ||
    nextHour < 1 ||
    nextHour > 12 ||
    nextMinute < 0 ||
    nextMinute > 59
  ) {
    return '';
  }

  if (period === 'AM') {
    nextHour = nextHour === 12 ? 0 : nextHour;
  } else {
    nextHour = nextHour === 12 ? 12 : nextHour + 12;
  }

  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
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

function calculateEndTime(start: string, totalHours: string) {
  if (!start || !totalHours) return '';
  const [hour, minute] = start.split(':').map(Number);
  const durationMinutes = Math.round(Number(totalHours) * 60);

  if (
    [hour, minute, durationMinutes].some((value) => Number.isNaN(value)) ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59 || durationMinutes <= 0
  ) {
    return '';
  }

  const endMinutes = (hour * 60 + minute + durationMinutes) % (24 * 60);
  return `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
}

function parseCost(value: string): number {
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function TimeOfDaySelect({
  id,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [parts, setParts] = useState(() => parseTimeParts(value));

  useEffect(() => {
    setParts(parseTimeParts(value));
  }, [value]);

  const handlePartChange = (part: 'hour' | 'minute' | 'period', nextValue: string) => {
    const nextParts = { ...parts, [part]: nextValue };
    setParts(nextParts);
    const nextTimeValue = buildTimeValue(nextParts.hour, nextParts.minute, nextParts.period);
    if (nextTimeValue) {
      onChange(nextTimeValue);
    }
  };

  return (
    <div className="grid grid-cols-[1fr_1fr_88px] gap-2">
      <Select value={parts.hour} onValueChange={(nextValue) => handlePartChange('hour', nextValue)} disabled={disabled}>
        <SelectTrigger id={`${id}-hour`} aria-label="Hour">
          <SelectValue placeholder="Hour" />
        </SelectTrigger>
        <SelectContent>
          {TIME_HOURS.map((hour) => (
            <SelectItem key={hour} value={hour}>
              {hour}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={parts.minute}
        onValueChange={(nextValue) => handlePartChange('minute', nextValue)}
        disabled={disabled}
      >
        <SelectTrigger id={`${id}-minute`} aria-label="Minute">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent>
          {TIME_MINUTES.map((minute) => (
            <SelectItem key={minute} value={minute}>
              {minute}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={parts.period}
        onValueChange={(nextValue) => handlePartChange('period', nextValue)}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-label="AM or PM">
          <SelectValue placeholder="AM/PM" />
        </SelectTrigger>
        <SelectContent>
          {TIME_PERIODS.map((period) => (
            <SelectItem key={period} value={period}>
              {period}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
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
                <div key={key} className="min-h-[110px] border-t border-border p-2">
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
    const list = users.filter((u) => u.role === 'sales' || u.role === 'manager');
    return list.length > 0 ? list.map(u => u.name) : FALLBACK_SALES_MEMBERS;
  }, [users]);

  const shootMembers = useMemo(() => {
    const list = users.filter((u) => u.role === 'shoot');
    return list.length > 0 ? list.map(u => ({ name: u.name, email: u.email })) : FALLBACK_SHOOT_MEMBERS;
  }, [users]);

  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [shoots, setShoots] = useState<Shoot[]>(initialShoots);
  const [editing, setEditing] = useState<EditingProject[]>(initialEditing);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const [newLeadService, setNewLeadService] = useState('podcast');
  const [reachoutDone, setReachoutDone] = useState<'yes' | 'no'>('no');
  const [assignedTo, setAssignedTo] = useState<string>(DEFAULT_ASSIGNED_TO);

  useEffect(() => {
    if (salesMembers.length > 0 && assignedTo === FALLBACK_SALES_MEMBERS[0]) {
      setAssignedTo(salesMembers[0]);
    }
  }, [salesMembers, assignedTo]);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [filterTab, setFilterTab] = useState<LeadFilterTab>('all');
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [proposalForm, setProposalForm] = useState<ProposalForm>({
    clientEmail: '',
    cost: '',
    serviceNotes: '',
    salesNotes: '',
    camera: '',
    recordTime: '',
    studioTime: '',
    longFormatDuration: '',
    shortFormatDuration: '',
    ...DEFAULT_DELIVERABLES,
  });
  const [paymentLinkOpen, setPaymentLinkOpen] = useState(false);
  const [paymentLead, setPaymentLead] = useState<Lead | null>(null);
  const [paymentOption, setPaymentOption] = useState<'50' | '100' | 'custom'>('50');
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Online');
  const [installmentLabel, setInstallmentLabel] = useState<InstallmentLabel>('Advance');
  const [cashCollectedBy, setCashCollectedBy] = useState('');
  const [additionalEmails, setAdditionalEmails] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false);
  const [verifyingLeadId, setVerifyingLeadId] = useState<string | null>(null);
  const [completingFinalPaymentId, setCompletingFinalPaymentId] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleLead, setScheduleLead] = useState<Lead | null>(null);
  const [schedulingShoot, setSchedulingShoot] = useState(false);
  const [conflictError, setConflictError] = useState('');
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);
  const [approvingExtraId, setApprovingExtraId] = useState<string | null>(null);
  const [handoverId, setHandoverId] = useState<string | null>(null);
  const [extraCosts, setExtraCosts] = useState<Record<string, string>>({});
  const [extraFeedback, setExtraFeedback] = useState<Record<string, string>>({});
  const [handoverNotes, setHandoverNotes] = useState<Record<string, string>>({});
  const [paymentHistoryLead, setPaymentHistoryLead] = useState<Lead | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Record<string, PaymentInstallment[]>>({});
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    shootDate: '',
    shootStartTime: '',
    shootEndTime: '',
    totalHours: '',
    camera: '1',
    teleprompter: 'No',
    bts: 'No',
    recordTime: '',
    setName: '',
    studioTime: '',
    shootMemberName: FALLBACK_SHOOT_MEMBERS[0].name,
    shootMemberEmail: FALLBACK_SHOOT_MEMBERS[0].email,
  });

  useEffect(() => {
    if (shootMembers.length > 0 && scheduleForm.shootMemberName === FALLBACK_SHOOT_MEMBERS[0].name) {
      setScheduleForm((prev) => ({
        ...prev,
        shootMemberName: shootMembers[0].name,
        shootMemberEmail: shootMembers[0].email,
      }));
    }
  }, [shootMembers, scheduleForm.shootMemberName]);

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
      setEditing(data.editing ?? []);
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
    void refreshLeads(true, true);
    refreshShoots(true);
    refreshEditing(true);
    refreshPaymentHistory(true);
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
      if (shoot.leadId) map.set(shoot.leadId, shoot);
      if (shoot.shootId) map.set(shoot.shootId, shoot);
    });
    return map;
  }, [shoots]);

  const totalHours = scheduleForm.totalHours;

  const salesLeads = useMemo(() => {
    return filterSalesLeads(leads, user?.name, user?.role);
  }, [leads, user?.name, user?.role]);

  const visibleEditing = useMemo(() => {
    if (user?.role === 'manager' || user?.role === 'admin') return editing;
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
        return salesLeads.filter((lead) => lead.status === 'New Lead');
      case 'proposal_sent':
        return salesLeads.filter((lead) => lead.status === 'Proposal Sent');
      case 'revoked':
        return salesLeads.filter((lead) => lead.status === 'Proposal Revoked');
      case 'accepted':
        return salesLeads.filter((lead) => lead.proposalAccepted);
      default:
        return salesLeads;
    }
  }, [salesLeads, filterTab]);

  const paymentSummary = (lead: Lead) => {
    const payments = paymentHistory[lead.leadId] ?? [];
    const totalCost = parseCost(lead.cost);
    const totalCollected = payments
      .filter(isVerifiedInstallment)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const remaining = isFinalPaymentCompleted(lead)
      ? 0
      : payments.length > 0
      ? Math.max(0, totalCost - totalCollected)
      : totalCost;

    return { payments, totalCollected, remaining };
  };

  const openProposalModal = (lead: Lead) => {
    const shoot = shootsByLeadId.get(lead.leadId);
    setSelected(lead);
    setProposalForm({
      clientEmail: lead.clientEmail,
      cost: lead.cost,
      podcastEdit: lead.podcastEdit || '0',
      reelEdit: lead.reelEdit || '0',
      longFormatVideo: lead.longFormatVideo || '0',
      shortFormatVideo: '0',
      teaserEdit: lead.teaserDemo || '0',
      thumbnailEdit: lead.thumbnail || '0',
      serviceNotes: SERVICE_NOTE_OPTIONS.includes(
        lead.serviceNotes as (typeof SERVICE_NOTE_OPTIONS)[number]
      )
        ? lead.serviceNotes
        : '',
      salesNotes: lead.salesNotes || '',
      camera: shoot?.camera || '',
      recordTime: shoot?.recordTime || '',
      studioTime: shoot?.studioTime || '',
      longFormatDuration: '',
      shortFormatDuration: '',
    });
    setProposalOpen(true);
  };

  const openScheduleModal = (lead: Lead) => {
    setScheduleLead(lead);
    setScheduleForm({
      shootDate: '',
      shootStartTime: '',
      shootEndTime: '',
      totalHours: '',
      camera: '1',
      teleprompter: 'No',
      bts: 'No',
      recordTime: '',
      setName: '',
      studioTime: '',
      shootMemberName: shootMembers[0]?.name || FALLBACK_SHOOT_MEMBERS[0].name,
      shootMemberEmail: shootMembers[0]?.email || FALLBACK_SHOOT_MEMBERS[0].email,
    });
    setConflictError('');
    setScheduleOpen(true);
  };

  const handleScheduleMemberChange = (name: string) => {
    const member = shootMembers.find((item) => item.name === name) ?? shootMembers[0] ?? FALLBACK_SHOOT_MEMBERS[0];
    setScheduleForm((prev) => ({
      ...prev,
      shootMemberName: member.name,
      shootMemberEmail: member.email,
    }));
  };

  const handleScheduleShoot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scheduleLead) return;

    if (!scheduleForm.setName) {
      setConflictError('Please select a set / location before scheduling.');
      return;
    }

    setSchedulingShoot(true);
    try {
      const assignedTo = getAssignedSalespersonName(scheduleLead.assignedTo, users);
      const payload = {
        lead_id: scheduleLead.leadId,
        client_name: scheduleLead.name,
        contact_num: scheduleLead.phoneNumber,
        email_id: scheduleLead.clientEmail,
        shoot_date: scheduleForm.shootDate,
        shoot_start_time: scheduleForm.shootStartTime,
        shoot_end_time: scheduleForm.shootEndTime,
        total_hours: totalHours,
        camera: scheduleForm.camera,
        teleprompter: scheduleForm.teleprompter,
        bts: scheduleForm.bts,
        record_time: scheduleForm.recordTime,
        set_name: scheduleForm.setName,
        studio_time: scheduleForm.studioTime,
        assigned_to: assignedTo,
        shoot_member_name: scheduleForm.shootMemberName,
        shoot_member_email: scheduleForm.shootMemberEmail,
      };
      const response = await fetch(SCHEDULE_SHOOT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        const conflict = await response.json();
        
        let errorMessage = "A scheduling conflict occurred.";
        
        if (conflict.conflict_type === 'member') {
          errorMessage = `${conflict.conflicting_member || scheduleForm.shootMemberName} is already assigned to a shoot for ${conflict.conflicting_client} from ${conflict.conflicting_start} to ${conflict.conflicting_end}. Please assign a different member or change the time.`;
        } else {
          errorMessage = `"${conflict.conflicting_set || payload.set_name}" is already booked for ${conflict.conflicting_client} from ${conflict.conflicting_start} to ${conflict.conflicting_end}. Please choose a different set or time.`;
        }
        
        setConflictError(errorMessage);
        return;
      }

      if (!response.ok) throw new Error('Failed to schedule shoot');

      setScheduleOpen(false);
      setScheduleLead(null);
      toast.success('Shoot scheduled!');
      await Promise.all([refreshLeads(true), refreshShoots(true)]);
    } catch (error) {
      toast.error('Failed to schedule shoot', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSchedulingShoot(false);
    }
  };

  const handleSendProposal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;

    const deliverablesPayload = Object.fromEntries(
      DELIVERABLE_FIELDS.map((field) => [
        field.payloadKey,
        normalizeQuantity(proposalForm[field.key]),
      ])
    );
    const serviceNotes = proposalForm.serviceNotes.trim();
    const salesNotes = proposalForm.salesNotes.trim();

    setSubmittingProposal(true);
    try {
      const response = await authFetch('/api/send-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selected.leadId,
          client_name: selected.name,
          client_email: proposalForm.clientEmail,
          client_phone: selected.phoneNumber,
          service_pitched: selected.servicePitched,
          service_notes: serviceNotes,
          sales_notes: salesNotes,
          ...deliverablesPayload,
          long_format_duration: proposalForm.longFormatDuration.trim(),
          short_format_duration: proposalForm.shortFormatDuration.trim(),
          cost: proposalForm.cost,
          camera: proposalForm.camera,
          record_time: proposalForm.recordTime,
          studio_time: proposalForm.studioTime,
          salesperson_name: selected.assignedTo,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send proposal');
      }

      setProposalOpen(false);
      toast.success('Proposal sent successfully!');
      await refreshLeads(true);
    } catch (error) {
      toast.error('Failed to send proposal', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSubmittingProposal(false);
    }
  };

  const handleLeadOpenChange = (open: boolean) => {
    setLeadOpen(open);
    if (open) {
      setNewLeadService('podcast');
      setReachoutDone('no');
      setAssignedTo(DEFAULT_ASSIGNED_TO);
    }
  };

  const handleCreateLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    setCreatingLead(true);
    try {
      const response = await authFetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('company'),
          phoneNumber: form.get('contact'),
          whatsapp: form.get('whatsapp'),
          service: newLeadService,
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
      setNewLeadService('podcast');
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

  const handleSendPaymentLink = async () => {
    if (!paymentLead || !user) return;

    const totalCost = parseCost(paymentLead.cost);
    const { remaining: remainingBeforePayment, totalCollected } = paymentSummary(paymentLead);
    const amountToCollect = paymentOption === 'custom'
      ? Number(customAmount)
      : (remainingBeforePayment * Number(paymentOption)) / 100;
    const percentage = (amountToCollect / totalCost) * 100;

    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      toast.error('A valid project cost is required before sending a payment link');
      return;
    }

    if (!Number.isFinite(amountToCollect) || amountToCollect <= 0 || amountToCollect > remainingBeforePayment) {
      toast.error('Payment amount must be greater than zero and cannot exceed the remaining balance');
      return;
    }

    if (paymentMode === 'Cash' && !cashCollectedBy.trim()) {
      toast.error('Cash collector name is required');
      return;
    }

    if (!invoiceFile) {
      toast.error('An invoice or supporting document is required before sending a payment link');
      return;
    }

    const roundedAmountToCollect = Number(amountToCollect.toFixed(2));
    const roundedPercentage = Number(percentage.toFixed(2));
    const remainingAmount = Number((remainingBeforePayment - roundedAmountToCollect).toFixed(2));

    setSendingPaymentLink(true);
    try {
      const formData = new FormData();
      formData.append('lead_id', paymentLead.leadId);
      formData.append('client_name', paymentLead.name);
      formData.append('client_email', paymentLead.clientEmail);
      formData.append('cost', paymentLead.cost);
      formData.append('total_cost', String(totalCost));
      formData.append('amount_to_collect', String(roundedAmountToCollect));
      formData.append('remaining_amount', String(remainingAmount));
      formData.append('amount_paid_so_far', String(totalCollected));
      formData.append('payment_percentage', String(roundedPercentage));
      formData.append('payment_type', roundedPercentage === 100 ? 'Full Payment' : 'Advance Payment');
      formData.append('payment_mode', paymentMode);
      formData.append('cash_collected_by', paymentMode === 'Cash' ? cashCollectedBy.trim() : '');
      formData.append('installment_label', installmentLabel);
      formData.append('salesperson_name', paymentLead.assignedTo);
      formData.append('salesperson_email', user.email);
      formData.append('additional_emails', additionalEmails);
      if (invoiceFile) {
        formData.append('invoice_file', invoiceFile);
      }

      const response = await authFetch('/api/send-payment-link', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to send payment link');
      }

      setPaymentLinkOpen(false);
      setPaymentLead(null);
      setAdditionalEmails('');
      setInvoiceFile(null);
      toast.success(paymentMode === 'Cash' ? 'Cash payment recorded!' : 'Payment link sent!');
      await refreshLeads(true);
      await refreshPaymentHistory(true);
    } catch (error) {
      toast.error('Failed to send payment link', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSendingPaymentLink(false);
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

    if (lead.status === 'Proposal Sent') {
      return (
        <Button variant="outline" size="sm" disabled className="text-muted-foreground">
          Proposal Sent
        </Button>
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
      return (
        <Button variant="outline" size="sm" disabled className="text-muted-foreground">
          Awaiting Verification
        </Button>
      );
    }

    if (lead.proposalAccepted && remaining > 0) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setPaymentLead(lead);
            setPaymentOption('50');
            setCustomAmount('');
            setPaymentMode('Online');
            setInstallmentLabel('Advance');
            setCashCollectedBy(user?.name ?? '');
            setAdditionalEmails('');
            setInvoiceFile(null);
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
    const existingShoot = shootsByLeadId.get(lead.leadId);
    const isAlreadyScheduled = existingShoot || ['Shoot Scheduled', 'Shoot Done'].includes(lead.status);

    if (isAlreadyScheduled) {
      return (
        <Button variant="outline" size="sm" disabled className="text-muted-foreground">
          {lead.status === 'Shoot Done' ? 'Shoot Done' : 'Shoot Scheduled'}
        </Button>
      );
    }

    if (!isPaymentComplete(lead)) return null;

    return (
      <Button
        size="sm"
        className="bg-blue-600 text-white hover:bg-blue-700"
        onClick={(e) => {
          e.stopPropagation();
          openScheduleModal(lead);
        }}
      >
        <Camera className="mr-1 h-3 w-3" />
        Schedule Shoot
      </Button>
    );
  };

  const renderFinalPaymentAction = (lead: Lead) => {
    if (isFinalPaymentCompleted(lead)) return null;

    const isCompleting = completingFinalPaymentId === lead.leadId;

    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isCompleting}
        onClick={(e) => {
          e.stopPropagation();
          handleFinalPaymentCompleted(lead);
        }}
      >
        {isCompleting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
        Final Payment Completed ✓
      </Button>
    );
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

  const renderActions = (lead: Lead) => (
    <div className="flex flex-col gap-1.5 items-start">
      {renderProposalAction(lead)}
      {renderPaymentAction(lead)}
      {renderFinalPaymentAction(lead)}
      {renderScheduleAction(lead)}
    </div>
  );

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
    },
    {
      key: 'client',
      header: 'Client',
      sortable: true,
      sortValue: (lead) => lead.name,
      cell: (lead) => (
        <div>
          <p className="font-medium">{lead.name}</p>
          <p className="text-xs text-muted-foreground">{lead.phoneNumber}</p>
        </div>
      ),
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
      className: 'min-w-[160px]',
    },
  ];

  const totalLeads = salesLeads.length;
  const proposalsSent = salesLeads.filter(
    (lead) => lead.status === 'Proposal Sent' || String(lead.proposalSent).toLowerCase() === 'true'
  ).length;
  const totalPipeline = salesLeads.reduce((sum, lead) => sum + parseCost(lead.cost), 0);
  const acceptedValue = salesLeads
    .filter((lead) => lead.proposalAccepted)
    .reduce((sum, lead) => sum + parseCost(lead.cost), 0);

  const pipelineStatuses = [
    'New Lead',
    'Proposal Sent',
    'Proposal Accepted',
    'Shoot Scheduled',
    'Editing',
    'Draft Sent',
    'Delivered',
  ];

  return (
    <TooltipProvider delayDuration={200}>
    <div>
      <PageHeader
        title="Sales"
        description="Lead intake, proposals, and payment tracking"
        actions={
          <Button size="sm" onClick={() => setLeadOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Lead
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Total Leads" value={totalLeads} icon={Users} />
        <StatCard title="Proposals Sent" value={proposalsSent} icon={FileText} />
        <StatCard title="Pipeline Value" value={formatINR(totalPipeline)} icon={TrendingUp} />
        <StatCard title="Collected" value={formatINR(acceptedValue)} icon={Wallet} />
      </div>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="verify">Verify Editor Work</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFilterTab(tab.value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    filterTab === tab.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshLeads(false, true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn('mr-1.5 h-4 w-4', refreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          <DataTable
            data={filteredLeads}
            columns={columns}
            searchKeys={['searchText']}
            searchPlaceholder="Search by client name or phone..."
            onRowClick={setPaymentHistoryLead}
          />
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
                  },
                ]}
                searchKeys={['searchText']}
                searchPlaceholder="Search..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <SalesCalendar shoots={shoots} />
        </TabsContent>

        <TabsContent value="verify" className="mt-4 space-y-4">
          {extraRevisionNeeded.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-base">Extra Revision Needed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {extraRevisionNeeded.map((edit) => (
                  <div key={edit.editId} className="flex flex-col gap-3 rounded-md border border-border bg-background p-3">
                    <div className="grid gap-3 lg:grid-cols-[1fr_150px_180px_auto] lg:items-center">
                      <div>
                        <p className="font-medium">{edit.clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          Revision {edit.revisionCount}/{edit.maxFreeRevisions} used
                        </p>
                      </div>
                      <Badge className="w-fit border-amber-500/40 bg-amber-500/15 text-amber-600">Needs quote</Badge>
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
                        Confirm Extra Revision
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
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Drafts Ready for Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {draftReadyEdits.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No editor drafts ready right now.</p>
              ) : (
                draftReadyEdits.map((edit) => (
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivered Handover Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {deliveredEdits.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No delivered projects awaiting handover notes.</p>
              ) : (
                deliveredEdits.map((edit) => (
                  <div key={edit.editId} className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[1fr_2fr_auto] lg:items-center">
                    <div>
                      <p className="text-sm font-medium">{edit.clientName}</p>
                      <p className="text-xs text-muted-foreground">{edit.serviceType || 'Delivered project'}</p>
                    </div>
                    <Input
                      placeholder="Handover notes"
                      value={handoverNotes[edit.editId] ?? edit.handoverToClient}
                      onChange={(event) =>
                        setHandoverNotes((prev) => ({ ...prev, [edit.editId]: event.target.value }))
                      }
                    />
                    <Button size="sm" onClick={() => updateHandover(edit)} disabled={handoverId === edit.editId}>
                      Save Handover
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={proposalOpen} onOpenChange={setProposalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Proposal</DialogTitle>
            <DialogDescription>
              Send a proposal to {selected?.name ?? 'the client'}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <form onSubmit={handleSendProposal} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-name">Client Name</Label>
                <Input id="client-name" value={selected.name} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email">Client Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  required
                  value={proposalForm.clientEmail}
                  onChange={(e) =>
                    setProposalForm((prev) => ({ ...prev, clientEmail: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="service-notes">Service Notes</Label>
                  <Select
                    value={proposalForm.serviceNotes}
                    onValueChange={(value) =>
                      setProposalForm((prev) => ({ ...prev, serviceNotes: value }))
                    }
                  >
                    <SelectTrigger id="service-notes">
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_NOTE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sales-notes">Sales Notes</Label>
                  <Textarea
                    id="sales-notes"
                    value={proposalForm.salesNotes}
                    onChange={(e) =>
                      setProposalForm((prev) => ({ ...prev, salesNotes: e.target.value }))
                    }
                    placeholder="Add notes for the sales team..."
                    className="min-h-10"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="proposal-camera">Camera Setup</Label>
                  <Input
                    id="proposal-camera"
                    value={proposalForm.camera}
                    onChange={(e) =>
                      setProposalForm((prev) => ({ ...prev, camera: e.target.value }))
                    }
                    placeholder="e.g. 2 cameras"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal-record-time">Record Time</Label>
                  <Input
                    id="proposal-record-time"
                    value={proposalForm.recordTime}
                    onChange={(e) =>
                      setProposalForm((prev) => ({ ...prev, recordTime: e.target.value }))
                    }
                    placeholder="e.g. 2 hours"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal-studio-time">Studio Time</Label>
                  <Input
                    id="proposal-studio-time"
                    value={proposalForm.studioTime}
                    onChange={(e) =>
                      setProposalForm((prev) => ({ ...prev, studioTime: e.target.value }))
                    }
                    placeholder="e.g. 3 hours"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {DELIVERABLE_FIELDS.map((field) => {
                  const durationKey = 'durationKey' in field ? field.durationKey : null;

                  if (durationKey) {
                    return (
                      <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2" key={field.key}>
                        <div className="space-y-2">
                          <Label htmlFor={field.key}>{field.label}</Label>
                          <Input
                            id={field.key}
                            type="number"
                            min="0"
                            step="1"
                            value={proposalForm[field.key]}
                            onChange={(e) =>
                              setProposalForm((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={durationKey}>Duration</Label>
                          <Input
                            id={durationKey}
                            value={proposalForm[durationKey]}
                            onChange={(e) =>
                              setProposalForm((prev) => ({
                                ...prev,
                                [durationKey]: e.target.value,
                              }))
                            }
                            placeholder="e.g. 60 min"
                          />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2" key={field.key}>
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <Input
                        id={field.key}
                        type="number"
                        min="0"
                        step="1"
                        value={proposalForm[field.key]}
                        onChange={(e) =>
                          setProposalForm((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-sm font-medium">
                Total deliverables: {totalDeliverables(proposalForm)}
              </p>
              <div className="space-y-2">
                <Label htmlFor="cost">Cost in ₹</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={proposalForm.cost}
                  onChange={(e) =>
                    setProposalForm((prev) => ({ ...prev, cost: e.target.value }))
                  }
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setProposalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingProposal}>
                  <Send className="mr-1.5 h-4 w-4" />
                  Send Proposal
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={paymentLinkOpen} onOpenChange={setPaymentLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Payment Link</DialogTitle>
            <DialogDescription>
              Send payment instructions to {paymentLead?.clientEmail || 'the client'}?
            </DialogDescription>
          </DialogHeader>
          {paymentLead && (
            <>
            <div className="rounded-md border border-border p-3 space-y-1 text-sm">
              <p className="font-medium">{paymentLead.name}</p>
              <p className="text-muted-foreground">{paymentLead.clientEmail}</p>
              <p className="text-muted-foreground tabular-nums">
                Amount: {paymentLead.cost ? formatINR(parseCost(paymentLead.cost)) : '—'}
              </p>
            </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Payment Mode</legend>
                <div className="grid grid-cols-2 rounded-md border border-border p-1">
                  {(['Online', 'Cash'] as PaymentMode[]).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      variant={paymentMode === mode ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setPaymentMode(mode)}
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor="installment-label">Installment Label</Label>
                <Select value={installmentLabel} onValueChange={(value) => setInstallmentLabel(value as InstallmentLabel)}>
                  <SelectTrigger id="installment-label"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSTALLMENT_LABELS.map((label) => <SelectItem key={label} value={label}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {paymentMode === 'Cash' ? (
                <>
                <div className="space-y-2">
                  <Label htmlFor="cash-collected-by">Cash collected by</Label>
                  <Input
                    id="cash-collected-by"
                    required
                    value={cashCollectedBy}
                    onChange={(e) => setCashCollectedBy(e.target.value)}
                    placeholder="Collector's name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cash-invoice-file">Attach Invoice/Document *</Label>
                  <Input
                    id="cash-invoice-file"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    required
                    onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                </>
              ) : (
                <>
              <div className="space-y-2">
                <Label htmlFor="additional-emails">Additional Emails (Comma separated)</Label>
                <Input
                  id="additional-emails"
                  type="text"
                  value={additionalEmails}
                  onChange={(e) => setAdditionalEmails(e.target.value)}
                  placeholder="person@example.com, finance@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-file">Attach Invoice/Document *</Label>
                <Input
                  id="invoice-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  required
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                />
              </div>
                </>
              )}
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Advance Payment Type</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {[
                    { value: '50', label: '50% Advance' },
                    { value: '100', label: '100% Full Payment' },
                    { value: 'custom', label: 'Custom amount' },
                  ].map((option) => (
                    <Label key={option.value} className="flex cursor-pointer items-center gap-2 font-normal">
                      <input
                        type="radio"
                        name="payment-option"
                        value={option.value}
                        checked={paymentOption === option.value}
                        onChange={() => setPaymentOption(option.value as '50' | '100' | 'custom')}
                      />
                      {option.label}
                    </Label>
                  ))}
                </div>
                {paymentOption === 'custom' && (
                  <div className="max-w-56 space-y-2">
                    <Label htmlFor="custom-payment-amount">Custom amount (₹)</Label>
                    <Input
                      id="custom-payment-amount"
                      type="number"
                      min="0.01"
                      max={paymentSummary(paymentLead).remaining}
                      step="0.01"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="e.g. 25000"
                    />
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {Number(customAmount) > 0 && parseCost(paymentLead.cost) > 0
                        ? `This is ${((Number(customAmount) / parseCost(paymentLead.cost)) * 100).toFixed(2)}% of the total amount.`
                        : 'Enter an amount to see its percentage of the total.'}
                    </p>
                  </div>
                )}
              </fieldset>
              <div className="rounded-md bg-muted p-3 text-sm space-y-1 tabular-nums">
                <p>
                  Amount to collect: {formatINR(paymentOption === 'custom' ? Number(customAmount) || 0 : (paymentSummary(paymentLead).remaining * Number(paymentOption)) / 100)}
                </p>
                <p className="text-muted-foreground">
                  Remaining balance after this payment: {formatINR(paymentSummary(paymentLead).remaining - (paymentOption === 'custom' ? Number(customAmount) || 0 : (paymentSummary(paymentLead).remaining * Number(paymentOption)) / 100))}
                </p>
              </div>
            </>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPaymentLinkOpen(false);
                setPaymentLead(null);
                setAdditionalEmails('');
                setInvoiceFile(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSendPaymentLink} disabled={sendingPaymentLink || !invoiceFile}>
              <Wallet className="mr-1.5 h-4 w-4" />
              {paymentMode === 'Cash' ? 'Record Cash Payment' : 'Send Payment Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                           ) && user && ['manager', 'sales', 'admin'].includes(user.role ?? '') && (
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

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Shoot</DialogTitle>
            <DialogDescription>Send shoot details to the production team.</DialogDescription>
          </DialogHeader>
          {scheduleLead && (
            <form onSubmit={handleScheduleShoot} className="space-y-5">
              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-medium mb-3">Client Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Client Name</p>
                    <p className="font-medium">{scheduleLead.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contact Number</p>
                    <p>{scheduleLead.phoneNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email ID</p>
                    <p className="truncate">{scheduleLead.clientEmail || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shootDate">Shoot Date</Label>
                  <Input
                    id="shootDate"
                    type="date"
                    required
                    className="schedule-shoot-date-input"
                    value={scheduleForm.shootDate}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, shootDate: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="camera">Camera Count</Label>
                  <Input
                    id="camera"
                    type="number"
                    min="1"
                    required
                    value={scheduleForm.camera}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, camera: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shootStartTime">Shoot Start Time</Label>
                  <TimeOfDaySelect
                    id="shootStartTime"
                    value={scheduleForm.shootStartTime}
                    onChange={(value) => {
                      setScheduleForm((prev) => ({
                        ...prev,
                        shootStartTime: value,
                        shootEndTime: calculateEndTime(value, prev.totalHours),
                      }));
                      setConflictError('');
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shootEndTime">Shoot End Time</Label>
                  <TimeOfDaySelect
                    id="shootEndTime"
                    value={scheduleForm.shootEndTime}
                    onChange={() => undefined}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalHours">Total Hours</Label>
                  <Input
                    id="totalHours"
                    type="number"
                    min="0.25"
                    step="0.25"
                    required
                    disabled={!scheduleForm.shootStartTime}
                    value={totalHours}
                    onChange={(event) => {
                      const value = event.target.value;
                      setScheduleForm((prev) => ({
                        ...prev,
                        totalHours: value,
                        shootEndTime: calculateEndTime(prev.shootStartTime, value),
                      }));
                      setConflictError('');
                    }}
                    placeholder={scheduleForm.shootStartTime ? 'e.g. 1.5' : 'Select a start time first'}
                  />
                  <p className="text-xs text-muted-foreground">End time is calculated automatically.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teleprompter">Teleprompter</Label>
                  <Select
                    value={scheduleForm.teleprompter}
                    onValueChange={(value) =>
                      setScheduleForm((prev) => ({ ...prev, teleprompter: value }))
                    }
                  >
                    <SelectTrigger id="teleprompter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="Yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bts">BTS Required</Label>
                  <Select
                    value={scheduleForm.bts}
                    onValueChange={(value) =>
                      setScheduleForm((prev) => ({ ...prev, bts: value }))
                    }
                  >
                    <SelectTrigger id="bts"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="Yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recordTime">Record Time</Label>
                  <Input
                    id="recordTime"
                    value={scheduleForm.recordTime}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, recordTime: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setName">Set / Location</Label>
                  <Select
                    value={scheduleForm.setName}
                    onValueChange={(value) => {
                      setScheduleForm((prev) => ({ ...prev, setName: value }));
                      setConflictError('');
                    }}
                  >
                    <SelectTrigger id="setName"><SelectValue placeholder="Select a set / location" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Black Money">Black Money</SelectItem>
                      <SelectItem value="Dark Realm">Dark Realm</SelectItem>
                      <SelectItem value="Dark Multiverse">Dark Multiverse</SelectItem>
                      <SelectItem value="Green Amazon">Green Amazon</SelectItem>
                      <SelectItem value="Moroccan">Moroccan</SelectItem>
                      <SelectItem value="Cyclorama Chroma Screen">Cyclorama Chroma Screen</SelectItem>
                      <SelectItem value="Entire Studio">Entire Studio</SelectItem>
                      <SelectItem value="Product Shoot">Product Shoot</SelectItem>
                      <SelectItem value="Outdoor Shoot">Outdoor Shoot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studioTime">Studio Time</Label>
                  <Input
                    id="studioTime"
                    value={scheduleForm.studioTime}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, studioTime: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shootMember">Shoot Member</Label>
                  <Select
                    value={scheduleForm.shootMemberName}
                    onValueChange={handleScheduleMemberChange}
                  >
                    <SelectTrigger id="shootMember"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {shootMembers.map((member) => (
                        <SelectItem key={member.name} value={member.name}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shootMemberEmail">Shoot Member Email</Label>
                  <Input
                    id="shootMemberEmail"
                    type="email"
                    required
                    value={scheduleForm.shootMemberEmail}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, shootMemberEmail: e.target.value }))
                    }
                  />
                </div>
              </div>

              {conflictError && (
                <div className="rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  {conflictError}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setScheduleOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={schedulingShoot || !totalHours}>
                  <Camera className="mr-1.5 h-4 w-4" />
                  Send to Shoot Team
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={leadOpen} onOpenChange={handleLeadOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Lead</SheetTitle>
            <SheetDescription>Capture a new lead from WhatsApp Business</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateLead} className="space-y-4 mt-6">
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
              <Label htmlFor="service">Service Required</Label>
              <Select value={newLeadService} onValueChange={setNewLeadService}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="podcast">Podcast</SelectItem>
                  <SelectItem value="reel">Reel</SelectItem>
                  <SelectItem value="brand_film">Brand Film</SelectItem>
                  <SelectItem value="product_video">Product Video</SelectItem>
                  <SelectItem value="event_coverage">Event Coverage</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                </SelectContent>
              </Select>
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
                <Plus className="mr-1.5 h-4 w-4" />
                Create Lead
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
    </TooltipProvider>
  );
}
