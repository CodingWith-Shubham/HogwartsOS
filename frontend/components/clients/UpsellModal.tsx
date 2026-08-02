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
import { Lock, Loader2, ArrowUpCircle } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from 'sonner';
import type { Lead } from '@/lib/sheets/types';

interface UpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Lead | null;
  salesMembers: string[];
  onSuccess: () => void;
}

export function UpsellModal({ open, onOpenChange, client, salesMembers, onSuccess }: UpsellModalProps) {
  const [assignedTo, setAssignedTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!client) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const cost = formData.get('cost') as string;
    const serviceType = formData.get('serviceType') as string;
    const notes = formData.get('notes') as string;

    try {
      const res = await authFetch('/api/upsell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingClientId: client.leadId,
          assignedTo,
          cost,
          serviceType,
          notes,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create upsell lead');
      }

      toast.success('Upsell lead created successfully!');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error('Failed to create upsell lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-amber-500" />
            Creating upsell for {client.name}
          </DialogTitle>
          <DialogDescription>
            This will create a new upsell record without altering the original client history.
          </DialogDescription>
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
              <Input value={client.clientEmail} readOnly className="bg-muted text-muted-foreground focus-visible:ring-0" />
            </div>
          </div>

          {/* Editable fields */}
          <div className="space-y-2">
            <Label htmlFor="assignTo">Assign To <span className="text-red-500">*</span></Label>
            <Select value={assignedTo} onValueChange={setAssignedTo} required>
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
            <Label htmlFor="serviceType">Service Type <span className="text-red-500">*</span></Label>
            <Input id="serviceType" name="serviceType" placeholder="e.g. Reel + Thumbnail" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost">Cost in ₹ <span className="text-red-500">*</span></Label>
            <Input id="cost" name="cost" type="number" min="0" step="0.01" placeholder="0" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Any context for the upsell..." className="min-h-[80px]" />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !assignedTo} className="bg-amber-600 hover:bg-amber-700 text-white">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Upsell'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
