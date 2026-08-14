import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/auth-fetch';
import { postWebhook } from '@/lib/editing';
import type { EditingProject } from '@/lib/sheets/types';

interface SetRevisionPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: EditingProject | null;
  onSuccess: () => void;
}

export function SetRevisionPriceDialog({
  open,
  onOpenChange,
  project,
  onSuccess,
}: SetRevisionPriceDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [additionalCost, setAdditionalCost] = useState('');

  // Prefill the cost if it was already set by the manager
  useEffect(() => {
    if (open && project?.extraRevisionCost) {
      setAdditionalCost(project.extraRevisionCost);
    } else if (!open) {
      setAdditionalCost('');
    }
  }, [open, project]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!project) return;

    if (!additionalCost || isNaN(Number(additionalCost)) || Number(additionalCost) <= 0) {
      toast.error('Please enter a valid positive cost');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Update project in database
      const response = await authFetch(`/api/editing/projects/${project.editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraRevisionCost: additionalCost,
          addonPaymentStatus: 'price_set',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to update revision cost');
      }

      // 2. Trigger webhook to email client
      await postWebhook('/send-revision-payment-link', {
        edit_id: project.editId,
        client_name: project.clientName,
        client_email: project.emailId || '',
        revision_count: project.revisionCount,
        additional_cost: additionalCost,
      });

      toast.success('Revision price set and client notified!');
      setAdditionalCost('');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error('Failed to set revision price', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Revision Payment Link</DialogTitle>
          <DialogDescription>
            Confirm the price for the extra revision for {project?.clientName} and send the payment link.
          </DialogDescription>
        </DialogHeader>

        {project && (
          <div className="space-y-4 py-4 text-sm bg-muted/30 p-4 rounded-md border border-border mt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Revisions Requested:</span>
              <span className="font-medium">{project.revisionCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Free Revisions Allowed:</span>
              <span className="font-medium">{project.maxFreeRevisions || 2}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service Type:</span>
              <span className="font-medium">{project.serviceType}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="additionalCost">Additional Cost (₹)</Label>
            <Input
              id="additionalCost"
              type="number"
              placeholder="e.g. 1500"
              value={additionalCost}
              onChange={(e) => setAdditionalCost(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save & Send Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
