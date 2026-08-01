import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { ShootDashboard } from '@/components/shoot/ShootDashboard';

export const dynamic = 'force-dynamic';

export default async function ShootPage() {
  const user = getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const allowedRoles = ['manager', 'shoot'];
  if (!allowedRoles.includes(user.role)) {
    redirect(user.redirectTo || '/dashboard');
  }

  return <ShootDashboard initialShoots={[]} />;
}
