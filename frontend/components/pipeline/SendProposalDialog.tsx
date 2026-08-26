'use client';

import { useEffect, useState, useRef } from 'react';
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
  SERVICE_CONFIGS,
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
  deliverableSets?: any[];
}

export interface SendProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: ProposalDialogLead | null;
  defaults?: Partial<ProposalFormValues>;
  extraPayload?: Record<string, string>;
  onSuccess?: () => void | Promise<void>;
}

type DeliverableSet = {
  reelEdit: string;
  longFormatVideo: string;
  shortFormatVideo: string;
  teaserEdit: string;
  thumbnailEdit: string;
  longFormatDuration: string;
  shortFormatDuration: string;
  camera: string;
  recordTime: string;
  studioTime: string;
  // new marketing fields
  months?: string;
  posts?: string;
  socialMediaHandles?: string;
  marketingNotes?: string;
  // reference
  serviceName?: string;
};

type ServiceData = {
  quantity: string;
  sets: DeliverableSet[];
};

const createEmptySet = (serviceName: string, defaults?: any): DeliverableSet => {
  const fb = defaults || {};
  return {
    reelEdit: fb.reelEdit || '',
    longFormatVideo: fb.longFormatVideo || '',
    shortFormatVideo: fb.shortFormatVideo || '',
    teaserEdit: fb.teaserEdit || '',
    thumbnailEdit: fb.thumbnailEdit || '',
    longFormatDuration: fb.longFormatDuration || '',
    shortFormatDuration: fb.shortFormatDuration || '',
    camera: fb.camera || '',
    recordTime: fb.recordTime || '',
    studioTime: fb.studioTime || '',
    months: fb.months || '',
    posts: fb.posts || '',
    socialMediaHandles: fb.socialMediaHandles || '',
    marketingNotes: fb.marketingNotes || '',
    serviceName,
  };
};

