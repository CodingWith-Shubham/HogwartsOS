'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { PaymentBadge } from '@/components/shared/Badges';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Wallet, TrendingUp, AlertCircle, FileText, Send, Download, RefreshCw, CalendarIcon, Users } from 'lucide-react';
import { useFinance, FinanceFilters } from '@/lib/hooks/use-finance';
import { formatINR, formatDate, titleCase } from '@/lib/formatter';
import { useWorkflow } from '@/hooks/use-workflow';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#58A6FF', '#3FB950', '#D29922', '#E57C2B', '#F85149', '#8B949E', '#A371F7', '#76E3EA'];

function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    toast.error('No data to export');
    return;
  }
  const headers = ['Invoice ID', 'Client Name', 'Amount', 'Type', 'Status', 'Due Date', 'Service Type', 'Salesperson', 'Is Upsell'];
  const rows = data.map(i => [
    `"${i.id}"`,
    `"${i.clientName || 'Unknown'}"`,
    i.amount,
    i.type,
    i.status,
    i.dueDate ? formatDate(i.dueDate) : '',
    i.serviceType,
    i.assignedTo,
    i.isUpsell ? 'Yes' : 'No'
  ]);
  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function FinancePage() {
  const [filters, setFilters] = useState<FinanceFilters>({
    salesperson: 'all',
    serviceType: 'all',
    paymentStatus: 'all',
    startDate: '',
    endDate: ''
  });

  const { data, loading, error, refresh } = useFinance(filters);
  const { user } = useAuth();
  const { triggerWorkflow, triggering } = useWorkflow();

  const handleFilterChange = (key: keyof FinanceFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Custom date handling is now done via the inputs directly, 
  // but we keep handleFilterChange for setting startDate and endDate.

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Finance Dashboard" description="Revenue analytics, invoicing, and payment tracking" />
        <Card className="border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-red-400 mb-4 font-medium">Failed to load finance data: {error}</p>
          <Button onClick={refresh} variant="outline" className="border-red-500/40 hover:bg-red-500/20 gap-2">
            <RefreshCw className="h-4 w-4" /> Retry Connection
          </Button>
        </Card>
      </div>
    );
  }

  const sendLink = async (inv: any) => {
    await triggerWorkflow('payment.link.sent', {
      projectId: inv.projectId,
      data: { invoiceId: inv.id, amount: inv.amount, type: inv.type },
      triggeredBy: user?.name ?? 'manager',
    });
    toast.success('Payment Link Sent', { description: `${formatINR(inv.amount)} link sent to ${inv.clientName}` });
  };

  const columns: Column<any>[] = [
    {
      key: 'id',
      header: 'Invoice',
      sortable: true,
      sortValue: (i) => i.id,
      cell: (i) => <span className="font-mono text-xs text-muted-foreground">{i.id}</span>,
    },
    {
      key: 'client',
      header: 'Client',
      sortable: true,
      sortValue: (i) => i.clientName,
      cell: (i) => (
        <div>
          <div className="font-medium">{i.clientName}</div>
          {i.isUpsell && <span className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold">Upsell</span>}
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Service & Rep',
      cell: (i) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{i.serviceType}</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Users className="w-3 h-3" /> {i.assignedTo}
          </span>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (i) => i.amount,
      cell: (i) => <span className="tabular-nums font-medium">{formatINR(i.amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (i) => <PaymentBadge status={i.status} />,
    },
    {
      key: 'action',
      header: '',
      cell: (i) => (
        <Button
          variant="outline"
          size="sm"
          disabled={i.status === 'paid' || triggering['payment.link.sent']}
          onClick={(e) => { e.stopPropagation(); sendLink(i); }}
        >
          <Send className="mr-1 h-3 w-3" /> Send Link
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader title="Finance Dashboard" description="Revenue analytics, invoicing, and payment tracking" />
        <Button variant="outline" onClick={() => exportToCSV(data?.invoices || [], 'finance_export.csv')} className="shrink-0" disabled={loading}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="bg-[#161B22]/60 border-[#30363D] shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Start Date</label>
              <Input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">End Date</label>
              <Input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-muted-foreground">Salesperson</label>
              <Select value={filters.salesperson} onValueChange={(val) => handleFilterChange('salesperson', val)}>
                <SelectTrigger><SelectValue placeholder="All Sales" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales</SelectItem>
                  <SelectItem value="isha">Isha</SelectItem>
                  <SelectItem value="krishna">Krishna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={filters.paymentStatus} onValueChange={(val) => handleFilterChange('paymentStatus', val)}>
                <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending/Partial</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Search Client/Invoice</label>
              <Input 
                placeholder="Type to filter..." 
                value={filters.clientId || ''}
                onChange={(e) => handleFilterChange('clientId', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse bg-[#161B22]/50 border-[#30363D] h-[104px]" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <Card className="animate-pulse bg-[#161B22]/50 border-[#30363D] h-[300px]" />
             <Card className="animate-pulse bg-[#161B22]/50 border-[#30363D] h-[300px]" />
          </div>
          <Card className="animate-pulse bg-[#161B22]/50 border-[#30363D] h-[400px]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Collected" value={formatINR(data?.metrics.totalCollected || 0)} icon={Wallet} />
            <StatCard title="Pending" value={formatINR(data?.metrics.pendingAmount || 0)} icon={TrendingUp} />
            <StatCard title="Overdue" value={formatINR(data?.metrics.overdueAmount || 0)} icon={AlertCircle} />
            <StatCard title="Total Invoices" value={data?.metrics.totalInvoicesCount || 0} icon={FileText} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue By Service */}
            <Card className="bg-[#161B22]/50 border-[#30363D] col-span-1 lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Revenue by Service (Collected)</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] mt-4">
                {data?.breakdowns.revenueByService.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.breakdowns.revenueByService} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                      <XAxis dataKey="name" stroke="#8B949E" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#8B949E" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                      <RechartsTooltip 
                        cursor={{ fill: '#30363D', opacity: 0.4 }}
                        contentStyle={{ backgroundColor: '#0D1117', borderColor: '#30363D', borderRadius: '8px' }}
                        formatter={(value: number) => [formatINR(value), 'Revenue']}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {data.breakdowns.revenueByService.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No data available</div>
                )}
              </CardContent>
            </Card>

            {/* Upsell vs New Sale */}
            <Card className="bg-[#161B22]/50 border-[#30363D]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Acquisition Source</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] mt-4 flex flex-col">
                {data?.breakdowns.upsellVsNewSale.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.breakdowns.upsellVsNewSale}
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.breakdowns.upsellVsNewSale.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#3FB950' : '#58A6FF'} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#0D1117', borderColor: '#30363D', borderRadius: '8px' }}
                        formatter={(value: number) => [formatINR(value), 'Revenue']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No data available</div>
                )}
                <div className="flex justify-center gap-6 mt-auto pb-4">
                   <div className="flex items-center gap-2 text-sm text-muted-foreground"><div className="w-3 h-3 rounded-full bg-[#3FB950]"></div>New Sale</div>
                   <div className="flex items-center gap-2 text-sm text-muted-foreground"><div className="w-3 h-3 rounded-full bg-[#58A6FF]"></div>Upsell</div>
                </div>
              </CardContent>
            </Card>

             {/* Aging Breakdown */}
             <Card className="bg-[#161B22]/50 border-[#30363D] col-span-1 lg:col-span-3">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Receivables Aging (Unpaid/Overdue)</CardTitle>
                  <CardDescription>Amount pending organized by days since invoice generation</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="mt-4">
                 <div className="grid grid-cols-3 gap-4">
                    {data?.breakdowns.aging.map((tier, idx) => (
                      <div key={idx} className="bg-[#0D1117] rounded-xl p-5 border border-[#30363D] flex flex-col items-center justify-center text-center">
                        <div className="text-muted-foreground text-sm mb-2">{tier.name}</div>
                        <div className={`text-2xl font-bold ${idx === 2 ? 'text-red-400' : idx === 1 ? 'text-orange-400' : 'text-blue-400'}`}>
                          {formatINR(tier.value)}
                        </div>
                      </div>
                    ))}
                 </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#161B22]/50 border-[#30363D]">
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable 
                data={data?.invoices || []} 
                columns={columns} 
                searchKeys={['clientName', 'id', 'serviceType', 'assignedTo', 'clientPhone']}
                searchPlaceholder="Search invoices..." 
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
