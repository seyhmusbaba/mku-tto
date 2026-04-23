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
 * Vitrin portalı için AVESİS tarzı layout — yan menü yok, üstte
 * kurumsal header, altta iletişim footer'ı. Anonim ziyaretçilere yönelik.
 */
export function PublicLayout({ children, showSearch = true }: Props) {
  const router = useRouter();
  const [institution, setInstitution] = useState<{ siteName: string; institutionName: string; logoUrl: string }>({
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
    <div className="min-h-screen flex flex-col" style={{ background: '#f7f5f1' }}>
      {/* ═════ Top bar ═════ */}
      <div style={{ background: '#0a1a30' }}>
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between text-[11px] text-white/60">
          <span>Akademik Veri Yönetim Sistemi</span>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="hover:text-white transition-colors">
              Araştırmacı Girişi →
            </Link>
          </div>
        </div>
      </div>

      {/* ═════ Header ═════ */}
      <header className="sticky top-0 z-20 shadow-sm" style={{ background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-6">
            {/* Logo + Title */}
            <Link href="/p" className="flex items-center gap-3 group min-w-0">
              {institution.logoUrl ? (
                <img src={institution.logoUrl} alt={institution.siteName} className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#c8a45a,#e8c97a)' }}>
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                  </svg>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white font-bold text-sm leading-tight truncate">{institution.siteName}</p>
                <p className="text-white/50 text-[10px] leading-none mt-1">Akademik Portal</p>
              </div>
            </Link>

            {/* Search */}
            {showSearch && (
              <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-md">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Araştırmacı, yayın, proje ara..."
                    className="w-full pl-10 pr-4 py-2 rounded-full text-sm border focus:outline-none focus:ring-2 focus:ring-[#c8a45a]/50 bg-white/95"
                    style={{ borderColor: 'transparent' }}
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0f2444]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  placeholder="Araştırmacı, yayın, proje ara..."
                  className="w-full pl-10 pr-4 py-2 rounded-full text-sm border focus:outline-none focus:ring-2 bg-white/95"
                  style={{ borderColor: 'transparent' }}
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0f2444]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

      {/* ═════ Footer ═════ */}
      <footer className="mt-16" style={{ background: '#0a1a30', color: 'rgba(255,255,255,0.7)' }}>
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="font-semibold text-white mb-2">{institution.institutionName}</p>
            <p className="text-xs leading-relaxed">
              Teknoloji Transfer Ofisi<br />
              Tayfur Sökmen Kampüsü, Rektörlük Binası<br />
              Hatay / Antakya
            </p>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">İletişim</p>
            <p className="text-xs leading-relaxed">
              Tel: 0 (326) 245 53 64<br />
              E-posta: tto@mku.edu.tr
            </p>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">Bağlantılar</p>
            <ul className="text-xs space-y-1">
              <li><Link className="hover:text-white" href="/p">Ana Sayfa</Link></li>
              <li><Link className="hover:text-white" href="/p/arastirmacilar">Araştırmacılar</Link></li>
              <li><Link className="hover:text-white" href="/auth/login">Araştırmacı Girişi</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-3 text-[11px] text-white/40 flex flex-col md:flex-row justify-between gap-2">
            <span>© {new Date().getFullYear()} {institution.institutionName}. Tüm hakları saklıdır.</span>
            <span>TTO Akademik Portal</span>
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
      className="px-3 py-1.5 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
    >
      {children}
    </Link>
  );
}
