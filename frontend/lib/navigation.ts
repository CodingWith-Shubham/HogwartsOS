import {
  LayoutDashboard,
  Briefcase,
  Users,
  UserCheck,
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
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['manager', 'super_admin'] },
  { label: 'Sales', href: '/sales', icon: Briefcase, roles: ['manager', 'admin', 'super_admin', 'sales'] },
  { label: 'Manager', href: '/manager', icon: LayoutDashboard, roles: ['manager', 'admin', 'super_admin'] },
  { label: 'Shoot', href: '/shoot', icon: Camera, roles: ['manager', 'super_admin', 'shoot'] },
  { label: 'Editor', href: '/editor', icon: Scissors, roles: ['manager', 'super_admin', 'editor'] },
  { label: 'Clients', href: '/clients', icon: Users, roles: ['manager', 'admin', 'super_admin', 'sales'] },
  { label: 'Client Profiles', href: '/client-profiles', icon: UserCheck, roles: ['manager', 'admin', 'super_admin', 'sales', 'editor'] },
  { label: 'Attendance', href: '/attendance', icon: Clock, roles: ['manager', 'admin', 'super_admin', 'sales', 'shoot', 'editor'] },
  { label: 'Finance', href: '/finance', icon: Wallet, roles: ['manager', 'super_admin'] },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['manager', 'super_admin'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['manager', 'admin', 'super_admin', 'sales', 'shoot', 'editor'] },
];

export function getNavForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
