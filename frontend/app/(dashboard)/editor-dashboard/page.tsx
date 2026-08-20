import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { EditorSummaryDashboard } from '@/components/dashboards/EditorSummaryDashboard';

export const dynamic = 'force-dynamic';

export default async function EditorDashboardPage() {
  const user = getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const allowedRoles = ['editor', 'super_admin'];
  if (!allowedRoles.includes(user.role)) {
    redirect(user.redirectTo || '/dashboard');
  }

  return <EditorSummaryDashboard />;
}
