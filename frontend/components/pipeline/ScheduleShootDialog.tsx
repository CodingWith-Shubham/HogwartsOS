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
import { Camera } from 'lucide-react';
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
}

/** Pre-fill applied to every shoot form when the dialog opens. */
export interface ScheduleDialogPrefill {
  /** Number of shoot forms to render (defaults to 1). */
  shootCount?: number;
  camera?: string;
  recordTime?: string;
  studioTime?: string;
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
    const list = users.filter((u) => u.role === 'shoot');
    return list.length > 0 ? list.map(u => ({ name: u.name, email: u.email })) : FALLBACK_SHOOT_MEMBERS;
  }, [users]);

  const [scheduleForms, setScheduleForms] = useState([DEFAULT_SCHEDULE_FORM]);
  const [schedulingShoot, setSchedulingShoot] = useState(false);
  const [conflictError, setConflictError] = useState('');

  useEffect(() => {
    if (!open || !lead) return;
    let quantity = Math.max(1, prefill?.shootCount ?? 1);
    if (!Number.isFinite(quantity)) quantity = 1;
    setScheduleForms(
      Array.from({ length: quantity }).map(() => ({
        ...DEFAULT_SCHEDULE_FORM,
        camera: prefill?.camera || '1',
        recordTime: prefill?.recordTime || '',
        studioTime: prefill?.studioTime || '',
        deliverableSetIndex: 0,
        shootMemberName: shootMembers[0]?.name || FALLBACK_SHOOT_MEMBERS[0].name,
        shootMemberEmail: shootMembers[0]?.email || FALLBACK_SHOOT_MEMBERS[0].email,
      }))
    );
    setConflictError('');
    // Build fresh forms each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleScheduleMemberChange = (name: string, index: number) => {
    const member = shootMembers.find((item) => item.name === name) ?? shootMembers[0] ?? FALLBACK_SHOOT_MEMBERS[0];
    setScheduleForms((prev) => {
      const newForms = [...prev];
      newForms[index] = {
        ...newForms[index],
        shootMemberName: member.name,
        shootMemberEmail: member.email,
      };
      return newForms;
    });
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
    if (!lead) return;

    if (scheduleForms.some((f) => !f.setName)) {
      setConflictError('Please select a set / location for all scheduled shoots.');
      return;
    }

    for (let i = 0; i < scheduleForms.length; i++) {
      const formA = scheduleForms[i];
      if (!formA.shootDate || !formA.shootStartTime || !formA.shootEndTime) continue;

      for (let j = i + 1; j < scheduleForms.length; j++) {
        const formB = scheduleForms[j];
        if (formA.shootDate === formB.shootDate) {
          const overlap = checkTimeOverlap(formA.shootStartTime, formA.shootEndTime, formB.shootStartTime, formB.shootEndTime);
          if (overlap) {
            if (formA.setName === formB.setName || formA.setName === 'Entire Studio' || formB.setName === 'Entire Studio') {
              setConflictError(`Scheduling conflict between Shoot ${i + 1} and Shoot ${j + 1}: Both are booked for the same set at overlapping times.`);
              return;
            }
            if (formA.shootMemberName === formB.shootMemberName) {
              setConflictError(`Scheduling conflict between Shoot ${i + 1} and Shoot ${j + 1}: ${formA.shootMemberName} is double-booked.`);
              return;
            }
          }
        }
      }

      const conflict = existingShoots.find((existingShoot) => {
        if (existingShoot.shootDate !== formA.shootDate) return false;
        const overlap = checkTimeOverlap(formA.shootStartTime, formA.shootEndTime, existingShoot.shootStartTime, existingShoot.shootEndTime);
        if (!overlap) return false;
        const setMatches = formA.setName === existingShoot.setName || formA.setName === 'Entire Studio' || existingShoot.setName === 'Entire Studio';
        const memberMatches = formA.shootMemberName === existingShoot.shootMemberName;
        return setMatches || memberMatches;
      });

      if (conflict) {
        if (conflict.shootMemberName === formA.shootMemberName) {
          setConflictError(`Conflict for Shoot ${i + 1}: ${formA.shootMemberName} is already assigned to a shoot for ${conflict.clientName} from ${conflict.shootStartTime} to ${conflict.shootEndTime}.`);
          return;
        } else {
          setConflictError(`Conflict for Shoot ${i + 1}: The set "${conflict.setName || 'Entire Studio'}" is already booked for ${conflict.clientName} from ${conflict.shootStartTime} to ${conflict.shootEndTime}.`);
          return;
        }
      }
    }

    setSchedulingShoot(true);
    setConflictError('');


    try {
      const assignedTo = getAssignedSalespersonName(lead.assignedTo, users);

      for (let i = 0; i < scheduleForms.length; i++) {
        const form = scheduleForms[i];
        const payload = {
          lead_id: lead.leadId,
          client_name: lead.name,
          contact_num: lead.phoneNumber,
          email_id: lead.clientEmail,
          shoot_date: form.shootDate,
          shoot_start_time: form.shootStartTime,
          shoot_end_time: form.shootEndTime,
          total_hours: form.totalHours,
          camera: form.camera,
          teleprompter: form.teleprompter,
          bts: form.bts,
          record_time: form.recordTime,
          set_name: form.setName,
          studio_time: form.studioTime,
          assigned_to: assignedTo,
          shoot_member_name: form.shootMemberName,
          shoot_member_email: form.shootMemberEmail,
          deliverable_set_index: form.deliverableSetIndex,
          ...(extraPayload ?? {}),
        };

        const response = await fetch(SCHEDULE_SHOOT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.status === 409) {
          const conflict = await response.json();
          let errorMessage = `A scheduling conflict occurred for Shoot ${i + 1}.`;

          if (conflict.conflict_type === 'member') {
            errorMessage = `${conflict.conflicting_member || form.shootMemberName} is already assigned to a shoot for ${conflict.conflicting_client} from ${conflict.conflicting_start} to ${conflict.conflicting_end}. Please assign a different member or change the time for Shoot ${i + 1}.`;
          } else {
            errorMessage = `"${conflict.conflicting_set || payload.set_name}" is already booked for ${conflict.conflicting_client} from ${conflict.conflicting_start} to ${conflict.conflicting_end}. Please choose a different set or time for Shoot ${i + 1}.`;
          }

          setConflictError(errorMessage);
          return; // Stop processing further forms if one conflicts
        }

        if (!response.ok) throw new Error(`Failed to schedule shoot ${i + 1}`);
      }

      onOpenChange(false);
      toast.success('Shoots scheduled successfully!');
      await onSuccess?.();
    } catch (error) {
      toast.error('Failed to schedule shoots', {
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
          <form onSubmit={handleScheduleShoot} className="space-y-5">
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

            {scheduleForms.map((form, index) => (
              <div key={index} className="space-y-4 rounded-md border border-border p-4">
                <h4 className="font-semibold text-sm border-b pb-2">Shoot {index + 1}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`shootDate-${index}`}>Shoot Date</Label>
                    <Input
                      id={`shootDate-${index}`}
                      type="date"
                      required
                      className="schedule-shoot-date-input"
                      value={form.shootDate}
                      onChange={(e) =>
                        setScheduleForms((prev) => {
                          const newForms = [...prev];
                          newForms[index] = { ...newForms[index], shootDate: e.target.value };
                          return newForms;
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`camera-${index}`}>Camera Count</Label>
                    <Input
                      id={`camera-${index}`}
                      type="number"
                      min="1"
                      required
                      value={form.camera}
                      onChange={(e) =>
                        setScheduleForms((prev) => {
                          const newForms = [...prev];
                          newForms[index] = { ...newForms[index], camera: e.target.value };
                          return newForms;
                        })
                      }
                    />
                  </div>

                  {lead?.deliverableSets && lead.deliverableSets.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor={`deliverableSetIndex-${index}`}>Shoot For Podcast</Label>
                      <Select
                        value={String(form.deliverableSetIndex)}
                        onValueChange={(val) => setScheduleForms(prev => {
                          const newForms = [...prev];
                          newForms[index] = { ...newForms[index], deliverableSetIndex: Number(val) };
                          return newForms;
                        })}
                      >
                        <SelectTrigger id={`deliverableSetIndex-${index}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {lead.deliverableSets.map((_, i) => (
                            <SelectItem key={i} value={String(i)}>Podcast {i + 1}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor={`shootStartTime-${index}`}>Shoot Start Time</Label>
                    <TimeOfDaySelect
                      id={`shootStartTime-${index}`}
                      value={form.shootStartTime}
                      onChange={(value) => {
                        setScheduleForms((prev) => {
                          const newForms = [...prev];
                          newForms[index] = {
                            ...newForms[index],
                            shootStartTime: value,
                            shootEndTime: calculateEndTime(value, newForms[index].totalHours),
                          };
                          return newForms;
                        });
                        setConflictError('');
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`totalHours-${index}`}>Total Hours</Label>
                    <Input
                      id={`totalHours-${index}`}
                      type="number"
                      min="0.25"
                      step="0.25"
                      required
                      disabled={!form.shootStartTime}
                      value={form.totalHours}
                      onChange={(event) => {
                        const value = event.target.value;
                        setScheduleForms((prev) => {
                          const newForms = [...prev];
                          newForms[index] = {
                            ...newForms[index],
                            totalHours: value,
                            shootEndTime: calculateEndTime(newForms[index].shootStartTime, value),
                          };
                          return newForms;
                        });
                        setConflictError('');
                      }}
                      placeholder={form.shootStartTime ? 'e.g. 1.5' : 'Select a start time first'}
                    />
                    <p className="text-xs text-muted-foreground">End time is calculated automatically.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`shootEndTime-${index}`}>Shoot End Time</Label>
                    <TimeOfDaySelect
                      id={`shootEndTime-${index}`}
                      value={form.shootEndTime}
                      onChange={() => undefined}
                      disabled
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`teleprompter-${index}`}>Teleprompter</Label>
                    <Select
                      value={form.teleprompter}
                      onValueChange={(value) =>
                        setScheduleForms((prev) => {
                          const newForms = [...prev];
                          newForms[index] = { ...newForms[index], teleprompter: value };
                          return newForms;
                        })
                      }
                    >
                      <SelectTrigger id={`teleprompter-${index}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`bts-${index}`}>BTS Required</Label>
                    <Select
                      value={form.bts}
                      onValueChange={(value) =>
                        setScheduleForms((prev) => {
                          const newForms = [...prev];
                          newForms[index] = { ...newForms[index], bts: value };
                          return newForms;
                        })
                      }
                    >
                      <SelectTrigger id={`bts-${index}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`recordTime-${index}`}>Record Time</Label>
                    <Input
                      id={`recordTime-${index}`}
                      value={form.recordTime}
                      onChange={(e) =>
                        setScheduleForms((prev) => {
                          const newForms = [...prev];
                          newForms[index] = { ...newForms[index], recordTime: e.target.value };
                          return newForms;
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`setName-${index}`}>Set / Location</Label>
                    <Select
                      value={form.setName}
                      onValueChange={(value) => {
                        setScheduleForms((prev) => {
                          const newForms = [...prev];
                          newForms[index] = { ...newForms[index], setName: value };
                          return newForms;
                        });
                        setConflictError('');
                      }}
                    >
                      <SelectTrigger id={`setName-${index}`}><SelectValue placeholder="Select a set / location" /></SelectTrigger>
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
                    <Label htmlFor={`studioTime-${index}`}>Studio Time</Label>
                    <Input
                      id={`studioTime-${index}`}
                      value={form.studioTime}
                      onChange={(e) =>
                        setScheduleForms((prev) => {
                          const newForms = [...prev];
                          newForms[index] = { ...newForms[index], studioTime: e.target.value };
                          return newForms;
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`shootMember-${index}`}>Shoot Member</Label>
                    <Select
                      value={form.shootMemberName}
                      onValueChange={(val) => handleScheduleMemberChange(val, index)}
                    >
                      <SelectTrigger id={`shootMember-${index}`}><SelectValue /></SelectTrigger>
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
                    <Label htmlFor={`shootMemberEmail-${index}`}>Shoot Member Email</Label>
                    <Input
                      id={`shootMemberEmail-${index}`}
                      type="email"
                      required
                      value={form.shootMemberEmail}
                      onChange={(e) =>
                        setScheduleForms((prev) => {
                          const newForms = [...prev];
                          newForms[index] = { ...newForms[index], shootMemberEmail: e.target.value };
                          return newForms;
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}


            {conflictError && (
              <div className="rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {conflictError}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={schedulingShoot || scheduleForms.some(f => !f.totalHours)}>
                <Camera className="mr-1.5 h-4 w-4" />
                Send to Shoot Team
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

