import { NextResponse } from 'next/server';
import type { Lead, Shoot, EditingProject } from '@/lib/sheets/types';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { headers } from 'next/headers';
import { isPendingPaymentVerification } from '@/lib/sheets/payment-utils';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

async function fetchFromExpress(endpoint: string, token: string | null) {
  try {
    const baseUrl = await getBackendUrl();
    const headersInit: HeadersInit = {
      'Cache-Control': 'no-store'
    };
    if (token) {
      headersInit['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}${endpoint}`, { 
      cache: 'no-store',
      headers: headersInit
    });
    if (!res.ok) {
      console.error(`[notifications] fetchFromExpress failed for ${endpoint}: ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    console.log(`[notifications] fetchFromExpress success for ${endpoint}`);
    return data;
  } catch (err) {
    console.error(`[notifications] fetchFromExpress error for ${endpoint}:`, err);
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
  const reqHeaders = headers();
  const user = getAuthenticatedUser(reqHeaders);
  const token = getAccessToken(reqHeaders);
  
  if (!user) {
    console.error('[notifications] Unauthorized: No user found');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [leadsRes, shootsRes, editingRes] = await Promise.all([
      fetchFromExpress('/clients', token),
      fetchFromExpress('/shoots', token),
      fetchFromExpress('/editing', token)
    ]);

    const leads: Lead[] = leadsRes?.data?.leads || leadsRes?.leads || [];
    const shoots: Shoot[] = shootsRes?.data?.shoots || shootsRes?.shoots || [];
    const editing: EditingProject[] = editingRes?.data?.editingProjects || editingRes?.editingProjects || editingRes?.editing || [];
    
    console.log(`[notifications] Fetched ${leads.length} leads, ${shoots.length} shoots, ${editing.length} editing projects. User role: ${user.role}`);
    const notifications: AppNotification[] = [];
    const isAdminOrSuper = user.role === 'admin' || user.role === 'super_admin';
    const isManagerRole = user.role === 'manager';
    const equal = (first: string, second: string) => first.trim().toLowerCase() === second.trim().toLowerCase();
    const ownsLead = (lead: Lead) => [user.name, user.email, user.username].some((identity) => equal(lead.assignedTo, identity));
    const ownsShoot = (shoot: Shoot) => equal(shoot.shootMemberName, user.name) || equal(shoot.shootMemberEmail, user.email);
    const ownsEdit = (edit: EditingProject) => equal(edit.editorName, user.name) || equal(edit.editorEmail, user.email);

    // 1. Leads
    leads.forEach(lead => {
        const isAssignedSales = user.role === 'sales' && ownsLead(lead);
        
        if (isPendingPaymentVerification(lead)) {
            if (isAdminOrSuper || isAssignedSales) {
                notifications.push({ id: `payment-${lead.leadId}`, area: 'sales', title: 'Payment needs verification', message: `${lead.name || 'A client'} has uploaded a payment screenshot.`, href: isAdminOrSuper ? '/manager' : '/sales', priority: 'urgent' });
            }
        }
        
        if (lead.status === 'Proposal Revoked') {
            if (isAdminOrSuper || isAssignedSales) {
                notifications.push({ id: `revoked-${lead.leadId}`, area: 'sales', title: 'Proposal Revoked', message: `The proposal for ${lead.name} has been revoked.`, href: '/sales', priority: 'urgent' });
            }
        }
    });

    // 2. Shoots
    shoots.forEach(shoot => {
        const parentLead = leads.find(l => l.leadId === shoot.leadId);
        const isAssignedSales = user.role === 'sales' && parentLead && ownsLead(parentLead);
        const isAssignedShoot = user.role === 'shoot' && ownsShoot(shoot);
        
        const hours = hoursUntil(shoot.shootDate);
        if (!isTrue(shoot.driveLinkUploaded) && hours !== null && hours <= 24) {
            if (isAssignedShoot || isAssignedSales) {
                notifications.push({ id: `shoot-${shoot.shootId}`, area: 'shoot', title: hours < 0 ? 'Shoot footage upload overdue' : 'Shoot coming up', message: `${shoot.clientName || 'Client'} - ${shoot.shootDate}.`, href: '/shoot', priority: hours < 0 ? 'urgent' : 'normal' });
            }
        }
    });

    // 3. Editing
    editing.forEach(edit => {
        const parentLead = leads.find(l => l.leadId === edit.leadId);
        const isAssignedSales = user.role === 'sales' && parentLead && ownsLead(parentLead);
        const isAssignedEditor = user.role === 'editor' && ownsEdit(edit);
        
        const status = edit.status.trim().toLowerCase();
        const hours = hoursUntil(edit.deadlineAt);
        
        if (status === 'revision requested') {
            if (isAssignedEditor) {
                notifications.push({ id: `revision-${edit.editId}`, area: 'editor', title: 'Revision requested', message: `${edit.clientName || 'A project'} needs your changes.`, href: '/editor', priority: 'urgent' });
            }
        }
        
        if (status === 'draft ready') {
            if (isAdminOrSuper || isAssignedSales) {
                notifications.push({ id: `review-${edit.editId}`, area: 'manager', title: 'Draft ready for review', message: `${edit.clientName || 'A project'} is ready for manager review.`, href: isAdminOrSuper ? '/manager' : '/sales', priority: 'normal' });
            }
        }

        if (status === 'pending extra revision approval') {
            if (isAdminOrSuper || isAssignedSales) {
                notifications.push({ id: `extrarev-${edit.editId}`, area: 'manager', title: 'Extra Revision Approval', message: `${edit.clientName || 'A project'} requires approval for an extra revision.`, href: isAdminOrSuper ? '/manager' : '/sales', priority: 'normal' });
            }
        }

        if (status === 'completed') {
            if (isAdminOrSuper || isAssignedSales || isAssignedEditor) {
                notifications.push({ id: `completed-${edit.editId}`, area: 'manager', title: 'Task Completed', message: `Editing for ${edit.clientName || 'A project'} is completed.`, href: isAdminOrSuper ? '/manager' : (isAssignedSales ? '/sales' : '/editor'), priority: 'normal' });
            }
        }

        if (hours !== null && hours <= 48 && status !== 'delivered' && status !== 'completed') {
            if (isAssignedEditor) {
                notifications.push({ id: `deadline-${edit.editId}-${edit.deadlineAt}`, area: 'editor', title: hours < 0 ? 'Editing deadline overdue' : 'Editing deadline approaching', message: `${edit.clientName || 'A project'} is due ${edit.deadlineAt}.`, href: '/editor', priority: hours < 0 ? 'urgent' : 'normal' });
            }
        }
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Failed to build notifications:', error);
    return NextResponse.json({ error: 'Failed to load notifications', notifications: [] }, { status: 500 });
  }
}
