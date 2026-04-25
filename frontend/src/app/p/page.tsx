'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { publicApi } from '@/lib/api';
import { getInitials } from '@/lib/utils';

interface Stats {
  researchers: number;
  publications: number;
  citations: number;
  projects: number;
  publicProjects: number;
  hIndex?: number;
  hasData: boolean;
  sources?: {
    institutionId?: string;
    institutionName?: string;
    openAlexWorks?: number;
    openAlexCitations?: number;
    manualPublications?: number;
  };
}
interface Faculty { faculty: string; count: number }
interface RecentResearcher {
  id: string; slug: string; firstName: string; lastName: string;
  title?: string; faculty?: string; department?: string; avatar?: string;
}
interface RecentPublication {
  id: string; title: string; authors?: string; journal?: string;
  year?: number; doi?: string; type?: string; quartile?: string;
}

export default function PublicHomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [recent, setRecent] = useState<{ recentResearchers: RecentResearcher[]; recentPublications: RecentPublication[] } | null>(null);

  useEffect(() => {
    Promise.all([
      publicApi.stats().catch(() => ({ data: null })),
      publicApi.faculties().catch(() => ({ data: [] })),
      publicApi.recent().catch(() => ({ data: null })),
    ]).then(([s, f, r]) => {
      setStats(s.data);
      setFaculties(f.data || []);
      setRecent(r.data);
    });
  }, []);

  const fmt = (n: number | undefined) =>
    typeof n === 'number' && n > 0 ? new Intl.NumberFormat('tr-TR').format(n) : '-';

  return (
    <PublicLayout>
      {/* ═════ HERO - editorial ═════ */}
      <section className="relative overflow-hidden border-b" style={{ background: '#fefaf2', borderColor: 'rgba(15, 36, 68, 0.12)' }}>
        {/* Dekoratif geometrik desen */}
        <div className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(45deg, #0f2444 25%, transparent 25%),
              linear-gradient(-45deg, #0f2444 25%, transparent 25%)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="max-w-[1280px] mx-auto px-6 py-20 md:py-28 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-7">
              <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-5 flex items-center gap-3" style={{ color: '#8a7a52' }}>
                <span className="h-px w-12" style={{ background: '#c8a45a' }} />
                MKÜ TTO · {new Date().getFullYear()}
              </p>
              <h1 className="text-5xl md:text-7xl font-bold leading-[0.98] tracking-tight"
                style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                Üniversitemizde<br />
                <span style={{ fontStyle: 'italic', color: '#a88a3f' }}>üretilen bilim</span>,<br />
                tek bir yerde.
              </h1>
              <p className="mt-6 text-base md:text-lg leading-relaxed max-w-xl" style={{ color: '#4b5563' }}>
                Araştırmacılarımızın yayınlarına, yürüttükleri projelere ve kurumsal
                işbirliklerine açık erişim. Araştırmanızın peşinden hiç durmayın.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/p/arastirmacilar"
                  className="group inline-flex items-center gap-3 px-7 py-3.5 text-sm font-semibold text-white transition-all"
                  style={{ background: '#0f2444', borderRadius: 1 }}
                >
                  Araştırmacıları keşfet
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <Link
                  href="/auth/login"
                  className="text-sm font-semibold tracking-wide inline-flex items-center gap-2 pb-0.5 border-b-2"
                  style={{ color: '#0f2444', borderColor: '#c8a45a' }}
                >
                  Akademisyen girişi
                </Link>
              </div>
            </div>

            {/* Institutional emblem */}
            <div className="lg:col-span-5 hidden lg:block">
              <div className="relative">
                <div className="aspect-square max-w-md ml-auto border-2 flex items-center justify-center" style={{ borderColor: 'rgba(200, 164, 90, 0.4)' }}>
                  <div className="absolute inset-4 border flex items-center justify-center" style={{ borderColor: 'rgba(15, 36, 68, 0.15)' }}>
                    <div className="text-center px-8">
                      <p className="text-[10px] tracking-[0.3em] uppercase mb-5 font-semibold" style={{ color: '#8a7a52' }}>Est. 1992</p>
                      <div className="w-16 h-px mx-auto mb-5" style={{ background: '#c8a45a' }} />
                      <p className="text-3xl tracking-tight leading-tight" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                        Hatay<br />
                        <span style={{ fontStyle: 'italic' }}>Mustafa Kemal</span><br />
                        Üniversitesi
                      </p>
                      <div className="w-16 h-px mx-auto mt-5" style={{ background: '#c8a45a' }} />
                      <p className="text-[10px] tracking-[0.3em] uppercase mt-5 font-semibold" style={{ color: '#8a7a52' }}>Antakya</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════ STATS - magazin başyazısı rakamları ═════ */}
      {stats && (
        <section className="border-b" style={{ borderColor: 'rgba(15, 36, 68, 0.12)', background: '#ffffff' }}>
          <div className="max-w-[1280px] mx-auto px-6 py-14">
            <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-1" style={{ color: '#8a7a52' }}>
              Rakamlarla
            </p>
            <h2 className="text-3xl md:text-4xl mb-10 tracking-tight" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
              Kurumsal Üretim
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-t border-l" style={{ borderColor: 'rgba(15, 36, 68, 0.12)' }}>
              <StatCell label="Araştırmacı" value={fmt(stats.researchers)} />
              <StatCell label="Yayın" value={fmt(stats.publications)} hero />
              <StatCell label="Atıf" value={fmt(stats.citations)} hero />
              <StatCell label="h-index" value={fmt(stats.hIndex)} />
              <StatCell label="Aktif Proje" value={fmt(stats.projects)} />
            </div>
            {stats.sources?.openAlexWorks ? (
              <p className="mt-5 text-xs italic" style={{ color: '#9ca3af' }}>
                ※ Kurumsal bibliyometrik veriler OpenAlex üzerinden canlı çekilmektedir
                {stats.sources.institutionName ? ` · ${stats.sources.institutionName}` : ''}.
              </p>
            ) : null}
          </div>
        </section>
      )}

      {/* ═════ FACULTIES - editorial liste ═════ */}
      {faculties.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
            <div className="lg:col-span-4">
              <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-1" style={{ color: '#8a7a52' }}>
                Dizin
              </p>
              <h2 className="text-3xl md:text-4xl tracking-tight leading-tight" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                Fakülteler ve<br />
                <span style={{ fontStyle: 'italic', color: '#a88a3f' }}>araştırma alanları</span>
              </h2>
            </div>
            <div className="lg:col-span-8">
              <div className="border-t border-b divide-y" style={{ borderColor: 'rgba(15, 36, 68, 0.2)' }}>
                {faculties.map((f, idx) => (
                  <Link
                    key={f.faculty}
                    href={`/p/arastirmacilar?faculty=${encodeURIComponent(f.faculty)}`}
                    className="flex items-baseline justify-between py-4 group hover:pl-2 transition-all"
                  >
                    <div className="flex items-baseline gap-5 min-w-0">
                      <span className="text-xs tabular-nums font-mono" style={{ color: '#a88a3f' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-base md:text-lg font-medium truncate transition-colors group-hover:text-[#a88a3f]"
                        style={{ color: '#0f2444', fontFamily: 'Playfair Display, serif' }}>
                        {f.faculty}
                      </span>
                    </div>
                    <span className="text-sm tabular-nums flex items-center gap-2 flex-shrink-0" style={{ color: '#6b7280' }}>
                      <span className="font-semibold">{f.count}</span>
                      <span className="text-xs">araştırmacı</span>
                      <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="#a88a3f" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═════ RECENT RESEARCHERS - profil kartları (editorial) ═════ */}
      {recent && recent.recentResearchers.length > 0 && (
        <section className="border-t" style={{ borderColor: 'rgba(15, 36, 68, 0.12)', background: '#fefaf2' }}>
          <div className="max-w-[1280px] mx-auto px-6 py-16">
            <div className="flex items-baseline justify-between mb-10">
              <div>
                <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-1" style={{ color: '#8a7a52' }}>
                  Yeni
                </p>
                <h2 className="text-3xl md:text-4xl tracking-tight" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                  Öne Çıkan Araştırmacılar
                </h2>
              </div>
              <Link href="/p/arastirmacilar" className="hidden md:inline-flex items-center gap-2 text-sm font-semibold pb-0.5 border-b-2"
                style={{ color: '#0f2444', borderColor: '#c8a45a' }}>
                Tümünü gör
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: 'rgba(15, 36, 68, 0.12)', border: '1px solid rgba(15, 36, 68, 0.12)' }}>
              {recent.recentResearchers.slice(0, 6).map((r, idx) => (
                <Link
                  key={r.id}
                  href={`/p/${r.slug || r.id}`}
                  className="bg-white p-6 hover:bg-[#fefaf2] transition-colors group flex items-start gap-4"
                >
                  {r.avatar ? (
                    <img src={r.avatar} alt="" className="w-16 h-16 object-cover flex-shrink-0" style={{ borderRadius: 1 }} />
                  ) : (
                    <div className="w-16 h-16 flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                      style={{ background: '#0f2444', borderRadius: 1, fontFamily: 'Playfair Display, serif' }}>
                      {getInitials(r.firstName, r.lastName)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: '#a88a3f' }}>
                      № {String(idx + 1).padStart(2, '0')} · {r.title || 'Araştırmacı'}
                    </p>
                    <p className="text-xl leading-tight group-hover:text-[#a88a3f] transition-colors" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                      {r.firstName} {r.lastName}
                    </p>
                    <p className="text-xs mt-2" style={{ color: '#6b7280' }}>{r.faculty || '-'}</p>
                    {r.department && <p className="text-[11px] italic mt-0.5" style={{ color: '#9ca3af' }}>{r.department}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═════ RECENT PUBLICATIONS - derginin içindekiler sayfası ═════ */}
      {recent && recent.recentPublications.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4">
              <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-1" style={{ color: '#8a7a52' }}>
                Vitrin
              </p>
              <h2 className="text-3xl md:text-4xl tracking-tight leading-tight mb-4" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                Son <span style={{ fontStyle: 'italic', color: '#a88a3f' }}>yayınlar</span>
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
                Portala yakın zamanda eklenmiş akademik çıktılar - makaleler, bildiriler
                ve kitap bölümleri.
              </p>
            </div>
            <div className="lg:col-span-8">
              <div className="border-t divide-y" style={{ borderColor: 'rgba(15, 36, 68, 0.2)', borderTopWidth: 2 }}>
                {recent.recentPublications.slice(0, 6).map((p, idx) => (
                  <article key={p.id} className="py-5 group">
                    <div className="flex items-baseline gap-5 mb-2">
                      <span className="text-xs tabular-nums font-mono flex-shrink-0 pt-1" style={{ color: '#a88a3f' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg leading-snug mb-1.5" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                          {p.title}
                        </h3>
                        {p.authors && (
                          <p className="text-xs italic mb-2 line-clamp-1" style={{ color: '#6b7280' }}>
                            {p.authors}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: '#6b7280' }}>
                          {p.journal && <span className="italic">{p.journal}</span>}
                          {p.year && <span className="tabular-nums">{p.year}</span>}
                          {p.quartile && (
                            <span className="font-bold px-1.5 py-0.5" style={{ background: p.quartile === 'Q1' ? '#dcfce7' : '#f3f4f6', color: p.quartile === 'Q1' ? '#15803d' : '#374151', borderRadius: 1 }}>
                              {p.quartile}
                            </span>
                          )}
                          {p.doi && (
                            <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" className="font-medium hover:underline" style={{ color: '#a88a3f' }}>
                              DOI ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═════ EMPTY STATE ═════ */}
      {stats && !stats.hasData && (
        <section className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="inline-block pt-8 pb-10 px-12 border" style={{ borderColor: 'rgba(15, 36, 68, 0.2)' }}>
            <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-3" style={{ color: '#8a7a52' }}>
              Hazırlanıyor
            </p>
            <h3 className="text-2xl tracking-tight mb-3" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
              Portal yakında <span style={{ fontStyle: 'italic' }}>içerikle</span> dolacak
            </h3>
            <p className="text-sm max-w-sm" style={{ color: '#6b7280' }}>
              Araştırmacılar profillerini tamamladıkça vitrin burada görünmeye başlayacak.
            </p>
          </div>
        </section>
      )}
    </PublicLayout>
  );
}

// ─────────────────────────────────────────────────────────────
function StatCell({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <div className="px-6 py-7 border-r border-b" style={{ borderColor: 'rgba(15, 36, 68, 0.12)' }}>
      <p className="text-[10px] tracking-[0.22em] uppercase font-bold mb-3" style={{ color: '#8a7a52' }}>
        {label}
      </p>
      <p className={`${hero ? 'text-4xl md:text-5xl' : 'text-3xl md:text-4xl'} font-bold tabular-nums tracking-tight`}
        style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
        {value}
      </p>
    </div>
  );
}
