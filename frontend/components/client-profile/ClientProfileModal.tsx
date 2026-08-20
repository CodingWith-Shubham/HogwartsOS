'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Search,
  Link2,
  Unlink,
  X,
  Send,
  Camera,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface ProjectResult {
  id: string;
  editId: string;
  clientName: string;
  serviceType: string;
  assignedEditor: string;
  status: string;
  deliveryDate?: string;
  revisionCount?: number;
  createdAt?: string;
  alreadyLinked?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientProfileModal({
  open,
  onOpenChange,
  profileId,
  clientInfo,
  onSuccess,
}: ClientProfileModalProps) {
  const { user } = useAuth();
  const userRole = user?.role || 'sales';

  // All roles can create and edit everything
  const canEditAllFields = ['sales', 'manager', 'admin', 'editor', 'super_admin'].includes(userRole);
  const canCreate = canEditAllFields;
  const canDelete = ['manager', 'admin', 'super_admin'].includes(userRole);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const hideContactInfo = userRole === 'shoot' || userRole === 'editor';
  const [activeTab, setActiveTab] = useState(hideContactInfo ? 'preferences' : 'basic');

  // Resolved profile ID (for when we load an existing profile via duplicate check)
  const [resolvedProfileId, setResolvedProfileId] = useState<string | null>(null);
  const effectiveProfileId = profileId || resolvedProfileId;

  // Form State
  const [formData, setFormData] = useState({
    // Basic Info
    name: '',
    email: '',
    profileImage: '',
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
    referenceLinks: '',
    attachments: [] as string[],

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

  const [projectHistory, setProjectHistory] = useState<ProjectResult[]>([]);
  const [previousProjects, setPreviousProjects] = useState<ProjectResult[]>([]);

  // Search Projects State
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [projectSearchResults, setProjectSearchResults] = useState<ProjectResult[]>([]);
  const [projectSearchLoading, setProjectSearchLoading] = useState(false);
  const [linkingProjectId, setLinkingProjectId] = useState<string | null>(null);
  const [unlinkingProjectId, setUnlinkingProjectId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open) {
      setResolvedProfileId(null);
      return;
    }

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
    setResolvedProfileId(null);
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
      referenceLinks: '',
      attachments: [],
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
    setPreviousProjects([]);
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
        setResolvedProfileId(data.profile._id);
        populateForm(data.profile, [], []);
        fetchProfileDetails(data.profile._id);
        toast.info('Existing client profile loaded — editing in place.');
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
        setResolvedProfileId(data.profile._id);
        populateForm(data.profile, data.projectHistory || [], data.previousProjects || []);
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

  const populateForm = (p: any, history: any[], prevProjects: any[]) => {
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
      referenceLinks: p.referenceLinks || '',
      attachments: p.attachments || [],
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
    setPreviousProjects(prevProjects);
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

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingProfilePic(true);
    const form = new FormData();
    form.append('attachment', file);

    try {
      const res = await fetch('/api/client-profiles/upload-attachment', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setFormData((prev) => ({
          ...prev,
          profileImage: data.url,
        }));
        toast.success('Profile picture uploaded successfully');
      } else {
        toast.error(data.error || 'Failed to upload profile picture');
      }
    } catch (err) {
      toast.error('An error occurred during upload');
    } finally {
      setUploadingProfilePic(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);
    const form = new FormData();
    form.append('attachment', file);

    try {
      const res = await authFetch('/api/client-profiles/upload-attachment', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setFormData((prev) => ({
          ...prev,
          attachments: [...prev.attachments, data.url],
        }));
        toast.success('Attachment uploaded successfully');
      } else {
        toast.error(data.error || 'Failed to upload attachment');
      }
    } catch (err) {
      toast.error('An error occurred during upload');
    } finally {
      setUploadingAttachment(false);
    }
  };

  // ─── Client-side validation ───────────────────────────────────────────────

  const validateForm = (): string | null => {
    if (!formData.name || !formData.name.trim()) {
      return 'Client name is required.';
    }
    if (formData.email && formData.email.trim() && !EMAIL_REGEX.test(formData.email.trim())) {
      return 'Invalid email format.';
    }
    if (formData.phone && formData.phone.trim()) {
      const digits = formData.phone.replace(/\D/g, '');
      if (digits.length < 10) {
        return 'Mobile number must contain at least 10 digits.';
      }
    }
    return null;
  };

  // ─── Save Handler ─────────────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      const isExisting = Boolean(effectiveProfileId);
      const url = isExisting
        ? `/api/client-profiles/${effectiveProfileId}`
        : '/api/client-profiles';
      const method = isExisting ? 'PATCH' : 'POST';

      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.status === 409 && data.isDuplicate) {
        // Duplicate found — load it instead
        toast.info(data.message || 'A matching client profile already exists. Loading it now.');
        if (data.existingProfile?._id) {
          setResolvedProfileId(data.existingProfile._id);
          fetchProfileDetails(data.existingProfile._id);
        }
        return;
      }

      if (!response.ok) {
        // Show the specific error from backend
        toast.error(data.error || data.message || 'Save failed');
        return;
      }

      toast.success(isExisting ? 'Profile updated successfully' : 'Profile created successfully');
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  // ─── Copy Link Handler ────────────────────────────────────────────────────

  const handleCopyOnboardingLink = async (id: string) => {
    try {
      const res = await authFetch(`/api/client-profiles/${id}/generate-link`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.token) {
        const url = `https://crm.hogwartsmedia.com/onboarding/client-profile?token=${data.token}`;
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

  const [sendingLink, setSendingLink] = useState(false);

  const handleSendOnboardingLink = async (id: string) => {
    setSendingLink(true);
    try {
      const res = await authFetch(`/api/client-profiles/${id}/send-onboarding`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Onboarding link sent to client via email!');
      } else {
        toast.error('Failed to send link', { description: data.error });
      }
    } catch (err) {
      console.error('Error sending link:', err);
      toast.error('Could not send onboarding link');
    } finally {
      setSendingLink(false);
    }
  };

  // ─── Delete Handler ───────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!effectiveProfileId) return;
    setDeleting(true);
    try {
      const response = await authFetch(`/api/client-profiles/${effectiveProfileId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to delete client profile');
        return;
      }
      toast.success('Client profile deleted');
      setDeleteDialogOpen(false);
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Previous Projects Management ─────────────────────────────────────────

  const searchForProjects = useCallback(
    async (query: string) => {
      if (!effectiveProfileId) return;
      setProjectSearchLoading(true);
      try {
        const res = await authFetch(
          `/api/client-profiles/${effectiveProfileId}/previous-projects?q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        if (res.ok && data.projects) {
          setProjectSearchResults(data.projects);
        } else {
          setProjectSearchResults([]);
        }
      } catch {
        setProjectSearchResults([]);
      } finally {
        setProjectSearchLoading(false);
      }
    },
    [effectiveProfileId]
  );

  const handleProjectSearchChange = (value: string) => {
    setProjectSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      searchForProjects(value);
    }, 300);
  };

  const handleLinkProject = async (projectId: string) => {
    if (!effectiveProfileId) return;
    setLinkingProjectId(projectId);
    try {
      const res = await authFetch(
        `/api/client-profiles/${effectiveProfileId}/previous-projects`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to link project');
        return;
      }
      toast.success('Project linked successfully');
      if (data.project) {
        setPreviousProjects((prev) => [...prev, data.project]);
      }
      // Update search results to mark as linked
      setProjectSearchResults((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, alreadyLinked: true } : p))
      );
    } catch {
      toast.error('Failed to link project');
    } finally {
      setLinkingProjectId(null);
    }
  };

  const handleUnlinkProject = async (projectId: string) => {
    if (!effectiveProfileId) return;
    setUnlinkingProjectId(projectId);
    try {
      const res = await authFetch(
        `/api/client-profiles/${effectiveProfileId}/previous-projects/${projectId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to unlink project');
        return;
      }
      toast.success('Project removed from profile');
      setPreviousProjects((prev) => prev.filter((p) => p.id !== projectId));
      // Update search results to mark as unlinked
      setProjectSearchResults((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, alreadyLinked: false } : p))
      );
    } catch {
      toast.error('Failed to unlink project');
    } finally {
      setUnlinkingProjectId(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

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
                You do not have permission to create client profiles.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 pt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-6 bg-muted/60 p-1 rounded-lg">
                {!hideContactInfo && (
                  <>
                    <TabsTrigger value="basic" className="text-xs md:text-sm">
                      Basic Info
                    </TabsTrigger>
                    <TabsTrigger value="sales" className="text-xs md:text-sm">
                      Sales Details
                    </TabsTrigger>
                  </>
                )}
                <TabsTrigger value="preferences" className="text-xs md:text-sm">
                  Client Prefs
                </TabsTrigger>
                <TabsTrigger
                  value="editor"
                  className="text-xs md:text-sm bg-purple-500/10 data-[state=active]:bg-purple-600 data-[state=active]:text-white font-medium"
                >
                  Editor Prefs ✨
                </TabsTrigger>
                <TabsTrigger value="status" className="text-xs md:text-sm">
                  Status
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs md:text-sm">
                  History ({previousProjects.length})
                </TabsTrigger>
              </TabsList>

              {/* SECTION 1: BASIC INFORMATION */}
              {!hideContactInfo && (
                <TabsContent value="basic" className="space-y-6 pt-4">
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="relative h-24 w-24 rounded-full border-2 border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                        {formData.profileImage ? (
                          <img src={formData.profileImage} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-10 w-10 text-muted-foreground" />
                        )}
                      </div>
                      {canEditAllFields && (
                        <div className="flex flex-col items-center w-full">
                          <Label htmlFor="profile-pic-upload" className="cursor-pointer text-xs text-primary hover:underline font-medium flex items-center">
                            {uploadingProfilePic ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Camera className="w-3 h-3 mr-1" />}
                            {uploadingProfilePic ? 'Uploading...' : 'Change Photo'}
                          </Label>
                          <Input
                            id="profile-pic-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePicUpload}
                            disabled={uploadingProfilePic}
                            className="hidden"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" /> Client Name *
                    </Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      disabled={!canEditAllFields}
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
                      disabled={!canEditAllFields}
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
                      disabled={!canEditAllFields}
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
                      disabled={!canEditAllFields}
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
                      disabled={!canEditAllFields}
                      placeholder="India / USA / UK"
                    />
                  </div>



                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /> Preferred Communication
                    </Label>
                    <Input
                      value={formData.preferredCommunication}
                      onChange={(e) => handleChange('preferredCommunication', e.target.value)}
                      disabled={!canEditAllFields}
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
                      disabled={!canEditAllFields}
                      placeholder="Assistant / Manager phone"
                    />
                  </div>
                </div>
              </TabsContent>
              )}

              {/* SECTION 2: SALES & MANAGER DETAILS */}
              {!hideContactInfo && (
                <TabsContent value="sales" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> Budget Range
                    </Label>
                    <Input
                      value={formData.budgetRange}
                      onChange={(e) => handleChange('budgetRange', e.target.value)}
                      disabled={!canEditAllFields}
                      placeholder="₹50k - ₹2L / $1,000 - $5,000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Payment Method</Label>
                    <Input
                      value={formData.paymentMethod}
                      onChange={(e) => handleChange('paymentMethod', e.target.value)}
                      disabled={!canEditAllFields}
                      placeholder="Bank Transfer / UPI / Stripe"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Lead Source</Label>
                    <Input
                      value={formData.leadSource}
                      onChange={(e) => handleChange('leadSource', e.target.value)}
                      disabled={!canEditAllFields}
                      placeholder="Website / Meta Ads / Referral"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Business Type</Label>
                    <Input
                      value={formData.businessType}
                      onChange={(e) => handleChange('businessType', e.target.value)}
                      disabled={!canEditAllFields}
                      placeholder="EdTech / E-Commerce / Creator"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Client Status</Label>
                    <Select
                      value={formData.clientStatus}
                      onValueChange={(v) => handleChange('clientStatus', v)}
                      disabled={!canEditAllFields}
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
                    disabled={!canEditAllFields}
                    rows={3}
                    placeholder="Key sales insights, negotiation notes, decision maker contacts..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Special Instructions</Label>
                  <Textarea
                    value={formData.specialInstructions}
                    onChange={(e) => handleChange('specialInstructions', e.target.value)}
                    disabled={!canEditAllFields}
                    rows={2}
                    placeholder="NDA constraints, billing instructions, non-standard terms..."
                  />
                </div>
              </TabsContent>
              )}

              {/* SECTION 3: CLIENT PREFERENCES */}
              <TabsContent value="preferences" className="space-y-4 pt-4">
                <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/20 mb-4">
                  <div>
                    <h4 className="text-sm font-semibold">Copy Onboarding Link</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Share this link with the client to let them fill out their preferences.</p>
                  </div>
                  {effectiveProfileId ? (
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyOnboardingLink(effectiveProfileId)}
                        className="h-8 border-primary/20 text-primary hover:bg-primary/10"
                      >
                        <Link2 className="mr-1.5 h-3.5 w-3.5" /> Copy Link
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        disabled={sendingLink}
                        onClick={() => handleSendOnboardingLink(effectiveProfileId)}
                        className="h-8 shadow-md"
                      >
                        {sendingLink ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Send via Email
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic shrink-0 ml-4">Save profile first to generate link</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Preferred Editing Style</Label>
                    <Input
                      value={formData.preferredEditingStyle}
                      onChange={(e) => handleChange('preferredEditingStyle', e.target.value)}
                      disabled={!canEditAllFields}
                      placeholder="Fast-paced, Minimal, Cinematic, Hormozi"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Language</Label>
                    <Input
                      value={formData.preferredLanguage}
                      onChange={(e) => handleChange('preferredLanguage', e.target.value)}
                      disabled={!canEditAllFields}
                      placeholder="English / Hindi / Hinglish"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Branding Guidelines Link / Notes</Label>
                    <Input
                      value={formData.brandingGuidelines}
                      onChange={(e) => handleChange('brandingGuidelines', e.target.value)}
                      disabled={!canEditAllFields}
                      placeholder="Drive link to brand kit"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Color Preferences</Label>
                    <Input
                      value={formData.colorPreferences}
                      onChange={(e) => handleChange('colorPreferences', e.target.value)}
                      disabled={!canEditAllFields}
                      placeholder="Hex codes (#FF0000) or Moody/Vibrant"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Font Preferences</Label>
                    <Input
                      value={formData.fontPreferences}
                      onChange={(e) => handleChange('fontPreferences', e.target.value)}
                      disabled={!canEditAllFields}
                      placeholder="Inter / Montserrat / Futura"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Music Preferences</Label>
                    <Input
                      value={formData.musicPreferences}
                      onChange={(e) => handleChange('musicPreferences', e.target.value)}
                      disabled={!canEditAllFields}
                      placeholder="Upbeat Lofi / Tech House / Instrumental"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Subtitle Preferences</Label>
                    <Input
                      value={formData.subtitlePreferences}
                      onChange={(e) => handleChange('subtitlePreferences', e.target.value)}
                      disabled={!canEditAllFields}
                      placeholder="Yellow highlight / Word-by-word / Standard captions"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Delivery Format</Label>
                    <Input
                      value={formData.deliveryFormat}
                      onChange={(e) => handleChange('deliveryFormat', e.target.value)}
                      disabled={!canEditAllFields}
                      placeholder="4K MP4 (16:9), 1080p Vertical (9:16)"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Revision Expectations & Turnaround</Label>
                  <Textarea
                    value={formData.revisionExpectations}
                    onChange={(e) => handleChange('revisionExpectations', e.target.value)}
                    disabled={!canEditAllFields}
                    rows={2}
                    placeholder="Requires 24h turnaround for drafts; expects precise timestamps..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>Reference Links</Label>
                    <Textarea
                      value={formData.referenceLinks}
                      onChange={(e) => handleChange('referenceLinks', e.target.value)}
                      disabled={!canEditAllFields}
                      rows={3}
                      placeholder="Add reference video links, inspiration channels..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Attachments</Label>
                    <div className="flex flex-col gap-2">
                      <Input
                        type="file"
                        onChange={handleFileUpload}
                        disabled={!canEditAllFields || uploadingAttachment}
                      />
                      {uploadingAttachment && <p className="text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin inline mr-1" /> Uploading...</p>}
                      {formData.attachments && formData.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {formData.attachments.map((url, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded border border-border bg-muted/20 text-xs">
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px]">
                                {url.split('/').pop()}
                              </a>
                              {canEditAllFields && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    attachments: prev.attachments.filter((_, index) => index !== i)
                                  }))}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* SECTION 4: EDITOR PREFERENCES */}
              <TabsContent value="editor" className="space-y-4 pt-4">
                <Card className="border-2 border-purple-500/30 bg-purple-950/10 dark:bg-purple-950/20 shadow-md">
                  <CardHeader className="pb-3 border-b border-purple-500/20">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2 text-purple-400">
                        <Scissors className="h-5 w-5" />
                        Editor Knowledge Base & Technical Preferences
                      </CardTitle>
                      <Badge className="bg-purple-600 text-white">Editable</Badge>
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
                          disabled={!canEditAllFields}
                          placeholder="Prefers quick jump cuts, sound effects on text popups"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Common Transition Preferences</Label>
                        <Input
                          value={formData.editorPreferences.transitionPreferences}
                          onChange={(e) => handleEditorPrefChange('transitionPreferences', e.target.value)}
                          disabled={!canEditAllFields}
                          placeholder="Whip pans, light leaks, clean whip cuts"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Motion Graphics Preferences</Label>
                        <Input
                          value={formData.editorPreferences.motionGraphicsPreferences}
                          onChange={(e) => handleEditorPrefChange('motionGraphicsPreferences', e.target.value)}
                          disabled={!canEditAllFields}
                          placeholder="Minimal lower thirds, animated chart overlays"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Thumbnail Notes & Style</Label>
                        <Input
                          value={formData.editorPreferences.thumbnailNotes}
                          onChange={(e) => handleEditorPrefChange('thumbnailNotes', e.target.value)}
                          disabled={!canEditAllFields}
                          placeholder="High contrast, bold 2-word hook, cutout glow"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Frequently Used Assets Drive Link</Label>
                        <Input
                          value={formData.editorPreferences.commonlyUsedAssets}
                          onChange={(e) => handleEditorPrefChange('commonlyUsedAssets', e.target.value)}
                          disabled={!canEditAllFields}
                          placeholder="Drive link to intro/outro assets, logos, sound fx pack"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Audio & Color Grading Notes</Label>
                        <Input
                          value={formData.editorPreferences.audioPreferences}
                          onChange={(e) => handleEditorPrefChange('audioPreferences', e.target.value)}
                          disabled={!canEditAllFields}
                          placeholder="-14 LUFS, warm skin tones, LUT preset X"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Previous Feedback Summary & Revision Patterns</Label>
                      <Textarea
                        value={formData.editorPreferences.feedbackSummary}
                        onChange={(e) => handleEditorPrefChange('feedbackSummary', e.target.value)}
                        disabled={!canEditAllFields}
                        rows={3}
                        placeholder="Client frequently requests quieter background music (-24dB max). Always double check spellings of technical terms."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tips for Future Editors & Technical Observations</Label>
                      <Textarea
                        value={formData.editorPreferences.futureRecommendations}
                        onChange={(e) => handleEditorPrefChange('futureRecommendations', e.target.value)}
                        disabled={!canEditAllFields}
                        rows={3}
                        placeholder="Render out prores 422 proxy first. Use project template 'Acme_V2.prproj' located in shared drive."
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SECTION 5: STATUS */}
              <TabsContent value="status" className="space-y-4 pt-4">
                <Card className="border-border/50 bg-card/50 shadow-sm">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" />
                      Client Project Status Overview
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Overview of all associated projects for this client across the platform.
                    </p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex flex-col bg-muted/30 p-4 rounded-xl border border-border/50">
                        <span className="text-sm text-muted-foreground">Total Projects</span>
                        <span className="text-2xl font-bold">{projectHistory.length}</span>
                      </div>
                      <div className="flex flex-col bg-muted/30 p-4 rounded-xl border border-border/50">
                        <span className="text-sm text-muted-foreground">Completed</span>
                        <span className="text-2xl font-bold text-green-500">
                          {projectHistory.filter(p => ['Completed', 'Delivered', 'Approved'].includes(p.status)).length}
                        </span>
                      </div>
                      <div className="flex flex-col bg-muted/30 p-4 rounded-xl border border-border/50">
                        <span className="text-sm text-muted-foreground">In Progress / Pending</span>
                        <span className="text-2xl font-bold text-amber-500">
                          {projectHistory.filter(p => !['Completed', 'Delivered', 'Approved', 'Cancelled'].includes(p.status)).length}
                        </span>
                      </div>
                      <div className="flex flex-col bg-muted/30 p-4 rounded-xl border border-border/50">
                        <span className="text-sm text-muted-foreground">Cancelled</span>
                        <span className="text-2xl font-bold text-red-500">
                          {projectHistory.filter(p => p.status === 'Cancelled').length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SECTION 6: PROJECT HISTORY & PREVIOUS PROJECTS */}
              <TabsContent value="history" className="space-y-6 pt-4">


                {/* Manually-linked Previous Projects */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-blue-500" /> Previous Projects ({previousProjects.length})
                    </h4>
                    {effectiveProfileId && canEditAllFields && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setProjectSearchOpen(!projectSearchOpen);
                          if (!projectSearchOpen) {
                            searchForProjects('');
                          }
                        }}
                        className="h-8 text-xs"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add Project
                      </Button>
                    )}
                  </div>

                  {/* Project Search Panel */}
                  {projectSearchOpen && effectiveProfileId && (
                    <Card className="border-blue-500/30 bg-blue-950/5 dark:bg-blue-950/10">
                      <CardContent className="pt-4 space-y-3">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by Edit ID, client name, service type..."
                            value={projectSearchQuery}
                            onChange={(e) => handleProjectSearchChange(e.target.value)}
                            className="pl-9 pr-8"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1 h-7 w-7 p-0"
                            onClick={() => {
                              setProjectSearchOpen(false);
                              setProjectSearchQuery('');
                              setProjectSearchResults([]);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {projectSearchLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : projectSearchResults.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-3">
                            {projectSearchQuery ? 'No projects found.' : 'Type to search for projects...'}
                          </p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto space-y-1.5">
                            {projectSearchResults.map((proj) => (
                              <div
                                key={proj.id}
                                className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card text-sm hover:bg-muted/40 transition-colors"
                              >
                                <div className="space-y-0.5 min-w-0 flex-1">
                                  <p className="font-medium text-xs truncate">
                                    <span className="text-blue-500 font-mono">{proj.editId}</span>
                                    {' — '}{proj.clientName || 'Unknown'}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {proj.serviceType} · {proj.assignedEditor} · {proj.status}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant={proj.alreadyLinked ? 'secondary' : 'default'}
                                  size="sm"
                                  disabled={proj.alreadyLinked || linkingProjectId === proj.id}
                                  onClick={() => handleLinkProject(proj.id)}
                                  className="ml-2 h-7 text-[11px] shrink-0"
                                >
                                  {linkingProjectId === proj.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : proj.alreadyLinked ? (
                                    <>
                                      <CheckCircle className="mr-1 h-3 w-3" /> Linked
                                    </>
                                  ) : (
                                    <>
                                      <Link2 className="mr-1 h-3 w-3" /> Link
                                    </>
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Previously Linked Projects List */}
                  {previousProjects.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                      No previous projects manually linked yet.
                      {effectiveProfileId && canEditAllFields && (
                        <span className="block mt-1 text-xs">
                          Click &quot;Add Project&quot; above to link existing projects.
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {previousProjects.map((proj) => (
                        <div
                          key={proj.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-blue-500/20 bg-blue-950/5 dark:bg-blue-950/10 text-sm"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <p className="font-medium">
                              <span className="text-blue-500 font-mono text-xs">{proj.editId}</span>
                              {' — '}{proj.clientName} — {proj.serviceType}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Editor: <span className="font-medium text-foreground">{proj.assignedEditor}</span>
                              {proj.revisionCount !== undefined && ` · Revisions: ${proj.revisionCount}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-[11px]">{proj.status}</Badge>
                            {canEditAllFields && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                disabled={unlinkingProjectId === proj.id}
                                onClick={() => handleUnlinkProject(proj.id)}
                              >
                                {unlinkingProjectId === proj.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Unlink className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
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
                {canDelete && effectiveProfileId && (
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

                {canEditAllFields && (
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
