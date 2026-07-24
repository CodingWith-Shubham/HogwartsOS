'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNavForRole } from '@/lib/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = user ? getNavForRole(user.role) : [];

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r border-border bg-card transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4 border-b border-border">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary border border-border">
          <Film className="h-4 w-4 text-foreground" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Howgarts</p>
            <p className="text-[11px] text-muted-foreground truncate">Media CRM</p>
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onToggle}>
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative group',
                active
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? item.label : undefined}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-foreground" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <Separator />
      <div className={cn('p-2', collapsed && 'px-1.5')}>
        {user && (
          <div className={cn('flex items-center gap-2 rounded-md px-2 py-2', collapsed && 'justify-center')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary border border-border text-xs font-medium">
              {user.initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user.name}</p>
                <p className="text-[11px] text-muted-foreground truncate capitalize">{user.role}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
