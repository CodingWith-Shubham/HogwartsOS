'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trash2, ExternalLink, Loader2, Scissors } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatINR, formatDate } from '@/lib/formatter';

export interface UpsellCrossSellEntry {
  _id: string;
  clientLeadId: string;
  clientName: string;
  contactNumber: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface PendingAssignmentEntry {
  _id: string;
  clientLeadId: string;
  clientName: string;
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

interface PipelineAction {
  label: string;
  nextStatus: string;
  linkField?: 'proposalLink' | 'paymentLink' | 'shootLink';
  linkTitle?: string;
  linkPlaceholder?: string;
}

/** Available next actions for an entry, honoring the editing-only bypass. */
const getActions = (entry: UpsellCrossSellEntry): PipelineAction[] => {
  switch (entry.status) {
    case 'initiated':
      return [
        {
          label: 'Proposal Sent',
          nextStatus: 'proposal_sent',
          linkField: 'proposalLink',
          linkTitle: 'Add proposal link',
          linkPlaceholder: 'https://... (proposal doc / PDF)',
        },
      ];
    case 'proposal_sent':
      return [
        {
          label: 'Send Payment Link',
          nextStatus: 'payment_sent',
          linkField: 'paymentLink',
          linkTitle: 'Add payment link',
          linkPlaceholder: 'https://... (payment link)',
        },
      ];
    case 'payment_sent':
      return [{ label: 'Mark Payment Done', nextStatus: 'payment_done' }];
    case 'payment_done':
      if (entry.editingOnly) return [];
      return [
        {
          label: 'Schedule Shoot',
          nextStatus: 'shoot_scheduled',
          linkField: 'shootLink',
          linkTitle: 'Add shoot / footage folder link',
          linkPlaceholder: 'https://... (drive folder)',
        },
      ];
    case 'shoot_scheduled':
      return [{ label: 'Mark Shoot Done', nextStatus: 'shoot_done' }];
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
  onRefresh?: () => void;
}

export function UpsellCrossSellPipeline({
  entries,
  showClientName = false,
  canAdvance = false,
  canDelete = false,
  pendingAssignment = [],
  onAssign,
  onRefresh,
}: UpsellCrossSellPipelineProps) {
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ entry: UpsellCrossSellEntry; action: PipelineAction } | null>(null);
  const [linkValue, setLinkValue] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);
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

  const handleDirectAction = async (entry: UpsellCrossSellEntry, action: PipelineAction) => {
    setAdvancingId(entry._id);
    try {
      await patchStatus(entry._id, { status: action.nextStatus });
      toast.success(`Status updated to "${UPSELL_STATUS_META[action.nextStatus]?.label || action.nextStatus}"`);
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setAdvancingId(null);
    }
  };

  const handleLinkSubmit = async () => {
    if (!linkDialog) return;
    if (!linkValue.trim()) {
      toast.error('Please provide a link');
      return;
    }
    setSubmittingLink(true);
    try {
      await patchStatus(linkDialog.entry._id, {
        status: linkDialog.action.nextStatus,
        [linkDialog.action.linkField as string]: linkValue.trim(),
      });
      toast.success(`Status updated to "${UPSELL_STATUS_META[linkDialog.action.nextStatus]?.label || linkDialog.action.nextStatus}"`);
      setLinkDialog(null);
      setLinkValue('');
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSubmittingLink(false);
    }
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
    const actions = canAdvance ? getActions(entry) : [];
    const busy = advancingId === entry._id;
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
          </div>
          <p className="text-xs text-muted-foreground">
            {entry.services.join(', ')} · {formatINR(entry.cost)} · Rep: {entry.assignedTo}
            {entry.editorAssigned ? ` · Editor: ${entry.editorAssigned}` : ''}
          </p>
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
          {actions.map((action) =>
            action.linkField ? (
              <Button
                key={action.nextStatus}
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setLinkValue('');
                  setLinkDialog({ entry, action });
                }}
              >
                {action.label}
              </Button>
            ) : (
              <Button
                key={action.nextStatus}
                size="sm"
                disabled={busy}
                onClick={() => handleDirectAction(entry, action)}
              >
                {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {action.label}
              </Button>
            )
          )}
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

      {/* Link capture dialog (proposal / payment / shoot links) */}
      <Dialog open={!!linkDialog} onOpenChange={(open) => !open && setLinkDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{linkDialog?.action.linkTitle || 'Add link'}</DialogTitle>
            <DialogDescription>
              {linkDialog ? `${linkDialog.entry.clientName} · ${linkDialog.entry.services.join(', ')}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="upsell-link-input">Link</Label>
            <Input
              id="upsell-link-input"
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              placeholder={linkDialog?.action.linkPlaceholder || 'https://...'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleLinkSubmit} disabled={submittingLink || !linkValue.trim()}>
              {submittingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save &amp; Advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

