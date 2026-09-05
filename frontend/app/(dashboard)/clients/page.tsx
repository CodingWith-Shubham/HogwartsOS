'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Building2, Wallet, TrendingUp, Loader2, Plus, Edit, ArrowUpCircle, UserCheck, Shuffle, Download, ShoppingCart } from 'lucide-react';
import { LeadStatusBadge } from '@/components/shared/Badges';
import { formatINR } from '@/lib/formatter';
import { ClientsShimmer } from '@/components/shared/ShimmerLoader';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from 'sonner';
import { ClientProfileModal } from '@/components/client-profile/ClientProfileModal';
import {
  UpsellCrossSellModal,
  type UpsellCrossSellType,
} from '@/components/clients/UpsellCrossSellModal';
import {
  UpsellCrossSellPipeline,
  UpsellStatusBadge,
  type UpsellCrossSellEntry,
} from '@/components/clients/UpsellCrossSellPipeline';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const SERVICE_LABELS: Record<string, string> = {
  podcast: 'Podcast',
  reel: 'Reel',
  brand_film: 'Brand Film',
  product_video: 'Product Video',
  event_coverage: 'Event Coverage',
  social_media: 'Social Media',
};

const CLIENT_STATUSES = [
  'New Lead',
  'Proposal Sent',
  'Proposal Accepted',
  'Awaiting Payment',
  'Shoot Scheduled',
  'Editing',
  'Draft Sent',
  'Revision Requested',
  'Delivered',
  'Closed',
  'On Hold',
];

