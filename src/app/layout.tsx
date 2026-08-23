import type { Metadata, Viewport } from 'next';

import { ToastProvider } from '@/state/toast';
import { ServiceWorker } from '@/components/service-worker';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Semilla · Haz crecer lo que tienes',
    template: '%s · Semilla',
  },
  description: 'Economía familiar compartida. Cada decisión cuenta.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Semilla',
  appleWebApp: {
    capable: true,
    title: 'Semilla',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon-180.png' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#FAF8F3',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
