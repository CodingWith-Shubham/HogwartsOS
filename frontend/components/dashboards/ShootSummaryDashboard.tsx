'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { Camera, Calendar, CheckCircle, UploadCloud, Clock } from 'lucide-react';
import { TableShimmer } from '@/components/shared/ShimmerLoader';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Shoot } from '@/lib/sheets/types';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isTrue(value: unknown) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ShootSummaryDashboard() {
  const { user } = useAuth();
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshShoots = useCallback(async () => {
    try {
      const response = await authFetch('/api/shoots', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) return;

      const filtered = (data.shoots ?? []).filter((shoot: Shoot) => !isTrue(shoot.isEditingOnly));
      setShoots(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshShoots();
  }, [refreshShoots]);

  const today = todayKey();
  
  const stats = useMemo(() => {
    return {
      todayShoots: shoots.filter(s => s.shootDate === today).length,
      upcoming: shoots.filter(s => s.shootDate > today && !isTrue(s.driveLinkUploaded)).length,
      completed: shoots.filter(s => isTrue(s.driveLinkUploaded)).length,
      pendingUploads: shoots.filter(s => !isTrue(s.driveLinkUploaded)).length,
      totalScheduled: shoots.length
    };
  }, [shoots, today]);

  if (loading) return (
    <div className="space-y-6">
      <PageHeader title="Shoot Summary Dashboard" description="Overview of production scheduling" />
      <TableShimmer rows={4} cols={4} />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Shoot Summary Dashboard" 
        description={`Welcome back, ${user?.name || 'Shoot Rep'}. Here is your shoot schedule overview.`} 
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Today's Shoots" 
          value={stats.todayShoots} 
          icon={Camera} 
          className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20"
        />
        <StatCard 
          title="Upcoming" 
          value={stats.upcoming} 
          icon={Calendar} 
          className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20"
        />
        <StatCard 
          title="Pending Uploads" 
          value={stats.pendingUploads} 
          icon={UploadCloud} 
          className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border-amber-500/20"
        />
        <StatCard 
          title="Completed" 
          value={stats.completed} 
          icon={CheckCircle} 
          className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20"
        />
        <StatCard 
          title="Total Scheduled" 
          value={stats.totalScheduled} 
          icon={Clock} 
          className="bg-gradient-to-br from-slate-500/10 to-gray-500/10 border-slate-500/20"
        />
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Camera className="mr-2 h-5 w-5 text-indigo-500" />
          Today & Upcoming Highlights
        </h3>
        {shoots.filter(s => !isTrue(s.driveLinkUploaded)).length === 0 ? (
           <Card className="bg-muted/30 border-dashed border-2">
             <CardContent className="py-10 text-center text-muted-foreground">
               No pending shoots scheduled. Great job!
             </CardContent>
           </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shoots.filter(s => !isTrue(s.driveLinkUploaded)).sort((a, b) => a.shootDate > b.shootDate ? 1 : -1).slice(0, 9).map(shoot => (
              <Card key={shoot.shootId} className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow">
                <div className={cn("h-1 w-full", shoot.shootDate === today ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-indigo-500 to-purple-500")} />
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-sm truncate pr-2">{shoot.clientName || 'Untitled Shoot'}</h4>
                    {shoot.shootDate === today && (
                      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] uppercase">
                        Today
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-3">
                    <div>
                      <p className="font-medium text-[10px] uppercase tracking-wider">Date</p>
                      <p className="text-foreground mt-0.5">{formatDate(shoot.shootDate)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-[10px] uppercase tracking-wider">Time</p>
                      <p className="text-foreground mt-0.5">{shoot.shootStartTime || '-'} - {shoot.shootEndTime || '-'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-[10px] uppercase tracking-wider">Camera</p>
                      <p className="text-foreground mt-0.5">{shoot.camera || '1'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-[10px] uppercase tracking-wider">Status</p>
                      <p className="text-amber-500 font-medium mt-0.5">Pending Upload</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      <div className="mt-4 flex justify-center">
         <Button variant="outline" asChild>
           <a href="/shoot">View Detailed Shoot Schedule</a>
         </Button>
      </div>
    </div>
  );
}
