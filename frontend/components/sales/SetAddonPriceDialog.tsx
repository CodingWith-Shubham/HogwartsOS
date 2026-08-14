import { useState } from 'react';
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
import type { Shoot } from '@/lib/sheets/types';

interface SetAddonPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shoot: Shoot | null;
  onSuccess: () => void;
}

export function SetAddonPriceDialog({
  open,
  onOpenChange,
  shoot,
  onSuccess,
}: SetAddonPriceDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [additionalCost, setAdditionalCost] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!shoot) return;

    if (!additionalCost || isNaN(Number(additionalCost)) || Number(additionalCost) <= 0) {
      toast.error('Please enter a valid positive cost');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Update shoot in database
      const response = await authFetch(`/api/shoots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shootId: shoot.shootId,
          additionalCost: additionalCost,
          addonPaymentStatus: 'price_set',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to update shoot addon cost');
      }

      // 2. Trigger webhook to email client
      await postWebhook('/send-addon-payment-link', {
        shoot_id: shoot.shootId,
        client_name: shoot.clientName,
        client_email: shoot.emailId || '',
        extra_camera: shoot.extraCamera || '0',
        extra_teleprompter: shoot.extraTeleprompter || '0',
        extra_duration_hours: shoot.extraDurationHours || '0',
        additional_cost: additionalCost,
      });

      toast.success('Addon price set and client notified!');
      setAdditionalCost('');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error('Failed to set addon price', {
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
          <DialogTitle>Set Addon Price</DialogTitle>
          <DialogDescription>
            Set the price for the additional equipment or time used during the shoot for {shoot?.clientName}.
          </DialogDescription>
        </DialogHeader>

        {shoot && (
          <div className="space-y-4 py-4 text-sm bg-muted/30 p-4 rounded-md border border-border mt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Extra Camera:</span>
              <span className="font-medium">{shoot.extraCamera || '0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Extra Teleprompter:</span>
              <span className="font-medium">{shoot.extraTeleprompter || '0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Extra Duration:</span>
              <span className="font-medium">{shoot.extraDurationHours || '0'} hrs</span>
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
