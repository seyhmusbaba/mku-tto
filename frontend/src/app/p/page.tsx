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
  maxHIndex: number;
  hasData: boolean;
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
    typeof n === 'number' ? new Intl.NumberFormat('tr-TR').format(n) : '—';

  return (
    <PublicLayout>
      {/* ═════ Hero ═════ */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 55%, #264d82 100%)' }}>
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 75% 30%, rgba(200,164,90,0.6), transparent 55%)' }} />
        <div className="max-w-7xl mx-auto px-4 py-16 relative">
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              Akademik Araştırma Portalı
            </h1>
            <p className="text-white/70 mt-3 text-sm md:text-base leading-relaxed">
              Hatay Mustafa Kemal Üniversitesi'ndeki araştırmacıları, yayınları, projeleri ve kurumsal
              işbirliklerini tek bir yerde keşfedin.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/p/arastirmacilar" className="px-5 py-2.5 rounded-full bg-white text-[#0f2444] text-sm font-semibold hover:bg-white/90 transition-all">
                Araştırmacıları Keşfet →
              </Link>
              <Link href="/auth/login" className="px-5 py-2.5 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-all">
                Araştırmacı Girişi
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═════ Stats ═════ */}
      <section className="max-w-7xl mx-auto px-4 -mt-10 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <StatCard label="Araştırmacı" value={fmt(stats?.researchers)} icon="users" />
          <StatCard label="Yayın" value={fmt(stats?.publications)} icon="book" />
          <StatCard label="Atıf" value={fmt(stats?.citations)} icon="quote" />
          <StatCard label="Proje" value={fmt(stats?.projects)} icon="clipboard" />
          <StatCard label="Max h-index" value={fmt(stats?.maxHIndex)} icon="chart" />
        </div>
      </section>

      {/* ═════ Faculties ═════ */}
      {faculties.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 mt-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#0f2444]/70 mb-4">Fakülteler</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {faculties.map(f => (
              <Link
                key={f.faculty}
                href={`/p/arastirmacilar?faculty=${encodeURIComponent(f.faculty)}`}
                className="group flex items-center justify-between p-3.5 rounded-xl bg-white border hover:border-[#c8a45a] hover:shadow-md transition-all"
                style={{ borderColor: '#e8e4dc' }}
              >
                <span className="text-sm font-medium text-[#0f2444] truncate pr-2">{f.faculty}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#f0ede8] text-[#0f2444] flex-shrink-0 group-hover:bg-[#c8a45a] group-hover:text-white transition-colors">
                  {f.count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═════ Recent researchers ═════ */}
      {recent && recent.recentResearchers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 mt-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#0f2444]/70">Son Güncellenen Profiller</h2>
            <Link href="/p/arastirmacilar" className="text-xs font-semibold text-[#1a3a6b] hover:text-[#c8a45a]">
              Tümünü gör →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {recent.recentResearchers.slice(0, 8).map(r => (
              <Link
                key={r.id}
                href={`/p/${r.slug || r.id}`}
                className="bg-white rounded-xl border p-4 hover:border-[#c8a45a] hover:shadow-md transition-all flex items-center gap-3"
                style={{ borderColor: '#e8e4dc' }}
              >
                {r.avatar ? (
                  <img src={r.avatar} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #0f2444, #1a3a6b)' }}
                  >
                    {getInitials(r.firstName, r.lastName)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0f2444] text-sm leading-tight truncate">
                    {r.title && <span className="text-[#c8a45a]">{r.title} </span>}
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5 truncate">{r.faculty || '—'}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═════ Recent publications ═════ */}
      {recent && recent.recentPublications.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 mt-10 mb-16">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#0f2444]/70 mb-4">Son Eklenen Yayınlar</h2>
          <div className="bg-white rounded-xl border divide-y" style={{ borderColor: '#e8e4dc' }}>
            {recent.recentPublications.slice(0, 8).map(p => (
              <div key={p.id} className="p-4 hover:bg-[#faf8f4] transition-colors">
                <div className="flex items-start gap-2 flex-wrap">
                  <p className="font-medium text-[#0f2444] text-sm leading-snug flex-1 min-w-0">{p.title}</p>
                  {p.quartile && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{p.quartile}</span>
                  )}
                  {p.year && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f0ede8] text-[#0f2444]">{p.year}</span>
                  )}
                </div>
                <div className="mt-1.5 text-xs text-muted flex flex-wrap gap-x-3 gap-y-0.5">
                  {p.authors && <span className="truncate max-w-md">👥 {p.authors}</span>}
                  {p.journal && <span className="italic">📘 {p.journal}</span>}
                  {p.doi && <a className="text-blue-600 hover:underline" href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">DOI</a>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═════ Empty state ═════ */}
      {stats && !stats.hasData && (
        <section className="max-w-3xl mx-auto px-4 mt-12 mb-16 text-center">
          <div className="py-16">
            <svg className="w-16 h-16 mx-auto text-[#0f2444]/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-4 text-base font-semibold text-[#0f2444]">Portal yakında içerikle dolacak</h3>
            <p className="text-sm text-muted mt-2">Araştırmacı profilleri tamamlandıkça vitrin portalında görünmeye başlayacak.</p>
          </div>
        </section>
      )}
    </PublicLayout>
  );
}

// ─────────────────────────────────────────────────────────────
function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  const ICONS: Record<string, string> = {
    users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    quote: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
    clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  };
  return (
    <div className="bg-white rounded-xl border p-4 md:p-5 shadow-sm" style={{ borderColor: '#e8e4dc' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
        <svg className="w-4 h-4 text-[#c8a45a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[icon]} />
        </svg>
      </div>
      <p className="text-xl md:text-2xl font-bold text-[#0f2444] tabular-nums">{value}</p>
    </div>
  );
}
