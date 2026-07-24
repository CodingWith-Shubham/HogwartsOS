import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { SalesDashboard } from '@/components/sales/SalesDashboard';
import { fetchEditingFromSheet, fetchLeadsWithPayments, fetchShootsFromSheet } from '@/lib/google/sheets';
import type { EditingProject, Lead, Shoot } from '@/lib/sheets/types';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const user = getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  // Route authorization check (corresponds to NAV_ITEMS roles)
  const allowedRoles = ['manager', 'admin', 'sales', 'editor'];
  if (!allowedRoles.includes(user.role)) {
    redirect(user.redirectTo || '/dashboard');
  }

  // Fetch all data
  const [allLeads, allShoots, allEditing] = await Promise.all([
    fetchLeadsWithPayments(),
    fetchShootsFromSheet(),
    fetchEditingFromSheet(),
  ]);

  let initialLeads = allLeads;
  let initialShoots = allShoots;
  let initialEditing = allEditing;

  // Apply role-based data isolation
  if (user.role === 'sales') {
    initialLeads = allLeads.filter(
      (lead) =>
        lead.assignedTo.trim().toLowerCase() === user.name.trim().toLowerCase() ||
        lead.assignedTo.trim().toLowerCase() === user.email.trim().toLowerCase() ||
        lead.assignedTo.trim().toLowerCase() === user.username.trim().toLowerCase()
    );
    const allowedLeadIds = new Set(initialLeads.map((l) => l.leadId));
    initialShoots = allShoots.filter((s) => s.leadId && allowedLeadIds.has(s.leadId));
    initialEditing = allEditing.filter((e) => e.leadId && allowedLeadIds.has(e.leadId));
  } else if (user.role === 'editor') {
    initialEditing = allEditing.filter(
      (edit) =>
        edit.editorEmail.trim().toLowerCase() === user.email.trim().toLowerCase() ||
        edit.editorName.trim().toLowerCase() === user.name.trim().toLowerCase()
    );
    const allowedLeadIds = new Set(initialEditing.map((e) => e.leadId));
    initialLeads = allLeads.filter((l) => l.leadId && allowedLeadIds.has(l.leadId));
    initialShoots = allShoots.filter((s) => s.leadId && allowedLeadIds.has(s.leadId));
  } else if (user.role === 'shoot') {
    initialShoots = allShoots.filter(
      (shoot) =>
        shoot.shootMemberEmail.trim().toLowerCase() === user.email.trim().toLowerCase() ||
        shoot.shootMemberName.trim().toLowerCase() === user.name.trim().toLowerCase()
    );
    const allowedLeadIds = new Set(initialShoots.map((s) => s.leadId));
    initialLeads = allLeads.filter((l) => l.leadId && allowedLeadIds.has(l.leadId));
    initialEditing = allEditing.filter((e) => e.leadId && allowedLeadIds.has(e.leadId));
  }

  return (
    <SalesDashboard
      initialLeads={initialLeads}
      initialShoots={initialShoots}
      initialEditing={initialEditing}
    />
  );
}
