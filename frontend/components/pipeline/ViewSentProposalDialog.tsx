'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Lead } from '@/lib/sheets/types';
import { formatINR } from '@/lib/formatter';

export interface ViewSentProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

export function ViewSentProposalDialog({
  open,
  onOpenChange,
  lead,
}: ViewSentProposalDialogProps) {
  if (!lead) return null;

  const serviceNotes = lead.serviceNotes ? lead.serviceNotes.split(',').map(s => s.trim()) : [];
  const deliverableSets = lead.deliverableSets || (lead as any).deliverable_sets || [];

  const rootDeliverables = [
    { label: 'Podcast Edit', value: lead.podcastEdit },
    { label: 'Reel Edit', value: lead.reelEdit },
    { label: 'Long Format Video', value: lead.longFormatVideo },
    { label: 'Short Format Video', value: lead.shortFormatVideo },
    { label: 'Teaser Edit', value: lead.teaserEdit },
    { label: 'Thumbnail Edit', value: lead.thumbnailEdit },
    { label: 'Long Format Duration', value: lead.longFormatDuration },
    { label: 'Short Format Duration', value: lead.shortFormatDuration },
  ].filter(d => d.value && d.value !== '0' && d.value !== '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sent Proposal Details</DialogTitle>
          <DialogDescription>
            Proposal previously sent to {lead.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pb-4 mt-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Client Email</Label>
              <Input value={lead.clientEmail || 'N/A'} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Cost</Label>
              <Input value={formatINR(Number(lead.cost || 0))} readOnly className="bg-muted text-green-600 font-semibold" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Services Included</Label>
            <div className="flex flex-wrap gap-2">
              {serviceNotes.length > 0 ? (
                serviceNotes.map((note, i) => (
                  <span key={i} className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-400">
                    {note}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No specific services selected.</span>
              )}
            </div>
          </div>
          {lead.salesNotes && (
            <div className="space-y-2">
              <Label>Sales Notes</Label>
              <Textarea value={lead.salesNotes} readOnly className="bg-muted min-h-10 resize-none" />
            </div>
          )}

          {rootDeliverables.length > 0 && (
            <div className="space-y-2 pt-2">
              <Label className="text-base font-semibold">Total Deliverables</Label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 border rounded-md bg-muted/10 text-sm">
                {rootDeliverables.map((item, idx) => (
                  <div key={idx} className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">{item.label}:</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deliverableSets.length > 0 && (
            <div className="space-y-4 pt-2">
              <Label className="text-base font-semibold">Deliverable Sets Details</Label>
              {deliverableSets.map((set: any, index: number) => {
                const serviceName = set.serviceName || set.service_name || 'General';
                return (
                  <div key={index} className="space-y-2 p-4 border rounded-md bg-muted/20 relative mt-4">
                    <h4 className="font-semibold text-sm text-primary absolute top-0 -mt-2.5 left-4 bg-background px-1">
                      {serviceName} Set {index + 1}
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 text-sm">
                      {Object.entries(set).filter(([k]) => k !== 'serviceName' && k !== 'service_name').map(([key, value]) => {
                        if (!value || value === '0') return null;
                        const formattedKey = key
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase())
                          .replace(/_/g, ' ');
                        return (
                          <div key={key} className="flex justify-between border-b pb-1">
                            <span className="text-muted-foreground">{formattedKey}:</span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
