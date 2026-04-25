'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { publicApi } from '@/lib/api';

interface Props {
  children: React.ReactNode;
  showSearch?: boolean;
}

/**
 * Editorial akademik portal layout - serif başlıklar, krem-lacivert-altın
 * paleti, dergi/gazete hissiyatı. Magazin stili header/footer.
 */
export function PublicLayout({ children, showSearch = true }: Props) {
  const router = useRouter();
  const pathname = usePathname() || '';
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

  const isActive = (href: string) => pathname === href || (href !== '/p' && pathname.startsWith(href));

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f6f3ec' }}>
      {/* ═════ Top ribbon ═════ */}
      <div style={{ background: '#0a1628' }}>
        <div className="max-w-[1280px] mx-auto px-6 py-2 flex items-center justify-between text-[10.5px] tracking-[0.18em] uppercase font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <span className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full" style={{ background: '#c8a45a' }} />
            Akademik Araştırma Portalı
          </span>
          <Link href="/auth/login" className="hover:text-white transition-colors flex items-center gap-1.5">
            Akademisyen Girişi
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ═════ Main header - masthead ═════ */}
      <header className="sticky top-0 z-30 border-b" style={{ background: '#fefaf2', borderColor: 'rgba(15, 36, 68, 0.12)' }}>
        <div className="max-w-[1280px] mx-auto">
          {/* Masthead row - büyük logo */}
          <div className="px-6 pt-5 pb-4 flex items-center justify-between gap-6">
            <Link href="/p" className="flex items-center gap-4 min-w-0 flex-shrink-0 group">
              {institution.logoUrl ? (
                <img src={institution.logoUrl} alt={institution.siteName}
                  className="w-12 h-12 rounded object-cover flex-shrink-0 transition-transform group-hover:scale-105" />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                  style={{ background: '#0f2444', borderRadius: 2 }}>
                  <span className="text-white font-bold text-sm tracking-tighter" style={{ fontFamily: 'Playfair Display, serif' }}>
                    HMKÜ
                  </span>
                </div>
              )}
              <div className="min-w-0 hidden sm:block">
                <p className="text-[10.5px] tracking-[0.22em] uppercase font-semibold" style={{ color: '#8a7a52' }}>
                  Araştırma Portalı
                </p>
                <p className="font-bold text-lg leading-tight tracking-tight"
                  style={{ color: '#0f2444', fontFamily: 'Playfair Display, serif' }}>
                  {institution.siteName.replace('Üniversitesi', 'Ü.').substring(0, 40)}
                </p>
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
                    placeholder="Araştırmacı, yayın, konu ara..."
                    className="w-full pl-11 pr-4 py-2.5 text-[13.5px] border bg-white focus:outline-none transition-all"
                    style={{ borderColor: 'rgba(15, 36, 68, 0.15)', borderRadius: 1 }}
                  />
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#8a7a52" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
              </form>
            )}
          </div>

          {/* Navigation bar - serif tabs */}
          <nav className="px-6 border-t flex items-center gap-1" style={{ borderColor: 'rgba(15, 36, 68, 0.08)' }}>
            {[
              { href: '/p', label: 'Ana Sayfa' },
              { href: '/p/arastirmacilar', label: 'Araştırmacılar' },
            ].map(item => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="py-3 px-4 text-[13px] font-medium tracking-wide transition-colors relative"
                  style={{ color: active ? '#0f2444' : '#6b7280' }}
                >
                  {item.label}
                  {active && (
                    <span className="absolute bottom-0 left-4 right-4 h-0.5" style={{ background: '#c8a45a' }} />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* ═════ Footer - dergi kolofonu ═════ */}
      <footer className="mt-24" style={{ background: '#0a1628', color: 'rgba(255,255,255,0.7)' }}>
        <div className="max-w-[1280px] mx-auto px-6 py-14">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            <div className="md:col-span-6">
              <p className="text-[10.5px] tracking-[0.22em] uppercase font-semibold mb-4" style={{ color: '#c8a45a' }}>
                Kolofon
              </p>
              <p className="text-xl tracking-tight mb-3" style={{ fontFamily: 'Playfair Display, serif', color: '#ffffff' }}>
                {institution.institutionName}
              </p>
              <p className="text-sm leading-relaxed max-w-md" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Teknoloji Transfer Ofisi bünyesinde yürütülen akademik araştırma
                çıktılarının, kurumsal işbirliklerinin ve bilimsel üretimin açık
                dijital vitrinidir.
              </p>
            </div>
            <div className="md:col-span-3">
              <p className="text-[10.5px] tracking-[0.22em] uppercase font-semibold mb-4" style={{ color: '#c8a45a' }}>
                İletişim
              </p>
              <address className="not-italic text-sm space-y-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <p>Tayfur Sökmen Kampüsü<br />Rektörlük Binası, Antakya</p>
                <p className="pt-2">+90 326 245 53 64</p>
                <a href="mailto:tto@mku.edu.tr" className="hover:text-white block">tto@mku.edu.tr</a>
              </address>
            </div>
            <div className="md:col-span-3">
              <p className="text-[10.5px] tracking-[0.22em] uppercase font-semibold mb-4" style={{ color: '#c8a45a' }}>
                Bağlantılar
              </p>
              <ul className="text-sm space-y-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <li><Link className="hover:text-white" href="/p">Ana Sayfa</Link></li>
                <li><Link className="hover:text-white" href="/p/arastirmacilar">Araştırmacılar</Link></li>
                <li><Link className="hover:text-white" href="/auth/login">Akademisyen Girişi</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="max-w-[1280px] mx-auto px-6 py-4 text-[10.5px] tracking-[0.15em] uppercase flex flex-col md:flex-row justify-between gap-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span>© {new Date().getFullYear()} · {institution.institutionName}</span>
            <span>TTO Araştırma Portalı · V1</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
