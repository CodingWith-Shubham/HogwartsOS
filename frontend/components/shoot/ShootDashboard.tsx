'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Camera, CheckCircle, Clock, ExternalLink, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { Shoot } from '@/lib/sheets/types';
import { cn } from '@/lib/utils';

const UPDATE_WEBHOOK_URL =
  'https://hogwartsautomation.app.n8n.cloud/webhook/update-shoot-details';
const UPLOAD_WEBHOOK_URL =
  'https://hogwartsautomation.app.n8n.cloud/webhook/upload-drive-link';

interface ShootDashboardProps {
  initialShoots: Shoot[];
}

interface PostShootForm {
  extraCamera: string;
  extraTeleprompter: string;
  extraDurationHours: string;
  additionalCost: string;
  recordTime: string;
  studioTime: string;
  testimonials: string;
  shootNotes: string;
}

const DURATION_HOURS = Array.from({ length: 25 }, (_, index) => String(index));
const DURATION_MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, '0')
);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isTrue(value: string | undefined) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function isYes(value: string | undefined) {
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
                      className="w-full rounded bg-blue-500/15 border border-blue-500/30 px-2 py-1 text-left text-[11px] text-blue-600 hover:bg-blue-500/20"
                    >
                      <span className="block truncate font-medium">{shoot.clientName}</span>
                      <span className="block truncate">{shoot.shootStartTime || '-'}</span>
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
  uploadValue,
  onUploadValueChange,
  uploading,
}: {
  shoot: Shoot;
  onEdit: (shoot: Shoot) => void;
  onUpload: (shoot: Shoot) => void;
  uploadValue: string;
  onUploadValueChange: (shootId: string, value: string) => void;
  uploading: boolean;
}) {
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
            </div>
            <p className="text-sm text-muted-foreground">{shoot.contactNum || '-'}</p>
          </div>
          <UploadStatusBadge shoot={shoot} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Shoot Date</p>
            <p>{formatDate(shoot.shootDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Time</p>
            <p>{shoot.shootStartTime || '-'} - {shoot.shootEndTime || '-'}</p>
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
            <Button variant="outline" size="sm" onClick={() => onEdit(shoot)}>
              Edit Post-Shoot Details
            </Button>
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
  const [shoots, setShoots] = useState<Shoot[]>(initialShoots);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Shoot | null>(null);
  const [editShoot, setEditShoot] = useState<Shoot | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [driveLinks, setDriveLinks] = useState<Record<string, string>>({});
  const [postShootForm, setPostShootForm] = useState<PostShootForm>({
    extraCamera: '0',
    extraTeleprompter: '0',
    extraDurationHours: '0',
    additionalCost: '0',
    recordTime: '',
    studioTime: '',
    testimonials: '',
    shootNotes: '',
  });

  const refreshShoots = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch('/api/shoots', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to refresh shoots');
      setShoots(data.shoots ?? []);
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
    const interval = setInterval(() => refreshShoots(true), 30000);
    return () => clearInterval(interval);
  }, [refreshShoots]);

  const today = todayKey();
  const todaysShoots = shoots.filter((shoot) => shoot.shootDate === today);
  const upcoming = shoots.filter(
    (shoot) => shoot.shootDate > today && !isTrue(shoot.driveLinkUploaded)
  );
  const completed = shoots.filter((shoot) => isTrue(shoot.driveLinkUploaded));
  const pendingUploads = shoots.filter((shoot) => !isTrue(shoot.driveLinkUploaded)).length;

  const openEdit = (shoot: Shoot) => {
    setEditShoot(shoot);
    setPostShootForm({
      extraCamera: shoot.extraCamera || '0',
      extraTeleprompter: shoot.extraTeleprompter || '0',
      extraDurationHours: shoot.extraDurationHours || '0',
      additionalCost: shoot.additionalCost || '0',
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
          additional_cost: postShootForm.additionalCost,
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
      const response = await fetch(UPLOAD_WEBHOOK_URL, {
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

  const renderList = (items: Shoot[], empty: string) => {
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

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map((shoot) => (
          <ShootCard
            key={shoot.id}
            shoot={shoot}
            onEdit={openEdit}
            onUpload={uploadDriveLink}
            uploadValue={driveLinks[shoot.shootId] ?? ''}
            onUploadValueChange={(shootId, value) =>
              setDriveLinks((prev) => ({ ...prev, [shootId]: value }))
            }
            uploading={uploadingId === shoot.shootId}
          />
        ))}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Shoot"
        description="Production scheduling and shoot management"
        actions={
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">
              {pendingUploads} pending uploads
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refreshShoots()} disabled={refreshing}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Today's Shoots" value={todaysShoots.length} icon={Camera} />
        <StatCard title="Upcoming" value={upcoming.length} icon={Clock} />
        <StatCard title="Completed" value={completed.length} icon={CheckCircle} />
        <StatCard title="Total Scheduled" value={shoots.length} icon={Calendar} />
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          {renderList(todaysShoots, 'No shoots scheduled for today.')}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <ShootCalendar shoots={shoots} onSelect={setDetail} />
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          {renderList(upcoming, 'No upcoming pending shoots.')}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {renderList(completed, 'No completed shoots yet.')}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.clientName}</DialogTitle>
                <DialogDescription>Full shoot details</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Contact:</span> {detail.contactNum || '-'}</div>
                <div><span className="text-muted-foreground">Email:</span> {detail.emailId || '-'}</div>
                <div><span className="text-muted-foreground">Date:</span> {formatDate(detail.shootDate)}</div>
                <div><span className="text-muted-foreground">Time:</span> {detail.shootStartTime} - {detail.shootEndTime}</div>
                <div><span className="text-muted-foreground">Camera:</span> {detail.camera || '1'}</div>
                <div><span className="text-muted-foreground">Hours:</span> {detail.totalHours || '-'}</div>
                <div><span className="text-muted-foreground">Member:</span> {detail.shootMemberName || '-'}</div>
                <div><span className="text-muted-foreground">Assigned:</span> {detail.assignedTo || '-'}</div>
              </div>
              {detail.shootNotes && <p className="text-sm text-muted-foreground">{detail.shootNotes}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>

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
              ['additionalCost', 'Additional Cost INR'],
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
                onChange={(event) =>
                  setPostShootForm((prev) => ({ ...prev, testimonials: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="shootNotes">Shoot Notes</Label>
              <Textarea
                id="shootNotes"
                value={postShootForm.shootNotes}
                onChange={(event) =>
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
