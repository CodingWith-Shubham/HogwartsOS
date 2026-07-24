import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export function StatCard({ title, value, description, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn('overflow-hidden card-hover-effect', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary border border-border">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1.5">
            <span
              className={cn(
                'text-xs font-medium',
                trend.positive ? 'text-[#3FB950]' : 'text-[#F85149]'
              )}
            >
              {trend.positive ? '↑' : '↓'} {trend.value}
            </span>
            <span className="text-xs text-muted-foreground">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
