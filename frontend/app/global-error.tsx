'use client';

import { useEffect } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root Layout Critical Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 antialiased">
        <div className="max-w-md w-full border border-destructive/20 bg-card p-8 rounded-lg shadow-2xl text-center space-y-6">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20">
            <AlertOctagon className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Critical Error</h1>
            <p className="text-sm text-muted-foreground">
              A critical application error occurred.
            </p>
          </div>
          <div className="bg-destructive/5 border border-destructive/10 rounded-lg p-4 font-mono text-xs text-destructive text-left overflow-x-auto">
            {error.message || 'Root Application Crash'}
          </div>
          <button
            onClick={() => reset()}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/95 h-10 px-4 py-2 rounded-md font-medium text-sm transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Refresh Application
          </button>
        </div>
      </body>
    </html>
  );
}
