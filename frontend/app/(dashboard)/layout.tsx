'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getNavForRole } from '@/lib/navigation';
import { useAuth } from '@/lib/auth-context';
import { Film } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const navItems = user ? getNavForRole(user.role) : [];

  useEffect(() => {
    if (isLoading || !user) return;
    const allowed = navItems.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + '/')
    );
    if (!allowed && pathname !== '/') {
      router.replace(user.redirectTo);
    }
  }, [user?.role, isLoading, pathname, navItems, router]);

  const isAllowed = !user || navItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  if (!isAllowed && pathname !== '/') {
    return null;
  }

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[240px] p-0">
            <SheetHeader className="p-4 border-b border-border">
              <SheetTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary border border-border">
                  <Film className="h-4 w-4" />
                </div>
                Howgarts Media
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative',
                      active
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    )}
                  >
                    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-foreground" />}
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 flex-col min-w-0">
          <Header onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1400px] p-4 md:p-6 lg:p-8 animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