export default function ClientsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [shoots, setShoots] = useState<any[]>([]);
  const [editing, setEditing] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Form states
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [clientName, setClientName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [service, setService] = useState('podcast');
  const [clientEmail, setClientEmail] = useState('');
  const [cost, setCost] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState('New Lead');
  const [submitting, setSubmitting] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedProfileClient, setSelectedProfileClient] = useState<any>(null);

  // Upsell & Cross-Sell pipeline state (isolated from the Lead model)
  const [ucxModalOpen, setUcxModalOpen] = useState(false);
  const [ucxType, setUcxType] = useState<UpsellCrossSellType>('upsell');
  const [selectedUcxClient, setSelectedUcxClient] = useState<any | null>(null);
  const [ucxEntries, setUcxEntries] = useState<UpsellCrossSellEntry[]>([]);
  const [ucxClients, setUcxClients] = useState<any[]>([]);
  const [ucxPayments, setUcxPayments] = useState<Record<string, any[]>>({});

  const fetchUpsells = useCallback(async () => {
    try {
      const [listRes, summaryRes, paymentsRes] = await Promise.all([
        authFetch('/api/upsell-crosssell', { cache: 'no-store' }),
        authFetch('/api/upsell-crosssell/clients-summary', { cache: 'no-store' }),
        // Every payment tagged to an upsell/cross-sell entry (screenshot + verify trail)
        authFetch('/api/payments?upsell=1', { cache: 'no-store' }),
      ]);
      const listPayload = await listRes.json().catch(() => ({}));
      const summaryPayload = await summaryRes.json().catch(() => ({}));
      const paymentsPayload = await paymentsRes.json().catch(() => ({}));
      if (listRes.ok) setUcxEntries(listPayload.data?.entries ?? []);
      if (summaryRes.ok) setUcxClients(summaryPayload.data?.clients ?? []);
      if (paymentsRes.ok) {
        const grouped: Record<string, any[]> = {};
        (paymentsPayload.payments ?? []).forEach((payment: any) => {
          const key = String(payment.upsellCrossSellId ?? '').trim();
          if (!key) return;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(payment);
        });
        setUcxPayments(grouped);
      }
    } catch (error) {
      console.error('Error fetching upsell/cross-sell data:', error);
    }
  }, []);

  const triggerFetch = useCallback(async () => {
    try {
      const [clientsRes, realtimeRes, shootsRes, editingRes, usersRes] = await Promise.all([
        fetch('/api/clients', { cache: 'no-store' }),
        fetch('/api/realtime-data', { cache: 'no-store' }),
        fetch('/api/shoots', { cache: 'no-store' }),
        fetch('/api/editing', { cache: 'no-store' }),
        fetch('/api/users', { cache: 'no-store' }),
      ]);

      const [clientsJson, realtimeJson, shootsJson, editingJson, usersJson] = await Promise.all([
        clientsRes.json(),
        realtimeRes.json(),
        shootsRes.json(),
        editingRes.json(),
        usersRes.json(),
      ]);

      if (clientsRes.ok) setLeads(clientsJson.leads ?? []);
      if (realtimeRes.ok) setInvoices(realtimeJson.invoices ?? []);
      if (shootsRes.ok) setShoots(shootsJson.shoots ?? []);
      if (editingRes.ok) setEditing(editingJson.editing ?? []);
      if (usersRes.ok) {
        const list = usersJson.users ?? [];
        setUsersList(list);
        if (list.length > 0 && !assignedTo) {
          setAssignedTo(list[0].name);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching clients page data:', error);
    }
  }, [assignedTo]);

  useEffect(() => {
    let mounted = true;
    if (mounted) {
      triggerFetch();
    }
    return () => {
      mounted = false;
    };
  }, [triggerFetch]);

  useEffect(() => {
    fetchUpsells();
  }, [fetchUpsells]);

  // Poll the upsell/cross-sell pipeline so client-side events (proposal
  // accepted/revoked, screenshot uploads) appear without a manual refresh —
  // same 30s cadence as the sales dashboard.
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchUpsells();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchUpsells]);

  const handleAddClient = () => {
    setEditingClient(null);
    setClientName('');
    setContactNumber('');
    setWhatsapp('');
    setService('podcast');
    setClientEmail('');
    setCost('');
    if (usersList.length > 0) {
      setAssignedTo(usersList[0].name);
    } else {
      setAssignedTo('');
    }
    setStatus('New Lead');
    setSheetOpen(true);
  };

  const handleEditClient = (c: any) => {
    const lead = leads.find((l) => l.leadId === c.id);
    if (!lead) return;

    setEditingClient(lead);
    setClientName(lead.name || '');
    setContactNumber(lead.phoneNumber || '');
    setWhatsapp(lead.whatsapp || '');

    const serviceKey = Object.keys(SERVICE_LABELS).find((key) => SERVICE_LABELS[key] === lead.servicePitched) || lead.servicePitched || 'podcast';
    setService(serviceKey);

    setClientEmail(lead.clientEmail || '');
    setCost(lead.cost || '');
    setAssignedTo(lead.assignedTo || '');
    setStatus(lead.status || 'New Lead');
    setSheetOpen(true);
  };

  // Isolated upsell / cross-sell modals — never touch the Lead record
  const handleNewUpsell = (c: any) => {
    const lead = leads.find((l) => l.leadId === c.id);
    if (!lead) return;
    setSelectedUcxClient(lead);
    setUcxType('upsell');
    setUcxModalOpen(true);
  };

  const handleNewCrossSell = (c: any) => {
    const lead = leads.find((l) => l.leadId === c.id);
    if (!lead) return;
    setSelectedUcxClient(lead);
    setUcxType('crosssell');
    setUcxModalOpen(true);
  };

  const handleNewSale = (c: any) => {
    const lead = leads.find((l) => l.leadId === c.id);
    if (!lead) return;
    setSelectedUcxClient(lead);
    setUcxType('newsale');
    setUcxModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = '/api/clients';
      const method = editingClient ? 'PUT' : 'POST';
      const payload: any = {
        name: clientName,
        phoneNumber: contactNumber,
        whatsapp,
        service,
        assignedTo,
        clientEmail,
        cost,
      };

      if (editingClient) {
        payload.leadId = editingClient.leadId;
        payload.status = status;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          toast.warning('Duplicate Lead Detected', {
            description: data.error ?? 'A lead with this phone number or email already exists.',
          });
          return;
        }
        throw new Error(data.error ?? 'Failed to save client');
      }

      toast.success(editingClient ? 'Client Updated' : 'Client Created', {
        description: editingClient ? 'Client details updated in Google Sheets' : 'New client added to Google Sheets',
      });

      setSheetOpen(false);
      setLoading(true);
      await triggerFetch();
    } catch (err) {
      toast.error('Error saving client', {
        description: err instanceof Error ? err.message : 'Unknown error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ClientsShimmer />;
  }

  // 1. Stats calculation
  const totalClients = leads.filter((l) => l.proposalAccepted).length;
  const activeClients = leads.filter((l) => l.proposalAccepted && !['closed', 'delivered'].includes((l.status || '').toLowerCase())).length;
  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
  const leadsCount = leads.filter((l) => !l.proposalAccepted).length;
  const upsellCount = ucxClients.reduce((sum, c) => sum + (c.upsellCount || 0), 0);
  const crosssellCount = ucxClients.reduce((sum, c) => sum + (c.crosssellCount || 0), 0);
  const newsaleCount = ucxClients.reduce((sum, c) => sum + (c.newsaleCount || 0), 0);

  // 2. Clients list mapping
  const clientsData = leads.map((lead) => {
    const clientInvoices = invoices.filter((i) => i.projectId === lead.leadId && i.status === 'paid');
    const clientRevenue = clientInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    const clientShoots = shoots.filter((s) => s.leadId === lead.leadId).length;
    const clientEdits = editing.filter((e) => e.leadId === lead.leadId).length;
    const totalProjects = Math.max(clientShoots, clientEdits);

    return {
      id: lead.leadId,
      name: lead.name || 'Unknown Client',
      contact: lead.phoneNumber || '—',
      email: lead.clientEmail || '—',
      service: lead.servicePitched || '—',
      totalProjects,
      totalRevenue: clientRevenue,
      status: lead.status || 'New Lead',
      whatsapp: lead.whatsapp || '',
      profileImage: lead.profileImage || '',
      ucxBadges: ucxClients
        .filter((summary) => summary.clientLeadId === lead.leadId)
        .flatMap((summary) => {
          const badges: { status: string; type: 'upsell' | 'crosssell' | 'newsale' }[] = [];
          if (summary.upsellCount > 0) badges.push({ status: summary.latestStatus, type: 'upsell' });
          if (summary.crosssellCount > 0) badges.push({ status: summary.latestStatus, type: 'crosssell' });
          if (summary.newsaleCount > 0) badges.push({ status: summary.latestStatus, type: 'newsale' });
          return badges;
        }),
    };
  });

  const isEditable = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'sales';

  const ServiceBadge = ({ status, type }: { status: string; type: 'upsell' | 'crosssell' | 'newsale' }) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {type === 'crosssell' ? (
        <Shuffle className="h-3 w-3 text-sky-500" />
      ) : type === 'newsale' ? (
        <ShoppingCart className="h-3 w-3 text-green-500" />
      ) : (
        <TrendingUp className="h-3 w-3 text-amber-500" />
      )}
      <UpsellStatusBadge status={status} />
    </div>
  );

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Client / Company',
      sortable: true,
      sortValue: (c) => c.name,
      mobilePrimary: true,
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {c.profileImage ? (
              <Image src={c.profileImage} alt={c.name} fill sizes="32px" className="h-full w-full object-cover" />
            ) : (
              <AvatarFallback className="bg-secondary border border-border text-xs">
                {c.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.email}</p>
            {(c.ucxBadges as { status: string; type: 'upsell' | 'crosssell' | 'newsale' }[]).length > 0 && (
              <div className="mt-1 space-y-1">
                {c.ucxBadges.map((badge: { status: string; type: 'upsell' | 'crosssell' | 'newsale' }, idx: number) => (
                  <ServiceBadge key={idx} status={badge.status} type={badge.type} />
                ))}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (c) => (
        <div>
          <p className="text-sm">{c.contact}</p>
          {c.whatsapp && <p className="text-xs text-muted-foreground">WA: {c.whatsapp}</p>}
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: 'projects',
      header: 'Projects',
      sortable: true,
      sortValue: (c) => c.totalProjects,
      cell: (c) => <span className="tabular-nums">{c.totalProjects}</span>,
      hideOnMobile: true,
    },
    {
      key: 'revenue',
      header: 'Revenue',
      sortable: true,
      sortValue: (c) => c.totalRevenue,
      cell: (c) => <span className="tabular-nums font-medium">{formatINR(c.totalRevenue)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => <LeadStatusBadge status={c.status} />,
      mobileHighlight: true,
    },
    {
      key: 'actions',
      header: 'Actions',
      mobileFooter: true,
      cell: (c: any) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Client Profile — create / edit"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedProfileClient({
                name: c.name,
                email: c.email !== '—' ? c.email : undefined,
                phone: c.contact !== '—' ? c.contact : undefined,
              });
              setProfileModalOpen(true);
            }}
          >
            <UserCheck className="h-4 w-4 text-purple-500 hover:text-purple-600" />
          </Button>
          {isEditable && (
            <>
              <Button
                variant="ghost"
                size="icon"
                title="Initiate Upsell (new pipeline)"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNewUpsell(c);
                }}
              >
                <TrendingUp className="h-4 w-4 text-amber-500 hover:text-amber-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Initiate Cross-Sell (different service category)"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNewCrossSell(c);
                }}
              >
                <Shuffle className="h-4 w-4 text-sky-500 hover:text-sky-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Initiate New Sale"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNewSale(c);
                }}
              >
                <ShoppingCart className="h-4 w-4 text-green-500 hover:text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Edit Client"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditClient(c);
                }}
              >
                <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clients"
        description="B2B client directory and relationship history"
        actions={
          <div className="flex items-center gap-2">
            {user?.role === 'super_admin' && (
              <Button size="sm" variant="outline" onClick={() => {
                import('@/lib/export').then(({ exportToExcel }) => exportToExcel(leads, 'clients_data'));
              }}>
                <Download className="mr-1.5 h-4 w-4" />
                Export
              </Button>
            )}
            {isEditable && (
              <Button size="sm" onClick={handleAddClient}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Client
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue={"clients" as string} className="w-full">
        <div className="tabs-scroll-container mb-6">
          <TabsList className="flex w-max min-w-full h-auto gap-2 p-1 bg-transparent border">
            <TabsTrigger value="clients" className="data-[state=active]:bg-muted shrink-0">
              <Users className="mr-1.5 h-4 w-4 shrink-0" /> All Clients
            </TabsTrigger>
            <TabsTrigger value="upsells" className="data-[state=active]:bg-muted shrink-0">
              <TrendingUp className="mr-1.5 h-4 w-4 text-amber-500 shrink-0" /> Upsells ({upsellCount})
            </TabsTrigger>
            <TabsTrigger value="crosssells" className="data-[state=active]:bg-muted shrink-0">
              <Shuffle className="mr-1.5 h-4 w-4 text-sky-500 shrink-0" /> Cross-Sells ({crosssellCount})
            </TabsTrigger>
            <TabsTrigger value="newsales" className="data-[state=active]:bg-muted shrink-0">
              <ShoppingCart className="mr-1.5 h-4 w-4 text-green-500 shrink-0" /> New Sales ({newsaleCount})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="clients" className="mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
            <StatCard title="Total Clients" value={totalClients} icon={Users} />
            <StatCard title="Active" value={activeClients} icon={Building2} />
            <StatCard title="Total Revenue" value={formatINR(totalRevenue)} icon={Wallet} />
            <StatCard title="Leads" value={leadsCount} icon={TrendingUp} />
            <StatCard title="Upsells" value={upsellCount} icon={ArrowUpCircle} />
            <StatCard title="Cross-Sells" value={crosssellCount} icon={Shuffle} />
            <StatCard title="New Sales" value={newsaleCount} icon={ShoppingCart} />
          </div>

          <DataTable
            data={clientsData}
            columns={columns}
            searchKeys={['name', 'email', 'contact']}
            searchPlaceholder="Search clients..."
            onRowClick={(c) => {
              const clientProjects = editing.filter((p) => p.leadId === c.id);
              console.log('Client projects:', clientProjects);
            }}
          />
        </TabsContent>

        <TabsContent value="upsells" className="mt-0">
          <UpsellCrossSellPipeline
            entries={ucxEntries.filter((e) => e.type === 'upsell')}
            showClientName
            canAdvance={isEditable}
            canDelete={true}
            paymentsByEntryId={ucxPayments}
            onRefresh={fetchUpsells}
          />
        </TabsContent>

        <TabsContent value="crosssells" className="mt-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cross-Sell Clients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ucxClients.filter((c) => c.crosssellCount > 0).length === 0 ? (
                <p className="text-sm text-muted-foreground">No cross-sell clients yet.</p>
              ) : (
                ucxClients
                  .filter((c) => c.crosssellCount > 0)
                  .map((client) => {
                    const statuses = ucxEntries
                      .filter((e) => e.clientLeadId === client.clientLeadId && e.type === 'crosssell')
                      .map((e) => e.status);
                    const latestStatus = client.latestStatus || statuses[0] || 'initiated';
                    return (
                      <div
                        key={client.clientLeadId}
                        className="flex flex-col gap-1 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm">{client.clientName}</p>
                            <UpsellStatusBadge status={latestStatus} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {(client.clientEmail || '') || '—'} · {client.crosssellCount} active cross-sell
                            {client.crosssellCount > 1 ? 's' : ''}
                          </p>
                        </div>
                        {user?.role !== 'manager' && (
                          <p className="text-xs text-muted-foreground md:max-w-[40%] md:text-right">
                            Latest: {latestStatus.replace(/_/g, ' ')}
                          </p>
                        )}
                      </div>
                    );
                  })
              )}
            </CardContent>
          </Card>

          <UpsellCrossSellPipeline
            entries={ucxEntries.filter((e) => e.type === 'crosssell')}
            showClientName
            canAdvance={isEditable}
            canDelete={true}
            paymentsByEntryId={ucxPayments}
            onRefresh={fetchUpsells}
          />
        </TabsContent>

        <TabsContent value="newsales" className="mt-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New Sale Clients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ucxClients.filter((c) => c.newsaleCount > 0).length === 0 ? (
                <p className="text-sm text-muted-foreground">No new sale clients yet.</p>
              ) : (
                ucxClients
                  .filter((c) => c.newsaleCount > 0)
                  .map((client) => {
                    const statuses = ucxEntries
                      .filter((e) => e.clientLeadId === client.clientLeadId && e.type === 'newsale')
                      .map((e) => e.status);
                    const latestStatus = client.latestStatus || statuses[0] || 'initiated';
                    return (
                      <div
                        key={client.clientLeadId}
                        className="flex flex-col gap-1 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm">{client.clientName}</p>
                            <UpsellStatusBadge status={latestStatus} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {(client.clientEmail || '') || '—'} · {client.newsaleCount} active new sale
                            {client.newsaleCount > 1 ? 's' : ''}
                          </p>
                        </div>
                        {user?.role !== 'manager' && (
                          <p className="text-xs text-muted-foreground md:max-w-[40%] md:text-right">
                            Latest: {latestStatus.replace(/_/g, ' ')}
                          </p>
                        )}
                      </div>
                    );
                  })
              )}
            </CardContent>
          </Card>

          <UpsellCrossSellPipeline
            entries={ucxEntries.filter((e) => e.type === 'newsale')}
            showClientName
            canAdvance={isEditable}
            canDelete={true}
            paymentsByEntryId={ucxPayments}
            onRefresh={fetchUpsells}
          />
        </TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingClient ? 'Edit Client' : 'New Client'}</SheetTitle>
            <SheetDescription>
              {editingClient ? 'Modify details for this customer in Google Sheets' : 'Create a new B2B client record in Google Sheets'}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client / Company Name</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input
                id="contactNumber"
                placeholder="+91 ..."
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp Username</Label>
              <Input
                id="whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service">Service Required</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger id="service">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="podcast">Podcast</SelectItem>
                  <SelectItem value="reel">Reel</SelectItem>
                  <SelectItem value="brand_film">Brand Film</SelectItem>
                  <SelectItem value="product_video">Product Video</SelectItem>
                  <SelectItem value="event_coverage">Event Coverage</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Client Email</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="client@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost in ₹</Label>
              <Input
                id="cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignTo">Assign To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id="assignTo">
                  <SelectValue placeholder="Select sales/team member" />
                </SelectTrigger>
                <SelectContent>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.name}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editingClient && (
              <div className="space-y-2">
                <Label htmlFor="status">Lead Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full mt-4">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <UpsellCrossSellModal
        open={ucxModalOpen}
        onOpenChange={setUcxModalOpen}
        type={ucxType}
        client={selectedUcxClient}
        salesMembers={usersList.map(u => u.name)}
        onSuccess={fetchUpsells}
      />

      <ClientProfileModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        clientInfo={selectedProfileClient}
        onSuccess={() => triggerFetch()}
      />
    </div>
  );
}
