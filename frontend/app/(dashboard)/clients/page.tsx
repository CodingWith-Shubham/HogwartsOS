'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Building2, Wallet, TrendingUp, Loader2, Plus, Edit } from 'lucide-react';
import { LeadStatusBadge } from '@/components/shared/Badges';
import { formatINR } from '@/lib/formatter';
import { ClientsShimmer } from '@/components/shared/ShimmerLoader';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
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
    };
  });

  const isEditable = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'sales';

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Client / Company',
      sortable: true,
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-secondary border border-border text-xs">
              {c.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.email}</p>
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
    },
    ...(isEditable
      ? [
          {
            key: 'actions',
            header: 'Actions',
            cell: (c: any) => (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditClient(c);
                }}
              >
                <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Clients"
        description="B2B client directory and relationship history"
        actions={
          isEditable && (
            <Button size="sm" onClick={handleAddClient}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Client
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Total Clients" value={totalClients} icon={Users} />
        <StatCard title="Active" value={activeClients} icon={Building2} />
        <StatCard title="Total Revenue" value={formatINR(totalRevenue)} icon={Wallet} />
        <StatCard title="Leads" value={leadsCount} icon={TrendingUp} />
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
    </div>
  );
}
