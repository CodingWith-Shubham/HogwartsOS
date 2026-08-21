'use client';

import { useEffect, useState } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';

// Detect iOS Safari (no beforeinstallprompt support)
function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return (
    ('standalone' in window.navigator && (window.navigator as any).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed this session
    if (isInStandaloneMode()) return;
    if (sessionStorage.getItem('pwa-dismissed')) return;

    if (isIOS()) {
      const t = setTimeout(() => setShowIOSGuide(true), 3000);
      return () => clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setShowBanner(false);
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  };

  const handleDismiss = (forBanner = true) => {
    sessionStorage.setItem('pwa-dismissed', '1');
    setDismissed(true);
    if (forBanner) setShowBanner(false);
    else setShowIOSGuide(false);
  };

  if (dismissed) return null;

  // ── Android / Desktop install banner ──────────────────────────────────────
  if (showBanner && deferredPrompt) {
    return (
      <div
        role="dialog"
        aria-label="Install Hogwarts CRM app"
        className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-24 sm:max-w-sm z-[60] animate-slide-in"
      >
        <div
          className="relative overflow-hidden rounded-2xl border border-indigo-500/30 shadow-2xl shadow-black/60"
          style={{ background: 'linear-gradient(135deg, hsl(215 28% 13%) 0%, hsl(215 28% 9%) 100%)' }}
        >
          <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />

          <button
            onClick={() => handleDismiss(true)}
            className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-5 pr-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon-192x192.png"
                  alt="Hogwarts CRM icon"
                  className="w-14 h-14 rounded-2xl border border-indigo-500/30 shadow-lg"
                />
                <div className="absolute -bottom-1 -right-1 bg-indigo-500 rounded-full p-0.5 border-2 border-[hsl(215_28%_11%)]">
                  <Download className="h-2.5 w-2.5 text-white" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm leading-tight text-foreground">Hogwarts Media &amp; Studios</p>
                <p className="text-xs text-indigo-400 font-medium mt-0.5">Install as app</p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                  Add to your home screen for instant access — works offline too.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mb-4 text-[11px] text-muted-foreground">
              {['No browser bar', 'Faster loading', 'Works offline'].map((text) => (
                <span key={text} className="flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  {text}
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                disabled={installing}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
                }}
              >
                {installing ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {installing ? 'Installing…' : 'Install App'}
              </button>
              <button
                onClick={() => handleDismiss(true)}
                className="px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors border border-border"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── iOS Safari "Add to Home Screen" guide ─────────────────────────────────
  if (showIOSGuide) {
    return (
      <div
        role="dialog"
        aria-label="Install Hogwarts CRM on iOS"
        className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-24 sm:max-w-sm z-[60] animate-slide-in"
      >
        <div
          className="relative overflow-hidden rounded-2xl border border-indigo-500/30 shadow-2xl shadow-black/60"
          style={{ background: 'linear-gradient(135deg, hsl(215 28% 13%) 0%, hsl(215 28% 9%) 100%)' }}
        >
          <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
          <button
            onClick={() => handleDismiss(false)}
            className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-5 pr-10">
            <div className="flex items-center gap-3 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon-192x192.png"
                alt="Hogwarts CRM icon"
                className="w-12 h-12 rounded-xl border border-indigo-500/30 shrink-0"
              />
              <div>
                <p className="font-bold text-sm text-foreground">Install on iPhone / iPad</p>
                <p className="text-xs text-indigo-400 font-medium mt-0.5">Add to Home Screen</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Safari doesn&apos;t support automatic install. Follow these 2 quick steps:
            </p>

            <ol className="space-y-2.5 text-xs text-foreground/80">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-[10px]">1</span>
                <span>
                  Tap the{' '}
                  <span className="inline-flex items-center gap-0.5 text-indigo-400 font-medium">
                    <Share className="h-3 w-3" /> Share
                  </span>{' '}
                  button at the bottom of Safari
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-[10px]">2</span>
                <span>
                  Scroll down and tap{' '}
                  <span className="inline-flex items-center gap-0.5 text-indigo-400 font-medium">
                    <Plus className="h-3 w-3" /> Add to Home Screen
                  </span>
                </span>
              </li>
            </ol>

            <div className="mt-4 flex justify-center">
              <div className="text-[10px] text-muted-foreground text-center px-3 py-1.5 rounded-lg bg-white/5 border border-border/50">
                ↓ Safari toolbar is at the bottom of your screen
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
