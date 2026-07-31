import { NextResponse } from 'next/server';
import type { Lead, Shoot, EditingProject } from '@/lib/sheets/types';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { isPendingPaymentVerification } from '@/lib/sheets/payment-utils';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

async function fetchFromExpress(endpoint: string) {
  try {
    const baseUrl = await getBackendUrl();
    const res = await fetch(`${baseUrl}${endpoint}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export type NotificationArea = 'sales' | 'shoot' | 'editor' | 'manager';
export interface AppNotification { id: string; area: NotificationArea; title: string; message: string; href: string; priority: 'normal' | 'urgent'; }

const isTrue = (value: string | boolean) => {
  if (typeof value === 'boolean') return value;
  return value ? value.trim().toLowerCase() === 'true' : false;
};
function hoursUntil(value: string): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : (time - Date.now()) / 3_600_000;
}

export async function GET() {
  const user = getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [leadsRes, shootsRes, editingRes] = await Promise.all([
      fetchFromExpress('/clients'),
      fetchFromExpress('/shoots'),
      fetchFromExpress('/editing')
    ]);

    const leads: Lead[] = leadsRes?.leads || [];
    const shoots: Shoot[] = shootsRes?.shoots || [];
    const editing: EditingProject[] = editingRes?.editing || [];
    const notifications: AppNotification[] = [];
    const isManager = user.role === 'manager' || user.role === 'admin';
    const equal = (first: string, second: string) => first.trim().toLowerCase() === second.trim().toLowerCase();
    const ownsLead = (lead: Lead) => [user.name, user.email, user.username].some((identity) => equal(lead.assignedTo, identity));
    const ownsShoot = (shoot: Shoot) => equal(shoot.shootMemberName, user.name) || equal(shoot.shootMemberEmail, user.email);
    const ownsEdit = (edit: EditingProject) => equal(edit.editorName, user.name) || equal(edit.editorEmail, user.email);

    if (isManager || user.role === 'sales') leads.filter((lead) => isManager || ownsLead(lead)).filter(isPendingPaymentVerification).forEach((lead) => notifications.push({ id: `payment-${lead.leadId}`, area: 'sales', title: 'Payment needs verification', message: `${lead.name || 'A client'} has uploaded a payment screenshot.`, href: isManager ? '/manager' : '/sales', priority: 'urgent' }));
    if (isManager || user.role === 'shoot') shoots.filter((shoot) => isManager || ownsShoot(shoot)).forEach((shoot) => {
      const hours = hoursUntil(shoot.shootDate);
      if (!isTrue(shoot.driveLinkUploaded) && hours !== null && hours <= 24) notifications.push({ id: `shoot-${shoot.shootId}-${shoot.driveLinkUploaded}`, area: 'shoot', title: hours < 0 ? 'Shoot footage upload overdue' : 'Shoot coming up', message: `${shoot.clientName || 'Client'}${shoot.shootDate ? ` - ${shoot.shootDate}` : ''}.`, href: isManager ? '/manager' : '/shoot', priority: hours < 0 ? 'urgent' : 'normal' });
    });
    if (isManager || user.role === 'editor') editing.filter((edit) => isManager || ownsEdit(edit)).forEach((edit) => {
      const status = edit.status.trim().toLowerCase();
      const hours = hoursUntil(edit.deadlineAt);
      if (status === 'revision requested') notifications.push({ id: `revision-${edit.editId}`, area: 'editor', title: 'Revision requested', message: `${edit.clientName || 'A project'} needs your changes.`, href: isManager ? '/manager' : '/editor', priority: 'urgent' });
      if (hours !== null && hours <= 48 && status !== 'delivered') notifications.push({ id: `deadline-${edit.editId}-${edit.deadlineAt}`, area: 'editor', title: hours < 0 ? 'Editing deadline overdue' : 'Editing deadline approaching', message: `${edit.clientName || 'A project'}${edit.deadlineAt ? ` is due ${edit.deadlineAt}` : ''}.`, href: isManager ? '/manager' : '/editor', priority: hours < 0 ? 'urgent' : 'normal' });
    });
    if (isManager) editing.filter((edit) => edit.status.trim().toLowerCase() === 'draft ready').forEach((edit) => notifications.push({ id: `review-${edit.editId}`, area: 'manager', title: 'Draft ready for review', message: `${edit.clientName || 'A project'} is ready for manager review.`, href: '/manager', priority: 'normal' }));
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Failed to build notifications:', error);
    return NextResponse.json({ error: 'Failed to load notifications', notifications: [] }, { status: 500 });
  }
}
