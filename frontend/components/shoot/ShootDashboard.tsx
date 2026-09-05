'use client';
import { Download } from 'lucide-react';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { ShootShimmer } from '@/components/shared/ShimmerLoader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, CalendarClock, Camera, CheckCircle, Clock, ExternalLink, Upload, XCircle } from 'lucide-react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { toast } from 'sonner';
import { ScheduleShootDialog, type ScheduleDialogLead } from '@/components/pipeline/ScheduleShootDialog';
import type { Shoot } from '@/lib/sheets/types';
import type { User } from '@/lib/types';
import { cn } from '@/lib/utils';

const UPDATE_WEBHOOK_URL =
  'https://n8n.hogwartsstudios.com/webhook/update-shoot-details';
const UPLOAD_DRIVE_LINK_URL =
  'https://n8n.hogwartsstudios.com/webhook/upload-drive-link';

interface ShootDashboardProps {
  initialShoots: Shoot[];
}

interface PostShootForm {
  extraCamera: string;
  extraTeleprompter: string;
  extraDurationHours: string;
  addonHasAddons: 'yes' | 'no';
  recordTime: string;
  studioTime: string;
  testimonials: string;
  shootNotes: string;
}

type HandoverRecipient = Pick<User, 'name' | 'email'> & { key: string };

const DURATION_HOURS = Array.from({ length: 25 }, (_, index) => String(index));
const DURATION_MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, '0')
);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isTrue(value: unknown) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function isYes(value: unknown) {
  return String(value ?? '').trim().toLowerCase() === 'yes';
}

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime12Hour(time: string | undefined | null) {
  if (!time || time === '-') return '-';
  const [hours, minutes] = time.split(':');
  if (!hours || !minutes) return time;
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function buildMonthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDurationParts(hours: number, minutes: number) {
  const totalMinutes = Math.max(0, Math.round(hours * 60 + minutes));
  const nextHours = Math.floor(totalMinutes / 60);
  const nextMinutes = totalMinutes % 60;
  const maxHours = Number(DURATION_HOURS[DURATION_HOURS.length - 1]);

  return {
    hours: String(Math.min(nextHours, maxHours)),
    minutes: String(nextMinutes).padStart(2, '0'),
  };
}

function parseDurationParts(value: string) {
  const trimmedValue = value.trim().toLowerCase();
  if (!trimmedValue) return { hours: '', minutes: '' };

  const clockMatch = trimmedValue.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (clockMatch) {
    return normalizeDurationParts(Number(clockMatch[1]), Number(clockMatch[2]));
  }

  const hourMatch = trimmedValue.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/);
  const minuteMatch = trimmedValue.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/);
  if (hourMatch || minuteMatch) {
    return normalizeDurationParts(
      hourMatch ? Number(hourMatch[1]) : 0,
      minuteMatch ? Number(minuteMatch[1]) : 0
    );
  }

  const decimalHours = Number(trimmedValue);
  if (Number.isFinite(decimalHours)) {
    return normalizeDurationParts(decimalHours, 0);
  }

  return { hours: '', minutes: '' };
}

function buildDurationValue(hours: string, minutes: string) {
  if (!hours || !minutes) return '';
  return `${Number(hours)}:${minutes}`;
}

function DurationSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const parts = parseDurationParts(value);

  const handlePartChange = (part: 'hours' | 'minutes', nextValue: string) => {
    const nextParts = {
      hours: part === 'hours' ? nextValue : parts.hours || '0',
      minutes: part === 'minutes' ? nextValue : parts.minutes || '00',
    };

    onChange(buildDurationValue(nextParts.hours, nextParts.minutes));
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Select value={parts.hours} onValueChange={(nextValue) => handlePartChange('hours', nextValue)}>
        <SelectTrigger id={`${id}-hours`} aria-label="Hours">
          <SelectValue placeholder="Hours" />
        </SelectTrigger>
        <SelectContent>
          {DURATION_HOURS.map((hour) => (
            <SelectItem key={hour} value={hour}>
              {hour} hr
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={parts.minutes}
        onValueChange={(nextValue) => handlePartChange('minutes', nextValue)}
      >
        <SelectTrigger id={`${id}-minutes`} aria-label="Minutes">
          <SelectValue placeholder="Minutes" />
        </SelectTrigger>
        <SelectContent>
          {DURATION_MINUTES.map((minute) => (
            <SelectItem key={minute} value={minute}>
              {minute} min
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function UploadStatusBadge({ shoot }: { shoot: Shoot }) {
  if (isTrue(shoot.driveLinkUploaded)) {
    return <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Uploaded</Badge>;
  }

  return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Pending Upload</Badge>;
}

function YesNoBadge({ label, value }: { label: string; value: string }) {
  const yes = isYes(value);
  return (
    <Badge
      variant="outline"
      className={cn(
        yes
          ? 'bg-green-500/10 text-green-600 border-green-500/30'
          : 'bg-secondary text-muted-foreground'
      )}
    >
      {label}: {yes ? 'Yes' : 'No'}
    </Badge>
  );
}

function ShootCalendar({
  shoots,
  onSelect,
}: {
  shoots: Shoot[];
  onSelect: (shoot: Shoot) => void;
}) {
  const [month, setMonth] = useState(() => new Date());
  const days = useMemo(() => buildMonthDays(month), [month]);
  const shootsByDate = useMemo(() => {
    const grouped = new Map<string, Shoot[]>();
    shoots.forEach((shoot) => {
      const key = shoot.shootDate;
      grouped.set(key, [...(grouped.get(key) ?? []), shoot]);
    });
    return grouped;
  }, [shoots]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">{monthLabel(month)}</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            Next
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 border border-border rounded-md overflow-hidden">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="bg-secondary px-2 py-2 text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
          {days.map((day) => {
            const key = dateKey(day);
            const items = shootsByDate.get(key) ?? [];
            const muted = day.getMonth() !== month.getMonth();
            return (
              <div key={key} className="min-h-[110px] border-t border-border p-2">
                <div className={cn('text-xs font-medium mb-1', muted && 'text-muted-foreground')}>
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {items.map((shoot) => (
                    <button
                      type="button"
                      key={shoot.id}
                      onClick={() => onSelect(shoot)}
                      className={cn(
                        "w-full rounded border px-2 py-1 text-left text-[11px]",
                        shoot.bookingStatus === 'tentative'
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-600 hover:bg-amber-500/20"
                          : "bg-blue-500/15 border-blue-500/30 text-blue-600 hover:bg-blue-500/20"
                      )}
                    >
                      <span className="block truncate font-medium">{shoot.clientName}</span>
                      <span className="block truncate">{formatTime12Hour(shoot.shootStartTime)} - {formatTime12Hour(shoot.shootEndTime)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ShootCard({
  shoot,
  onEdit,
  onUpload,
  onConfirmHandover,
  uploadValue,
  onUploadValueChange,
  uploading,
  handoverRecipients,
  selectedHandover,
  onHandoverRecipientChange,
  handingOver,
  confirmedHandover,
  onCancelShoot,
  cancellingId,
}: {
  shoot: Shoot;
  onEdit: (shoot: Shoot) => void;
  onUpload: (shoot: Shoot) => void;
  onConfirmHandover: (shoot: Shoot) => void;
  uploadValue: string;
  onUploadValueChange: (shootId: string, value: string) => void;
  uploading: boolean;
  handoverRecipients: HandoverRecipient[];
  selectedHandover?: HandoverRecipient;
  onHandoverRecipientChange: (shootId: string, recipientKey: string) => void;
  handingOver: boolean;
  confirmedHandover?: HandoverRecipient;
  onCancelShoot?: (shoot: Shoot) => void;
  cancellingId?: string | null;
}) {
  const { user } = useAuth();
  const hideContactInfo = user?.role === 'shoot' || user?.role === 'editor';
  const uploaded = isTrue(shoot.driveLinkUploaded);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{shoot.clientName || 'Untitled shoot'}</p>
              {isTrue(shoot.editedByShootTeam) && (
                <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30">Edited</Badge>
              )}
              {shoot.bookingStatus === 'tentative' && (
                <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Tentative Hold</Badge>
              )}
              {shoot.bookingStatus === 'confirmed' && (
                <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Confirmed</Badge>
              )}
              {shoot.bookingStatus === 'conflict' && (
                <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Conflict: Slot Taken</Badge>
              )}
              {shoot.bookingStatus === 'cancelled' && (
                <Badge className="bg-secondary text-muted-foreground line-through">Cancelled</Badge>
              )}
            </div>
            {!hideContactInfo && (
              <p className="text-sm text-muted-foreground">{shoot.contactNum || '-'}</p>
            )}
          </div>
          <UploadStatusBadge shoot={shoot} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Shoot Date</p>
            <p>{formatDate(shoot.shootDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Shoot Time</p>
            <p>
              {formatTime12Hour(shoot.shootStartTime)} - {formatTime12Hour(shoot.shootEndTime)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Record Time</p>
            <p>{shoot.recordTime || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Studio Time</p>
            <p>{shoot.studioTime || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Room</p>
            <p>{shoot.setName || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Camera</p>
            <p>{shoot.camera || '1'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Shoot Member</p>
            <p>{shoot.shootMemberName || '-'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <YesNoBadge label="Teleprompter" value={shoot.teleprompter} />
          <YesNoBadge label="BTS" value={shoot.bts} />
        </div>

        {!uploaded ? (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => onEdit(shoot)}>
                Edit Post-Shoot Details
              </Button>
              {shoot.bookingStatus === 'tentative' && onCancelShoot && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancelShoot(shoot)}
                  disabled={cancellingId === shoot.shootId}
                  className="border-red-500/40 text-red-500 hover:bg-red-500/10"
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Cancel Tentative Hold
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={uploadValue}
                onChange={(event) => onUploadValueChange(shoot.shootId, event.target.value)}
                placeholder="Paste Google Drive footage link"
              />
              <Button
                onClick={() => onUpload(shoot)}
                disabled={uploading || !uploadValue.trim()}
                className="sm:w-auto"
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Upload Drive Link
              </Button>
            </div>
            <div className="space-y-2 rounded-md border border-dashed border-border px-3 py-2.5">
              <p className="text-sm font-medium">Hard Disk Handover</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor={`handover-to-${shoot.id}`} className="text-xs text-muted-foreground">
                    Hand over hard disk to
                  </Label>
                  <Select
                    value={selectedHandover?.key ?? ''}
                    onValueChange={(recipientKey) => onHandoverRecipientChange(shoot.shootId, recipientKey)}
                    disabled={Boolean(confirmedHandover)}
                  >
                    <SelectTrigger id={`handover-to-${shoot.id}`} className="h-9 text-sm">
                      <SelectValue placeholder="Select the handover recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client — {shoot.clientName || 'Unnamed client'}</SelectItem>
                      {handoverRecipients.map((recipient) => (
                        <SelectItem key={recipient.key} value={recipient.key}>
                          {recipient.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConfirmHandover(shoot)}
                  disabled={handingOver || !selectedHandover || Boolean(confirmedHandover)}
                >
                  Confirm Handover
                </Button>
              </div>
              {confirmedHandover && (
                <p className="text-xs text-green-600">✅ Hard disk handed to {confirmedHandover.name}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="border-t border-border pt-3">
            <Button variant="outline" size="sm" asChild disabled={!shoot.dataLink}>
              <a href={shoot.dataLink} target="_blank" rel="noreferrer">
                View Footage <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ShootDashboard({ initialShoots }: ShootDashboardProps) {
  const { user } = useAuth();
  const hideContactInfo = user?.role === 'shoot' || user?.role === 'editor';
  const [shoots, setShoots] = useState<Shoot[]>(initialShoots);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Shoot | null>(null);
  const [editShoot, setEditShoot] = useState<Shoot | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [driveLinks, setDriveLinks] = useState<Record<string, string>>({});
  const [handoverRecipients, setHandoverRecipients] = useState<HandoverRecipient[]>([]);
  const [selectedHandovers, setSelectedHandovers] = useState<Record<string, HandoverRecipient>>({});
  const [confirmedHandovers, setConfirmedHandovers] = useState<Record<string, HandoverRecipient>>({});
  const [handingOverId, setHandingOverId] = useState<string | null>(null);
  const [cancellingShootId, setCancellingShootId] = useState<string | null>(null);
  const [showAllShoots, setShowAllShoots] = useState(false);
  const [rescheduleShoot, setRescheduleShoot] = useState<Shoot | null>(null);
  const [activeTab, setActiveTab] = useState('today');
  const tabsRef = useRef<HTMLDivElement>(null);
  const [postShootForm, setPostShootForm] = useState<PostShootForm>({
    extraCamera: '0',
    extraTeleprompter: '0',
    extraDurationHours: '0',
    addonHasAddons: 'no',
    recordTime: '',
    studioTime: '',
    testimonials: '',
    shootNotes: '',
  });

  const [todayPage, setTodayPage] = useState(1);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);

  const refreshShoots = useCallback(async (silent = false, forceFresh = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await authFetch(`/api/shoots${forceFresh ? '?fresh=1' : ''}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to refresh shoots');
      // Editing-only placeholder records bypass the shoot team entirely and are
      // surfaced only on the manager dashboard's "Assign Editor" queue.
      setShoots((data.shoots ?? []).filter((shoot: Shoot) => !isTrue(shoot.isEditingOnly)));
    } catch (error) {
      if (!silent) {
        toast.error('Failed to refresh shoots', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshShoots(true, true).finally(() => setLoading(false));
  }, [refreshShoots]);

  useEffect(() => {
    const interval = setInterval(() => refreshShoots(true), 30000);
    return () => clearInterval(interval);
  }, [refreshShoots]);

  useEffect(() => {
    const fetchHandoverRecipients = async () => {
      try {
        const response = await fetch('/api/users', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Failed to load users');

        setHandoverRecipients(
          (data.users ?? [])
            .filter((user: User) => user.role === 'sales' || user.role === 'editor')
            .map((user: User) => ({ ...user, key: user.email }))
        );
      } catch (error) {
        toast.error('Failed to load handover recipients', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    fetchHandoverRecipients();
  }, []);

  const activeShoots = useMemo(() => {
    if (showAllShoots) return shoots;
    return shoots.filter((s) => !['cancelled', 'conflict'].includes(s.bookingStatus ?? ''));
  }, [shoots, showAllShoots]);

  // Reschedule: build the minimal lead shape the ScheduleShootDialog needs from
  // the shoot being rescheduled (client details live on the shoot record).
  const rescheduleLead = useMemo<ScheduleDialogLead | null>(() => {
    if (!rescheduleShoot) return null;
    return {
      leadId: rescheduleShoot.leadId,
      name: rescheduleShoot.clientName || '',
      phoneNumber: rescheduleShoot.contactNum || '',
      clientEmail: rescheduleShoot.emailId || (rescheduleShoot as any).clientEmailId || '',
      assignedTo: rescheduleShoot.assignedTo || '',
      deliverableSets: [],
      upsellCrossSellId: rescheduleShoot.upsellCrossSellId,
    };
  }, [rescheduleShoot]);

  const today = todayKey();
  const todaysShoots = activeShoots
    .filter((shoot) => shoot.shootDate === today)
    .sort((a, b) => (a.shootStartTime || '').localeCompare(b.shootStartTime || ''));
    
  const upcoming = activeShoots
    .filter((shoot) => shoot.shootDate > today && !isTrue(shoot.driveLinkUploaded))
    .sort((a, b) => {
      const cmp = (a.shootDate || '').localeCompare(b.shootDate || '');
      return cmp !== 0 ? cmp : (a.shootStartTime || '').localeCompare(b.shootStartTime || '');
    });
    
  const completed = activeShoots
    .filter((shoot) => isTrue(shoot.driveLinkUploaded))
    .sort((a, b) => {
      const cmp = (b.shootDate || '').localeCompare(a.shootDate || '');
      return cmp !== 0 ? cmp : (b.shootStartTime || '').localeCompare(a.shootStartTime || '');
    });
  const pendingUploads = activeShoots.filter((shoot) => !isTrue(shoot.driveLinkUploaded)).length;

  const cancelShoot = async (shoot: Shoot) => {
    if (!confirm(`Cancel ${shoot.bookingStatus === 'tentative' ? 'tentative hold' : 'shoot'} for ${shoot.clientName}? This cannot be undone.`)) return;
    setCancellingShootId(shoot.shootId);
    try {
      const res = await authFetch(`/api/shoots/${shoot.shootId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to cancel shoot');
      }
      toast.success(
        shoot.bookingStatus === 'tentative'
          ? 'Tentative hold cancelled.'
          : 'Shoot cancelled.'
      );
      await refreshShoots(true);
    } catch (error) {
      toast.error('Failed to cancel shoot', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setCancellingShootId(null);
    }
  };

  const openEdit = (shoot: Shoot) => {
    setEditShoot(shoot);
    setPostShootForm({
      extraCamera: shoot.extraCamera || '0',
      extraTeleprompter: shoot.extraTeleprompter || '0',
      extraDurationHours: shoot.extraDurationHours || '0',
      addonHasAddons: 'no',
      recordTime: shoot.recordTime || '',
      studioTime: shoot.studioTime || '',
      testimonials: shoot.testimonials || '',
      shootNotes: shoot.shootNotes || '',
    });
  };

  const savePostShootDetails = async () => {
    if (!editShoot) return;
    setSaving(true);
    try {
      const response = await fetch(UPDATE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shoot_id: editShoot.shootId,
          extra_camera: postShootForm.extraCamera,
          extra_teleprompter: postShootForm.extraTeleprompter,
          extra_duration_hours: postShootForm.extraDurationHours,
          has_addons: postShootForm.addonHasAddons === 'yes',
          shoot_notes: postShootForm.shootNotes,
          testimonials: postShootForm.testimonials,
          record_time: postShootForm.recordTime,
          studio_time: postShootForm.studioTime,
        }),
      });

      if (!response.ok) throw new Error('Failed to save details');

      toast.success('Details updated!');
      setEditShoot(null);
      await refreshShoots(true);
    } catch (error) {
      toast.error('Failed to update details', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadDriveLink = async (shoot: Shoot) => {
    const dataLink = driveLinks[shoot.shootId]?.trim();
    if (!dataLink) return;

    setUploadingId(shoot.shootId);
    try {
      const response = await fetch(UPLOAD_DRIVE_LINK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shoot_id: shoot.shootId,
          data_link: dataLink,
        }),
      });

      if (!response.ok) throw new Error('Failed to upload drive link');

      toast.success('Footage uploaded!');
      setShoots((prev) =>
        prev.map((item) =>
          item.shootId === shoot.shootId
            ? { ...item, dataLink, driveLinkUploaded: 'true' }
            : item
        )
      );
      await refreshShoots(true);
    } catch (error) {
      toast.error('Failed to upload drive link', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setUploadingId(null);
    }
  };

  const confirmHandover = async (shoot: Shoot) => {
    const recipient = selectedHandovers[shoot.shootId];
    if (!recipient || confirmedHandovers[shoot.shootId]) return;

    setHandingOverId(shoot.shootId);
    try {
      const response = await fetch(UPLOAD_DRIVE_LINK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shoot_id: shoot.shootId,
          data_link: '',
          handover_to: recipient.name,
          handover_to_email: recipient.email,
        }),
      });

      if (!response.ok) throw new Error('Failed to confirm hard disk handover');

      setConfirmedHandovers((prev) => ({ ...prev, [shoot.shootId]: recipient }));
      toast.success(`Hard disk handed to ${recipient.name}`);
    } catch (error) {
      toast.error('Failed to confirm handover', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setHandingOverId(null);
    }
  };

  const renderPagination = (page: number, setPage: (p: number) => void, totalItems: number, pageSize: number = 10) => {
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) return null;
    return (
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={() => setPage(Math.max(1, page - 1))} className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
          </PaginationItem>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <PaginationItem key={p}>
              <PaginationLink isActive={page === p} onClick={() => setPage(p)} className="cursor-pointer">
                {p}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext onClick={() => setPage(Math.min(totalPages, page + 1))} className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  const renderList = (items: Shoot[], empty: string, page: number, setPage: (p: number) => void) => {
    if (items.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Camera className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{empty}</p>
          </CardContent>
        </Card>
      );
    }

    const pageSize = 10;
    const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {paginatedItems.map((shoot) => (
            <ShootCard
              key={shoot.id}
              shoot={shoot}
              onEdit={openEdit}
              onUpload={uploadDriveLink}
              onConfirmHandover={confirmHandover}
              onCancelShoot={cancelShoot}
              cancellingId={cancellingShootId}
              uploadValue={driveLinks[shoot.shootId] ?? ''}
              onUploadValueChange={(shootId, value) =>
                setDriveLinks((prev) => ({ ...prev, [shootId]: value }))
              }
              uploading={uploadingId === shoot.shootId}
              handoverRecipients={handoverRecipients}
              selectedHandover={selectedHandovers[shoot.shootId]}
              onHandoverRecipientChange={(shootId, recipientKey) => {
                const recipient = recipientKey === 'client'
                  ? { key: 'client', name: shoot.clientName || 'Client', email: shoot.emailId }
                  : handoverRecipients.find((user) => user.key === recipientKey);
                if (recipient) {
                  setSelectedHandovers((prev) => ({ ...prev, [shootId]: recipient }));
                }
              }}
              handingOver={handingOverId === shoot.shootId}
              confirmedHandover={confirmedHandovers[shoot.shootId]}
            />
          ))}
        </div>
        {renderPagination(page, setPage, items.length, pageSize)}
      </div>
    );
  };

  const openTab = (tab: string) => {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  if (loading) return <ShootShimmer />;

  return (
    <div>
      <PageHeader
        title="Shoot"
        description="Production scheduling and shoot management"
        actions={
          <div className="flex items-center gap-2">
            {user?.role === 'super_admin' && (
              <Button size="sm" variant="outline" onClick={() => {
                import('@/lib/export').then(({ exportToExcel }) => exportToExcel(shoots, 'shoot_data'));
              }}>
                <Download className="mr-1.5 h-4 w-4" />
                Export
              </Button>
            )}
            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">
              {pendingUploads} pending uploads
            </Badge>
            <div className="flex items-center gap-1.5 ml-2 border-l border-border pl-4">
              <Label htmlFor="show-all-shoots" className="text-xs font-medium cursor-pointer">Show All</Label>
              <input
                type="checkbox"
                id="show-all-shoots"
                className="w-3.5 h-3.5 cursor-pointer accent-blue-600 rounded-sm"
                checked={showAllShoots}
                onChange={(e) => setShowAllShoots(e.target.checked)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => refreshShoots(false, true)} disabled={refreshing}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Today's Shoots" value={todaysShoots.length} icon={Camera} onClick={() => openTab('today')} />
        <StatCard title="Upcoming" value={upcoming.length} icon={Clock} onClick={() => openTab('upcoming')} />
        <StatCard title="Completed" value={completed.length} icon={CheckCircle} onClick={() => openTab('completed')} />
        <StatCard title="Total Scheduled" value={shoots.length} icon={Calendar} onClick={() => openTab('calendar')} />
      </div>

      <div ref={tabsRef} className="scroll-mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="today" className="relative">
              Today
              {todaysShoots.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full shadow-sm shadow-blue-500/20">
                  {todaysShoots.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="upcoming" className="relative">
              Upcoming
              {upcoming.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full shadow-sm shadow-blue-500/20">
                  {upcoming.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="relative">
              Completed
              {completed.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full shadow-sm shadow-blue-500/20">
                  {completed.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4">
            {renderList(todaysShoots, 'No shoots scheduled for today.', todayPage, setTodayPage)}
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <ShootCalendar shoots={activeShoots} onSelect={setDetail} />
          </TabsContent>

          <TabsContent value="upcoming" className="mt-4">
            {renderList(upcoming, 'No upcoming pending shoots.', upcomingPage, setUpcomingPage)}
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            {renderList(completed, 'No completed shoots yet.', completedPage, setCompletedPage)}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.clientName}</DialogTitle>
                <DialogDescription>Full shoot details</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {!hideContactInfo && (
                  <>
                    <div><span className="text-muted-foreground">Contact:</span> {detail.contactNum || '-'}</div>
                    <div><span className="text-muted-foreground">Email:</span> {detail.emailId || '-'}</div>
                  </>
                )}
                <div><span className="text-muted-foreground">Date:</span> {formatDate(detail.shootDate)}</div>
                <div><span className="text-muted-foreground">Time:</span> {detail.shootStartTime} - {detail.shootEndTime}</div>
                <div><span className="text-muted-foreground">Camera:</span> {detail.camera || '1'}</div>
                <div><span className="text-muted-foreground">Hours:</span> {detail.totalHours || '-'}</div>
                <div><span className="text-muted-foreground">Member:</span> {detail.shootMemberName || '-'}</div>
                <div><span className="text-muted-foreground">Assigned:</span> {detail.assignedTo || '-'}</div>
                <div><span className="text-muted-foreground">Status:</span> <span className="capitalize">{detail.bookingStatus || 'confirmed'}</span></div>
              </div>
              {detail.bookingStatusNote && <p className="text-sm text-red-500/90 italic font-medium">{detail.bookingStatusNote}</p>}
              {detail.shootNotes && <p className="text-sm text-muted-foreground">{detail.shootNotes}</p>}
              {/* Reschedule is only offered for shoots that haven't happened yet
                  (footage not uploaded) and are still active. */}
              {!isTrue(detail.driveLinkUploaded) &&
                !['cancelled', 'conflict'].includes(detail.bookingStatus ?? '') && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRescheduleShoot(detail);
                      setDetail(null);
                    }}
                  >
                    <CalendarClock className="mr-1.5 h-4 w-4" />
                    Reschedule Shoot
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog (opened from the shoot details popup above). The
          dialog itself handles releasing the old shoot + re-firing the n8n
          schedule-shoot webhook with the new date/time. */}
      <ScheduleShootDialog
        open={Boolean(rescheduleShoot)}
        onOpenChange={(open) => {
          if (!open) setRescheduleShoot(null);
        }}
        lead={rescheduleLead}
        existingShoots={shoots}
        rescheduleShoot={rescheduleShoot}
        onSuccess={async () => {
          await refreshShoots(true, true);
        }}
      />

      <Dialog open={Boolean(editShoot)} onOpenChange={(open) => !open && setEditShoot(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Post-Shoot Details</DialogTitle>
            <DialogDescription>Save changes before footage is uploaded.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ['extraCamera', 'Extra Camera'],
              ['extraTeleprompter', 'Extra Teleprompter'],
              ['extraDurationHours', 'Extra Duration Hours'],
            ].map(([key, label]) => (
              <div className="space-y-2" key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="number"
                  min="0"
                  value={postShootForm[key as keyof PostShootForm]}
                  onChange={(event) =>
                    setPostShootForm((prev) => ({ ...prev, [key]: event.target.value }))
                  }
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="addonHasAddons">Has Addons</Label>
              <Select
                value={postShootForm.addonHasAddons}
                onValueChange={(value) =>
                  setPostShootForm((prev) => ({ ...prev, addonHasAddons: value as 'yes' | 'no' }))
                }
              >
                <SelectTrigger id="addonHasAddons">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recordTime">Record Time</Label>
              <DurationSelect
                id="recordTime"
                value={postShootForm.recordTime}
                onChange={(value) =>
                  setPostShootForm((prev) => ({ ...prev, recordTime: value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studioTime">Studio Time</Label>
              <DurationSelect
                id="studioTime"
                value={postShootForm.studioTime}
                onChange={(value) =>
                  setPostShootForm((prev) => ({ ...prev, studioTime: value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="testimonials">Testimonials</Label>
              <Textarea
                id="testimonials"
                value={postShootForm.testimonials}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setPostShootForm((prev) => ({ ...prev, testimonials: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="shootNotes">Shoot Notes</Label>
              <Textarea
                id="shootNotes"
                value={postShootForm.shootNotes}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setPostShootForm((prev) => ({ ...prev, shootNotes: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditShoot(null)}>Cancel</Button>
            <Button onClick={savePostShootDetails} disabled={saving}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
