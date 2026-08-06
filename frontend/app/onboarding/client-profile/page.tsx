'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Building, Phone, Mail, Globe, Clock, MessageSquare, Sliders, Music, CheckCircle, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function OnboardingForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    companyName: '',
    country: '',
    timezone: '',
    preferredCommunication: '',
    alternateContact: '',

    preferredEditingStyle: '',
    preferredLanguage: '',
    brandingGuidelines: '',
    colorPreferences: '',
    fontPreferences: '',
    musicPreferences: '',
    subtitlePreferences: '',
    deliveryFormat: '',
    turnaroundPreference: '',
    additionalPreferences: '',
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing onboarding link.');
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/public/client-profile?token=${token}`);
        const data = await res.json();
        
        if (res.ok) {
          setFormData(prev => ({
            ...prev,
            ...data
          }));
        } else {
          setError(data.error || 'This link has expired or is invalid.');
        }
      } catch (err) {
        setError('Failed to connect to the server.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/public/client-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        toast.success('Profile saved successfully!');
      } else {
        toast.error('Failed to save profile', { description: data.error });
      }
    } catch (err) {
      toast.error('Connection error while saving profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black/95 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading your profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black/95 p-4">
        <Card className="max-w-md w-full bg-black/50 border-red-500/20 backdrop-blur-md">
          <CardHeader className="text-center">
            <div className="mx-auto bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <span className="text-red-500 text-2xl">!</span>
            </div>
            <CardTitle className="text-red-500">Link Invalid</CardTitle>
            <CardDescription className="text-red-400/80 mt-2">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black/95 p-4">
        <Card className="max-w-md w-full bg-black/50 border-green-500/20 backdrop-blur-md">
          <CardHeader className="text-center">
            <div className="mx-auto bg-green-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="text-green-500 w-8 h-8" />
            </div>
            <CardTitle className="text-green-500">Profile Completed!</CardTitle>
            <CardDescription className="text-green-400/80 mt-2 text-base">
              Thank you for providing your details. Our team will use this information to perfectly tailor our editing style to your brand.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button variant="outline" className="border-green-500/20 hover:bg-green-500/10" onClick={() => window.close()}>
              You can now close this tab
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-primary/5 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4 ring-1 ring-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.3)]">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 mb-3">
            Hogwarts Studio Onboarding
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Help us understand your brand and preferences better so we can craft the perfect videos for you.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="bg-black/40 border border-border/50 backdrop-blur-xl h-14 p-1 rounded-full shadow-2xl">
                <TabsTrigger value="basic" className="rounded-full px-6 text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all duration-300">
                  <User className="w-4 h-4 mr-2" /> Basic Info
                </TabsTrigger>
                <TabsTrigger value="branding" className="rounded-full px-6 text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all duration-300">
                  <Sliders className="w-4 h-4 mr-2" /> Preferences
                </TabsTrigger>
              </TabsList>
            </div>

            <Card className="bg-black/40 border-border/50 backdrop-blur-xl shadow-2xl overflow-hidden rounded-2xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-30" />
              
              <TabsContent value="basic" className="m-0 focus-visible:outline-none">
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Your contact details and company information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-muted-foreground">Full Name *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                        <Input id="name" name="name" value={formData.name} onChange={handleChange} required className="pl-9 bg-black/20 border-border/50 focus-visible:ring-primary/30" placeholder="John Doe" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-muted-foreground">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                        <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="pl-9 bg-black/20 border-border/50 focus-visible:ring-primary/30" placeholder="john@example.com" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-muted-foreground">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                        <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} className="pl-9 bg-black/20 border-border/50 focus-visible:ring-primary/30" placeholder="+1 234 567 890" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="text-muted-foreground">Company / Channel Name</Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                        <Input id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} className="pl-9 bg-black/20 border-border/50 focus-visible:ring-primary/30" placeholder="My Awesome Channel" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-muted-foreground">Country</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                        <Input id="country" name="country" value={formData.country} onChange={handleChange} className="pl-9 bg-black/20 border-border/50 focus-visible:ring-primary/30" placeholder="United States" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone" className="text-muted-foreground">Timezone</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                        <Input id="timezone" name="timezone" value={formData.timezone} onChange={handleChange} className="pl-9 bg-black/20 border-border/50 focus-visible:ring-primary/30" placeholder="EST, PST, GMT..." />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="button" onClick={() => setActiveTab('branding')} className="rounded-full px-8 shadow-lg shadow-primary/20">
                      Next: Preferences
                    </Button>
                  </div>
                </CardContent>
              </TabsContent>

              <TabsContent value="branding" className="m-0 focus-visible:outline-none">
                <CardHeader>
                  <CardTitle>Style & Branding</CardTitle>
                  <CardDescription>Tell us how you want your videos to look and feel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="brandingGuidelines" className="text-muted-foreground">Branding Guidelines & Fonts</Label>
                      <Textarea id="brandingGuidelines" name="brandingGuidelines" value={formData.brandingGuidelines} onChange={handleChange} className="min-h-[100px] bg-black/20 border-border/50 resize-y focus-visible:ring-primary/30" placeholder="Links to your brand kit, specific fonts to use, hex codes, etc..." />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="preferredEditingStyle" className="text-muted-foreground">Preferred Editing Style</Label>
                      <Input id="preferredEditingStyle" name="preferredEditingStyle" value={formData.preferredEditingStyle} onChange={handleChange} className="bg-black/20 border-border/50 focus-visible:ring-primary/30" placeholder="Fast-paced, documentary, minimalist, cinematic..." />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="musicPreferences" className="text-muted-foreground">Music & Audio Vibe</Label>
                      <Input id="musicPreferences" name="musicPreferences" value={formData.musicPreferences} onChange={handleChange} className="bg-black/20 border-border/50 focus-visible:ring-primary/30" placeholder="Upbeat, lofi, dramatic, corporate..." />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subtitlePreferences" className="text-muted-foreground">Subtitle Style</Label>
                      <Input id="subtitlePreferences" name="subtitlePreferences" value={formData.subtitlePreferences} onChange={handleChange} className="bg-black/20 border-border/50 focus-visible:ring-primary/30" placeholder="Alex Hormozi style, clean, no subtitles..." />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="turnaroundPreference" className="text-muted-foreground">Expected Turnaround</Label>
                      <Input id="turnaroundPreference" name="turnaroundPreference" value={formData.turnaroundPreference} onChange={handleChange} className="bg-black/20 border-border/50 focus-visible:ring-primary/30" placeholder="48 hours, 1 week, flexible..." />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="additionalPreferences" className="text-muted-foreground">Any other notes or preferences?</Label>
                      <Textarea id="additionalPreferences" name="additionalPreferences" value={formData.additionalPreferences} onChange={handleChange} className="min-h-[100px] bg-black/20 border-border/50 resize-y focus-visible:ring-primary/30" placeholder="Channels you like, things to avoid, general vibe you are going for..." />
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-6 border-t border-border/30 mt-8">
                    <Button type="button" variant="ghost" onClick={() => setActiveTab('basic')} className="text-muted-foreground">
                      Back
                    </Button>
                    <Button type="submit" disabled={saving} className="rounded-full px-10 shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Submit Profile'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </TabsContent>
            </Card>
          </Tabs>
        </form>
      </div>
    </div>
  );
}

export default function ClientProfileOnboardingPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-black/95">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <OnboardingForm />
    </Suspense>
  );
}
