'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function StatCardShimmer() {
  return (
    <Card className="shimmer h-[104px] w-full rounded-md border border-border" />
  );
}

export function TableShimmer({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-4">
      {/* Table grid shimmer */}
      <div className="border border-border rounded-md overflow-hidden">
        {/* Table Head */}
        <div className="bg-secondary/50 px-4 py-3.5 flex gap-4 border-b border-border">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="shimmer h-4 flex-1 rounded-md" />
          ))}
        </div>
        {/* Table Rows */}
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="px-4 py-5 flex gap-4 items-center">
              {Array.from({ length: cols }).map((_, c) => (
                <div key={c} className="shimmer h-5 flex-1 rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header Shimmer */}
      <div className="space-y-2">
        <div className="shimmer h-8 w-48 rounded-md" />
        <div className="shimmer h-4 w-72 rounded-md" />
      </div>

      {/* Grid of 4 Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCardShimmer />
        <StatCardShimmer />
        <StatCardShimmer />
        <StatCardShimmer />
      </div>

      {/* Charts & Split Screen Shimmer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border border-border">
          <CardHeader>
            <div className="shimmer h-5 w-32 rounded-md" />
          </CardHeader>
          <CardContent className="h-[250px] flex items-end gap-3 pt-4">
            <div className="shimmer h-full flex-1 rounded-md animate-pulse bg-secondary" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border border-border">
          <CardHeader>
            <div className="shimmer h-5 w-32 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="shimmer h-[60px] w-full rounded-md" />
            <div className="shimmer h-[60px] w-full rounded-md" />
            <div className="shimmer h-[60px] w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ClientsShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header Shimmer */}
      <div className="space-y-2">
        <div className="shimmer h-8 w-48 rounded-md" />
        <div className="shimmer h-4 w-72 rounded-md" />
      </div>

      {/* Grid of 4 Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCardShimmer />
        <StatCardShimmer />
        <StatCardShimmer />
        <StatCardShimmer />
      </div>

      {/* Table Shimmer */}
      <TableShimmer rows={6} cols={5} />
    </div>
  );
}

export function ManagerShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header Shimmer */}
      <div className="space-y-2">
        <div className="shimmer h-8 w-48 rounded-md" />
        <div className="shimmer h-4 w-72 rounded-md" />
      </div>

      {/* Grid of 5 Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCardShimmer />
        <StatCardShimmer />
        <StatCardShimmer />
        <StatCardShimmer />
        <StatCardShimmer />
      </div>

      {/* Main Content Split Shimmer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="shimmer h-9 w-48 rounded-md" />
          <TableShimmer rows={5} cols={4} />
        </div>
        <div className="lg:col-span-1 space-y-4">
          <div className="shimmer h-9 w-48 rounded-md" />
          <Card className="border border-border">
            <CardContent className="space-y-4 py-4">
              <div className="shimmer h-[120px] w-full rounded-md" />
              <div className="shimmer h-[120px] w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
