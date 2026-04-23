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
  maxHIndex: number;
  hasData: boolean;
  sources?: {
    scopusPublications: number;
    scopusCitations: number;
    wosPublications: number;
    wosCitations: number;
    manualPublications: number;
  };
}
interface Faculty { faculty: string; count: number }
interface RecentResearcher {
  id: string; slug: string; firstName: string; lastName: string;
  title?: string; faculty?: string; department?: string; avatar?: string;
  expertiseArea?: string;
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
    typeof n === 'number' && n > 0 ? new Intl.NumberFormat('tr-TR').format(n) : '—';

  return (
    <PublicLayout>
      {/* ═════ Hero ═════ */}
      <section className="border-b" style={{ borderColor: '#e5e7eb', background: '#fafaf9' }}>
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#9ca3af' }}>
              Araştırma Portalı
            </p>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1]" style={{ color: '#0f2444' }}>
              Bilim üretimimizi<br />
              <span style={{ color: '#c8a45a' }}>tek bir yerde</span> keşfedin
            </h1>
            <p className="mt-5 text-base leading-relaxed max-w-lg" style={{ color: '#4b5563' }}>
              Hatay Mustafa Kemal Üniversitesi'ndeki araştırmacılar, yayınlar, projeler ve
              kurumsal işbirliklerine açık erişim.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link
                href="/p/arastirmacilar"
                className="px-5 py-2.5 rounded text-sm font-semibold text-white transition-all"
                style={{ background: '#0f2444' }}
              >
                Araştırmacıları keşfet →
              </Link>
              <Link
                href="/auth/login"
                className="px-5 py-2.5 rounded text-sm font-semibold border transition-all hover:bg-gray-50"
                style={{ borderColor: '#d1d5db', color: '#374151' }}
              >
                Akademisyen girişi
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═════ Stats — akademik kompakt ═════ */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#6b7280' }}>
          Kurumsal Göstergeler
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-lg overflow-hidden border" style={{ borderColor: '#e5e7eb', background: '#e5e7eb' }}>
          <StatCell label="Araştırmacı" value={fmt(stats?.researchers)} />
          <StatCell label="Yayın" value={fmt(stats?.publications)} sub="Scopus & WoS" />
          <StatCell label="Atıf" value={fmt(stats?.citations)} sub="Toplam" />
          <StatCell label="Aktif Proje" value={fmt(stats?.projects)} />
        </div>
        {stats?.sources && (
          <p className="mt-3 text-[11px]" style={{ color: '#9ca3af' }}>
            Kaynaklar: Scopus ({new Intl.NumberFormat('tr-TR').format(stats.sources.scopusPublications)} yayın, {new Intl.NumberFormat('tr-TR').format(stats.sources.scopusCitations)} atıf)
            {stats.sources.wosPublications > 0 && ` · Web of Science (${new Intl.NumberFormat('tr-TR').format(stats.sources.wosPublications)} yayın)`}
            {stats.sources.manualPublications > 0 && ` · Manuel kayıt (${new Intl.NumberFormat('tr-TR').format(stats.sources.manualPublications)})`}
          </p>
        )}
      </section>

      {/* ═════ Faculties ═════ */}
      {faculties.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-12">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6b7280' }}>
              Fakülteler
            </h2>
            <span className="text-xs" style={{ color: '#9ca3af' }}>{faculties.length} fakülte</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px rounded-lg overflow-hidden border" style={{ borderColor: '#e5e7eb', background: '#e5e7eb' }}>
            {faculties.map(f => (
              <Link
                key={f.faculty}
                href={`/p/arastirmacilar?faculty=${encodeURIComponent(f.faculty)}`}
                className="flex items-center justify-between px-4 py-3 bg-white hover:bg-[#fafaf9] transition-colors group"
              >
                <span className="text-sm font-medium truncate pr-3" style={{ color: '#0f2444' }}>{f.faculty}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-semibold tabular-nums" style={{ color: '#6b7280' }}>{f.count}</span>
                  <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="#0f2444" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═════ Recent Researchers ═════ */}
      {recent && recent.recentResearchers.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-12">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6b7280' }}>
              Son Güncellenen Profiller
            </h2>
            <Link href="/p/arastirmacilar" className="text-xs font-semibold hover:underline" style={{ color: '#0f2444' }}>
              Tümünü gör →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recent.recentResearchers.slice(0, 8).map(r => (
              <Link
                key={r.id}
                href={`/p/${r.slug || r.id}`}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:border-[#0f2444] transition-all group"
                style={{ borderColor: '#e5e7eb' }}
              >
                {r.avatar ? (
                  <img src={r.avatar} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
                    style={{ background: '#0f2444' }}>
                    {getInitials(r.firstName, r.lastName)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate" style={{ color: '#0f2444' }}>
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-[11px] truncate mt-0.5" style={{ color: '#6b7280' }}>
                    {r.title ? `${r.title} · ` : ''}{r.faculty || '—'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═════ Recent Publications ═════ */}
      {recent && recent.recentPublications.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#6b7280' }}>
            Son Eklenen Yayınlar
          </h2>
          <div className="bg-white rounded-lg border divide-y" style={{ borderColor: '#e5e7eb' }}>
            {recent.recentPublications.slice(0, 8).map(p => (
              <div key={p.id} className="p-4 hover:bg-[#fafaf9] transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-snug" style={{ color: '#0f2444' }}>{p.title}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: '#6b7280' }}>
                      {p.authors && <span className="truncate max-w-md">{p.authors}</span>}
                      {p.journal && <span className="italic">{p.journal}</span>}
                      {p.doi && (
                        <a className="hover:underline" style={{ color: '#0f2444' }} href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">
                          DOI
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {p.year && (
                      <span className="text-xs font-semibold tabular-nums" style={{ color: '#6b7280' }}>{p.year}</span>
                    )}
                    {p.quartile && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: p.quartile === 'Q1' ? '#dcfce7' : '#f3f4f6', color: p.quartile === 'Q1' ? '#15803d' : '#374151' }}>
                        {p.quartile}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═════ Empty state ═════ */}
      {stats && !stats.hasData && (
        <section className="max-w-2xl mx-auto px-6 py-20 text-center">
          <svg className="w-14 h-14 mx-auto" fill="none" viewBox="0 0 24 24" stroke="#d1d5db" strokeWidth={1.3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="mt-5 text-base font-semibold" style={{ color: '#0f2444' }}>Portal yakında içerikle dolacak</h3>
          <p className="mt-2 text-sm" style={{ color: '#6b7280' }}>
            Araştırmacılar profillerini tamamladıkça burada görünmeye başlayacak.
          </p>
        </section>
      )}
    </PublicLayout>
  );
}

// ─────────────────────────────────────────────────────────────
function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-6 py-7 bg-white">
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>{label}</p>
      <p className="text-3xl font-bold tabular-nums mt-2 tracking-tight" style={{ color: '#0f2444' }}>{value}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: '#9ca3af' }}>{sub}</p>}
    </div>
  );
}
