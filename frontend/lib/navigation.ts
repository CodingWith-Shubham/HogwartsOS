import {
  LayoutDashboard,
  Briefcase,
  Users,
  Camera,
  Scissors,
  Wallet,
  BarChart3,
  Settings,
  Clock,
} from 'lucide-react';
import type { UserRole } from '@/lib/types';

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['manager', 'admin', 'sales', 'editor'] },
  { label: 'Sales', href: '/sales', icon: Briefcase, roles: ['manager', 'admin', 'sales', 'editor'] },
  { label: 'Manager', href: '/manager', icon: LayoutDashboard, roles: ['manager', 'admin', 'editor'] },
  { label: 'Shoot', href: '/shoot', icon: Camera, roles: ['manager', 'admin', 'sales', 'shoot', 'editor'] },
  { label: 'Editor', href: '/editor', icon: Scissors, roles: ['manager', 'admin', 'editor'] },
  { label: 'Clients', href: '/clients', icon: Users, roles: ['manager', 'admin', 'sales', 'editor'] },
  { label: 'Attendance', href: '/attendance', icon: Clock, roles: ['manager', 'admin', 'sales', 'shoot', 'editor'] },
  { label: 'Finance', href: '/finance', icon: Wallet, roles: ['manager', 'admin', 'editor'] },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['manager', 'admin', 'editor'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['manager'] },
];

export function getNavForRole(role: UserRole): NavItem[] {
  if (role === 'manager' || role === 'admin') {
    return NAV_ITEMS;
  }
  return NAV_ITEMS.filter((item) => {
    if (item.href === '/settings' || item.href === '/attendance') return true;
    if (role === 'sales' && item.href === '/sales') return true;
    if (role === 'editor' && item.href === '/editor') return true;
    if (role === 'shoot' && item.href === '/shoot') return true;
    return false;
  });
}