export function SendProposalDialog({
  open,
  onOpenChange,
  lead,
  defaults,
  extraPayload,
  onSuccess,
}: SendProposalDialogProps) {
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const initializedForRef = useRef<string | null>(null);
  
  const [proposalForm, setProposalForm] = useState({
    clientEmail: '',
    cost: '',
    serviceNotes: [] as string[],
    salesNotes: '',
  });

  const [serviceDeliverables, setServiceDeliverables] = useState<Record<string, ServiceData>>({});

  useEffect(() => {
    if (!open || !lead) {
      initializedForRef.current = null;
      return;
    }
    if (initializedForRef.current === lead.leadId) return;

    const initialServices = defaults?.serviceNotes?.length ? defaults.serviceNotes : (lead.servicePitched ? [lead.servicePitched] : []);
    const servicesToUse = initialServices.filter(s => SERVICE_NOTE_OPTIONS.includes(s as any));
    
    setProposalForm({
      clientEmail: lead.clientEmail || '',
      cost: lead.cost || '',
      serviceNotes: servicesToUse,
      salesNotes: defaults?.salesNotes ?? '',
    });

    const initialData: Record<string, ServiceData> = {};

    servicesToUse.forEach(service => {
      const config = SERVICE_CONFIGS[service];
      if (!config) return;
      
      let setsToUse = [createEmptySet(service, defaults)];
      let quantity = '1';

      // If lead already had deliverable sets, try to load them in the first configured service
      // Or if it's Podcast (which was the default before), load it there.
      if (lead.deliverableSets && lead.deliverableSets.length > 0 && 
         (service === 'Podcast' || Object.keys(initialData).length === 0)) {
        quantity = String(lead.deliverableSets.length);
        setsToUse = lead.deliverableSets.map((set: any, idx: number) => {
          const fb = idx === 0 ? defaults : {};
          return {
            reelEdit: set.reelEdit || set.reel_edit || fb?.reelEdit || '',
            longFormatVideo: set.longFormatVideo || set.long_format_video || fb?.longFormatVideo || '',
            shortFormatVideo: set.shortFormatVideo || set.short_format_video || fb?.shortFormatVideo || '',
            teaserEdit: set.teaserEdit || set.teaser_edit || fb?.teaserEdit || '',
            thumbnailEdit: set.thumbnailEdit || set.thumbnail_edit || fb?.thumbnailEdit || '',
            longFormatDuration: set.longFormatDuration || set.long_format_duration || fb?.longFormatDuration || '',
            shortFormatDuration: set.shortFormatDuration || set.short_format_duration || fb?.shortFormatDuration || '',
            camera: set.camera || fb?.camera || '',
            recordTime: set.recordTime || set.record_time || fb?.recordTime || '',
            studioTime: set.studioTime || set.studio_time || fb?.studioTime || '',
            months: set.months || fb?.months || '',
            posts: set.posts || fb?.posts || '',
            socialMediaHandles: set.socialMediaHandles || set.social_media_handles || fb?.socialMediaHandles || '',
            marketingNotes: set.marketingNotes || set.marketing_notes || fb?.marketingNotes || '',
            serviceName: service,
          };
        });
      }

      initialData[service] = { quantity, sets: setsToUse };
    });

    setServiceDeliverables(initialData);
    initializedForRef.current = lead.leadId;
  }, [open, lead, defaults]);

  const handleServiceNotesChange = (checked: boolean, option: string) => {
    setProposalForm(prev => {
      const newNotes = checked 
        ? [...prev.serviceNotes, option] 
        : prev.serviceNotes.filter(s => s !== option);
      
      setServiceDeliverables(prevDelivs => {
        const newDelivs = { ...prevDelivs };
        if (checked && !newDelivs[option]) {
          newDelivs[option] = { quantity: '1', sets: [createEmptySet(option)] };
        } else if (!checked && newDelivs[option]) {
          delete newDelivs[option];
        }
        return newDelivs;
      });

      return { ...prev, serviceNotes: newNotes };
    });
  };

  const updateServiceQuantity = (service: string, qty: string) => {
    setServiceDeliverables(prev => {
      const existing = prev[service];
      if (!existing) return prev;
      
      let count = Math.max(1, Number(normalizeQuantity(qty)));
      const config = SERVICE_CONFIGS[service];
      if (config && !config.hasQuantity) {
        count = 1;
      }
      
      let newSets = [...existing.sets];
      if (newSets.length < count) {
        const extra = Array.from({ length: count - newSets.length }).map(() => createEmptySet(service));
        newSets = [...newSets, ...extra];
      } else {
        newSets = newSets.slice(0, count);
      }
      
      return {
        ...prev,
        [service]: { quantity: qty, sets: newSets }
      };
    });
  };

  const updateServiceSet = (service: string, index: number, field: string, value: string) => {
    setServiceDeliverables(prev => {
      const existing = prev[service];
      if (!existing) return prev;
      const newSets = [...existing.sets];
      newSets[index] = { ...newSets[index], [field]: value };
      return { ...prev, [service]: { ...existing, sets: newSets } };
    });
  };

  // Aggregate for display and final payload
  const getAllSetsFlat = () => {
    return Object.values(serviceDeliverables).flatMap(data => data.sets);
  };

  const flatSets = getAllSetsFlat();

  const aggregatedDeliverables = {
    // Total podcastEdit is sum of podcastEdit fields from all sets OR quantity of podcast service
    // Previously podcastEdit was just the quantity of podcasts.
    podcastEdit: String(
      (serviceDeliverables['Podcast'] ? Number(normalizeQuantity(serviceDeliverables['Podcast'].quantity)) : 0) +
      flatSets.reduce((sum, set) => sum + Number(normalizeQuantity((set as any).podcastEdit || '0')), 0)
    ),
    reelEdit: String(flatSets.reduce((sum, set) => sum + Number(normalizeQuantity(set.reelEdit)), 0)),
    longFormatVideo: String(flatSets.reduce((sum, set) => sum + Number(normalizeQuantity(set.longFormatVideo)), 0)),
    shortFormatVideo: String(flatSets.reduce((sum, set) => sum + Number(normalizeQuantity(set.shortFormatVideo)), 0)),
    teaserEdit: String(flatSets.reduce((sum, set) => sum + Number(normalizeQuantity(set.teaserEdit)), 0)),
    thumbnailEdit: String(flatSets.reduce((sum, set) => sum + Number(normalizeQuantity(set.thumbnailEdit)), 0)),
    longFormatDuration: flatSets.map(s => s.longFormatDuration).filter(Boolean).join(', '),
    shortFormatDuration: flatSets.map(s => s.shortFormatDuration).filter(Boolean).join(', '),
  };

  const handleSendProposal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lead) return;

    const parseDurationToMinutes = (val: string) => {
      const s = String(val || '').toLowerCase().trim();
      const num = parseFloat(s) || 0;
      if (s.includes('min')) return num;
      if (s.includes('hr') || s.includes('hour')) return num * 60;
      return num > 12 ? num : num * 60;
    };

      for (const service of Object.keys(serviceDeliverables)) {
        const data = serviceDeliverables[service];
        for (let i = 0; i < data.sets.length; i++) {
          const set = data.sets[i];
          const recordMins = parseDurationToMinutes(set.recordTime);
          const studioMins = parseDurationToMinutes(set.studioTime);
          
          if (recordMins > 0 && studioMins > 0 && studioMins < recordMins) {
            toast.error(`${service} Set ${i + 1}: Studio Time (${set.studioTime || studioMins + ' min'}) cannot be less than Record Time (${set.recordTime || recordMins + ' min'}).`);
            return;
          }

          const longFormatCount = Number(normalizeQuantity(set.longFormatVideo));
          if (longFormatCount > 0 && !set.longFormatDuration?.trim()) {
            toast.error(`${service} Set ${i + 1}: Long Format Duration is required since Long Format Video quantity is ${longFormatCount}.`);
            return;
          }

          const shortFormatCount = Number(normalizeQuantity(set.shortFormatVideo));
          if (shortFormatCount > 0 && !set.shortFormatDuration?.trim()) {
            toast.error(`${service} Set ${i + 1}: Short Format Duration is required since Short Format Video quantity is ${shortFormatCount}.`);
            return;
          }
        }
      }

    const deliverablesPayload = Object.fromEntries(
      DELIVERABLE_FIELDS.map((field) => [
        field.payloadKey,
        normalizeQuantity(aggregatedDeliverables[field.key as keyof typeof aggregatedDeliverables] || '0'),
      ])
    );

    const serviceNotes = proposalForm.serviceNotes.join(', ').trim();
    const salesNotes = proposalForm.salesNotes.trim();

    // Prepare extra payload fields (e.g. from Marketing)
    const extraFields: any = {};
    if (serviceDeliverables['Only marketing']) {
      const mktSet = serviceDeliverables['Only marketing'].sets[0];
      if (mktSet) {
        extraFields.marketing_months = mktSet.months;
        extraFields.marketing_posts = mktSet.posts;
        extraFields.marketing_social_media_handles = mktSet.socialMediaHandles;
        extraFields.marketing_notes = mktSet.marketingNotes;
      }
    }

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
          deliverable_sets: flatSets,
          ...extraFields,
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
                        onCheckedChange={(checked) => handleServiceNotesChange(checked, option)}
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

            <div className="space-y-6">
              {proposalForm.serviceNotes.map(service => {
                const config = SERVICE_CONFIGS[service];
                if (!config) return null;
                const data = serviceDeliverables[service];
                if (!data) return null;

                return (
                  <div key={service} className="space-y-4 p-4 border rounded-md relative bg-card">
                    <h3 className="font-bold text-md text-primary absolute top-0 -mt-3 left-4 bg-background px-2">
                      {service} Details
                    </h3>
                    
                    {config.hasQuantity && (
                      <div className="space-y-2 border-b pb-4 pt-2">
                        <Label htmlFor={`qty-${service}`} className="text-sm font-semibold text-primary">
                          {config.quantityLabel || `Number of ${service}s`}
                        </Label>
                        <Input
                          id={`qty-${service}`}
                          type="number"
                          min="0"
                          step="1"
                          value={data.quantity}
                          onChange={(e) => updateServiceQuantity(service, e.target.value)}
                          className="max-w-[200px]"
                        />
                      </div>
                    )}

                    {data.sets.map((set, index) => (
                      <div key={index} className="space-y-4 p-4 border rounded-md bg-muted/20 relative mt-4">
                        <h4 className="font-semibold text-sm text-muted-foreground absolute top-0 -mt-2.5 left-4 bg-background px-1">
                          {data.sets.length > 1 ? `${service} ${index + 1} Deliverables` : 'Deliverables'}
                        </h4>
                        
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                          
                          {/* Render Dynamic Deliverable Fields */}
                          {DELIVERABLE_FIELDS.filter(f => config.fields.includes(f.key)).map((field) => {
                            const durationKey = 'durationKey' in field ? field.durationKey as keyof DeliverableSet : null;
                            if (durationKey && config.fields.includes(durationKey)) {
                              const videoQty = Number(set[field.key as keyof DeliverableSet] || 0);
                              return (
                                <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2" key={field.key}>
                                  <div className="space-y-2">
                                    <Label htmlFor={`${field.key}-${service}-${index}`}>{field.label}</Label>
                                    <Input
                                      id={`${field.key}-${service}-${index}`}
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={set[field.key as keyof DeliverableSet] ?? ''}
                                      onChange={(e) => updateServiceSet(service, index, field.key, e.target.value)}
                                      placeholder="0"
                                    />
                                  </div>
                                  {videoQty > 0 && (
                                    <div className="space-y-2">
                                      <Label htmlFor={`${durationKey}-${service}-${index}`}>Duration</Label>
                                      <Input
                                        id={`${durationKey}-${service}-${index}`}
                                        value={set[durationKey as keyof DeliverableSet] || ''}
                                        onChange={(e) => updateServiceSet(service, index, durationKey, e.target.value)}
                                        placeholder="e.g. 60 min"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <div className="space-y-2" key={field.key}>
                                <Label htmlFor={`${field.key}-${service}-${index}`}>{field.label}</Label>
                                <Input
                                  id={`${field.key}-${service}-${index}`}
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={set[field.key as keyof DeliverableSet] ?? ''}
                                  onChange={(e) => updateServiceSet(service, index, field.key, e.target.value)}
                                />
                              </div>
                            );
                          })}

                          {/* Extra Fields based on config */}
                          {config.fields.includes('months') && (
                            <div className="space-y-2">
                              <Label htmlFor={`months-${service}-${index}`}>Months</Label>
                              <Input
                                id={`months-${service}-${index}`}
                                type="number"
                                min="0"
                                value={set.months || ''}
                                onChange={(e) => updateServiceSet(service, index, 'months', e.target.value)}
                                placeholder="e.g. 3"
                              />
                            </div>
                          )}
                          {config.fields.includes('posts') && (
                            <div className="space-y-2">
                              <Label htmlFor={`posts-${service}-${index}`}>Number of Posts</Label>
                              <Input
                                id={`posts-${service}-${index}`}
                                type="number"
                                min="0"
                                value={set.posts || ''}
                                onChange={(e) => updateServiceSet(service, index, 'posts', e.target.value)}
                                placeholder="e.g. 12"
                              />
                            </div>
                          )}
                          {config.fields.includes('socialMediaHandles') && (
                            <div className="space-y-2 sm:col-span-2">
                              <Label htmlFor={`social-${service}-${index}`}>Social Media Handles (e.g. fb, insta, youtube)</Label>
                              <Input
                                id={`social-${service}-${index}`}
                                value={set.socialMediaHandles || ''}
                                onChange={(e) => updateServiceSet(service, index, 'socialMediaHandles', e.target.value)}
                                placeholder="e.g. FB, Insta, YT"
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-3 pt-2 border-t mt-2">
                            {config.fields.includes('camera') && (
                              <div className="space-y-2">
                                <Label htmlFor={`camera-${service}-${index}`}>Camera Setup</Label>
                                <Input
                                  id={`camera-${service}-${index}`}
                                  value={set.camera || ''}
                                  onChange={(e) => updateServiceSet(service, index, 'camera', e.target.value)}
                                  placeholder="e.g. 2 cameras"
                                />
                              </div>
                            )}
                            {config.fields.includes('recordTime') && (
                              <div className="space-y-2">
                                <Label htmlFor={`record-time-${service}-${index}`}>Record Time</Label>
                                <Input
                                  id={`record-time-${service}-${index}`}
                                  value={set.recordTime || ''}
                                  onChange={(e) => updateServiceSet(service, index, 'recordTime', e.target.value)}
                                  placeholder="e.g. 2 hours"
                                />
                              </div>
                            )}
                            {config.fields.includes('studioTime') && (
                              <div className="space-y-2">
                                <Label htmlFor={`studio-time-${service}-${index}`}>
                                  {service === 'Outdoor shoot' || service === 'Fashion' ? 'Total Time' : 'Studio Time'}
                                </Label>
                                <Input
                                  id={`studio-time-${service}-${index}`}
                                  value={set.studioTime || ''}
                                  onChange={(e) => updateServiceSet(service, index, 'studioTime', e.target.value)}
                                  placeholder="e.g. 3 hours"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {proposalForm.serviceNotes.length === 0 && (
               <div className="p-4 border rounded-md text-center text-muted-foreground bg-muted/20">
                 Please select one or more services from &quot;Service Notes&quot; above to fill out deliverables.
               </div>
            )}

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
