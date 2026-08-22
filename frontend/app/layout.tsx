import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth-context';
import { PWAInstallPrompt } from '@/components/shared/PWAInstallPrompt';
import maintenanceData from '../maintenance.json';
import { MaintenanceScreen } from '@/components/shared/MaintenanceScreen';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Hogwarts Media & Studios — Production CRM',
  description:
    'Enterprise B2B CRM & production workflow management for media productions.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Hogwarts CRM',
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (maintenanceData.isMaintenance) {
    return (
      <html lang="en" className={inter.variable}>
        <body className="font-sans antialiased min-h-screen bg-background text-foreground flex items-center justify-center">
          <MaintenanceScreen reason={maintenanceData.reason} />
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.warn('SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="bottom-right" />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
