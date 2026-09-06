import type { ProjectStatus, PaymentStatus, Priority } from './types';

export const STATUS_META: Record<
  ProjectStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  new_lead: { label: 'New Lead', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' }, // gray-500, gray-100, gray-200
  requirements_filled: { label: 'Requirements Filled', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' }, // blue-500, blue-50, blue-200
  proposal_sent: { label: 'Proposal Sent', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' }, // amber-600, amber-50, amber-200
  payment_pending: { label: 'Payment Pending', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  payment_done: { label: 'Payment Done', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' }, // green-600, green-50, green-200
  shoot_scheduled: { label: 'Shoot Scheduled', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  footage_received: { label: 'Footage Received', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  editor_assigned: { label: 'Editor Assigned', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' },
  editing: { label: 'Editing', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  draft_sent: { label: 'Draft Sent', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  in_revision: { label: 'In Revision', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  approved: { label: 'Approved', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  delivered: { label: 'Delivered', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  closed: { label: 'Closed', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' },
};

export const PAYMENT_META: Record<
  PaymentStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  unpaid: { label: 'Unpaid', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }, // red-600, red-50, red-200
  partial: { label: 'Partial', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  paid: { label: 'Paid', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  overdue: { label: 'Overdue', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; bg: string; border: string }
> = {
  low: { label: 'Low', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' },
  medium: { label: 'Medium', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  high: { label: 'High', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  urgent: { label: 'Urgent', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
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
