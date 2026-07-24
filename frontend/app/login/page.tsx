'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Film, Loader2, Sparkles, Lock, Mail } from 'lucide-react';
import { SESSION_KEY } from '@/lib/auth';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) {
      if (typeof window !== 'undefined') {
        const session = window.localStorage.getItem(SESSION_KEY);
        if (session) {
          try {
            const u = JSON.parse(session);
            router.replace(u.redirectTo || '/dashboard');
            return;
          } catch (e) {
            console.error('Failed to parse logged in user redirect:', e);
          }
        }
      }
      router.replace('/dashboard');
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
              <h2 className="text-xl font-semibold text-slate-100">Welcome back</h2>
              <p className="text-sm text-slate-400">Sign in with your employee email credentials</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Email Address
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
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 bg-slate-950/50 border-slate-800 text-slate-200 focus-visible:ring-violet-500 focus-visible:border-violet-500 placeholder:text-slate-600 rounded-lg h-11"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-lg bg-gradient-to-r from-amber-500 to-violet-600 hover:from-amber-600 hover:to-violet-700 text-slate-950 hover:text-slate-900 font-semibold shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 transition-all duration-200 mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
