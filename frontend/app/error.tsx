'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console
    console.error('Next.js Runtime Error Boundary Caught:', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center p-4">
      <Card className="max-w-md w-full border border-destructive/20 bg-card/40 backdrop-blur-md shadow-2xl relative overflow-hidden">
        {/* Glow effect background */}
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-destructive/10 blur-3xl pointer-events-none" />
        
        <CardHeader className="text-center pt-8">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive border border-destructive/20">
            <AlertOctagon className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Something went wrong</CardTitle>
          <CardDescription className="text-muted-foreground mt-1">
            An unexpected error occurred while rendering this page.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4 text-center">
          <div className="bg-destructive/5 border border-destructive/10 rounded-lg p-4 font-mono text-xs text-destructive text-left overflow-x-auto max-h-[150px]">
            {error.message || 'Unknown Application Error'}
            {error.digest && (
              <div className="text-[10px] text-muted-foreground mt-1">
                Digest ID: {error.digest}
              </div>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row gap-3 pt-4 pb-8">
          <Button
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          <Button
            variant="outline"
            asChild
            className="w-full flex items-center justify-center gap-2"
          >
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
