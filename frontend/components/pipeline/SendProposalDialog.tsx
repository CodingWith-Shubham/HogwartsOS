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
  normalizeQuantity,
  totalDeliverables,
  type ProposalFormValues,
} from './stageDialogShared';

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
  defaults?: Partial<ProposalFormValues>;
  extraPayload?: Record<string, string>;
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
  
  const [proposalForm, setProposalForm] = useState({
    clientEmail: '',
    cost: '',
    serviceNotes: [] as string[],
    salesNotes: '',
    podcastEdit: '0',
  });

  const [deliverableSets, setDeliverableSets] = useState([{
    reelEdit: '0',
    longFormatVideo: '0',
    shortFormatVideo: '0',
    teaserEdit: '0',
    thumbnailEdit: '0',
    longFormatDuration: '',
    shortFormatDuration: '',
    camera: '',
    recordTime: '',
    studioTime: '',
  }]);

  useEffect(() => {
    if (!open || !lead) return;
    setProposalForm({
      clientEmail: lead.clientEmail,
      cost: lead.cost,
      serviceNotes: [],
      salesNotes: '',
      podcastEdit: defaults?.podcastEdit ?? '0',
    });
    setDeliverableSets([{
      reelEdit: defaults?.reelEdit ?? '0',
      longFormatVideo: defaults?.longFormatVideo ?? '0',
      shortFormatVideo: defaults?.shortFormatVideo ?? '0',
      teaserEdit: defaults?.teaserEdit ?? '0',
      thumbnailEdit: defaults?.thumbnailEdit ?? '0',
      longFormatDuration: defaults?.longFormatDuration ?? '',
      shortFormatDuration: defaults?.shortFormatDuration ?? '',
      camera: '',
      recordTime: '',
      studioTime: '',
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Adjust number of deliverable sets based on podcastEdit
  useEffect(() => {
    const count = Math.max(1, Number(normalizeQuantity(proposalForm.podcastEdit)));
    if (deliverableSets.length !== count) {
      setDeliverableSets((prev) => {
        if (prev.length < count) {
          const extra = Array.from({ length: count - prev.length }).map(() => ({
            reelEdit: '0',
            longFormatVideo: '0',
            shortFormatVideo: '0',
            teaserEdit: '0',
            thumbnailEdit: '0',
            longFormatDuration: '',
            shortFormatDuration: '',
            camera: '',
            recordTime: '',
            studioTime: '',
          }));
          return [...prev, ...extra];
        } else {
          return prev.slice(0, count);
        }
      });
    }
  }, [proposalForm.podcastEdit, deliverableSets.length]);

  const aggregatedDeliverables = {
    podcastEdit: proposalForm.podcastEdit,
    reelEdit: String(deliverableSets.reduce((sum, set) => sum + Number(normalizeQuantity(set.reelEdit)), 0)),
    longFormatVideo: String(deliverableSets.reduce((sum, set) => sum + Number(normalizeQuantity(set.longFormatVideo)), 0)),
    shortFormatVideo: String(deliverableSets.reduce((sum, set) => sum + Number(normalizeQuantity(set.shortFormatVideo)), 0)),
    teaserEdit: String(deliverableSets.reduce((sum, set) => sum + Number(normalizeQuantity(set.teaserEdit)), 0)),
    thumbnailEdit: String(deliverableSets.reduce((sum, set) => sum + Number(normalizeQuantity(set.thumbnailEdit)), 0)),
    longFormatDuration: deliverableSets.map(s => s.longFormatDuration).filter(Boolean).join(', '),
    shortFormatDuration: deliverableSets.map(s => s.shortFormatDuration).filter(Boolean).join(', '),
  };

  const handleSendProposal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lead) return;

    const deliverablesPayload = Object.fromEntries(
      DELIVERABLE_FIELDS.map((field) => [
        field.payloadKey,
        field.key === 'podcastEdit' 
          ? normalizeQuantity(proposalForm.podcastEdit)
          : normalizeQuantity(aggregatedDeliverables[field.key as keyof typeof aggregatedDeliverables]),
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
          long_format_duration: aggregatedDeliverables.longFormatDuration.trim(),
          short_format_duration: aggregatedDeliverables.shortFormatDuration.trim(),
          cost: proposalForm.cost,
          salesperson_name: lead.assignedTo,
          deliverable_sets: deliverableSets,
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

  const childDeliverableFields = DELIVERABLE_FIELDS.filter(f => f.key !== 'podcastEdit');

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
          <form onSubmit={handleSendProposal} className="space-y-4 pb-4">
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


            <div className="space-y-4">
              <div className="space-y-2 border-b pb-4">
                <Label htmlFor="podcastEdit" className="text-lg font-semibold text-primary">Number of Podcasts</Label>
                <Input
                  id="podcastEdit"
                  type="number"
                  min="0"
                  step="1"
                  value={proposalForm.podcastEdit}
                  onChange={(e) =>
                    setProposalForm((prev) => ({
                      ...prev,
                      podcastEdit: e.target.value,
                    }))
                  }
                  className="max-w-[200px]"
                />
              </div>

              {deliverableSets.map((set, index) => (
                <div key={index} className="space-y-4 p-4 border rounded-md bg-muted/20 relative">
                  <h4 className="font-semibold text-sm text-muted-foreground absolute top-0 -mt-2.5 left-4 bg-background px-1">
                    {deliverableSets.length > 1 ? `Deliverables for Podcast ${index + 1}` : 'Child Deliverables'}
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                    {childDeliverableFields.map((field) => {
                      const durationKey = 'durationKey' in field ? field.durationKey as keyof typeof set : null;

                      if (durationKey) {
                        return (
                          <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2" key={field.key}>
                            <div className="space-y-2">
                              <Label htmlFor={`${field.key}-${index}`}>{field.label}</Label>
                              <Input
                                id={`${field.key}-${index}`}
                                type="number"
                                min="0"
                                step="1"
                                value={set[field.key as keyof typeof set]}
                                onChange={(e) => {
                                  const newSets = [...deliverableSets];
                                  newSets[index] = { ...newSets[index], [field.key]: e.target.value };
                                  setDeliverableSets(newSets);
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${durationKey}-${index}`}>Duration</Label>
                              <Input
                                id={`${durationKey}-${index}`}
                                value={set[durationKey]}
                                onChange={(e) => {
                                  const newSets = [...deliverableSets];
                                  newSets[index] = { ...newSets[index], [durationKey]: e.target.value };
                                  setDeliverableSets(newSets);
                                }}
                                placeholder="e.g. 60 min"
                              />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2" key={field.key}>
                          <Label htmlFor={`${field.key}-${index}`}>{field.label}</Label>
                          <Input
                            id={`${field.key}-${index}`}
                            type="number"
                            min="0"
                            step="1"
                            value={set[field.key as keyof typeof set]}
                            onChange={(e) => {
                              const newSets = [...deliverableSets];
                              newSets[index] = { ...newSets[index], [field.key]: e.target.value };
                              setDeliverableSets(newSets);
                            }}
                          />
                        </div>
                      );
                    })}
                    <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-3 pt-2 border-t mt-2">
                      <div className="space-y-2">
                        <Label htmlFor={`camera-${index}`}>Camera Setup</Label>
                        <Input
                          id={`camera-${index}`}
                          value={set.camera}
                          onChange={(e) => {
                            const newSets = [...deliverableSets];
                            newSets[index] = { ...newSets[index], camera: e.target.value };
                            setDeliverableSets(newSets);
                          }}
                          placeholder="e.g. 2 cameras"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`record-time-${index}`}>Record Time</Label>
                        <Input
                          id={`record-time-${index}`}
                          value={set.recordTime}
                          onChange={(e) => {
                            const newSets = [...deliverableSets];
                            newSets[index] = { ...newSets[index], recordTime: e.target.value };
                            setDeliverableSets(newSets);
                          }}
                          placeholder="e.g. 2 hours"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`studio-time-${index}`}>Studio Time</Label>
                        <Input
                          id={`studio-time-${index}`}
                          value={set.studioTime}
                          onChange={(e) => {
                            const newSets = [...deliverableSets];
                            newSets[index] = { ...newSets[index], studioTime: e.target.value };
                            setDeliverableSets(newSets);
                          }}
                          placeholder="e.g. 3 hours"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm font-medium pt-2">
              Total deliverables: {totalDeliverables(aggregatedDeliverables as any)}
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
            <DialogFooter className="pt-4">
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

