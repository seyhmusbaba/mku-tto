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

// Dark mode flash'ini önle — HTML parse edilirken hemen uygula
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('tto_theme');
    if (!t && window.matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark';
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
