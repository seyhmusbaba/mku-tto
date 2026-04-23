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
      limit: 20,
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
      {/* ═════ Page title — editorial ═════ */}
      <section className="border-b" style={{ borderColor: 'rgba(15, 36, 68, 0.12)', background: '#fefaf2' }}>
        <div className="max-w-[1280px] mx-auto px-6 py-14">
          <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-3 flex items-center gap-3" style={{ color: '#8a7a52' }}>
            <span className="h-px w-12" style={{ background: '#c8a45a' }} />
            Dizin
          </p>
          <h1 className="text-4xl md:text-5xl tracking-tight leading-[1.05]" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
            {faculty ? (
              <>{faculty}<br /><span style={{ fontStyle: 'italic', color: '#a88a3f' }}>araştırmacıları</span></>
            ) : search ? (
              <>"{search}" <span style={{ fontStyle: 'italic', color: '#a88a3f' }}>arama sonuçları</span></>
            ) : (
              <>Tüm <span style={{ fontStyle: 'italic', color: '#a88a3f' }}>araştırmacılar</span></>
            )}
          </h1>
          <p className="mt-4 text-sm tabular-nums" style={{ color: '#6b7280' }}>
            {total > 0 ? `${total.toLocaleString('tr-TR')} sonuç · Alfabetik sıralı` : 'Kriter belirleyin'}
          </p>
        </div>
      </section>

      {/* ═════ Filters ═════ */}
      <section className="border-b sticky top-[109px] z-10 backdrop-blur" style={{ borderColor: 'rgba(15, 36, 68, 0.1)', background: 'rgba(254, 250, 242, 0.95)' }}>
        <div className="max-w-[1280px] mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="İsim, soyisim veya uzmanlık alanı ile filtrele..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-11 pr-4 py-2.5 text-sm border bg-white focus:outline-none transition-all"
                style={{ borderColor: 'rgba(15, 36, 68, 0.15)', borderRadius: 1 }}
              />
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#8a7a52" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <select
              value={faculty}
              onChange={e => { setFaculty(e.target.value); setPage(1); }}
              className="md:w-80 px-4 py-2.5 text-sm border bg-white focus:outline-none"
              style={{ borderColor: 'rgba(15, 36, 68, 0.15)', borderRadius: 1 }}
            >
              <option value="">Tüm Fakülteler</option>
              {faculties.map(f => (
                <option key={f.faculty} value={f.faculty}>{f.faculty} ({f.count})</option>
              ))}
            </select>
          </div>
          {(search || faculty) && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span style={{ color: '#8a7a52' }}>Aktif filtreler —</span>
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }}
                  className="px-2.5 py-1 border font-medium flex items-center gap-1.5 hover:bg-white transition-colors"
                  style={{ borderColor: '#a88a3f', color: '#8a7a52', borderRadius: 1 }}>
                  "{search}"
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {faculty && (
                <button onClick={() => { setFaculty(''); setPage(1); }}
                  className="px-2.5 py-1 border font-medium flex items-center gap-1.5 hover:bg-white transition-colors"
                  style={{ borderColor: '#a88a3f', color: '#8a7a52', borderRadius: 1 }}>
                  {faculty}
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ═════ List — newspaper column ═════ */}
      <section className="max-w-[1280px] mx-auto px-6 py-10">
        {loading ? (
          <div className="flex justify-center py-24"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="border py-24 text-center" style={{ borderColor: 'rgba(15, 36, 68, 0.12)' }}>
            <p className="text-lg italic" style={{ fontFamily: 'Playfair Display, serif', color: '#8a7a52' }}>
              Arama kriterine uygun araştırmacı bulunamadı.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: 'rgba(15, 36, 68, 0.12)', border: '1px solid rgba(15, 36, 68, 0.12)' }}>
            {items.map((r, idx) => (
              <Link
                key={r.id}
                href={`/p/${r.slug || r.id}`}
                className="bg-white p-6 hover:bg-[#fefaf2] transition-colors group flex gap-5"
              >
                {r.avatar ? (
                  <img src={r.avatar} alt="" className="w-20 h-20 object-cover flex-shrink-0" style={{ borderRadius: 1 }} />
                ) : (
                  <div className="w-20 h-20 flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                    style={{ background: '#0f2444', borderRadius: 1, fontFamily: 'Playfair Display, serif' }}>
                    {getInitials(r.firstName, r.lastName)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] tracking-[0.2em] uppercase font-semibold mb-1.5 flex items-center gap-2" style={{ color: '#a88a3f' }}>
                    <span className="font-mono tabular-nums">№ {String((page - 1) * 20 + idx + 1).padStart(3, '0')}</span>
                    {r.title && <><span>·</span><span>{r.title}</span></>}
                  </p>
                  <p className="text-xl leading-tight group-hover:text-[#a88a3f] transition-colors mb-1"
                    style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-sm truncate" style={{ color: '#4b5563' }}>{r.faculty || '—'}</p>
                  {r.department && <p className="text-xs italic truncate mt-0.5" style={{ color: '#9ca3af' }}>{r.department}</p>}

                  {(typeof r.scopusDocCount === 'number' && r.scopusDocCount > 0) || (typeof r.scopusHIndex === 'number' && r.scopusHIndex > 0) ? (
                    <div className="mt-3 pt-3 border-t flex gap-5 text-[11px] tabular-nums" style={{ borderColor: 'rgba(15, 36, 68, 0.08)', color: '#6b7280' }}>
                      {r.scopusDocCount ? (
                        <div>
                          <span className="block text-[9px] tracking-[0.2em] uppercase mb-0.5" style={{ color: '#a88a3f' }}>Yayın</span>
                          <span className="text-sm font-bold" style={{ color: '#0f2444', fontFamily: 'Playfair Display, serif' }}>{r.scopusDocCount}</span>
                        </div>
                      ) : null}
                      {r.scopusCitedBy ? (
                        <div>
                          <span className="block text-[9px] tracking-[0.2em] uppercase mb-0.5" style={{ color: '#a88a3f' }}>Atıf</span>
                          <span className="text-sm font-bold" style={{ color: '#0f2444', fontFamily: 'Playfair Display, serif' }}>{r.scopusCitedBy}</span>
                        </div>
                      ) : null}
                      {r.scopusHIndex ? (
                        <div>
                          <span className="block text-[9px] tracking-[0.2em] uppercase mb-0.5" style={{ color: '#a88a3f' }}>h-index</span>
                          <span className="text-sm font-bold" style={{ color: '#0f2444', fontFamily: 'Playfair Display, serif' }}>{r.scopusHIndex}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-6">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="text-sm font-semibold tracking-wide disabled:opacity-30 flex items-center gap-2 transition-opacity hover:opacity-70"
              style={{ color: '#0f2444' }}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Önceki
            </button>
            <span className="text-sm tabular-nums" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
              <span className="font-bold">{page}</span>
              <span className="mx-2" style={{ color: '#a88a3f' }}>·</span>
              <span style={{ color: '#9ca3af' }}>{totalPages}</span>
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="text-sm font-semibold tracking-wide disabled:opacity-30 flex items-center gap-2 transition-opacity hover:opacity-70"
              style={{ color: '#0f2444' }}
            >
              Sonraki
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PublicLayout><div className="flex justify-center py-24"><div className="spinner" /></div></PublicLayout>}>
      <ResearchersContent />
    </Suspense>
  );
}
