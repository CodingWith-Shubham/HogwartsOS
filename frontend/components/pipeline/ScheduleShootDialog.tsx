'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Camera, CalendarPlus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import type { Shoot } from '@/lib/sheets/types';
import {
  SCHEDULE_SHOOT_WEBHOOK_URL,
  FALLBACK_SHOOT_MEMBERS,
  TimeOfDaySelect,
  calculateEndTime,
  getAssignedSalespersonName,
} from './stageDialogShared';

/** Minimal lead shape the schedule modal needs. */
export interface ScheduleDialogLead {
  leadId: string;
  name: string;
  phoneNumber: string;
  clientEmail: string;
  assignedTo: string;
  deliverableSets?: any[];
  servicePitched?: string;
  /** When scheduling a shoot for an upsell/cross-sell entry, its _id is passed here
   *  so the dialog filters only shoots tagged to that entry (not the original client's shoots). */
  upsellCrossSellId?: string;
}

/** Pre-fill applied to every shoot form when the dialog opens. */
export interface ScheduleDialogPrefill {
  camera?: string;
  recordTime?: string;
  studioTime?: string;
  shootCount?: number;
  deliverableSetIndex?: number;
}

export interface ScheduleShootDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: ScheduleDialogLead | null;
  prefill?: ScheduleDialogPrefill;
  /** Existing shoots, used for set/member conflict detection (same check as the Sales dashboard). */
  existingShoots: Shoot[];
  /** Extra fields appended to each shoot webhook payload (e.g. `{ upsell_crosssell_id }`). */
  extraPayload?: Record<string, string>;
  /** Called after all shoots were scheduled — e.g. advance pipeline status. */
  onSuccess?: () => void | Promise<void>;
}

const DEFAULT_SCHEDULE_FORM = {
  shootDate: '',
  shootStartTime: '',
  shootEndTime: '',
  totalHours: '',
  camera: '1',
  teleprompter: 'No',
  bts: 'No',
  recordTime: '',
  setName: '',
  studioTime: '',
  shootMemberName: FALLBACK_SHOOT_MEMBERS[0].name,
  shootMemberEmail: FALLBACK_SHOOT_MEMBERS[0].email,
  deliverableSetIndex: 0,
};

