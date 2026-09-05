import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { formatINR } from '@/lib/formatter';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from 'sonner';
import { Loader2, Target, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

interface SalesTarget {
  id: string;
  _id: string;
  salesPersonId: string;
  salesPersonName: string;
  period: string;
  targetAmount: number;
  achieved: number;
  remaining: number;
  achievementPercentage: number;
}

export function SalesTargetTab({ salesMembers }: { salesMembers: string[] }) {
  const { user } = useAuth();
  const isManager = ['manager', 'admin', 'super_admin'].includes(user?.role || '');

  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [setTargetOpen, setSetTargetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedRep, setSelectedRep] = useState(salesMembers[0] || '');
  const [targetAmount, setTargetAmount] = useState('');

  const fetchTargets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/sales-targets?period=${period}`);
      const data = await res.json();
      if (res.ok) {
        setTargets((data.targets || []).map((t: any) => ({ ...t, id: t._id })));
      } else {
        toast.error(data.error || 'Failed to fetch targets');
      }
    } catch (err) {
      toast.error('Network error while fetching targets');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRep || !targetAmount) return;

    setSaving(true);
    try {
      const res = await authFetch('/api/sales-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesPersonId: selectedRep,
          salesPersonName: selectedRep,
          period,
          targetAmount: Number(targetAmount),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Target saved successfully');
        setSetTargetOpen(false);
        fetchTargets();
      } else {
        toast.error(data.error || 'Failed to save target');
      }
    } catch (err) {
      toast.error('Network error while saving target');
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => {
    let totalTarget = 0;
    let totalAchieved = 0;
    let onTrackCount = 0;

    targets.forEach(t => {
      totalTarget += t.targetAmount;
      totalAchieved += t.achieved;
      if (t.achievementPercentage >= 100) onTrackCount++;
    });

    const overallPercentage = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

    return { totalTarget, totalAchieved, overallPercentage, onTrackCount, totalReps: targets.length };
  }, [targets]);

  const columns: Column<SalesTarget>[] = [
    {
      key: 'salesPersonName',
      header: 'Sales Rep',
      sortable: true,
      cell: (row) => <span className="font-medium">{row.salesPersonName}</span>,
      mobilePrimary: true,
    },
    {
      key: 'targetAmount',
      header: 'Target',
      sortable: true,
      cell: (row) => <span className="tabular-nums font-medium">{formatINR(row.targetAmount)}</span>,
    },
    {
      key: 'achieved',
      header: 'Achieved',
      sortable: true,
      cell: (row) => <span className="tabular-nums text-green-500 font-medium">{formatINR(row.achieved)}</span>,
    },
    {
      key: 'achievementPercentage',
      header: 'Progress',
      sortable: true,
      cell: (row) => {
        let colorClass = 'bg-red-500';
        if (row.achievementPercentage >= 100) colorClass = 'bg-green-500';
        else if (row.achievementPercentage >= 50) colorClass = 'bg-amber-500';

        return (
          <div className="flex flex-col gap-1 w-full max-w-[150px]">
            <div className="flex justify-between text-xs">
              <span>{row.achievementPercentage.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn('h-full rounded-full transition-all duration-500', colorClass)}
                style={{ width: `${Math.min(100, row.achievementPercentage)}%` }}
              />
            </div>
          </div>
        );
      },
      mobileHighlight: true,
    },
    {
      key: 'remaining',
      header: 'Remaining',
      cell: (row) => <span className="tabular-nums text-muted-foreground">{formatINR(row.remaining)}</span>,
      hideOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="period-selector" className="whitespace-nowrap">Period:</Label>
          <Input 
            id="period-selector" 
            type="month" 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="w-[180px]"
          />
        </div>
        
        {isManager && (
          <Button onClick={() => setSetTargetOpen(true)}>
            <Target className="w-4 h-4 mr-2" /> Set Target
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Total Target</CardTitle>
            <Target className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatINR(summary.totalTarget)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Total Achieved</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-green-500">{formatINR(summary.totalAchieved)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            {summary.overallPercentage >= 100 ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{summary.overallPercentage.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Reps On Track</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {summary.onTrackCount} <span className="text-sm font-normal text-muted-foreground">/ {summary.totalReps}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {targets.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center">
                <Target className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">No targets set for {new Date(period + '-01').toLocaleDateString('default', { month: 'long', year: 'numeric' })}</h3>
                {isManager && (
                  <Button variant="outline" className="mt-4" onClick={() => setSetTargetOpen(true)}>
                    Set First Target
                  </Button>
                )}
              </div>
            ) : (
              <DataTable
                data={targets}
                columns={columns}
                searchKeys={['salesPersonName']}
                searchPlaceholder="Search sales rep..."
              />
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={setTargetOpen} onOpenChange={setSetTargetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Sales Target</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTarget} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Period</Label>
              <Input value={new Date(period + '-01').toLocaleDateString('default', { month: 'long', year: 'numeric' })} disabled />
            </div>
            
            <div className="space-y-2">
              <Label>Sales Rep</Label>
              <Select value={selectedRep} onValueChange={setSelectedRep} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select Rep" />
                </SelectTrigger>
                <SelectContent>
                  {salesMembers.map(rep => (
                    <SelectItem key={rep} value={rep}>{rep}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Target Amount (₹)</Label>
              <Input 
                type="number" 
                min="0" 
                step="0.01" 
                value={targetAmount} 
                onChange={(e) => setTargetAmount(e.target.value)} 
                required 
                placeholder="e.g. 500000"
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSetTargetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Target
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
