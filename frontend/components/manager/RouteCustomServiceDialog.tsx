'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/lib/auth-context';
import type { Lead } from '@/lib/sheets/types';

export function RouteCustomServiceDialog({ 
  open, 
  onOpenChange, 
  data, 
  onSuccess 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: { lead: Lead, deliverableSetIndex: number, set: any } | null;
  onSuccess?: () => void 
}) {
  const { users } = useAuth();
  const [loading, setLoading] = useState(false);

  const [team, setTeam] = useState<'shoot' | 'edit' | 'marketing' | ''>('');
  
  // Shoot Fields
  const [shootDate, setShootDate] = useState('');
  const [shootStartTime, setShootStartTime] = useState('');
  const [shootEndTime, setShootEndTime] = useState('');
  
  // Edit Fields
  const [editDuration, setEditDuration] = useState('');
  const [editType, setEditType] = useState('');
  
  // Marketing Fields
  const [marketingComments, setMarketingComments] = useState('');
  
  // Common
  const [assignedMember, setAssignedMember] = useState('');

  // Reset form when opened with new data
  useEffect(() => {
    if (open && data) {
      setTeam('');
      setShootDate('');
      setShootStartTime('');
      setShootEndTime('');
      setEditDuration('');
      setEditType('');
      setMarketingComments(data.set?.customDetails || '');
      setAssignedMember('');
    }
  }, [open, data]);

  const members = users.filter(u => {
    if (team === 'shoot') return true; // typically any can be shoot, or maybe limit to editor/shooters
    if (team === 'edit') return u.role === 'editor';
    if (team === 'marketing') return u.role === 'marketing';
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.lead || data.deliverableSetIndex === null || !team) return;
    if (!assignedMember) {
      toast.error('Please assign a member.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        leadId: data.lead.leadId,
        deliverableSetIndex: data.deliverableSetIndex,
        team,
        assignedMember,
        shootDate,
        shootStartTime,
        shootEndTime,
        editDuration,
        editType,
        marketingComments,
        customDetails: data.set?.customDetails || '',
      };

      const res = await authFetch('/api/route-custom-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to route service');
      
      toast.success(`Service successfully routed to the ${team} team!`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error('Failed to route service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Route Custom Service</DialogTitle>
          <DialogDescription>
            Assign the custom service for {data?.lead?.name} to the appropriate team.
          </DialogDescription>
        </DialogHeader>
        
        {data?.lead && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Service Details (From Sales)</Label>
              <div className="text-sm p-3 bg-muted rounded-md border text-muted-foreground whitespace-pre-wrap">
                {data.set?.customDetails || 'No details provided.'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assign to Team</Label>
              <Select value={team} onValueChange={(val: any) => setTeam(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Team..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shoot">Shoot Team</SelectItem>
                  <SelectItem value="edit">Edit Team</SelectItem>
                  <SelectItem value="marketing">Marketing Team</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {team === 'shoot' && (
              <div className="space-y-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label>Shoot Date</Label>
                  <Input type="date" value={shootDate} onChange={e => setShootDate(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input type="time" value={shootStartTime} onChange={e => setShootStartTime(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input type="time" value={shootEndTime} onChange={e => setShootEndTime(e.target.value)} required />
                  </div>
                </div>
              </div>
            )}

            {team === 'edit' && (
              <div className="space-y-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label>Edit Duration</Label>
                  <Input placeholder="e.g. 60 seconds" value={editDuration} onChange={e => setEditDuration(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Type of Edit</Label>
                  <Input placeholder="e.g. Custom VFX, Documentary..." value={editType} onChange={e => setEditType(e.target.value)} required />
                </div>
              </div>
            )}

            {team === 'marketing' && (
              <div className="space-y-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label>Marketing Comments / Instructions</Label>
                  <Textarea placeholder="Enter instructions for the marketing team" value={marketingComments} onChange={e => setMarketingComments(e.target.value)} required />
                </div>
              </div>
            )}

            {team && (
              <div className="space-y-2 pt-2 border-t">
                <Label>Assign Member</Label>
                <Select value={assignedMember} onValueChange={setAssignedMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.email} value={m.name}>{m.name}</SelectItem>
                    ))}
                    {members.length === 0 && <SelectItem value="Unassigned">Leave Unassigned</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={loading || !team}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Route Service
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
