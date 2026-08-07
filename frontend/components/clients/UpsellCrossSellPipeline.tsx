'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trash2, ExternalLink, Loader2, Scissors, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatINR, formatDate } from '@/lib/formatter';
import type { Shoot } from '@/lib/sheets/types';
import { SendProposalDialog } from '@/components/pipeline/SendProposalDialog';
import { SendPaymentLinkDialog } from '@/components/pipeline/SendPaymentLinkDialog';
import { ScheduleShootDialog } from '@/components/pipeline/ScheduleShootDialog';
import { UploadDriveLinkDialog } from '@/components/pipeline/UploadDriveLinkDialog';
import {
  SERVICE_NOTE_OPTIONS,
  type ProposalFormValues,
} from '@/components/pipeline/stageDialogShared';

export interface UpsellCrossSellEntry {
  _id: string;
  clientLeadId: string;
  clientName: string;
  contactNumber: string;
  /** Backend field containing the client phone number. */
  clientPhone?: string;
  clientEmail?: string;
  type: 'upsell' | 'crosssell';
  services: string[];
  editingOnly: boolean;
  cost: number;
  assignedTo: string;
  notes?: string;
  status: string;
  editorAssigned?: string;
  proposalLink?: string;
  paymentLink?: string;
  shootLink?: string;
  /** Mirrors the lead pipeline's proposal acceptance tracking. */
  proposalAccepted?: boolean;
  proposalRevoked?: boolean;
  proposalRevokeReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Payment record linked to an upsell/cross-sell entry (latest first). */
export interface UpsellEntryPayment {
  paymentId?: string;
  screenshotUrl?: string;
  paymentStatus?: string;
  verifiedBy?: string;
  amount?: number;
}

export interface PendingAssignmentEntry {
  _id: string;
  clientLeadId: string;
  clientName: string;
  clientEmail?: string;
  type: 'upsell' | 'crosssell';
  services: string[];
  editingOnly: boolean;
  cost: number;
  assignedTo: string;
  status: string;
  shootLink?: string;
  editorAssigned?: string;
}

/** Ordered pipeline for progress display. Editing-only deals skip the two shoot stages. */
export const UPSELL_PIPELINE = [
  'initiated',
  'proposal_sent',
  'payment_sent',
  'payment_done',
  'shoot_scheduled',
  'shoot_done',
  'editing',
  'delivered',
] as const;

export const UPSELL_STATUS_META: Record<string, { label: string; className: string }> = {
  initiated: { label: 'Initiated', className: 'bg-slate-500/15 text-slate-600 border-slate-500/30' },
  proposal_sent: { label: 'Proposal Sent', className: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  payment_sent: { label: 'Payment Link Sent', className: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30' },
  payment_done: { label: 'Payment Done', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  shoot_scheduled: { label: 'Shoot Scheduled', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  shoot_done: { label: 'Shoot Done', className: 'bg-orange-500/15 text-orange-600 border-orange-500/30' },
  editing: { label: 'Editing', className: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  delivered: { label: 'Delivered', className: 'bg-green-500/15 text-green-600 border-green-500/30' },
};

export function UpsellTypeBadge({ type }: { type: 'upsell' | 'crosssell' }) {
  return (
    <Badge
      className={
        type === 'crosssell'
          ? 'bg-sky-500/15 text-sky-600 border-sky-500/30'
          : 'bg-amber-500/15 text-amber-600 border-amber-500/30'
      }
    >
      {type === 'crosssell' ? 'Cross-Sell' : 'Upsell'}
    </Badge>
  );
}

export function UpsellStatusBadge({ status }: { status: string }) {
  const meta = UPSELL_STATUS_META[status] || { label: status, className: 'bg-muted text-muted-foreground border-border' };
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

type StageModalKind = 'proposal' | 'payment' | 'schedule' | 'driveLink';

interface PipelineAction {
  label: string;
  nextStatus: string;
  /** Modal-and-webhook action used in the regular lead/shoot workflow. */
  modal?: StageModalKind;
  /** Direct payment verification (same /payments/:id/verify call the sales dashboard makes). */
  verify?: boolean;
  /** Rendered disabled with this explanation (mirrors the sales dashboard's gated buttons). */
  disabledReason?: string;
}

/** Payment statuses the n8n workflow sets when a screenshot still needs a human verify. */
const PENDING_VERIFICATION_STATUSES = [
  'screenshot received',
  'screenshot uploaded',
  'pending verification',
  'screenshot uploaded - pending verification',
];

const VERIFIED_PAYMENT_STATUSES = ['payment verified', 'payment completed', 'verified'];

const normalizePaymentStatus = (status?: string) => (status ?? '').trim().toLowerCase();

const isPaymentPendingVerification = (payment?: UpsellEntryPayment | null) =>
  !!payment && PENDING_VERIFICATION_STATUSES.includes(normalizePaymentStatus(payment.paymentStatus));

const isPaymentVerifiedRecord = (payment?: UpsellEntryPayment | null) =>
  !!payment && VERIFIED_PAYMENT_STATUSES.includes(normalizePaymentStatus(payment.paymentStatus));

/**
 * Available next actions for an entry, honoring the editing-only bypass and
 * the sales dashboard's gating:
 * - payment link only after the client accepted the proposal
 * - shoot scheduling only after the payment is verified
 */
const getActions = (entry: UpsellCrossSellEntry, payment?: UpsellEntryPayment | null): PipelineAction[] => {
  switch (entry.status) {
    case 'initiated':
      return [
        {
          label: 'Send Proposal',
          nextStatus: 'proposal_sent',
          modal: 'proposal',
        },
      ];
    case 'proposal_sent':
      if (entry.proposalAccepted) {
        return [
          {
            label: 'Send Payment Link',
            nextStatus: 'payment_sent',
            modal: 'payment',
          },
        ];
      }
      return [
        {
          label: 'Send Payment Link',
          nextStatus: 'payment_sent',
          modal: 'payment',
          disabledReason: 'Waiting for the client to accept the proposal',
        },
      ];
    case 'payment_sent':
      if (isPaymentPendingVerification(payment)) {
        return [{ label: 'Verify Payment', nextStatus: 'payment_done', verify: true }];
      }
      if (!isPaymentVerifiedRecord(payment)) {
        return [
          {
            label: 'Awaiting Verification',
            nextStatus: 'payment_done',
            disabledReason: 'Waiting for the client to upload the payment screenshot',
          },
        ];
      }
      return [];
    case 'payment_done':
      if (entry.editingOnly) return [];
      return [
        {
          label: 'Schedule Shoot',
          nextStatus: 'shoot_scheduled',
          modal: 'schedule',
        },
      ];
    case 'shoot_scheduled':
      return [{ label: 'Upload Drive Link', nextStatus: 'shoot_done', modal: 'driveLink' }];
    case 'editing':
      return [{ label: 'Mark Delivered', nextStatus: 'delivered' }];
    default:
      return [];
  }
};

interface UpsellCrossSellPipelineProps {
  entries: UpsellCrossSellEntry[];
  /** Sales flow: show client name on each card */
  showClientName?: boolean;
  /** Sales reps may advance statuses */
  canAdvance?: boolean;
  /** Managers may delete entries */
  canDelete?: boolean;
  /** Pending manager editor-assignment entries merged into the list */
  pendingAssignment?: PendingAssignmentEntry[];
  /** Manager callback — open the assign-editor dialog for an entry */
  onAssign?: (entry: PendingAssignmentEntry) => void;
  /** Payments linked to entries via upsell_crosssell_id, grouped by entry id (latest first). */
  paymentsByEntryId?: Record<string, UpsellEntryPayment[]>;
  onRefresh?: () => void;
}

export function UpsellCrossSellPipeline({
  entries,
  showClientName = false,
  canAdvance = false,
  canDelete = false,
  pendingAssignment = [],
  onAssign,
  paymentsByEntryId,
  onRefresh,
}: UpsellCrossSellPipelineProps) {
  const { user } = useAuth();
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [stageModal, setStageModal] = useState<{ entry: UpsellCrossSellEntry; kind: Exclude<StageModalKind, 'driveLink'> } | null>(null);
  const [driveTarget, setDriveTarget] = useState<{ entry: UpsellCrossSellEntry; shootId: string } | null>(null);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<UpsellCrossSellEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pendingIds = new Set(pendingAssignment.map((p) => p._id));
  const maxPipelineIndex = (entry: UpsellCrossSellEntry) =>
    entry.editingOnly ? UPSELL_PIPELINE.length - 3 : UPSELL_PIPELINE.length - 1;

  const patchStatus = async (id: string, body: Record<string, unknown>) => {
    const res = await authFetch(`/api/upsell-crosssell/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Failed to update status');
  };

  const advanceEntry = async (
    entry: UpsellCrossSellEntry,
    nextStatus: string,
    updates: Record<string, unknown> = {}
  ) => {
    setAdvancingId(entry._id);
    try {
      await patchStatus(entry._id, { status: nextStatus, ...updates });
      toast.success(`Status updated to "${UPSELL_STATUS_META[nextStatus]?.label || nextStatus}"`);
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setAdvancingId(null);
    }
  };

  const fetchShoots = async (): Promise<Shoot[]> => {
    try {
      const response = await authFetch('/api/shoots', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to load shoots');
      const nextShoots = (payload.shoots ?? []) as Shoot[];
      setShoots(nextShoots);
      return nextShoots;
    } catch {
      return shoots;
    }
  };

  const findShootForEntry = (entry: UpsellCrossSellEntry, availableShoots: Shoot[]) => {
    const matchingShoots = availableShoots
      .filter((shoot) => shoot.leadId === entry.clientLeadId)
      .sort((a, b) => String(b.createdAt || b.shootDate).localeCompare(String(a.createdAt || a.shootDate)));
    return (
      matchingShoots.find((shoot) => String(shoot.driveLinkUploaded).trim().toLowerCase() !== 'true') ??
      matchingShoots[0]
    );
  };

  /** Latest payment record linked to an entry (n8n tags it with upsell_crosssell_id). */
  const latestPaymentFor = (entry: UpsellCrossSellEntry): UpsellEntryPayment | null =>
    (paymentsByEntryId?.[entry._id] ?? [])[0] ?? null;

  /**
   * Same verification call the sales dashboard makes — the backend advances
   * this entry to payment_done once the payment verifies.
   */
  const handleVerifyPayment = async (entry: UpsellCrossSellEntry) => {
    if (!user) return;
    const payment = latestPaymentFor(entry);
    const paymentId = String(payment?.paymentId ?? '').trim();
    if (!paymentId) {
      toast.error('No payment record is linked to this entry yet');
      return;
    }

    setVerifyingId(entry._id);
    try {
      const res = await authFetch(`/api/payments/${paymentId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: 'Payment Verified',
          verifiedBy: user.name,
          verifiedAt: new Date().toISOString(),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to verify payment');
      toast.success('Payment verified!');
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to verify payment');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleAction = async (entry: UpsellCrossSellEntry, action: PipelineAction) => {
    if (action.verify) {
      await handleVerifyPayment(entry);
      return;
    }
    if (action.disabledReason) return;
    if (!action.modal) {
      await advanceEntry(entry, action.nextStatus);
      return;
    }
    if (action.modal === 'proposal' || action.modal === 'payment') {
      setStageModal({ entry, kind: action.modal });
      return;
    }

    setAdvancingId(entry._id);
    const latestShoots = await fetchShoots();
    setAdvancingId(null);

    if (action.modal === 'schedule') {
      setStageModal({ entry, kind: 'schedule' });
      return;
    }

    const shoot = findShootForEntry(entry, latestShoots);
    if (!shoot) {
      toast.error('No shoot record was found for this client. The scheduled shoot may not have synchronized yet.');
      return;
    }
    setDriveTarget({ entry, shootId: shoot.shootId });
  };

  const stageLeadFor = (entry: UpsellCrossSellEntry) => ({
    leadId: entry.clientLeadId,
    name: entry.clientName,
    phoneNumber: entry.clientPhone ?? entry.contactNumber ?? '',
    clientEmail: entry.clientEmail ?? '',
    servicePitched: entry.services.join(', '),
    cost: entry.cost ? String(entry.cost) : '',
    assignedTo: entry.assignedTo,
  });

  const proposalDefaultsFor = (entry: UpsellCrossSellEntry): Partial<ProposalFormValues> => {
    const validServiceNotes = new Set<string>(SERVICE_NOTE_OPTIONS);
    return {
      serviceNotes: entry.services.filter((service) => validServiceNotes.has(service)),
      salesNotes: entry.notes ?? '',
    };
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/upsell-crosssell/${deleteTarget._id}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to delete entry');
      toast.success(`Deleted ${deleteTarget.clientName}'s entry`);
      setDeleteTarget(null);
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setDeleting(false);
    }
  };


  const visibleEntries = entries.filter((e) => e.status !== 'delivered' && !pendingIds.has(e._id));
  const deliveredEntries = entries.filter((e) => e.status === 'delivered');

  const renderPendingCard = (entry: PendingAssignmentEntry) => (
    <div
      key={entry._id}
      className="flex flex-col gap-3 rounded-md border border-purple-500/30 bg-purple-500/5 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {showClientName && <p className="text-sm font-medium">{entry.clientName}</p>}
          <UpsellTypeBadge type={entry.type} />
          <UpsellStatusBadge status={entry.status} />
          {entry.editingOnly && (
            <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30">Editing Only</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {entry.services.join(', ')} · {formatINR(entry.cost)} · Rep: {entry.assignedTo}
        </p>
        <p className="text-xs text-purple-600 mt-0.5">Awaiting editor assignment</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {entry.shootLink && (
          <Button variant="outline" size="sm" asChild>
            <a href={entry.shootLink} target="_blank" rel="noreferrer">
              View Material <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        )}
        {onAssign && (
          <Button size="sm" onClick={() => onAssign(entry)}>
            <Scissors className="mr-1.5 h-3.5 w-3.5" />
            Assign Editor
          </Button>
        )}
      </div>
    </div>
  );

  const renderEntryCard = (entry: UpsellCrossSellEntry) => {
    const payment = latestPaymentFor(entry);
    const actions = canAdvance ? getActions(entry, payment) : [];
    const busy = advancingId === entry._id || verifyingId === entry._id;
    const screenshotUrl = String(payment?.screenshotUrl ?? '').trim();
    const paymentReached =
      isPaymentVerifiedRecord(payment) ||
      ['payment_done', 'shoot_scheduled', 'shoot_done', 'editing', 'delivered'].includes(entry.status);
    const progressPct = Math.round(
      ((UPSELL_PIPELINE.indexOf(entry.status as (typeof UPSELL_PIPELINE)[number]) + 1) / (maxPipelineIndex(entry) + 1)) * 100
    );
    return (
      <div
        key={entry._id}
        className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {showClientName && <p className="text-sm font-medium">{entry.clientName}</p>}
            <UpsellTypeBadge type={entry.type} />
            <UpsellStatusBadge status={entry.status} />
            {entry.editingOnly && (
              <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30">Editing Only</Badge>
            )}
            {/* Proposal response — same "✅ Client Accepted" / "Proposal Revoked" states as the sales dashboard */}
            {entry.proposalAccepted && (
              <span className="inline-flex items-center rounded-full border border-green-500/40 bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-600">
                ✅ Client Accepted
              </span>
            )}
            {entry.proposalRevoked && (
              <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30">Proposal Revoked</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {entry.services.join(', ')} · {formatINR(entry.cost)} · Rep: {entry.assignedTo}
            {entry.editorAssigned ? ` · Editor: ${entry.editorAssigned}` : ''}
          </p>
          {entry.proposalRevoked && (
            <p className="max-w-96 text-[11px] italic text-muted-foreground">
              Reason: {entry.proposalRevokeReason || 'No reason provided'}
            </p>
          )}
          {/* Payment trail — same Link Sent → Screenshot → Verified indicators as the sales dashboard */}
          <div className="flex flex-wrap items-center gap-1.5">
            {paymentReached ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Payment Verified
                </span>
                {screenshotUrl && (
                  <a
                    href={screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-700 hover:bg-green-500/20 transition-colors"
                  >
                    View SS
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </a>
                )}
              </>
            ) : entry.status === 'payment_sent' ? (
              screenshotUrl ? (
                <a
                  href={screenshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-500/25 transition-colors"
                >
                  <AlertCircle className="h-3 w-3" />
                  Screenshot uploaded - View
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              ) : (
                <p className="text-[11px] font-medium text-blue-500">Link Sent</p>
              )
            ) : entry.status === 'proposal_sent' && !entry.proposalAccepted ? (
              <p className="text-[11px] font-medium text-muted-foreground">Awaiting client acceptance</p>
            ) : null}
          </div>
          {entry.editingOnly && entry.status === 'payment_done' && (
            <p className="text-[11px] font-medium text-purple-400">
              Editing only · No shoot — awaiting editor assignment
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <div className="h-1.5 w-40 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full', entry.type === 'crosssell' ? 'bg-sky-500' : 'bg-amber-500')}
                style={{ width: `${Math.min(progressPct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{progressPct}%</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {entry.proposalLink && (
            <Button variant="ghost" size="sm" asChild>
              <a href={entry.proposalLink} target="_blank" rel="noreferrer">
                Proposal <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
          {entry.paymentLink && (
            <Button variant="ghost" size="sm" asChild>
              <a href={entry.paymentLink} target="_blank" rel="noreferrer">
                Payment <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
          {entry.shootLink && (
            <Button variant="ghost" size="sm" asChild>
              <a href={entry.shootLink} target="_blank" rel="noreferrer">
                Shoot <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
          {actions.map((action) => (
            <Button
              key={action.nextStatus}
              size="sm"
              variant={
                action.modal === 'proposal' || action.modal === 'payment' || action.modal === 'schedule' || action.verify
                  ? 'outline'
                  : undefined
              }
              className={cn(
                action.verify && 'border-amber-500/40 text-amber-600 hover:bg-amber-500/10',
                action.disabledReason && 'text-muted-foreground'
              )}
              title={action.disabledReason}
              disabled={busy || !!action.disabledReason}
              onClick={() => void handleAction(entry, action)}
            >
              {busy && !action.disabledReason ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {action.label}
            </Button>
          ))}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(entry)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };


  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upsell &amp; Cross-Sell Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {visibleEntries.length === 0 && pendingAssignment.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active upsell or cross-sell entries yet.
            </p>
          ) : (
            <>
              {pendingAssignment.map(renderPendingCard)}
              {visibleEntries.map(renderEntryCard)}
            </>
          )}

          {deliveredEntries.length > 0 && (
            <div className="pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Delivered ({deliveredEntries.length})
              </p>
              {deliveredEntries.map(renderEntryCard)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reuse the same stage modals and n8n webhook flows as the regular pipelines. */}
      <SendProposalDialog
        open={stageModal?.kind === 'proposal'}
        onOpenChange={(open) => {
          if (!open) setStageModal(null);
        }}
        lead={stageModal?.kind === 'proposal' ? stageLeadFor(stageModal.entry) : null}
        defaults={stageModal?.kind === 'proposal' ? proposalDefaultsFor(stageModal.entry) : {}}
        extraPayload={stageModal ? { upsell_crosssell_id: stageModal.entry._id } : undefined}
        onSuccess={() => {
          if (stageModal?.kind === 'proposal') {
            return advanceEntry(stageModal.entry, 'proposal_sent');
          }
        }}
      />

      <SendPaymentLinkDialog
        open={stageModal?.kind === 'payment'}
        onOpenChange={(open) => {
          if (!open) setStageModal(null);
        }}
        lead={stageModal?.kind === 'payment' ? stageLeadFor(stageModal.entry) : null}
        summary={
          stageModal?.kind === 'payment'
            ? { totalCollected: 0, remaining: stageModal.entry.cost }
            : null
        }
        extraPayload={stageModal ? { upsell_crosssell_id: stageModal.entry._id } : undefined}
        onSuccess={() => {
          if (stageModal?.kind === 'payment') {
            return advanceEntry(stageModal.entry, 'payment_sent');
          }
        }}
      />

      <ScheduleShootDialog
        open={stageModal?.kind === 'schedule'}
        onOpenChange={(open) => {
          if (!open) setStageModal(null);
        }}
        lead={stageModal?.kind === 'schedule' ? stageLeadFor(stageModal.entry) : null}
        prefill={{ shootCount: 1, camera: '1' }}
        existingShoots={shoots}
        extraPayload={stageModal ? { upsell_crosssell_id: stageModal.entry._id } : undefined}
        onSuccess={() => {
          if (stageModal?.kind === 'schedule') {
            void fetchShoots();
            return advanceEntry(stageModal.entry, 'shoot_scheduled');
          }
        }}
      />

      <UploadDriveLinkDialog
        open={!!driveTarget}
        onOpenChange={(open) => {
          if (!open) setDriveTarget(null);
        }}
        target={
          driveTarget
            ? { shootId: driveTarget.shootId, clientName: driveTarget.entry.clientName }
            : null
        }
        extraPayload={driveTarget ? { upsell_crosssell_id: driveTarget.entry._id } : undefined}
        onSuccess={(dataLink) => {
          if (driveTarget) {
            setDriveTarget(null);
            return advanceEntry(driveTarget.entry, 'shoot_done', { shootLink: dataLink });
          }
        }}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete entry</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Remove the ${deleteTarget.type === 'crosssell' ? 'cross-sell' : 'upsell'} for ${deleteTarget.clientName}? This only affects the upsell/cross-sell pipeline — the original client record stays untouched.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

