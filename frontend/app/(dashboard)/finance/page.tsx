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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, TrendingUp, AlertCircle, FileText, Send, Download, RefreshCw, CalendarIcon, Users, Plus, Edit, Trash2 } from 'lucide-react';
import { useFinance, FinanceFilters } from '@/lib/hooks/use-finance';
import { useExpenses, ExpenseFilters, Expense } from '@/lib/hooks/use-expenses';
import { formatINR, formatDate } from '@/lib/formatter';
import { useWorkflow } from '@/hooks/use-workflow';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ExpenseDialog } from '@/components/finance/ExpenseDialog';

const COLORS = ['hsl(var(--theme-accent))', 'hsl(var(--success))', 'hsl(var(--theme-warning))', 'hsl(var(--chart-4))', 'hsl(var(--danger))', 'hsl(var(--muted-foreground))', 'hsl(var(--chart-5))', 'hsl(var(--chart-2))'];

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
  const [activeTab, setActiveTab] = useState('revenue');
  
  // Finance State
  const [financeFilters, setFinanceFilters] = useState<FinanceFilters>({
    salesperson: 'all',
    serviceType: 'all',
    paymentStatus: 'all',
    startDate: '',
    endDate: ''
  });
  const { data: financeData, loading: financeLoading, error: financeError, refresh: refreshFinance } = useFinance(financeFilters);

  // Expenses State
  const [expenseFilters, setExpenseFilters] = useState<ExpenseFilters>({
    category: 'all',
    startDate: '',
    endDate: ''
  });
  const { data: expenseData, loading: expenseLoading, error: expenseError, refresh: refreshExpenses, createExpense, updateExpense, deleteExpense } = useExpenses(expenseFilters);
  
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const { user } = useAuth();
  const { triggerWorkflow, triggering } = useWorkflow();

  const handleFinanceFilterChange = (key: keyof FinanceFilters, value: string) => {
    setFinanceFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExpenseFilterChange = (key: keyof ExpenseFilters, value: string) => {
    setExpenseFilters(prev => ({ ...prev, [key]: value }));
  };

  const sendLink = async (inv: any) => {
    await triggerWorkflow('payment.link.sent', {
      projectId: inv.projectId,
      data: { invoiceId: inv.id, amount: inv.amount, type: inv.type },
      triggeredBy: user?.name ?? 'manager',
    });
    toast.success('Payment Link Sent', { description: `${formatINR(inv.amount)} link sent to ${inv.clientName}` });
  };

  const handleSaveExpense = async (data: Partial<Expense>) => {
    if (selectedExpense) {
      await updateExpense(selectedExpense._id, data);
      toast.success('Expense updated');
    } else {
      await createExpense(data);
      toast.success('Expense added');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      await deleteExpense(id);
      toast.success('Expense deleted');
    }
  };

  const revenueColumns: Column<any>[] = [
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

  const expenseColumns: Column<Expense>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (i) => i.date,
      cell: (i) => <span className="text-sm">{formatDate(i.date)}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      sortValue: (i) => i.category,
      cell: (i) => <span className="font-medium">{i.category}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      cell: (i) => <span className="text-sm text-muted-foreground line-clamp-1">{i.description || '-'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (i) => i.amount,
      cell: (i) => <span className="tabular-nums font-medium">{formatINR(i.amount)}</span>,
    },
    {
      key: 'recordedBy',
      header: 'Recorded By',
      cell: (i) => <span className="text-xs text-muted-foreground">{i.recordedBy}</span>,
    },
    {
      key: 'actions',
      header: '',
      cell: (i) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); setSelectedExpense(i); setExpenseDialogOpen(true); }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
            onClick={(e) => { e.stopPropagation(); handleDeleteExpense(i._id); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (financeError || expenseError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Finance Dashboard" description="Revenue analytics, invoicing, expenses, and payment tracking" />
        <Card className="border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-red-400 mb-4 font-medium">Failed to load finance data: {financeError || expenseError}</p>
          <Button onClick={() => { refreshFinance(); refreshExpenses(); }} variant="outline" className="border-red-500/40 hover:bg-red-500/20 gap-2">
            <RefreshCw className="h-4 w-4" /> Retry Connection
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader title="Finance Dashboard" description="Revenue analytics, invoicing, expenses, and payment tracking" />
        {activeTab === 'revenue' && (
          <Button variant="outline" onClick={() => exportToCSV(financeData?.invoices || [], 'finance_export.csv')} className="shrink-0" disabled={financeLoading}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        )}
        {activeTab === 'expenses' && (
          <Button onClick={() => { setSelectedExpense(null); setExpenseDialogOpen(true); }} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" /> Add Expense
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="revenue">Revenue & Invoicing</TabsTrigger>
          <TabsTrigger value="expenses">Expense Module</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-6">
          {/* Revenue Filter Bar */}
          <Card className="bg-[hsl(var(--card))]/60 border-[hsl(var(--border))] shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                  <Input
                    type="date"
                    value={financeFilters.startDate || ''}
                    onChange={(e) => handleFinanceFilterChange('startDate', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground">End Date</label>
                  <Input
                    type="date"
                    value={financeFilters.endDate || ''}
                    onChange={(e) => handleFinanceFilterChange('endDate', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                  <label className="text-xs font-medium text-muted-foreground">Salesperson</label>
                  <Select value={financeFilters.salesperson} onValueChange={(val) => handleFinanceFilterChange('salesperson', val)}>
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
                  <Select value={financeFilters.paymentStatus} onValueChange={(val) => handleFinanceFilterChange('paymentStatus', val)}>
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
                    value={financeFilters.clientId || ''}
                    onChange={(e) => handleFinanceFilterChange('clientId', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {financeLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="animate-pulse bg-[hsl(var(--card))]/50 border-[hsl(var(--border))] h-[104px]" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card className="animate-pulse bg-[hsl(var(--card))]/50 border-[hsl(var(--border))] h-[300px]" />
                 <Card className="animate-pulse bg-[hsl(var(--card))]/50 border-[hsl(var(--border))] h-[300px]" />
              </div>
              <Card className="animate-pulse bg-[hsl(var(--card))]/50 border-[hsl(var(--border))] h-[400px]" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Collected" value={formatINR(financeData?.metrics.totalCollected || 0)} icon={Wallet} />
                <StatCard title="Pending" value={formatINR(financeData?.metrics.pendingAmount || 0)} icon={TrendingUp} />
                <StatCard title="Overdue" value={formatINR(financeData?.metrics.overdueAmount || 0)} icon={AlertCircle} />
                <StatCard title="Total Invoices" value={financeData?.metrics.totalInvoicesCount || 0} icon={FileText} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue By Service */}
                <Card className="bg-[hsl(var(--card))]/50 border-[hsl(var(--border))] col-span-1 lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Revenue by Service (Collected)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px] mt-4">
                    {financeData?.breakdowns.revenueByService.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={financeData.breakdowns.revenueByService} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                          <RechartsTooltip 
                            cursor={{ fill: 'hsl(var(--border))', opacity: 0.4 }}
                            contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                            formatter={(value: number) => [formatINR(value), 'Revenue']}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {financeData.breakdowns.revenueByService.map((entry, index) => (
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
                <Card className="bg-[hsl(var(--card))]/50 border-[hsl(var(--border))]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Acquisition Source</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px] mt-4 flex flex-col">
                    {financeData?.breakdowns.upsellVsNewSale.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={financeData.breakdowns.upsellVsNewSale}
                            cx="50%"
                            cy="45%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {financeData.breakdowns.upsellVsNewSale.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--success))' : 'hsl(var(--theme-accent))'} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                            formatter={(value: number) => [formatINR(value), 'Revenue']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No data available</div>
                    )}
                    <div className="flex justify-center gap-6 mt-auto pb-4">
                       <div className="flex items-center gap-2 text-sm text-muted-foreground"><div className="w-3 h-3 rounded-full bg-success"></div>New Sale</div>
                       <div className="flex items-center gap-2 text-sm text-muted-foreground"><div className="w-3 h-3 rounded-full bg-theme-accent"></div>Upsell</div>
                    </div>
                  </CardContent>
                </Card>

                 {/* Aging Breakdown */}
                 <Card className="bg-[hsl(var(--card))]/50 border-[hsl(var(--border))] col-span-1 lg:col-span-3">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Receivables Aging (Unpaid/Overdue)</CardTitle>
                      <CardDescription>Amount pending organized by days since invoice generation</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-4">
                     <div className="grid grid-cols-3 gap-4">
                        {financeData?.breakdowns.aging.map((tier, idx) => (
                          <div key={idx} className="bg-[hsl(var(--background))] rounded-xl p-5 border border-[hsl(var(--border))] flex flex-col items-center justify-center text-center">
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

              <Card className="bg-[hsl(var(--card))]/50 border-[hsl(var(--border))]">
                <CardHeader>
                  <CardTitle>Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable 
                    data={financeData?.invoices || []} 
                    columns={revenueColumns} 
                    searchKeys={['clientName', 'id', 'serviceType', 'assignedTo', 'clientPhone']}
                    searchPlaceholder="Search invoices..." 
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          {/* Expenses Filter Bar */}
          <Card className="bg-[hsl(var(--card))]/60 border-[hsl(var(--border))] shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                  <Input
                    type="date"
                    value={expenseFilters.startDate || ''}
                    onChange={(e) => handleExpenseFilterChange('startDate', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground">End Date</label>
                  <Input
                    type="date"
                    value={expenseFilters.endDate || ''}
                    onChange={(e) => handleExpenseFilterChange('endDate', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <Select value={expenseFilters.category} onValueChange={(val) => handleExpenseFilterChange('category', val)}>
                    <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Travel">Travel</SelectItem>
                      <SelectItem value="Equipment">Equipment</SelectItem>
                      <SelectItem value="Software">Software</SelectItem>
                      <SelectItem value="Office">Office</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Contractors">Contractors</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {expenseLoading ? (
            <div className="space-y-6">
              <Card className="animate-pulse bg-[hsl(var(--card))]/50 border-[hsl(var(--border))] h-[104px] w-full max-w-sm" />
              <Card className="animate-pulse bg-[hsl(var(--card))]/50 border-[hsl(var(--border))] h-[400px]" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Total Expenses" value={formatINR(expenseData?.metrics.totalExpense || 0)} icon={Wallet} />
                <StatCard title="Expense Count" value={expenseData?.expenses.length || 0} icon={FileText} />
              </div>

              <Card className="bg-[hsl(var(--card))]/50 border-[hsl(var(--border))]">
                <CardHeader>
                  <CardTitle>Registered Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable 
                    data={expenseData?.expenses || []} 
                    columns={expenseColumns} 
                    searchKeys={['category', 'description', 'recordedBy']}
                    searchPlaceholder="Search expenses..." 
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <ExpenseDialog 
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        expense={selectedExpense}
        onSave={handleSaveExpense}
      />
    </div>
  );
}
