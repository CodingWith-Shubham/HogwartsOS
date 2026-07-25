import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { SalesDashboard } from '@/components/sales/SalesDashboard';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const user = getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const allowedRoles = ['manager', 'admin', 'sales', 'editor'];
  if (!allowedRoles.includes(user.role)) {
    redirect(user.redirectTo || '/dashboard');
  }

  return (
    <SalesDashboard
      initialLeads={[]}
      initialShoots={[]}
      initialEditing={[]}
    />
  );
}
