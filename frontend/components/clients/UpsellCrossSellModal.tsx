'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Lock, Loader2, TrendingUp, Shuffle, ShoppingCart } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Lead } from '@/lib/sheets/types';

export type UpsellCrossSellType = 'upsell' | 'crosssell' | 'newsale';

/**
 * Services offered for upsell / cross-sell deals (multi-select).
 * Aligned with the studio's deliverables vocabulary used elsewhere in the app.
 */
export const UPSELL_SERVICE_OPTIONS = [
  'Podcast',
  'Reel',
  'Thumbnail',
  'Teaser',
  'Long Format Video',
  'Short Format Video',
  'Brand Film',
  'Product Video',
  'Event Coverage',
  'Podcast Editing',
  'Reel Editing',
  'Social Media Design',
];

/** Mirrors backend EDITING_ONLY_MARKERS — services with no shoot stage. */
const EDITING_ONLY_MARKERS = ['thumbnail', 'editing', 'edit', 'social media', 'design'];

export const detectEditingOnly = (services: string[]): boolean =>
  services.length > 0 &&
  services.every((s) => EDITING_ONLY_MARKERS.some((m) => s.trim().toLowerCase().includes(m)));

const TYPE_META: Record<
  UpsellCrossSellType,
  { title: string; verb: string; description: string; icon: typeof TrendingUp; iconClass: string; buttonClass: string }
> = {
  upsell: {
    title: 'Initiate Upsell',
    verb: 'Initiating',
    description: 'Sell a bigger or add-on version of what this client already bought. The original client record and history stay untouched.',
    icon: TrendingUp,
    iconClass: 'text-amber-500',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  crosssell: {
    title: 'Initiate Cross-Sell',
    verb: 'Initiating',
    description: 'Sell a COMPLETELY DIFFERENT service category to this client. The original client record and history stay untouched.',
    icon: Shuffle,
    iconClass: 'text-sky-500',
    buttonClass: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
  newsale: {
    title: 'Initiate New Sale',
    verb: 'Initiating',
    description: 'Sell a new service to an existing client. Follows the same pipeline as a new client.',
    icon: ShoppingCart,
    iconClass: 'text-green-500',
    buttonClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
};

interface UpsellCrossSellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Lead | null;
  type: UpsellCrossSellType;
  salesMembers: string[];
  onSuccess: () => void;
}

export function UpsellCrossSellModal({ open, onOpenChange, client, type, salesMembers, onSuccess }: UpsellCrossSellModalProps) {
  const [services, setServices] = useState<string[]>([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [editingOnly, setEditingOnly] = useState(false);
  const [editingOnlyTouched, setEditingOnlyTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cost, setCost] = useState('');

  const toggleService = (service: string) => {
    setServices((prev) => {
      const next = prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service];
      if (!editingOnlyTouched) setEditingOnly(detectEditingOnly(next));
      return next;
    });
  };

  const resetForm = () => {
    setServices([]);
    setAssignedTo('');
    setEditingOnly(false);
    setEditingOnlyTouched(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  if (!client) return null;

  const meta = TYPE_META[type];
  const Icon = meta.icon;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (services.length === 0) {
      toast.error('Select at least one service');
      return;
    }
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const cost = formData.get('cost') as string;
    const notes = formData.get('notes') as string;

    try {
      const res = await authFetch('/api/upsell-crosssell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.leadId,
          clientLeadId: client.leadId,
          type,
          services,
          cost: Number(cost || 0),
          assignedTo,
          notes,
          editingOnly,
          reachout_done: 'yes',
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || `Failed to initiate ${type}`);
      }

      toast.success(type === 'crosssell' ? 'Cross-sell initiated successfully!' : type === 'newsale' ? 'New sale initiated successfully!' : 'Upsell initiated successfully!');
      handleOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : `Failed to initiate ${type}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn('h-5 w-5', meta.iconClass)} />
            {meta.title} for {client.name}
          </DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Read-only inherited fields */}
          <div className="space-y-3 bg-secondary/30 p-3 rounded-md border border-border">
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <Lock className="h-3 w-3" /> Client Name
              </Label>
              <Input value={client.name} readOnly className="bg-muted text-muted-foreground focus-visible:ring-0" />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <Lock className="h-3 w-3" /> Contact Number
              </Label>
              <Input value={client.phoneNumber} readOnly className="bg-muted text-muted-foreground focus-visible:ring-0" />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <Lock className="h-3 w-3" /> Email
              </Label>
              <Input value={client.clientEmail || '—'} readOnly className="bg-muted text-muted-foreground focus-visible:ring-0" />
            </div>
          </div>

          {/* Multi-select services */}
          <div className="space-y-2">
            <Label>
              Services <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {UPSELL_SERVICE_OPTIONS.map((service) => {
                const selected = services.includes(service);
                return (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggleService(service)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        selected
                          ? type === 'crosssell'
                            ? 'border-sky-500 bg-sky-500/15 text-sky-600'
                            : type === 'newsale'
                            ? 'border-green-500 bg-green-500/15 text-green-600'
                            : 'border-amber-500 bg-amber-500/15 text-amber-600'
                          : 'border-border bg-secondary/40 text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    {service}
                  </button>
                );
              })}
            </div>
            {services.length === 0 && (
              <p className="text-xs text-muted-foreground">Select one or more services for this deal.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignTo">Assigned To <span className="text-red-500">*</span></Label>
            <Select value={assignedTo} onValueChange={setAssignedTo} required>
              <SelectTrigger id="assignTo">
                <SelectValue placeholder="Select sales rep" />
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
            <Label htmlFor="cost">Cost in ₹ <span className="text-red-500">*</span></Label>
            <Input id="cost" name="cost" type="number" min="0" step="0.01" placeholder="0" required />
          </div>

          {/* Editing-only bypass — auto-detected from services, manually overridable */}
          <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 p-3">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="editingOnly" className="text-sm">Editing-only (no shoot required)</Label>
              <p className="text-xs text-muted-foreground">
                Skips the shoot stages — the deal goes straight from payment to editing.
              </p>
            </div>
            <Switch
              id="editingOnly"
              checked={editingOnly}
              onCheckedChange={(checked) => {
                setEditingOnlyTouched(true);
                setEditingOnly(checked);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Any context for this deal..." className="min-h-[80px]" />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !assignedTo || services.length === 0} className={meta.buttonClass}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {meta.verb}...
                </>
              ) : (
                meta.title
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