export function ScheduleShootDialog({
  open,
  onOpenChange,
  lead,
  prefill,
  existingShoots,
  extraPayload,
  onSuccess,
}: ScheduleShootDialogProps) {
  const { users } = useAuth();

  const shootMembers = useMemo(() => {
    const list = users.filter((u) => u.role === 'shoot' && u.isActive !== false);
    return list.length > 0 ? list.map(u => ({ name: u.name, email: u.email })) : FALLBACK_SHOOT_MEMBERS;
  }, [users]);

  // Derived unscheduled sets
  const unscheduledSets = useMemo(() => {
    const deliverableSets = lead?.deliverableSets || (lead as any)?.deliverable_sets;
    if (!deliverableSets) return [];
    
    // Filter to only shoots belonging to this lead AND this upsell entry (if applicable).
    // Without the upsellCrossSellId filter, upsell shoots would share the same leadId
    // as the original client's shoots and would falsely appear as already scheduled.
    const upsellId = lead?.upsellCrossSellId ?? '';
    const leadShoots = existingShoots.filter(s => {
      if (s.leadId !== lead?.leadId) return false;
      if (upsellId) {
        // Upsell context: only consider shoots that belong to this upsell entry
        return (s.upsellCrossSellId ?? '') === upsellId;
      }
      // Original-lead context: exclude shoots that belong to any upsell entry
      return !s.upsellCrossSellId;
    });
    const scheduledIndices = new Set(leadShoots.map(s => Number(s.deliverableSetIndex || 0)));
    
    return deliverableSets.map((set: any, idx: number) => ({ ...set, originalIndex: idx })).filter((set: any) => !scheduledIndices.has(set.originalIndex));
  }, [lead?.deliverableSets, (lead as any)?.deliverable_sets, lead?.leadId, lead?.upsellCrossSellId, existingShoots]);

  const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState(DEFAULT_SCHEDULE_FORM);
  const [schedulingShoot, setSchedulingShoot] = useState(false);
  const [conflictError, setConflictError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelectedSetIndex(null);
    setConflictError('');
  }, [open]);

  const handleSelectSet = (index: number) => {
    const deliverableSets = lead?.deliverableSets || (lead as any)?.deliverable_sets;
    const ds = deliverableSets ? deliverableSets[index] : null;
    setScheduleForm({
      ...DEFAULT_SCHEDULE_FORM,
      camera: ds?.camera || prefill?.camera || '1',
      recordTime: ds?.recordTime || prefill?.recordTime || '',
      studioTime: ds?.studioTime || prefill?.studioTime || '',
      deliverableSetIndex: index,
      shootMemberName: shootMembers[0]?.name || FALLBACK_SHOOT_MEMBERS[0].name,
      shootMemberEmail: shootMembers[0]?.email || FALLBACK_SHOOT_MEMBERS[0].email,
    });
    setSelectedSetIndex(index);
    setConflictError('');
  };

  const handleScheduleMemberChange = (name: string) => {
    const member = shootMembers.find((item) => item.name === name) ?? shootMembers[0] ?? FALLBACK_SHOOT_MEMBERS[0];
    setScheduleForm((prev) => ({
      ...prev,
      shootMemberName: member.name,
      shootMemberEmail: member.email,
    }));
  };

  const checkTimeOverlap = (startA: string, endA: string, startB: string, endB: string) => {
    if (!startA || !endA || !startB || !endB) return false;
    const toMins = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return (h * 60) + (m || 0);
    };
    const startAMins = toMins(startA);
    const endAMins = toMins(endA);
    const startBMins = toMins(startB);
    const endBMins = toMins(endB);
    return startAMins < endBMins && startBMins < endAMins;
  };

  const handleScheduleShoot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lead || selectedSetIndex === null) return;

    if (!scheduleForm.setName) {
      setConflictError('Please select a set / location.');
      return;
    }

    const conflict = existingShoots.find((existingShoot) => {
      if (existingShoot.shootDate !== scheduleForm.shootDate) return false;
      const overlap = checkTimeOverlap(scheduleForm.shootStartTime, scheduleForm.shootEndTime, existingShoot.shootStartTime, existingShoot.shootEndTime);
      if (!overlap) return false;
      const setMatches = scheduleForm.setName === existingShoot.setName || scheduleForm.setName === 'Entire Studio' || existingShoot.setName === 'Entire Studio';
      const memberMatches = scheduleForm.shootMemberName === existingShoot.shootMemberName;
      return setMatches || memberMatches;
    });

    if (conflict) {
      if (conflict.shootMemberName === scheduleForm.shootMemberName) {
        setConflictError(`Conflict: ${scheduleForm.shootMemberName} is already assigned to a shoot for ${conflict.clientName} from ${conflict.shootStartTime} to ${conflict.shootEndTime}.`);
        return;
      } else {
        setConflictError(`Conflict: The set "${conflict.setName || 'Entire Studio'}" is already booked for ${conflict.clientName} from ${conflict.shootStartTime} to ${conflict.shootEndTime}.`);
        return;
      }
    }

    setSchedulingShoot(true);
    setConflictError('');

    try {
      const assignedTo = getAssignedSalespersonName(lead.assignedTo, users);
      
      const payload = {
        lead_id: lead.leadId,
        client_name: lead.name,
        contact_num: lead.phoneNumber,
        email_id: lead.clientEmail,
        shoot_date: scheduleForm.shootDate,
        shoot_start_time: scheduleForm.shootStartTime,
        shoot_end_time: scheduleForm.shootEndTime,
        total_hours: scheduleForm.totalHours,
        camera: scheduleForm.camera,
        teleprompter: scheduleForm.teleprompter,
        bts: scheduleForm.bts,
        record_time: scheduleForm.recordTime,
        set_name: scheduleForm.setName,
        studio_time: scheduleForm.studioTime,
        assigned_to: assignedTo,
        shoot_member_name: scheduleForm.shootMemberName,
        shoot_member_email: scheduleForm.shootMemberEmail,
        deliverable_set_index: extraPayload?.upsell_crosssell_id 
          ? ((existingShoots.length + 1) * 100 + (scheduleForm.deliverableSetIndex || 0))
          : scheduleForm.deliverableSetIndex,
        ...(extraPayload ?? {}),
      };

      const response = await fetch(SCHEDULE_SHOOT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        const resConflict = await response.json();
        let errorMessage = `A scheduling conflict occurred.`;
        if (resConflict.conflict_type === 'duplicate') {
           errorMessage = `This shoot instance has already been scheduled.`;
        } else if (resConflict.conflict_type === 'member') {
          errorMessage = `${resConflict.conflicting_member || scheduleForm.shootMemberName} is already assigned to a shoot for ${resConflict.conflicting_client} from ${resConflict.conflicting_start} to ${resConflict.conflicting_end}. Please assign a different member or change the time.`;
        } else {
          errorMessage = `"${resConflict.conflicting_set || payload.set_name}" is already booked for ${resConflict.conflicting_client} from ${resConflict.conflicting_start} to ${resConflict.conflicting_end}. Please choose a different set or time.`;
        }
        setConflictError(errorMessage);
        return;
      }

      if (!response.ok) throw new Error(`Failed to schedule shoot`);

      toast.success('Shoot scheduled successfully!');
      setSelectedSetIndex(null);
      await onSuccess?.();
    } catch (error) {
      toast.error('Failed to schedule shoot', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSchedulingShoot(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Shoot</DialogTitle>
          <DialogDescription>Send shoot details to the production team.</DialogDescription>
        </DialogHeader>
        {lead && (
          <div className="space-y-5">
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium mb-3">Client Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Client Name</p>
                  <p className="font-medium">{lead.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contact Number</p>
                  <p>{lead.phoneNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email ID</p>
                  <p className="truncate">{lead.clientEmail || '-'}</p>
                </div>
              </div>
            </div>

            {selectedSetIndex === null ? (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm border-b pb-2">Unscheduled Services</h4>
                {unscheduledSets.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground bg-muted/30 rounded-md">
                    All services for this lead have been scheduled.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {unscheduledSets.map((set: any) => (
                      <div key={set.originalIndex} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-md bg-card shadow-sm gap-4">
                        <div className="space-y-1">
                          <p className="font-medium text-sm text-primary">
                            🎬 {set.serviceName || 'Service'}
                          </p>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                            {set.recordTime && <span>Record: {set.recordTime}</span>}
                            {set.studioTime && <span>Studio: {set.studioTime}</span>}
                            {set.podcastEdit && set.podcastEdit !== '0' && <span>Podcast: {set.podcastEdit}</span>}
                            {set.reelEdit && set.reelEdit !== '0' && <span>Reels: {set.reelEdit}</span>}
                            {set.longFormatVideo && set.longFormatVideo !== '0' && <span>Long Form: {set.longFormatVideo}</span>}
                          </div>
                        </div>
                        <Button size="sm" onClick={() => handleSelectSet(set.originalIndex)}>
                          <CalendarPlus className="mr-1.5 h-4 w-4" />
                          Schedule This Shoot
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleScheduleShoot} className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 mb-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedSetIndex(null)} className="-ml-3 text-muted-foreground">
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back to Services
                  </Button>
                </div>
                
                <div className="space-y-4 rounded-md border border-border p-4">
                  <h4 className="font-semibold text-sm border-b pb-2 text-primary">
                    Scheduling: {(lead?.deliverableSets || (lead as any)?.deliverable_sets)?.[selectedSetIndex]?.serviceName || 'Service'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shootDate">Shoot Date</Label>
                      <Input
                        id="shootDate"
                        type="date"
                        required
                        className="schedule-shoot-date-input"
                        value={scheduleForm.shootDate}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, shootDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="camera">Camera Count</Label>
                      <Input
                        id="camera"
                        type="number"
                        min="1"
                        required
                        value={scheduleForm.camera}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, camera: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shootStartTime">Shoot Start Time</Label>
                      <TimeOfDaySelect
                        id="shootStartTime"
                        value={scheduleForm.shootStartTime}
                        onChange={(value) => {
                          setScheduleForm(prev => ({
                            ...prev,
                            shootStartTime: value,
                            shootEndTime: calculateEndTime(value, prev.totalHours),
                          }));
                          setConflictError('');
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totalHours">Total Hours</Label>
                      <Input
                        id="totalHours"
                        type="number"
                        min="0.25"
                        step="0.25"
                        required
                        disabled={!scheduleForm.shootStartTime}
                        value={scheduleForm.totalHours}
                        onChange={(event) => {
                          const value = event.target.value;
                          setScheduleForm(prev => ({
                            ...prev,
                            totalHours: value,
                            shootEndTime: calculateEndTime(prev.shootStartTime, value),
                          }));
                          setConflictError('');
                        }}
                        placeholder={scheduleForm.shootStartTime ? 'e.g. 1.5' : 'Select a start time first'}
                      />
                      <p className="text-xs text-muted-foreground">End time is calculated automatically.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shootEndTime">Shoot End Time</Label>
                      <TimeOfDaySelect
                        id="shootEndTime"
                        value={scheduleForm.shootEndTime}
                        onChange={() => undefined}
                        disabled
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="teleprompter">Teleprompter</Label>
                      <Select
                        value={scheduleForm.teleprompter}
                        onValueChange={(value) => setScheduleForm(prev => ({ ...prev, teleprompter: value }))}
                      >
                        <SelectTrigger id="teleprompter"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="No">No</SelectItem>
                          <SelectItem value="Yes">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bts">BTS Required</Label>
                      <Select
                        value={scheduleForm.bts}
                        onValueChange={(value) => setScheduleForm(prev => ({ ...prev, bts: value }))}
                      >
                        <SelectTrigger id="bts"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="No">No</SelectItem>
                          <SelectItem value="Yes">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recordTime">Record Time</Label>
                      <Input
                        id="recordTime"
                        value={scheduleForm.recordTime}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, recordTime: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="setName">Set / Location</Label>
                      <Select
                        value={scheduleForm.setName}
                        onValueChange={(value) => {
                          setScheduleForm(prev => ({ ...prev, setName: value }));
                          setConflictError('');
                        }}
                      >
                        <SelectTrigger id="setName"><SelectValue placeholder="Select a set / location" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Black Money">Black Money</SelectItem>
                          <SelectItem value="Dark Realm">Dark Realm</SelectItem>
                          <SelectItem value="Dark Multiverse">Dark Multiverse</SelectItem>
                          <SelectItem value="Green Amazon">Green Amazon</SelectItem>
                          <SelectItem value="Moroccan">Moroccan</SelectItem>
                          <SelectItem value="Cyclorama Chroma Screen">Cyclorama Chroma Screen</SelectItem>
                          <SelectItem value="Entire Studio">Entire Studio</SelectItem>
                          <SelectItem value="Product Shoot">Product Shoot</SelectItem>
                          <SelectItem value="Outdoor Shoot">Outdoor Shoot</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="studioTime">Studio Time</Label>
                      <Input
                        id="studioTime"
                        value={scheduleForm.studioTime}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, studioTime: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shootMember">Shoot Member</Label>
                      <Select
                        value={scheduleForm.shootMemberName}
                        onValueChange={handleScheduleMemberChange}
                      >
                        <SelectTrigger id="shootMember"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {shootMembers.map((member) => (
                            <SelectItem key={member.name} value={member.name}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shootMemberEmail">Shoot Member Email</Label>
                      <Input
                        id="shootMemberEmail"
                        type="email"
                        required
                        value={scheduleForm.shootMemberEmail}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, shootMemberEmail: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {conflictError && (
                  <div className="rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                    {conflictError}
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setSelectedSetIndex(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={schedulingShoot || !scheduleForm.totalHours}>
                    <Camera className="mr-1.5 h-4 w-4" />
                    Send to Shoot Team
                  </Button>
                </DialogFooter>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
