'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Film, Loader2, Sparkles, Mail, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    setIsSubmitting(true);
    setSuccessMessage('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(data.message || 'Password reset link has been sent to your email.');
        toast.success('Reset Link Sent', {
          description: 'Check your inbox for password reset instructions.',
        });
      } else {
        toast.error('Request Failed', {
          description: data.error || 'Failed to send reset link',
        });
      }
    } catch (err) {
      toast.error('Request Failed', {
        description: 'Failed to connect to authentication server',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center p-4">
      {/* Hogwarts Magic Glow Background */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-900/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/20 blur-[120px]" />
      <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] rounded-full bg-amber-500/5 blur-[100px]" />

      <div className="w-full max-w-md z-10 relative">
        <div className="flex flex-col items-center justify-center gap-2 mb-8 animate-fade-in">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-violet-600 to-indigo-600 p-0.5 shadow-lg shadow-violet-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950">
              <Film className="h-6 w-6 text-amber-400 animate-pulse" />
            </div>
          </div>
          <div className="text-center mt-2">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-amber-200 via-violet-200 to-indigo-200 bg-clip-text text-transparent flex items-center gap-1.5 justify-center">
              Hogwarts Studios
              <Sparkles className="h-4 w-4 text-amber-400" />
            </h1>
            <p className="text-sm text-slate-400 font-medium">Production CRM Portal</p>
          </div>
        </div>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-violet-500 to-indigo-500" />
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-semibold text-slate-100 flex items-center justify-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-400" />
                Forgot Password
              </h2>
              <p className="text-sm text-slate-400">
                Enter your employee email to receive a password reset link
              </p>
            </div>

            {successMessage ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-3">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  Reset Instructions Sent!
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {successMessage}
                </p>
                <div className="pt-2">
                  <Link href="/login">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
                    >
                      Return to Sign In
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Employee Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@hogwartsstudios.com"
                      className="pl-10 bg-slate-950/50 border-slate-800 text-slate-200 focus-visible:ring-violet-500 focus-visible:border-violet-500 placeholder:text-slate-600 rounded-lg h-11"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-lg bg-gradient-to-r from-amber-500 to-violet-600 hover:from-amber-600 hover:to-violet-700 text-slate-950 font-semibold shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 transition-all duration-200 mt-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                      Sending Link...
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </form>
            )}

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
