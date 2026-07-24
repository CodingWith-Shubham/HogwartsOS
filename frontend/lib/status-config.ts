import type { ProjectStatus, PaymentStatus, Priority } from './types';

export const STATUS_META: Record<
  ProjectStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  new_lead: { label: 'New Lead', color: '#8B949E', bg: 'rgba(139,148,158,0.12)', border: 'rgba(139,148,158,0.3)' },
  requirements_filled: { label: 'Requirements Filled', color: '#58A6FF', bg: 'rgba(88,166,255,0.12)', border: 'rgba(88,166,255,0.3)' },
  proposal_sent: { label: 'Proposal Sent', color: '#D29922', bg: 'rgba(210,153,34,0.12)', border: 'rgba(210,153,34,0.3)' },
  payment_pending: { label: 'Payment Pending', color: '#D29922', bg: 'rgba(210,153,34,0.12)', border: 'rgba(210,153,34,0.3)' },
  payment_done: { label: 'Payment Done', color: '#3FB950', bg: 'rgba(63,185,80,0.12)', border: 'rgba(63,185,80,0.3)' },
  shoot_scheduled: { label: 'Shoot Scheduled', color: '#58A6FF', bg: 'rgba(88,166,255,0.12)', border: 'rgba(88,166,255,0.3)' },
  footage_received: { label: 'Footage Received', color: '#E57C2B', bg: 'rgba(229,124,43,0.12)', border: 'rgba(229,124,43,0.3)' },
  editor_assigned: { label: 'Editor Assigned', color: '#8B949E', bg: 'rgba(139,148,158,0.12)', border: 'rgba(139,148,158,0.3)' },
  editing: { label: 'Editing', color: '#E57C2B', bg: 'rgba(229,124,43,0.12)', border: 'rgba(229,124,43,0.3)' },
  draft_sent: { label: 'Draft Sent', color: '#58A6FF', bg: 'rgba(88,166,255,0.12)', border: 'rgba(88,166,255,0.3)' },
  in_revision: { label: 'In Revision', color: '#F85149', bg: 'rgba(248,81,73,0.12)', border: 'rgba(248,81,73,0.3)' },
  approved: { label: 'Approved', color: '#3FB950', bg: 'rgba(63,185,80,0.12)', border: 'rgba(63,185,80,0.3)' },
  delivered: { label: 'Delivered', color: '#3FB950', bg: 'rgba(63,185,80,0.12)', border: 'rgba(63,185,80,0.3)' },
  closed: { label: 'Closed', color: '#6E7681', bg: 'rgba(110,118,129,0.12)', border: 'rgba(110,118,129,0.3)' },
};

export const PAYMENT_META: Record<
  PaymentStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  unpaid: { label: 'Unpaid', color: '#F85149', bg: 'rgba(248,81,73,0.12)', border: 'rgba(248,81,73,0.3)' },
  partial: { label: 'Partial', color: '#D29922', bg: 'rgba(210,153,34,0.12)', border: 'rgba(210,153,34,0.3)' },
  paid: { label: 'Paid', color: '#3FB950', bg: 'rgba(63,185,80,0.12)', border: 'rgba(63,185,80,0.3)' },
  overdue: { label: 'Overdue', color: '#F85149', bg: 'rgba(248,81,73,0.12)', border: 'rgba(248,81,73,0.3)' },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; bg: string; border: string }
> = {
  low: { label: 'Low', color: '#8B949E', bg: 'rgba(139,148,158,0.12)', border: 'rgba(139,148,158,0.3)' },
  medium: { label: 'Medium', color: '#58A6FF', bg: 'rgba(88,166,255,0.12)', border: 'rgba(88,166,255,0.3)' },
  high: { label: 'High', color: '#D29922', bg: 'rgba(210,153,34,0.12)', border: 'rgba(210,153,34,0.3)' },
  urgent: { label: 'Urgent', color: '#F85149', bg: 'rgba(248,81,73,0.12)', border: 'rgba(248,81,73,0.3)' },
};

export const STATUS_ORDER: ProjectStatus[] = [
  'new_lead',
  'requirements_filled',
  'proposal_sent',
  'payment_pending',
  'payment_done',
  'shoot_scheduled',
  'footage_received',
  'editor_assigned',
  'editing',
  'draft_sent',
  'in_revision',
  'approved',
  'delivered',
  'closed',
];

export const KANBAN_COLUMNS: ProjectStatus[] = [
  'new_lead',
  'requirements_filled',
  'proposal_sent',
  'payment_pending',
  'payment_done',
  'shoot_scheduled',
  'footage_received',
  'editor_assigned',
  'editing',
  'draft_sent',
  'approved',
  'delivered',
];
