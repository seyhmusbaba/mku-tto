'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { publicApi } from '@/lib/api';
import { getInitials } from '@/lib/utils';

interface Researcher {
  id: string; slug: string;
  firstName: string; lastName: string;
  title?: string; faculty?: string; department?: string;
  avatar?: string; expertiseArea?: string;
  scopusHIndex?: number; scopusCitedBy?: number; scopusDocCount?: number;
}

function ResearchersContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const initialQ = sp?.get('q') || '';
  const initialFaculty = sp?.get('faculty') || '';

  const [items, setItems] = useState<Researcher[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(initialQ);
  const [faculty, setFaculty] = useState(initialFaculty);
  const [faculties, setFaculties] = useState<{ faculty: string; count: number }[]>([]);

  useEffect(() => {
    publicApi.faculties().then(r => setFaculties(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    publicApi.researchers({
      search: search || undefined,
      faculty: faculty || undefined,
      page,
      limit: 24,
    }).then(r => {
      setItems(r.data.items || []);
      setTotal(r.data.total || 0);
      setTotalPages(r.data.totalPages || 1);
    }).finally(() => setLoading(false));
  }, [search, faculty, page]);

  // URL'yi güncel tut
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (faculty) params.set('faculty', faculty);
    const qs = params.toString();
    router.replace(qs ? `/p/arastirmacilar?${qs}` : '/p/arastirmacilar', { scroll: false });
  }, [search, faculty, router]);

  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-[#0f2444]">Araştırmacılar</h1>
          <p className="text-sm text-muted">{total > 0 ? `${total} araştırmacı` : ''}</p>
        </div>

        {/* ═════ Filters ═════ */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="İsim, soyisim veya uzmanlık alanı ara..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border bg-white focus:outline-none focus:ring-2 focus:ring-[#c8a45a]/30 focus:border-[#c8a45a]"
              style={{ borderColor: '#e8e4dc' }}
            />
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0f2444]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <select
            value={faculty}
            onChange={e => { setFaculty(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-xl text-sm border bg-white focus:outline-none focus:ring-2 focus:ring-[#c8a45a]/30"
            style={{ borderColor: '#e8e4dc' }}
          >
            <option value="">Tüm Fakülteler</option>
            {faculties.map(f => (
              <option key={f.faculty} value={f.faculty}>{f.faculty} ({f.count})</option>
            ))}
          </select>
        </div>

        {(search || faculty) && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-muted">Aktif filtreler:</span>
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }}
                className="px-2.5 py-1 rounded-full bg-[#f0ede8] text-[#0f2444] font-semibold flex items-center gap-1.5 hover:bg-[#e8e2d6]">
                "{search}" ×
              </button>
            )}
            {faculty && (
              <button onClick={() => { setFaculty(''); setPage(1); }}
                className="px-2.5 py-1 rounded-full bg-[#f0ede8] text-[#0f2444] font-semibold flex items-center gap-1.5 hover:bg-[#e8e2d6]">
                {faculty} ×
              </button>
            )}
          </div>
        )}

        {/* ═════ Grid ═════ */}
        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-20"><div className="spinner" /></div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-xl border py-16 text-center" style={{ borderColor: '#e8e4dc' }}>
              <p className="text-sm text-muted">Arama kriterine uygun araştırmacı bulunamadı.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map(r => (
                <Link
                  key={r.id}
                  href={`/p/${r.slug || r.id}`}
                  className="bg-white rounded-xl border p-4 hover:border-[#c8a45a] hover:shadow-md transition-all flex gap-3"
                  style={{ borderColor: '#e8e4dc' }}
                >
                  {r.avatar ? (
                    <img src={r.avatar} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0f2444, #1a3a6b)' }}
                    >
                      {getInitials(r.firstName, r.lastName)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#0f2444] text-sm leading-tight">
                      {r.title && <span className="text-[#c8a45a]">{r.title} </span>}
                      {r.firstName} {r.lastName}
                    </p>
                    <p className="text-xs text-muted mt-0.5 truncate">{r.faculty || '—'}</p>
                    {r.department && <p className="text-[11px] text-muted/80 truncate">{r.department}</p>}
                    {(r.scopusHIndex || r.scopusCitedBy) ? (
                      <div className="flex gap-2 mt-2 text-[10px]">
                        {r.scopusHIndex != null && (
                          <span className="px-1.5 py-0.5 rounded bg-[#f0ede8] font-semibold">h: {r.scopusHIndex}</span>
                        )}
                        {r.scopusCitedBy != null && r.scopusCitedBy > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-[#f0ede8] font-semibold">Atıf: {r.scopusCitedBy}</span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ═════ Pagination ═════ */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border disabled:opacity-40 hover:bg-[#faf8f4]"
              style={{ borderColor: '#e8e4dc' }}
            >
              ← Önceki
            </button>
            <span className="text-xs text-muted px-3">
              Sayfa {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border disabled:opacity-40 hover:bg-[#faf8f4]"
              style={{ borderColor: '#e8e4dc' }}
            >
              Sonraki →
            </button>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PublicLayout><div className="flex justify-center py-20"><div className="spinner" /></div></PublicLayout>}>
      <ResearchersContent />
    </Suspense>
  );
}
