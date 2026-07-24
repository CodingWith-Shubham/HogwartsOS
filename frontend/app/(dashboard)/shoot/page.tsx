import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { ShootDashboard } from '@/components/shoot/ShootDashboard';
import { fetchShootsFromSheet, fetchLeadsWithPayments, fetchEditingFromSheet } from '@/lib/google/sheets';
import type { Shoot } from '@/lib/sheets/types';

export const dynamic = 'force-dynamic';

export default async function ShootPage() {
  const user = getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  // Route authorization check (corresponds to NAV_ITEMS roles)
  const allowedRoles = ['manager', 'admin', 'sales', 'shoot', 'editor'];
  if (!allowedRoles.includes(user.role)) {
    redirect(user.redirectTo || '/dashboard');
  }

  const allShoots = await fetchShootsFromSheet();
  let initialShoots = allShoots;

  if (user.role === 'shoot') {
    initialShoots = allShoots.filter(
      (shoot) =>
        shoot.shootMemberEmail.trim().toLowerCase() === user.email.trim().toLowerCase() ||
        shoot.shootMemberName.trim().toLowerCase() === user.name.trim().toLowerCase()
    );
  } else if (user.role === 'sales') {
    const allLeads = await fetchLeadsWithPayments();
    const salesLeads = allLeads.filter(
      (lead) =>
        lead.assignedTo.trim().toLowerCase() === user.name.trim().toLowerCase() ||
        lead.assignedTo.trim().toLowerCase() === user.email.trim().toLowerCase() ||
        lead.assignedTo.trim().toLowerCase() === user.username.trim().toLowerCase()
    );
    const allowedLeadIds = new Set(salesLeads.map((l) => l.leadId));
    initialShoots = allShoots.filter((s) => s.leadId && allowedLeadIds.has(s.leadId));
  } else if (user.role === 'editor') {
    const allEditing = await fetchEditingFromSheet();
    const editorEdits = allEditing.filter(
      (edit) =>
        edit.editorEmail.trim().toLowerCase() === user.email.trim().toLowerCase() ||
        edit.editorName.trim().toLowerCase() === user.name.trim().toLowerCase()
    );
    const allowedLeadIds = new Set(editorEdits.map((e) => e.leadId));
    initialShoots = allShoots.filter((s) => s.leadId && allowedLeadIds.has(s.leadId));
  }

  return <ShootDashboard initialShoots={initialShoots} />;
}
