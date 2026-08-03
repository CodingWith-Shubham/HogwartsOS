'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Building,
  Phone,
  Mail,
  Globe,
  Clock,
  MessageSquare,
  DollarSign,
  Briefcase,
  Sliders,
  Scissors,
  History,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from 'sonner';

interface ClientProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId?: string | null;
  clientInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    companyName?: string;
  };
  onSuccess?: () => void;
}

export function ClientProfileModal({
  open,
  onOpenChange,
  profileId,
  clientInfo,
  onSuccess,
}: ClientProfileModalProps) {
  const { user } = useAuth();
  const userRole = user?.role || 'sales';
  const isEditor = userRole === 'editor';
  const canEditSalesInfo = ['sales', 'manager', 'admin'].includes(userRole);
  const canCreate = canEditSalesInfo;
  const canDelete = ['manager', 'admin'].includes(userRole);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // Form State
  const [formData, setFormData] = useState({
    // Basic Info
    name: '',
    email: '',
    phone: '',
    companyName: '',
    country: '',
    timezone: '',
    preferredCommunication: '',
    alternateContact: '',

    // Sales & Manager Details
    budgetRange: '',
    paymentMethod: '',
    leadSource: '',
    businessType: '',
    internalNotes: '',
    specialInstructions: '',
    clientStatus: 'Active',

    // Client Preferences
    preferredEditingStyle: '',
    preferredLanguage: '',
    brandingGuidelines: '',
    colorPreferences: '',
    fontPreferences: '',
    musicPreferences: '',
    subtitlePreferences: '',
    deliveryFormat: '',
    revisionExpectations: '',
    turnaroundPreference: '',
    additionalPreferences: '',

    // Editor Preferences
    editorPreferences: {
      editingStyleNotes: '',
      transitionPreferences: '',
      motionGraphicsPreferences: '',
      thumbnailNotes: '',
      commonlyUsedAssets: '',
      feedbackSummary: '',
      audioPreferences: '',
      colorGradingNotes: '',
      revisionPatterns: '',
      technicalNotes: '',
      editorObservations: '',
      futureRecommendations: '',
    },
  });

  const [projectHistory, setProjectHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;

    if (profileId) {
      fetchProfile(profileId);
    } else if (clientInfo) {
      // Try to check if duplicate/matching profile exists by email or phone
      checkMatchingProfile(clientInfo);
    } else {
      resetForm();
    }
  }, [open, profileId, clientInfo]);

  const resetForm = (keepNotFound = false) => {
    if (!keepNotFound) {
      setNotFound(false);
    }
    setFormData({
      name: clientInfo?.name || '',
      email: clientInfo?.email || '',
      phone: clientInfo?.phone || '',
      companyName: clientInfo?.companyName || '',
      country: '',
      timezone: '',
      preferredCommunication: 'Email',
      alternateContact: '',
      budgetRange: '',
      paymentMethod: '',
      leadSource: '',
      businessType: '',
      internalNotes: '',
      specialInstructions: '',
      clientStatus: 'Active',
      preferredEditingStyle: '',
      preferredLanguage: '',
      brandingGuidelines: '',
      colorPreferences: '',
      fontPreferences: '',
      musicPreferences: '',
      subtitlePreferences: '',
      deliveryFormat: '',
      revisionExpectations: '',
      turnaroundPreference: '',
      additionalPreferences: '',
      editorPreferences: {
        editingStyleNotes: '',
        transitionPreferences: '',
        motionGraphicsPreferences: '',
        thumbnailNotes: '',
        commonlyUsedAssets: '',
        feedbackSummary: '',
        audioPreferences: '',
        colorGradingNotes: '',
        revisionPatterns: '',
        technicalNotes: '',
        editorObservations: '',
        futureRecommendations: '',
      },
    });
    setProjectHistory([]);
  };

  const checkMatchingProfile = async (info: { email?: string; phone?: string; name?: string }) => {
    setLoading(true);
    try {
      const res = await authFetch('/api/client-profiles/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info),
      });
      const data = await res.json();
      if (data.exists && data.profile) {
        setNotFound(false);
        populateForm(data.profile, []);
        fetchProfileDetails(data.profile._id);
      } else {
        resetForm(true);
        setNotFound(true);
      }
    } catch (err) {
      resetForm(true);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfileDetails = async (id: string) => {
    try {
      const res = await authFetch(`/api/client-profiles/${id}`);
      const data = await res.json();
      if (res.ok && data.profile) {
        populateForm(data.profile, data.projectHistory || []);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      setNotFound(true);
    }
  };

  const fetchProfile = async (id: string) => {
    setLoading(true);
    await fetchProfileDetails(id);
    setLoading(false);
  };

  const populateForm = (p: any, history: any[]) => {
    setFormData({
      name: p.name || '',
      email: p.email || '',
      phone: p.phone || '',
      companyName: p.companyName || '',
      country: p.country || '',
      timezone: p.timezone || '',
      preferredCommunication: p.preferredCommunication || '',
      alternateContact: p.alternateContact || '',
      budgetRange: p.budgetRange || '',
      paymentMethod: p.paymentMethod || '',
      leadSource: p.leadSource || '',
      businessType: p.businessType || '',
      internalNotes: p.internalNotes || '',
      specialInstructions: p.specialInstructions || '',
      clientStatus: p.clientStatus || 'Active',
      preferredEditingStyle: p.preferredEditingStyle || '',
      preferredLanguage: p.preferredLanguage || '',
      brandingGuidelines: p.brandingGuidelines || '',
      colorPreferences: p.colorPreferences || '',
      fontPreferences: p.fontPreferences || '',
      musicPreferences: p.musicPreferences || '',
      subtitlePreferences: p.subtitlePreferences || '',
      deliveryFormat: p.deliveryFormat || '',
      revisionExpectations: p.revisionExpectations || '',
      turnaroundPreference: p.turnaroundPreference || '',
      additionalPreferences: p.additionalPreferences || '',
      editorPreferences: {
        editingStyleNotes: p.editorPreferences?.editingStyleNotes || '',
        transitionPreferences: p.editorPreferences?.transitionPreferences || '',
        motionGraphicsPreferences: p.editorPreferences?.motionGraphicsPreferences || '',
        thumbnailNotes: p.editorPreferences?.thumbnailNotes || '',
        commonlyUsedAssets: p.editorPreferences?.commonlyUsedAssets || '',
        feedbackSummary: p.editorPreferences?.feedbackSummary || '',
        audioPreferences: p.editorPreferences?.audioPreferences || '',
        colorGradingNotes: p.editorPreferences?.colorGradingNotes || '',
        revisionPatterns: p.editorPreferences?.revisionPatterns || '',
        technicalNotes: p.editorPreferences?.technicalNotes || '',
        editorObservations: p.editorPreferences?.editorObservations || '',
        futureRecommendations: p.editorPreferences?.futureRecommendations || '',
      },
    });
    setProjectHistory(history);
  };

  const handleChange = (field: string, val: string) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleEditorPrefChange = (field: string, val: string) => {
    setFormData((prev) => ({
      ...prev,
      editorPreferences: {
        ...prev.editorPreferences,
        [field]: val,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isExisting = profileId || (notFound === false && formData.name);
      const url = isExisting && profileId ? `/api/client-profiles/${profileId}` : '/api/client-profiles';
      const method = isExisting && profileId ? 'PATCH' : 'POST';

      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save client profile');
      }

      toast.success(isExisting ? 'Profile Updated' : 'Profile Created');
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      toast.error('Save failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!profileId) return;
    setDeleting(true);
    try {
      const response = await authFetch(`/api/client-profiles/${profileId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete client profile');
      }
      toast.success('Client profile deleted');
      setDeleteDialogOpen(false);
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      toast.error('Delete failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <User className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  {formData.name ? formData.name : 'Client Profile'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Centralized client repository and historical editor preferences
                </DialogDescription>
              </div>
            </div>
            {formData.clientStatus && (
              <Badge
                variant="outline"
                className={
                  formData.clientStatus === 'VIP'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-semibold'
                    : formData.clientStatus === 'Active'
                    ? 'border-green-500 bg-green-500/10 text-green-500 font-semibold'
                    : 'border-muted bg-muted/20 text-muted-foreground'
                }
              >
                {formData.clientStatus}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : notFound && !profileId ? (
          <div className="py-12 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-lg">This client does not have a profile yet.</h4>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                No matching client profile was found for this client.
              </p>
            </div>
            {canCreate ? (
              <Button
                onClick={() => {
                  setNotFound(false);
                }}
                className="mt-2"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Client Profile
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Only Sales Members and Managers can create client profiles.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 pt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-5 bg-muted/60 p-1 rounded-lg">
                <TabsTrigger value="basic" className="text-xs md:text-sm">
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="sales" className="text-xs md:text-sm">
                  Sales Details
                </TabsTrigger>
                <TabsTrigger value="preferences" className="text-xs md:text-sm">
                  Client Prefs
                </TabsTrigger>
                <TabsTrigger
                  value="editor"
                  className="text-xs md:text-sm bg-purple-500/10 data-[state=active]:bg-purple-600 data-[state=active]:text-white font-medium"
                >
                  Editor Prefs ✨
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs md:text-sm">
                  History ({projectHistory.length})
                </TabsTrigger>
              </TabsList>

              {/* SECTION 1: BASIC INFORMATION */}
              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" /> Client Name *
                    </Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="e.g. John Doe"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-muted-foreground" /> Company Name
                    </Label>
                    <Input
                      value={formData.companyName}
                      onChange={(e) => handleChange('companyName', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="e.g. Acme Corp"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email Address
                    </Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="client@company.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Phone Number
                    </Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="+91 9876543210"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Country
                    </Label>
                    <Input
                      value={formData.country}
                      onChange={(e) => handleChange('country', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="India / USA / UK"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Timezone
                    </Label>
                    <Input
                      value={formData.timezone}
                      onChange={(e) => handleChange('timezone', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="IST (UTC+5:30) / EST"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /> Preferred Communication
                    </Label>
                    <Input
                      value={formData.preferredCommunication}
                      onChange={(e) => handleChange('preferredCommunication', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="WhatsApp / Email / Slack"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Alternate Contact
                    </Label>
                    <Input
                      value={formData.alternateContact}
                      onChange={(e) => handleChange('alternateContact', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="Assistant / Manager phone"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* SECTION 2: SALES & MANAGER DETAILS */}
              <TabsContent value="sales" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> Budget Range
                    </Label>
                    <Input
                      value={formData.budgetRange}
                      onChange={(e) => handleChange('budgetRange', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="₹50k - ₹2L / $1,000 - $5,000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Payment Method</Label>
                    <Input
                      value={formData.paymentMethod}
                      onChange={(e) => handleChange('paymentMethod', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="Bank Transfer / UPI / Stripe"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Lead Source</Label>
                    <Input
                      value={formData.leadSource}
                      onChange={(e) => handleChange('leadSource', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="Website / Meta Ads / Referral"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Business Type</Label>
                    <Input
                      value={formData.businessType}
                      onChange={(e) => handleChange('businessType', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="EdTech / E-Commerce / Creator"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Client Status</Label>
                    <Select
                      value={formData.clientStatus}
                      onValueChange={(v) => handleChange('clientStatus', v)}
                      disabled={!canEditSalesInfo}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="VIP">VIP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Internal Sales Notes</Label>
                  <Textarea
                    value={formData.internalNotes}
                    onChange={(e) => handleChange('internalNotes', e.target.value)}
                    disabled={!canEditSalesInfo}
                    rows={3}
                    placeholder="Key sales insights, negotiation notes, decision maker contacts..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Special Instructions</Label>
                  <Textarea
                    value={formData.specialInstructions}
                    onChange={(e) => handleChange('specialInstructions', e.target.value)}
                    disabled={!canEditSalesInfo}
                    rows={2}
                    placeholder="NDA constraints, billing instructions, non-standard terms..."
                  />
                </div>
              </TabsContent>

              {/* SECTION 3: CLIENT PREFERENCES */}
              <TabsContent value="preferences" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Preferred Editing Style</Label>
                    <Input
                      value={formData.preferredEditingStyle}
                      onChange={(e) => handleChange('preferredEditingStyle', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="Fast-paced, Minimal, Cinematic, Hormozi"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Language</Label>
                    <Input
                      value={formData.preferredLanguage}
                      onChange={(e) => handleChange('preferredLanguage', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="English / Hindi / Hinglish"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Branding Guidelines Link / Notes</Label>
                    <Input
                      value={formData.brandingGuidelines}
                      onChange={(e) => handleChange('brandingGuidelines', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="Drive link to brand kit"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Color Preferences</Label>
                    <Input
                      value={formData.colorPreferences}
                      onChange={(e) => handleChange('colorPreferences', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="Hex codes (#FF0000) or Moody/Vibrant"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Font Preferences</Label>
                    <Input
                      value={formData.fontPreferences}
                      onChange={(e) => handleChange('fontPreferences', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="Inter / Montserrat / Futura"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Music Preferences</Label>
                    <Input
                      value={formData.musicPreferences}
                      onChange={(e) => handleChange('musicPreferences', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="Upbeat Lofi / Tech House / Instrumental"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Subtitle Preferences</Label>
                    <Input
                      value={formData.subtitlePreferences}
                      onChange={(e) => handleChange('subtitlePreferences', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="Yellow highlight / Word-by-word / Standard captions"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Delivery Format</Label>
                    <Input
                      value={formData.deliveryFormat}
                      onChange={(e) => handleChange('deliveryFormat', e.target.value)}
                      disabled={!canEditSalesInfo}
                      placeholder="4K MP4 (16:9), 1080p Vertical (9:16)"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Revision Expectations & Turnaround</Label>
                  <Textarea
                    value={formData.revisionExpectations}
                    onChange={(e) => handleChange('revisionExpectations', e.target.value)}
                    disabled={!canEditSalesInfo}
                    rows={2}
                    placeholder="Requires 24h turnaround for drafts; expects precise timestamps..."
                  />
                </div>
              </TabsContent>

              {/* SECTION 4: EDITOR PREFERENCES (SEPARATE CARD) */}
              <TabsContent value="editor" className="space-y-4 pt-4">
                <Card className="border-2 border-purple-500/30 bg-purple-950/10 dark:bg-purple-950/20 shadow-md">
                  <CardHeader className="pb-3 border-b border-purple-500/20">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2 text-purple-400">
                        <Scissors className="h-5 w-5" />
                        Editor Knowledge Base & Technical Preferences
                      </CardTitle>
                      {isEditor ? (
                        <Badge className="bg-purple-600 text-white">Editable by You (Editor)</Badge>
                      ) : (
                        <Badge variant="outline" className="border-purple-400 text-purple-400">
                          Read-Only (Editor Managed)
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Living knowledge base built from previous projects to guide present and future editors.
                    </p>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Frequently Requested Editing Style</Label>
                        <Input
                          value={formData.editorPreferences.editingStyleNotes}
                          onChange={(e) => handleEditorPrefChange('editingStyleNotes', e.target.value)}
                          disabled={!isEditor}
                          placeholder="Prefers quick jump cuts, sound effects on text popups"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Common Transition Preferences</Label>
                        <Input
                          value={formData.editorPreferences.transitionPreferences}
                          onChange={(e) => handleEditorPrefChange('transitionPreferences', e.target.value)}
                          disabled={!isEditor}
                          placeholder="Whip pans, light leaks, clean whip cuts"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Motion Graphics Preferences</Label>
                        <Input
                          value={formData.editorPreferences.motionGraphicsPreferences}
                          onChange={(e) => handleEditorPrefChange('motionGraphicsPreferences', e.target.value)}
                          disabled={!isEditor}
                          placeholder="Minimal lower thirds, animated chart overlays"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Thumbnail Notes & Style</Label>
                        <Input
                          value={formData.editorPreferences.thumbnailNotes}
                          onChange={(e) => handleEditorPrefChange('thumbnailNotes', e.target.value)}
                          disabled={!isEditor}
                          placeholder="High contrast, bold 2-word hook, cutout glow"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Frequently Used Assets Drive Link</Label>
                        <Input
                          value={formData.editorPreferences.commonlyUsedAssets}
                          onChange={(e) => handleEditorPrefChange('commonlyUsedAssets', e.target.value)}
                          disabled={!isEditor}
                          placeholder="Drive link to intro/outro assets, logos, sound fx pack"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Audio & Color Grading Notes</Label>
                        <Input
                          value={formData.editorPreferences.audioPreferences}
                          onChange={(e) => handleEditorPrefChange('audioPreferences', e.target.value)}
                          disabled={!isEditor}
                          placeholder="-14 LUFS, warm skin tones, LUT preset X"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Previous Feedback Summary & Revision Patterns</Label>
                      <Textarea
                        value={formData.editorPreferences.feedbackSummary}
                        onChange={(e) => handleEditorPrefChange('feedbackSummary', e.target.value)}
                        disabled={!isEditor}
                        rows={3}
                        placeholder="Client frequently requests quieter background music (-24dB max). Always double check spellings of technical terms."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tips for Future Editors & Technical Observations</Label>
                      <Textarea
                        value={formData.editorPreferences.futureRecommendations}
                        onChange={(e) => handleEditorPrefChange('futureRecommendations', e.target.value)}
                        disabled={!isEditor}
                        rows={3}
                        placeholder="Render out prores 422 proxy first. Use project template 'Acme_V2.prproj' located in shared drive."
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SECTION 5: PROJECT HISTORY */}
              <TabsContent value="history" className="space-y-4 pt-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" /> Past & Active Projects ({projectHistory.length})
                  </h4>
                  {projectHistory.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                      No project history linked to this client yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {projectHistory.map((proj) => (
                        <div
                          key={proj.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 text-sm"
                        >
                          <div className="space-y-1">
                            <p className="font-medium">{proj.clientName} — {proj.serviceType}</p>
                            <p className="text-xs text-muted-foreground">
                              Editor: <span className="font-medium text-foreground">{proj.assignedEditor}</span> · Revisions: {proj.revisionCount}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge variant="secondary">{proj.status}</Badge>
                            <p className="text-[11px] text-muted-foreground">
                              {proj.deliveryDate ? new Date(proj.deliveryDate).toLocaleDateString() : 'Active'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div>
                {canDelete && profileId && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete Profile
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>

                {(canEditSalesInfo || isEditor) && (
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" /> Save Profile
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        )}
      </DialogContent>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Client Profile
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong className="text-foreground">{formData.name}</strong>&apos;s client profile?
              This action cannot be undone and will remove all stored preferences.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                'Delete Profile'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
