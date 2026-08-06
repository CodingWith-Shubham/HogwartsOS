'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UserCheck,
  Building2,
  Search,
  Plus,
  Edit,
  Eye,
  Scissors,
  Sparkles,
  Users,
  ShieldAlert,
  Trash2,
  Link as LinkIcon,
} from 'lucide-react';
import { TableShimmer } from '@/components/shared/ShimmerLoader';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { ClientProfileModal } from '@/components/client-profile/ClientProfileModal';
import { toast } from 'sonner';

export default function ClientProfilesPage() {
  const { user } = useAuth();
  const userRole = user?.role || 'sales';
  const canCreate = ['sales', 'manager', 'admin', 'super_admin', 'editor'].includes(userRole);
  const canDelete = ['manager', 'admin', 'super_admin'].includes(userRole);

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);

      const res = await authFetch(`/api/client-profiles?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.profiles) {
        setProfiles(data.profiles);
      } else {
        toast.error('Failed to load profiles', { description: data.error });
      }
    } catch (err) {
      console.error('Error fetching client profiles:', err);
      toast.error('Could not fetch client profiles');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleCreateNew = () => {
    setSelectedProfileId(null);
    setModalOpen(true);
  };

  const handleViewProfile = (id: string) => {
    setSelectedProfileId(id);
    setModalOpen(true);
  };

  const handleCopyOnboardingLink = async (id: string) => {
    try {
      const res = await authFetch(`/api/client-profiles/${id}/generate-link`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.token) {
        const url = `${window.location.origin}/onboarding/client-profile?token=${data.token}`;
        await navigator.clipboard.writeText(url);
        toast.success('Onboarding link copied to clipboard!');
      } else {
        toast.error('Failed to generate link', { description: data.error });
      }
    } catch (err) {
      console.error('Error generating link:', err);
      toast.error('Could not generate onboarding link');
    }
  };

  // Stats calculation
  const totalProfiles = profiles.length;
  const activeProfiles = profiles.filter((p) => p.clientStatus === 'Active').length;
  const vipProfiles = profiles.filter((p) => p.clientStatus === 'VIP').length;
  const withEditorNotes = profiles.filter(
    (p) => p.editorPreferences && Object.values(p.editorPreferences).some((v) => Boolean(v))
  ).length;

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Client / Company',
      sortable: true,
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
              {p.name
                .split(' ')
                .map((w: string) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm hover:underline cursor-pointer" onClick={() => handleViewProfile(p._id)}>
                {p.name}
              </p>
              {p.clientStatus === 'VIP' && (
                <Badge variant="outline" className="border-amber-500 bg-amber-500/10 text-amber-500 text-[10px] px-1.5 py-0">
                  VIP
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{p.companyName || p.email || 'No company'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Info',
      cell: (p) => (
        <div className="text-xs">
          <p className="font-medium text-foreground">{p.email || '—'}</p>
          <p className="text-muted-foreground">{p.phone || '—'}</p>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: 'preferences',
      header: 'Style & Language',
      cell: (p) => (
        <div className="text-xs space-y-0.5">
          <p className="font-medium">{p.preferredEditingStyle || 'Default Editing'}</p>
          <p className="text-muted-foreground">{p.preferredLanguage || 'English'}</p>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: 'editorNotes',
      header: 'Editor Notes',
      cell: (p) => {
        const hasNotes = p.editorPreferences && Object.values(p.editorPreferences).some((v) => Boolean(v));
        return hasNotes ? (
          <Badge variant="secondary" className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs">
            <Scissors className="mr-1 h-3 w-3" /> Available
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground italic">None yet</span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => (
        <Badge
          variant="outline"
          className={
            p.clientStatus === 'VIP'
              ? 'border-amber-500 bg-amber-500/10 text-amber-500'
              : p.clientStatus === 'Active'
              ? 'border-green-500 bg-green-500/10 text-green-500'
              : 'border-muted bg-muted/20 text-muted-foreground'
          }
        >
          {p.clientStatus || 'Active'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (p) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleViewProfile(p._id);
            }}
            className="h-8 px-2 text-xs"
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" /> View Profile
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyOnboardingLink(p._id);
            }}
            className="h-8 px-2 text-xs border-primary/20 text-primary hover:bg-primary/10"
          >
            <LinkIcon className="mr-1.5 h-3 w-3" /> Copy Link
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Profiles"
        description="Centralized repository of client information, sales history, and editor preferences"
        actions={
          canCreate ? (
            <Button size="sm" onClick={handleCreateNew}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create Profile
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Profiles" value={totalProfiles} icon={Users} />
        <StatCard title="Active Clients" value={activeProfiles} icon={UserCheck} />
        <StatCard title="VIP Clients" value={vipProfiles} icon={Sparkles} />
        <StatCard title="Editor Knowledge" value={withEditorNotes} icon={Scissors} />
      </div>

      <Card className="border-border bg-card">
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <TableShimmer rows={6} cols={5} />
          ) : profiles.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2 border border-dashed rounded-lg">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="font-medium text-sm">No client profiles found.</p>
              {canCreate && (
                <Button variant="outline" size="sm" onClick={handleCreateNew} className="mt-2">
                  <Plus className="mr-1.5 h-4 w-4" /> Create First Profile
                </Button>
              )}
            </div>
          ) : (
            <DataTable
              data={profiles}
              columns={columns}
              onRowClick={(p) => handleViewProfile(p._id)}
            />
          )}
        </CardContent>
      </Card>

      <ClientProfileModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        profileId={selectedProfileId}
        onSuccess={fetchProfiles}
      />
    </div>
  );
}
