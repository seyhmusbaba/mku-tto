'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { publicApi } from '@/lib/api';

interface Props {
  children: React.ReactNode;
  showSearch?: boolean;
}

/**
 * Vitrin portalı için profesyonel akademik layout —
 * üstte ince üst şerit, altında temiz header, footer'da iletişim.
 * Sıkı beyaz arka plan, koyu lacivert header, altın accent.
 */
export function PublicLayout({ children, showSearch = true }: Props) {
  const router = useRouter();
  const [institution, setInstitution] = useState({
    siteName: 'Hatay Mustafa Kemal Üniversitesi',
    institutionName: 'Hatay Mustafa Kemal Üniversitesi',
    logoUrl: '',
  });
  const [search, setSearch] = useState('');

  useEffect(() => {
    publicApi.institution().then(r => setInstitution(r.data)).catch(() => {});
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (q.length < 2) return;
    router.push(`/p/arastirmacilar?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ fontFamily: '"Inter", system-ui, -apple-system, sans-serif' }}>
      {/* Top bar — kurumsal bilgi */}
      <div className="border-b" style={{ background: '#0a1628', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 py-1.5 flex items-center justify-between text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <span className="tracking-wide">Akademik Veri Yönetim Sistemi · Araştırma Portalı</span>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="hover:text-white transition-colors flex items-center gap-1">
              Akademisyen Girişi
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className="sticky top-0 z-20 border-b" style={{ background: '#ffffff', borderColor: '#e5e7eb' }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-8">
            {/* Logo */}
            <Link href="/p" className="flex items-center gap-3 min-w-0 flex-shrink-0">
              {institution.logoUrl ? (
                <img src={institution.logoUrl} alt={institution.siteName} className="w-10 h-10 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: '#0f2444' }}>
                  <span className="text-white font-bold text-sm tracking-tight">
                    {institution.siteName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0 hidden sm:block">
                <p className="font-semibold text-sm tracking-tight leading-tight" style={{ color: '#0f2444' }}>
                  {institution.siteName}
                </p>
                <p className="text-[11px] leading-none mt-0.5" style={{ color: '#6b7280' }}>Araştırma Portalı</p>
              </div>
            </Link>

            {/* Search — sadece sticky, orta */}
            {showSearch && (
              <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-lg">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Araştırmacı, yayın, proje ara..."
                    className="w-full pl-10 pr-4 py-2 rounded text-sm border focus:outline-none transition-colors"
                    style={{
                      borderColor: '#e5e7eb',
                      background: '#f9fafb',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#0f2444'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#f9fafb'; }}
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#6b7280" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
              </form>
            )}

            {/* Nav */}
            <nav className="flex items-center gap-1 flex-shrink-0">
              <NavLink href="/p">Ana Sayfa</NavLink>
              <NavLink href="/p/arastirmacilar">Araştırmacılar</NavLink>
            </nav>
          </div>

          {/* Mobile search */}
          {showSearch && (
            <form onSubmit={submitSearch} className="md:hidden mt-3">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Araştırmacı, yayın ara..."
                  className="w-full pl-10 pr-4 py-2 rounded text-sm border focus:outline-none"
                  style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#6b7280" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
            </form>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t" style={{ background: '#0a1628', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
            <div className="md:col-span-2">
              <p className="font-semibold text-white mb-2 text-base">{institution.institutionName}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Teknoloji Transfer Ofisi — akademik araştırmaları, yayınları ve kurumsal<br />
                işbirliklerini kamuya açan dijital vitrin.
              </p>
            </div>
            <div>
              <p className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">İletişim</p>
              <address className="not-italic text-xs space-y-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <p>Tayfur Sökmen Kampüsü<br />Rektörlük Binası, Antakya</p>
                <p>+90 326 245 53 64</p>
                <a href="mailto:tto@mku.edu.tr" className="hover:text-white block">tto@mku.edu.tr</a>
              </address>
            </div>
            <div>
              <p className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Bağlantılar</p>
              <ul className="text-xs space-y-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <li><Link className="hover:text-white" href="/p">Ana Sayfa</Link></li>
                <li><Link className="hover:text-white" href="/p/arastirmacilar">Araştırmacılar</Link></li>
                <li><Link className="hover:text-white" href="/auth/login">Akademisyen Girişi</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="max-w-7xl mx-auto px-6 py-4 text-[11px] flex flex-col md:flex-row justify-between gap-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span>© {new Date().getFullYear()} {institution.institutionName}</span>
            <span>TTO Akademik Portal · v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 text-sm font-medium hover:text-[#0f2444] transition-colors rounded"
      style={{ color: '#374151' }}
    >
      {children}
    </Link>
  );
}
