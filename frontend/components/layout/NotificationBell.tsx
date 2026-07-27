'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/app/api/notifications/route';

const READ_KEY = 'hogwarts_notification_read';
const CURRENT_KEY = 'hogwarts_notification_current';
function stored(key: string): string[] { try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; } }

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);
  const unread = items.filter((item) => !read.includes(item.id));

  const notifyDevice = useCallback(async (item: AppNotification) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification(item.title, { body: item.message, tag: item.id });
    else new Notification(item.title, { body: item.message, tag: item.id });
  }, []);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) return;
      const next: AppNotification[] = data.notifications ?? [];
      const previous = stored(CURRENT_KEY);
      localStorage.setItem(CURRENT_KEY, JSON.stringify(next.map((item) => item.id)));
      if (!initialLoad.current) next.filter((item) => !previous.includes(item.id)).forEach(notifyDevice);
      initialLoad.current = false;
      setItems(next);
    } catch { /* keep the last successful list while offline */ } finally { setLoading(false); }
  }, [notifyDevice]);

  useEffect(() => {
    setRead(stored(READ_KEY));
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    const update = () => refresh();
    window.addEventListener('leads-updated', update);
    return () => { window.clearInterval(interval); window.removeEventListener('leads-updated', update); };
  }, [refresh]);
  const markAllRead = () => {
    const next = Array.from(new Set([...read, ...items.map((item) => item.id)]));
    localStorage.setItem(READ_KEY, JSON.stringify(next));
    setRead(next);
  };
  const enableDeviceAlerts = async () => {
    if (!('Notification' in window)) return;
    await Notification.requestPermission();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  };

  return <Popover onOpenChange={(open) => { if (open && unread.length) markAllRead(); }}>
    <PopoverTrigger asChild>
      <button aria-label="Open notifications" className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
        <Bell className="h-4 w-4" />
        {unread.length > 0 && <span className="absolute right-0.5 top-0.5 min-w-[1rem] rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-destructive-foreground">{unread.length > 99 ? '99+' : unread.length}</span>}
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-[360px] p-0">
      <div className="flex items-center justify-between border-b px-4 py-3"><div><p className="text-sm font-semibold">Notifications</p><p className="text-xs text-muted-foreground">Sales, shoots, editing and reviews</p></div>{items.length > 0 && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={markAllRead}><CheckCheck className="mr-1.5 h-3.5 w-3.5" />Mark read</Button>}</div>
      <div className="max-h-[380px] overflow-y-auto">
        {loading ? <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : items.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">You are all caught up.</p> : items.map((item) => <button key={item.id} onClick={() => router.push(item.href)} className="flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-secondary/60"><span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.priority === 'urgent' ? 'bg-destructive' : 'bg-info')} /><span><span className="block text-sm font-medium">{item.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.message}</span><span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground">{item.area}</span></span></button>)}
      </div>
      {'Notification' in globalThis && Notification.permission !== 'granted' && <div className="border-t p-3"><Button variant="outline" size="sm" className="w-full text-xs" onClick={enableDeviceAlerts}><Settings2 className="mr-1.5 h-3.5 w-3.5" />Enable device alerts</Button></div>}
    </PopoverContent>
  </Popover>;
}
