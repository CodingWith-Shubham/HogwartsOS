import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { ShootSummaryDashboard } from '@/components/dashboards/ShootSummaryDashboard';

export const dynamic = 'force-dynamic';

export default async function ShootDashboardPage() {
  const user = getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const allowedRoles = ['shoot', 'super_admin'];
  if (!allowedRoles.includes(user.role)) {
    redirect(user.redirectTo || '/dashboard');
  }

  return <ShootSummaryDashboard />;
}
