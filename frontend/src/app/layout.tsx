import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from 'react-hot-toast';
import { SiteHead } from '@/components/SiteHead';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'MKÜ TTO - Proje Yönetim Sistemi',
  description: 'Hatay Mustafa Kemal Üniversitesi Teknoloji Transfer Ofisi Proje Yönetim Sistemi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <AuthProvider>
          <SiteHead />
          <ErrorBoundary label="Uygulama kökü">
            {children}
          </ErrorBoundary>
          <Toaster position="top-right" toastOptions={{ className: 'font-sans text-sm', duration: 3000 }} />
        </AuthProvider>
      </body>
    </html>
  );
}
