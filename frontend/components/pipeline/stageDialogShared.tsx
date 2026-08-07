'use client';

import { useEffect, useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { User } from '@/lib/types';

/**
 * Shared constants + helpers for the lead stage dialogs (Send Proposal,
 * Send Payment Link, Schedule Shoot, Upload Drive Link).
 *
 * These were extracted verbatim from `components/sales/SalesDashboard.tsx` so
 * the exact same modals (and n8n webhook flows) can be reused by both the
 * regular Sales lead pipeline and the Upsell & Cross-Sell pipeline.
 */

export const SCHEDULE_SHOOT_WEBHOOK_URL =
  'https://n8n.hogwartsstudios.com/webhook/schedule-shoot';

/** Same webhook the Shoot dashboard uses for footage drive links. */
export const UPLOAD_DRIVE_LINK_URL =
  'https://n8n.hogwartsstudios.com/webhook/upload-drive-link';

export const FALLBACK_SHOOT_MEMBERS = [
  { name: 'Mayank Saxena', email: 'mayank@hogwartsstudios.com' },
];

export const SERVICE_NOTE_OPTIONS = [
  'Podcast',
  'Solo content shoot',
  'Outdoor shoot',
  'Product',
  'Fashion',
  'Only space',
  'Only editing',
  'Only marketing',
  'End to End',
] as const;

export const DELIVERABLE_FIELDS = [
  { key: 'podcastEdit', payloadKey: 'podcast_edit', label: 'Podcast Edit' },
  { key: 'reelEdit', payloadKey: 'reel_edit', label: 'Reel Edit' },
  { key: 'longFormatVideo', payloadKey: 'long_format_video', label: 'Long Format Video', durationKey: 'longFormatDuration' },
  { key: 'shortFormatVideo', payloadKey: 'short_format_video', label: 'Short Format Video', durationKey: 'shortFormatDuration' },
  { key: 'teaserEdit', payloadKey: 'teaser_edit', label: 'Teaser Edit' },
  { key: 'thumbnailEdit', payloadKey: 'thumbnail_edit', label: 'Thumbnail Edit' },
] as const;

const TIME_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const TIME_MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const TIME_PERIODS = ['AM', 'PM'] as const;

type TimePeriod = (typeof TIME_PERIODS)[number];
export type DeliverableKey = (typeof DELIVERABLE_FIELDS)[number]['key'];

export function getAssignedSalespersonName(assignedTo: string, users: User[]) {
  const normalizedAssignee = assignedTo.trim().toLowerCase();
  if (!normalizedAssignee) return assignedTo;

  const salesperson = users.find((user) => {
    if (!['sales', 'manager', 'admin', 'super_admin'].includes(user.role)) return false;
    return (
      user.name.trim().toLowerCase() === normalizedAssignee ||
      user.email.trim().toLowerCase() === normalizedAssignee ||
      user.username.trim().toLowerCase() === normalizedAssignee
    );
  });

  return salesperson?.name ?? assignedTo;
}

export type ProposalFormValues = {
  clientEmail: string;
  cost: string;
  serviceNotes: string[];
  salesNotes: string;
  camera: string;
  recordTime: string;
  studioTime: string;
  longFormatDuration: string;
  shortFormatDuration: string;
} & Record<DeliverableKey, string>;

export const DEFAULT_DELIVERABLES: Record<DeliverableKey, string> = {
  podcastEdit: '0',
  reelEdit: '0',
  longFormatVideo: '0',
  shortFormatVideo: '0',
  teaserEdit: '0',
  thumbnailEdit: '0',
};

function parseTimeParts(value: string) {
  if (!value) return { hour: '', minute: '', period: '' };
  const [rawHour, rawMinute] = value.split(':').map(Number);
  if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) {
    return { hour: '', minute: '', period: '' };
  }

  const period: TimePeriod = rawHour >= 12 ? 'PM' : 'AM';
  const hour = rawHour % 12 || 12;

  return {
    hour: String(hour),
    minute: String(rawMinute).padStart(2, '0'),
    period,
  };
}

function buildTimeValue(hour: string, minute: string, period: string) {
  if (!hour || !minute || !period) return '';
  let nextHour = Number(hour);
  const nextMinute = Number(minute);

  if (
    Number.isNaN(nextHour) ||
    Number.isNaN(nextMinute) ||
    nextHour < 1 ||
    nextHour > 12 ||
    nextMinute < 0 ||
    nextMinute > 59
  ) {
    return '';
  }

  if (period === 'AM') {
    nextHour = nextHour === 12 ? 0 : nextHour;
  } else {
    nextHour = nextHour === 12 ? 12 : nextHour + 12;
  }

  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
}

export function calculateEndTime(start: string, totalHours: string) {
  if (!start || !totalHours) return '';
  const [hour, minute] = start.split(':').map(Number);
  const durationMinutes = Math.round(Number(totalHours) * 60);

  if (
    [hour, minute, durationMinutes].some((value) => Number.isNaN(value)) ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59 || durationMinutes <= 0
  ) {
    return '';
  }

  const endMinutes = (hour * 60 + minute + durationMinutes) % (24 * 60);
  return `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
}

export function TimeOfDaySelect({
  id,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [parts, setParts] = useState(() => parseTimeParts(value));

  useEffect(() => {
    setParts(parseTimeParts(value));
  }, [value]);

  const handlePartChange = (part: 'hour' | 'minute' | 'period', nextValue: string) => {
    const nextParts = { ...parts, [part]: nextValue };
    setParts(nextParts);
    const nextTimeValue = buildTimeValue(nextParts.hour, nextParts.minute, nextParts.period);
    if (nextTimeValue) {
      onChange(nextTimeValue);
    }
  };

  return (
    <div className="grid grid-cols-[1fr_1fr_88px] gap-2">
      <Select value={parts.hour} onValueChange={(nextValue) => handlePartChange('hour', nextValue)} disabled={disabled}>
        <SelectTrigger id={`${id}-hour`} aria-label="Hour">
          <SelectValue placeholder="Hour" />
        </SelectTrigger>
        <SelectContent>
          {TIME_HOURS.map((hour) => (
            <SelectItem key={hour} value={hour}>
              {hour}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={parts.minute}
        onValueChange={(nextValue) => handlePartChange('minute', nextValue)}
        disabled={disabled}
      >
        <SelectTrigger id={`${id}-minute`} aria-label="Min">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent>
          {TIME_MINUTES.map((minute) => (
            <SelectItem key={minute} value={minute}>
              {minute}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={parts.period}
        onValueChange={(nextValue) => handlePartChange('period', nextValue)}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-label="AM or PM">
          <SelectValue placeholder="AM/PM" />
        </SelectTrigger>
        <SelectContent>
          {TIME_PERIODS.map((period) => (
            <SelectItem key={period} value={period}>
              {period}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function normalizeQuantity(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return '0';
  return String(Math.floor(parsed));
}

export function totalDeliverables(values: Record<DeliverableKey, string>) {
  return DELIVERABLE_FIELDS.reduce(
    (sum, field) => sum + Number(normalizeQuantity(values[field.key])),
    0
  );
}

export function parseCost(value: string): number {
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
