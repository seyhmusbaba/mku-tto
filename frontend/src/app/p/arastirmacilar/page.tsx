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

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (faculty) params.set('faculty', faculty);
    const qs = params.toString();
    router.replace(qs ? `/p/arastirmacilar?${qs}` : '/p/arastirmacilar', { scroll: false });
  }, [search, faculty, router]);

  return (
    <PublicLayout>
      {/* Page title */}
      <section className="border-b" style={{ borderColor: '#e5e7eb', background: '#fafaf9' }}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#9ca3af' }}>
            Dizin
          </p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: '#0f2444' }}>
            Araştırmacılar
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#6b7280' }}>
            {total > 0 ? `${total.toLocaleString('tr-TR')} araştırmacı` : 'Arama kriteri belirleyin'}
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-3 mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="İsim, soyisim veya uzmanlık alanı..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded text-sm border bg-white focus:outline-none focus:border-[#0f2444]"
              style={{ borderColor: '#e5e7eb' }}
            />
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#6b7280" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <select
            value={faculty}
            onChange={e => { setFaculty(e.target.value); setPage(1); }}
            className="px-3 py-2.5 rounded text-sm border bg-white focus:outline-none focus:border-[#0f2444]"
            style={{ borderColor: '#e5e7eb' }}
          >
            <option value="">Tüm Fakülteler</option>
            {faculties.map(f => (
              <option key={f.faculty} value={f.faculty}>{f.faculty} ({f.count})</option>
            ))}
          </select>
        </div>

        {(search || faculty) && (
          <div className="mb-4 flex items-center gap-2 text-xs">
            <span style={{ color: '#6b7280' }}>Filtreler:</span>
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }}
                className="px-2.5 py-1 rounded border font-medium flex items-center gap-1.5 hover:bg-gray-50"
                style={{ borderColor: '#d1d5db', color: '#374151' }}>
                "{search}"
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {faculty && (
              <button onClick={() => { setFaculty(''); setPage(1); }}
                className="px-2.5 py-1 rounded border font-medium flex items-center gap-1.5 hover:bg-gray-50"
                style={{ borderColor: '#d1d5db', color: '#374151' }}>
                {faculty}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="border rounded-lg py-16 text-center" style={{ borderColor: '#e5e7eb' }}>
            <p className="text-sm" style={{ color: '#6b7280' }}>Arama kriterine uygun araştırmacı bulunamadı.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map(r => (
              <Link
                key={r.id}
                href={`/p/${r.slug || r.id}`}
                className="bg-white rounded-lg border p-4 hover:border-[#0f2444] hover:shadow-sm transition-all flex gap-4"
                style={{ borderColor: '#e5e7eb' }}
              >
                {r.avatar ? (
                  <img src={r.avatar} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                    style={{ background: '#0f2444' }}>
                    {getInitials(r.firstName, r.lastName)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight" style={{ color: '#0f2444' }}>
                    {r.firstName} {r.lastName}
                  </p>
                  {r.title && <p className="text-[11px] font-medium mt-0.5" style={{ color: '#c8a45a' }}>{r.title}</p>}
                  <p className="text-xs mt-1 truncate" style={{ color: '#6b7280' }}>{r.faculty || '—'}</p>
                  {r.department && <p className="text-[11px] truncate" style={{ color: '#9ca3af' }}>{r.department}</p>}

                  {(typeof r.scopusDocCount === 'number' && r.scopusDocCount > 0) || (typeof r.scopusHIndex === 'number' && r.scopusHIndex > 0) ? (
                    <div className="flex gap-3 mt-2.5 text-[11px] tabular-nums" style={{ color: '#6b7280' }}>
                      {r.scopusDocCount ? <span><b style={{ color: '#0f2444' }}>{r.scopusDocCount}</b> yayın</span> : null}
                      {r.scopusCitedBy ? <span><b style={{ color: '#0f2444' }}>{r.scopusCitedBy}</b> atıf</span> : null}
                      {r.scopusHIndex ? <span>h-index <b style={{ color: '#0f2444' }}>{r.scopusHIndex}</b></span> : null}
                    </div>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-semibold rounded border bg-white disabled:opacity-40 hover:bg-gray-50"
              style={{ borderColor: '#d1d5db', color: '#374151' }}
            >
              ← Önceki
            </button>
            <span className="text-xs px-3" style={{ color: '#6b7280' }}>
              Sayfa <b style={{ color: '#0f2444' }}>{page}</b> / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 text-xs font-semibold rounded border bg-white disabled:opacity-40 hover:bg-gray-50"
              style={{ borderColor: '#d1d5db', color: '#374151' }}
            >
              Sonraki →
            </button>
          </div>
        )}
      </section>
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
