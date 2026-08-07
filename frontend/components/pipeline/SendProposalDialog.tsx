'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/auth-fetch';
import {
  SERVICE_NOTE_OPTIONS,
  DELIVERABLE_FIELDS,
  DEFAULT_DELIVERABLES,
  normalizeQuantity,
  totalDeliverables,
  type ProposalFormValues,
} from './stageDialogShared';

/** Minimal lead shape the proposal modal needs — satisfied by both `Lead` and upsell/cross-sell entries. */
export interface ProposalDialogLead {
  leadId: string;
  name: string;
  phoneNumber: string;
  clientEmail: string;
  servicePitched: string;
  cost: string;
  assignedTo: string;
}

export interface SendProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: ProposalDialogLead | null;
  /** Values pre-filled every time the dialog opens. */
  defaults?: Partial<ProposalFormValues>;
  /** Extra fields appended to the webhook payload (e.g. `{ upsell_crosssell_id }`). */
  extraPayload?: Record<string, string>;
  /** Called after the webhook succeeds — e.g. advance pipeline status. */
  onSuccess?: () => void | Promise<void>;
}

export function SendProposalDialog({
  open,
  onOpenChange,
  lead,
  defaults,
  extraPayload,
  onSuccess,
}: SendProposalDialogProps) {
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [proposalForm, setProposalForm] = useState<ProposalFormValues>({
    clientEmail: '',
    cost: '',
    serviceNotes: [],
    salesNotes: '',
    camera: '',
    recordTime: '',
    studioTime: '',
    longFormatDuration: '',
    shortFormatDuration: '',
    ...DEFAULT_DELIVERABLES,
  });

  useEffect(() => {
    if (!open || !lead) return;
    setProposalForm({
      clientEmail: lead.clientEmail,
      cost: lead.cost,
      serviceNotes: [],
      salesNotes: '',
      camera: '',
      recordTime: '',
      studioTime: '',
      longFormatDuration: '',
      shortFormatDuration: '',
      ...DEFAULT_DELIVERABLES,
      ...defaults,
    });
    // Initialize from the latest lead/defaults each time the dialog is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSendProposal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lead) return;

    const deliverablesPayload = Object.fromEntries(
      DELIVERABLE_FIELDS.map((field) => [
        field.payloadKey,
        normalizeQuantity(proposalForm[field.key]),
      ])
    );
    const serviceNotes = proposalForm.serviceNotes.join(', ').trim();
    const salesNotes = proposalForm.salesNotes.trim();

    setSubmittingProposal(true);
    try {
      const response = await authFetch('/api/send-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.leadId,
          client_name: lead.name,
          client_email: proposalForm.clientEmail,
          client_phone: lead.phoneNumber,
          service_pitched: lead.servicePitched,
          service_notes: serviceNotes,
          sales_notes: salesNotes,
          ...deliverablesPayload,
          long_format_duration: proposalForm.longFormatDuration.trim(),
          short_format_duration: proposalForm.shortFormatDuration.trim(),
          cost: proposalForm.cost,
          camera: proposalForm.camera,
          record_time: proposalForm.recordTime,
          studio_time: proposalForm.studioTime,
          salesperson_name: lead.assignedTo,
          ...(extraPayload ?? {}),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send proposal');
      }

      onOpenChange(false);
      toast.success('Proposal sent successfully!');
      await onSuccess?.();
    } catch (error) {
      toast.error('Failed to send proposal', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSubmittingProposal(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Proposal</DialogTitle>
          <DialogDescription>
            Send a proposal to {lead?.name ?? 'the client'}
          </DialogDescription>
        </DialogHeader>
        {lead && (
          <form onSubmit={handleSendProposal} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Client Name</Label>
              <Input id="client-name" value={lead.name} readOnly className="bg-muted" />
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal border-input">
                      {proposalForm.serviceNotes.length > 0 
                        ? proposalForm.serviceNotes.join(', ') 
                        : <span className="text-muted-foreground">Select services</span>}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="start">
                    {SERVICE_NOTE_OPTIONS.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option}
                        checked={proposalForm.serviceNotes.includes(option)}
                        onCheckedChange={(checked) => {
                          setProposalForm((prev) => ({
                            ...prev,
                            serviceNotes: checked
                              ? [...prev.serviceNotes, option]
                              : prev.serviceNotes.filter((s) => s !== option),
                          }));
                        }}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {option}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
  );
}

