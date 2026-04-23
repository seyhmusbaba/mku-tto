'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { publicApi } from '@/lib/api';
import { getInitials } from '@/lib/utils';

interface Profile {
  id: string; slug: string;
  firstName: string; lastName: string; fullName: string;
  title?: string; faculty?: string; department?: string; avatar?: string;
  bio?: string; expertiseArea?: string;
  orcidId?: string; googleScholarId?: string;
  researchGateUrl?: string; academiaUrl?: string;
  scopusAuthorId?: string; wosResearcherId?: string;
  scopusHIndex?: number; scopusCitedBy?: number; scopusDocCount?: number;
  wosHIndex?: number; wosCitedBy?: number; wosDocCount?: number;
  openAlexHIndex?: number; openAlexCitedBy?: number; openAlexDocCount?: number;
  googleScholarHIndex?: number; googleScholarCitedBy?: number; googleScholarDocCount?: number;
  trDizinHIndex?: number; trDizinCitedBy?: number; trDizinDocCount?: number;
  sobiadHIndex?: number; sobiadCitedBy?: number; sobiadDocCount?: number;
  totalPublicationCount?: number;
  openAccessCount?: number;
  otherCitedBy?: number;
  thesisAdvisorCount?: number;
  memberSince?: string;
}

interface Publication {
  id: string; title: string; authors?: string; journal?: string;
  year?: number; doi?: string; url?: string; type?: string;
  citations?: number; quartile?: string;
  isOpenAccess?: boolean; isFeatured?: boolean;
}

interface PublicProject {
  id: string; title: string; type: string; status: string;
  faculty?: string; department?: string;
  startDate?: string; endDate?: string;
  fundingSource?: string; description?: string;
}

interface Collab {
  organizations: { name: string; projectCount: number; sectors?: string[] }[];
  coResearchers: { id: string; firstName: string; lastName: string; title?: string; faculty?: string; avatar?: string; slug: string; count: number }[];
}

type Tab = 'about' | 'publications' | 'projects' | 'collaborations';

const TAB_LABELS: Record<Tab, string> = {
  about:          'Hakkında',
  publications:   'Yayınlar',
  projects:       'Projeler',
  collaborations: 'İşbirlikleri',
};

export default function ProfilePage() {
  const params = useParams();
  const slug = String(params?.slug || '');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [pubs, setPubs] = useState<Publication[]>([]);
  const [pubsLoading, setPubsLoading] = useState(true);
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [collab, setCollab] = useState<Collab | null>(null);
  const [tab, setTab] = useState<Tab>('about');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    publicApi.profile(slug)
      .then(r => setProfile(r.data))
      .catch(e => { if (e?.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!profile) return;
    setPubsLoading(true);
    Promise.all([
      publicApi.profilePubs(slug).catch(() => ({ data: [] })),
      publicApi.profileProjects(slug).catch(() => ({ data: [] })),
      publicApi.profileCollaborations(slug).catch(() => ({ data: { organizations: [], coResearchers: [] } })),
    ]).then(([p, pr, c]) => {
      setPubs(p.data || []);
      setProjects(pr.data || []);
      setCollab(c.data);
    }).finally(() => setPubsLoading(false));
  }, [profile, slug]);

  if (loading) {
    return <PublicLayout><div className="flex justify-center py-24"><div className="spinner" /></div></PublicLayout>;
  }

  if (notFound || !profile) {
    return (
      <PublicLayout>
        <div className="max-w-xl mx-auto px-6 py-24 text-center">
          <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-3" style={{ color: '#8a7a52' }}>404</p>
          <h1 className="text-3xl tracking-tight mb-4" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
            Araştırmacı <span style={{ fontStyle: 'italic', color: '#a88a3f' }}>bulunamadı</span>
          </h1>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Aradığınız profil kaldırılmış veya gizli olabilir.
          </p>
          <Link href="/p/arastirmacilar" className="inline-block mt-8 px-7 py-3 text-sm font-semibold text-white"
            style={{ background: '#0f2444', borderRadius: 1 }}>
            Araştırmacıları Keşfet
          </Link>
        </div>
      </PublicLayout>
    );
  }

  // Not: Burada tek bir "toplam yayın/atıf" hesaplamıyoruz; AVESİS tarzında
  // her veritabanını ayrı gösteriyoruz. Bir "toplam" rakam kaynakları
  // birleştirdiği için yanıltıcı olur.

  return (
    <PublicLayout showSearch={false}>
      {/* ═════ Hero — magazin makale açılışı ═════ */}
      <section className="border-b relative overflow-hidden" style={{ borderColor: 'rgba(15, 36, 68, 0.12)', background: '#fefaf2' }}>
        {/* Dekoratif arka plan deseni */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, #0f2444 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="max-w-[1280px] mx-auto px-6 pt-6 pb-14 relative">
          {/* Breadcrumb */}
          <Link href="/p/arastirmacilar" className="inline-flex items-center gap-2 text-xs tracking-wide mb-10 hover:text-[#a88a3f] transition-colors" style={{ color: '#8a7a52' }}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Araştırmacılar
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Portrait */}
            <div className="lg:col-span-4">
              <div className="relative inline-block">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.fullName}
                    className="w-56 h-64 md:w-64 md:h-72 object-cover"
                    style={{ borderRadius: 1, filter: 'contrast(1.02)' }}
                  />
                ) : (
                  <div
                    className="w-56 h-64 md:w-64 md:h-72 flex items-center justify-center text-white"
                    style={{ background: '#0f2444', borderRadius: 1 }}
                  >
                    <span className="text-6xl font-bold tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {getInitials(profile.firstName, profile.lastName)}
                    </span>
                  </div>
                )}
                {/* Altın dekor çerçeve */}
                <div className="absolute -bottom-3 -right-3 w-56 h-64 md:w-64 md:h-72 border pointer-events-none"
                  style={{ borderColor: '#c8a45a', borderRadius: 1 }} />
              </div>
            </div>

            {/* Editorial lead */}
            <div className="lg:col-span-8">
              {profile.title && (
                <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-4 flex items-center gap-3" style={{ color: '#a88a3f' }}>
                  <span className="h-px w-12" style={{ background: '#c8a45a' }} />
                  {profile.title}
                </p>
              )}
              <h1 className="text-5xl md:text-7xl font-bold leading-[0.95] tracking-tight mb-6"
                style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                {profile.firstName}<br />
                <span style={{ fontStyle: 'italic' }}>{profile.lastName}</span>
              </h1>

              <div className="text-base leading-relaxed space-y-1 mb-6 max-w-xl" style={{ color: '#4b5563' }}>
                {profile.faculty && <p className="font-medium">{profile.faculty}</p>}
                {profile.department && <p className="text-sm italic" style={{ color: '#6b7280' }}>{profile.department}</p>}
              </div>

              {profile.expertiseArea && (
                <div className="border-l-2 pl-5 py-1 mb-7 max-w-xl" style={{ borderColor: '#c8a45a' }}>
                  <p className="text-[10px] tracking-[0.22em] uppercase font-bold mb-1" style={{ color: '#a88a3f' }}>Uzmanlık</p>
                  <p className="text-sm italic" style={{ color: '#4b5563' }}>{profile.expertiseArea}</p>
                </div>
              )}

              {/* External profile chips */}
              <div className="flex flex-wrap gap-2">
                {profile.orcidId && <ExtLink label="ORCID" href={`https://orcid.org/${profile.orcidId}`} color="#a6ce39" />}
                {profile.scopusAuthorId && <ExtLink label="Scopus" href={`https://www.scopus.com/authid/detail.uri?authorId=${profile.scopusAuthorId}`} color="#e9711c" />}
                {profile.googleScholarId && <ExtLink label="Scholar" href={`https://scholar.google.com/citations?user=${profile.googleScholarId}`} color="#4285f4" />}
                {profile.wosResearcherId && <ExtLink label="WoS" href={`https://www.webofscience.com/wos/author/record/${profile.wosResearcherId}`} color="#5e33bf" />}
                {profile.researchGateUrl && <ExtLink label="ResearchGate" href={profile.researchGateUrl} color="#00d0af" />}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════ Metrikler — AVESİS tarzı kaynak-bazlı ═════ */}
      <section className="border-b" style={{ borderColor: 'rgba(15, 36, 68, 0.12)', background: '#ffffff' }}>
        <div className="max-w-[1280px] mx-auto px-6 py-10">
          <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-5" style={{ color: '#8a7a52' }}>
            Bibliyometrik Göstergeler
          </p>

          {/* Özet sayılar */}
          {(profile.totalPublicationCount || projects.length || profile.thesisAdvisorCount || profile.openAccessCount) ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-l mb-6" style={{ borderColor: 'rgba(15, 36, 68, 0.12)' }}>
              <PublicSummaryCell label="Toplam Yayın" value={profile.totalPublicationCount} />
              <PublicSummaryCell label="Proje" value={projects.length} />
              <PublicSummaryCell label="Tez Danışmanlığı" value={profile.thesisAdvisorCount} />
              <PublicSummaryCell label="Açık Erişim" value={profile.openAccessCount} />
            </div>
          ) : null}

          {/* Kaynak-bazlı grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { n: 'OpenAlex',       k: 'openalex' as const, c: '#ee3f3f', d: profile.openAlexDocCount,      cit: profile.openAlexCitedBy,      h: profile.openAlexHIndex },
              { n: 'Scopus',         k: 'scopus' as const,   c: '#e9711c', d: profile.scopusDocCount,         cit: profile.scopusCitedBy,         h: profile.scopusHIndex },
              { n: 'Web of Science', k: 'wos' as const,      c: '#5e33bf', d: profile.wosDocCount,            cit: profile.wosCitedBy,            h: profile.wosHIndex },
              { n: 'TR Dizin',       k: 'trdizin' as const,  c: '#c8a45a', d: profile.trDizinDocCount,        cit: profile.trDizinCitedBy,        h: profile.trDizinHIndex },
              { n: 'Google Scholar', k: 'scholar' as const,  c: '#4285f4', d: profile.googleScholarDocCount,  cit: profile.googleScholarCitedBy,  h: profile.googleScholarHIndex },
              { n: 'Sobiad',         k: 'sobiad' as const,   c: '#0f2444', d: profile.sobiadDocCount,         cit: profile.sobiadCitedBy,         h: profile.sobiadHIndex },
            ].filter(x => (x.d && x.d > 0) || (x.cit && x.cit > 0) || (x.h && x.h > 0)).map(x => (
              <PublicSourceCard key={x.n} name={x.n} sourceKey={x.k} color={x.c} docs={x.d} cites={x.cit} hIndex={x.h} />
            ))}
          </div>

          {profile.otherCitedBy && profile.otherCitedBy > 0 ? (
            <p className="text-xs mt-4 flex items-center gap-2" style={{ color: '#8a7a52' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#c8a45a' }} />
              Diğer kaynaklardan toplam <strong style={{ color: '#0f2444' }}>{profile.otherCitedBy.toLocaleString('tr-TR')}</strong> atıf
            </p>
          ) : null}

          {!(profile.openAlexDocCount || profile.googleScholarDocCount || profile.scopusDocCount || profile.wosDocCount || profile.trDizinDocCount || profile.sobiadDocCount) && (
            <p className="text-sm italic text-center py-8" style={{ fontFamily: 'Playfair Display, serif', color: '#8a7a52' }}>
              Henüz bibliyometrik metrik kaydedilmemiş.
            </p>
          )}
        </div>
      </section>

      {/* ═════ Tabs ═════ */}
      <section className="max-w-[1280px] mx-auto px-6 sticky top-[109px] z-10 backdrop-blur" style={{ background: 'rgba(246, 243, 236, 0.95)' }}>
        <div className="flex border-b overflow-x-auto" style={{ borderColor: 'rgba(15, 36, 68, 0.15)' }}>
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => {
            const count =
              t === 'publications' ? pubs.length :
              t === 'projects' ? projects.length :
              t === 'collaborations' ? ((collab?.organizations.length || 0) + (collab?.coResearchers.length || 0)) :
              undefined;
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="py-4 px-5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-all tracking-wide"
                style={{
                  color: active ? '#0f2444' : '#8a7a52',
                  borderColor: active ? '#c8a45a' : 'transparent',
                  fontFamily: active ? 'Playfair Display, serif' : undefined,
                  fontSize: active ? '15px' : '13px',
                  fontStyle: active ? 'italic' : 'normal',
                }}
              >
                {TAB_LABELS[t]}
                {count !== undefined && count > 0 && (
                  <span className="ml-2 text-[10px] tabular-nums font-mono" style={{ color: '#a88a3f' }}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ═════ TAB CONTENT ═════ */}
      <section className="max-w-[1280px] mx-auto px-6 py-12 pb-20">
        {tab === 'about' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8">
              <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-4" style={{ color: '#8a7a52' }}>
                Biyografi
              </p>
              {profile.bio ? (
                <div className="prose prose-lg max-w-none" style={{ color: '#1a1a2e' }}>
                  <p className="text-lg leading-relaxed whitespace-pre-wrap first-letter:text-6xl first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:leading-[0.85] first-letter:mt-1"
                    style={{ fontFamily: 'Playfair Display, serif' }}>
                    {profile.bio}
                  </p>
                </div>
              ) : (
                <p className="text-lg italic" style={{ fontFamily: 'Playfair Display, serif', color: '#8a7a52' }}>
                  Bu araştırmacı henüz biyografi eklememiş.
                </p>
              )}
            </div>

            <aside className="lg:col-span-4 lg:border-l lg:pl-10" style={{ borderColor: 'rgba(15, 36, 68, 0.1)' }}>
              <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-6" style={{ color: '#8a7a52' }}>
                Künye
              </p>
              <dl className="space-y-6">
                {profile.faculty && (
                  <div>
                    <dt className="text-[10px] tracking-[0.22em] uppercase font-semibold mb-1" style={{ color: '#a88a3f' }}>Fakülte</dt>
                    <dd className="text-base leading-snug" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>{profile.faculty}</dd>
                  </div>
                )}
                {profile.department && (
                  <div>
                    <dt className="text-[10px] tracking-[0.22em] uppercase font-semibold mb-1" style={{ color: '#a88a3f' }}>Bölüm</dt>
                    <dd className="text-sm" style={{ color: '#4b5563' }}>{profile.department}</dd>
                  </div>
                )}
                {profile.memberSince && (
                  <div>
                    <dt className="text-[10px] tracking-[0.22em] uppercase font-semibold mb-1" style={{ color: '#a88a3f' }}>Üyelik</dt>
                    <dd className="text-sm" style={{ color: '#4b5563' }}>
                      {new Date(profile.memberSince).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })}
                    </dd>
                  </div>
                )}
              </dl>
            </aside>
          </div>
        )}

        {tab === 'publications' && (
          <div>
            {pubsLoading ? (
              <div className="flex justify-center py-20"><div className="spinner" /></div>
            ) : pubs.length === 0 ? (
              <EmptyBlock text="Scopus, OpenAlex veya manuel kayıtta yayın bulunamadı." />
            ) : (
              <>
                <div className="flex items-baseline justify-between mb-8 pb-4 border-b" style={{ borderColor: 'rgba(15, 36, 68, 0.12)' }}>
                  <div>
                    <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-1" style={{ color: '#8a7a52' }}>
                      Yayın Listesi
                    </p>
                    <h2 className="text-2xl tracking-tight" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                      {pubs.length} <span style={{ fontStyle: 'italic', color: '#a88a3f' }}>eser</span>
                    </h2>
                  </div>
                  <p className="text-xs italic hidden md:block" style={{ color: '#9ca3af' }}>
                    Scopus · OpenAlex · Manuel kayıtlardan birleştirilmiştir
                  </p>
                </div>

                <div className="divide-y" style={{ borderColor: 'rgba(15, 36, 68, 0.08)' }}>
                  {pubs.map((p, idx) => (
                    <article key={p.id} className="py-6 group hover:pl-3 transition-all">
                      <div className="flex gap-6">
                        <div className="flex-shrink-0 w-12 md:w-16 text-right">
                          <p className="text-xs font-mono tabular-nums" style={{ color: '#a88a3f' }}>
                            {String(idx + 1).padStart(3, '0')}
                          </p>
                          {p.year && (
                            <p className="text-2xl tabular-nums mt-1 font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                              {p.year}
                            </p>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-base md:text-lg leading-snug mb-2"
                            style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                            {p.title}
                          </h3>
                          {p.authors && (
                            <p className="text-sm italic mb-2 line-clamp-2" style={{ color: '#6b7280' }}>
                              {p.authors}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs" style={{ color: '#6b7280' }}>
                            {p.journal && <span className="italic font-medium">{p.journal}</span>}
                            {typeof p.citations === 'number' && p.citations > 0 && (
                              <span className="tabular-nums"><b style={{ color: '#0f2444' }}>{p.citations}</b> atıf</span>
                            )}
                            {p.quartile && (
                              <span className="font-bold px-1.5 py-0.5 text-[10px]"
                                style={{
                                  background: p.quartile === 'Q1' ? '#dcfce7' : p.quartile === 'Q2' ? '#fef3c7' : '#f3f4f6',
                                  color: p.quartile === 'Q1' ? '#15803d' : p.quartile === 'Q2' ? '#92400e' : '#374151',
                                  borderRadius: 1,
                                }}>
                                {p.quartile}
                              </span>
                            )}
                            {p.isOpenAccess && (
                              <span className="font-bold text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700" style={{ borderRadius: 1 }}>OA</span>
                            )}
                            {p.isFeatured && <span style={{ color: '#a88a3f' }}>★</span>}
                            {p.doi && (
                              <a className="font-semibold hover:underline inline-flex items-center gap-0.5" style={{ color: '#a88a3f' }}
                                href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">
                                DOI ↗
                              </a>
                            )}
                            {p.url && !p.doi && (
                              <a className="font-semibold hover:underline inline-flex items-center gap-0.5" style={{ color: '#a88a3f' }}
                                href={p.url} target="_blank" rel="noreferrer">
                                Tam metin ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'projects' && (
          <div>
            {projects.length === 0 ? (
              <EmptyBlock text="Araştırmacının kamuya açık projesi yok. Proje sahibi açmadıkça projeler kapalı tutulur." />
            ) : (
              <>
                <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-4" style={{ color: '#8a7a52' }}>
                  Projeler
                </p>
                <h2 className="text-2xl tracking-tight mb-8 pb-4 border-b" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444', borderColor: 'rgba(15, 36, 68, 0.12)' }}>
                  {projects.length} <span style={{ fontStyle: 'italic', color: '#a88a3f' }}>araştırma</span>
                </h2>
                <div className="grid gap-6">
                  {projects.map((p, idx) => (
                    <article key={p.id} className="border-l-2 pl-6 py-2" style={{ borderColor: p.status === 'active' ? '#c8a45a' : 'rgba(15, 36, 68, 0.15)' }}>
                      <div className="flex items-baseline gap-4 mb-3">
                        <span className="text-xs font-mono tabular-nums" style={{ color: '#a88a3f' }}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] tracking-[0.22em] uppercase font-bold" style={{ color: '#8a7a52' }}>
                          {p.type}
                        </span>
                        <span className="text-[10px] tracking-[0.22em] uppercase font-bold"
                          style={{ color: p.status === 'active' ? '#15803d' : p.status === 'completed' ? '#6b7280' : '#92400e' }}>
                          {p.status === 'active' ? 'Aktif' : p.status === 'completed' ? 'Tamamlandı' : p.status}
                        </span>
                      </div>
                      <h3 className="text-2xl leading-tight mb-3" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                        {p.title}
                      </h3>
                      {p.description && (
                        <p className="text-sm leading-relaxed mb-4 max-w-3xl" style={{ color: '#4b5563' }}>
                          {p.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: '#8a7a52' }}>
                        {p.startDate && <span>{p.startDate}{p.endDate ? ` — ${p.endDate}` : ''}</span>}
                        {p.fundingSource && <span className="italic">{p.fundingSource}</span>}
                        {p.faculty && <span>{p.faculty}</span>}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'collaborations' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-6">
              <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-4" style={{ color: '#8a7a52' }}>
                Kurumsal
              </p>
              <h2 className="text-2xl tracking-tight mb-6 pb-4 border-b" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444', borderColor: 'rgba(15, 36, 68, 0.12)' }}>
                Ortak kuruluşlar
              </h2>
              {!collab?.organizations.length ? (
                <p className="text-base italic" style={{ fontFamily: 'Playfair Display, serif', color: '#8a7a52' }}>
                  Henüz kurumsal işbirliği kaydı yok.
                </p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'rgba(15, 36, 68, 0.08)' }}>
                  {collab.organizations.map((o, idx) => (
                    <div key={o.name} className="flex items-baseline justify-between py-4 gap-4">
                      <div className="flex items-baseline gap-4 min-w-0">
                        <span className="text-xs font-mono tabular-nums flex-shrink-0" style={{ color: '#a88a3f' }}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <p className="text-base leading-tight truncate" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                            {o.name}
                          </p>
                          {o.sectors?.length ? (
                            <p className="text-[11px] italic mt-0.5" style={{ color: '#9ca3af' }}>
                              {o.sectors.join(' · ')}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ fontFamily: 'Playfair Display, serif', color: '#a88a3f' }}>
                        {o.projectCount} <span className="text-[10px] font-normal" style={{ color: '#6b7280' }}>proje</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-6">
              <p className="text-[11px] tracking-[0.25em] uppercase font-bold mb-4" style={{ color: '#8a7a52' }}>
                Akademik
              </p>
              <h2 className="text-2xl tracking-tight mb-6 pb-4 border-b" style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444', borderColor: 'rgba(15, 36, 68, 0.12)' }}>
                Çalışma arkadaşları
              </h2>
              {!collab?.coResearchers.length ? (
                <p className="text-base italic" style={{ fontFamily: 'Playfair Display, serif', color: '#8a7a52' }}>
                  Henüz birlikte proje yürüttüğü araştırmacı yok.
                </p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'rgba(15, 36, 68, 0.08)' }}>
                  {collab.coResearchers.map(c => (
                    <Link key={c.id} href={`/p/${c.slug || c.id}`}
                      className="flex items-center gap-4 py-4 group">
                      {c.avatar ? (
                        <img src={c.avatar} alt="" className="w-11 h-11 object-cover flex-shrink-0" style={{ borderRadius: 1 }} />
                      ) : (
                        <div className="w-11 h-11 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: '#0f2444', borderRadius: 1, fontFamily: 'Playfair Display, serif' }}>
                          {getInitials(c.firstName, c.lastName)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-base leading-tight truncate group-hover:text-[#a88a3f] transition-colors"
                          style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="text-[11px] italic truncate mt-0.5" style={{ color: '#6b7280' }}>{c.faculty || '—'}</p>
                      </div>
                      <span className="text-sm font-bold tabular-nums" style={{ color: '#a88a3f', fontFamily: 'Playfair Display, serif' }}>
                        ×{c.count}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}

// ─────────────────────────────────────────────────────────────
function PublicSummaryCell({ label, value }: { label: string; value?: number | null }) {
  const fmt = (typeof value === 'number' && value > 0) ? value.toLocaleString('tr-TR') : '—';
  const empty = fmt === '—';
  return (
    <div className="px-5 py-5 bg-white border-r border-b" style={{ borderColor: 'rgba(15, 36, 68, 0.12)' }}>
      <p className="text-[10px] tracking-[0.22em] uppercase font-bold mb-2" style={{ color: '#8a7a52' }}>{label}</p>
      <p className={`text-2xl md:text-3xl font-bold tabular-nums tracking-tight`}
        style={{ fontFamily: 'Playfair Display, serif', color: empty ? '#d4d0c8' : '#0f2444' }}>
        {fmt}
      </p>
    </div>
  );
}

function PublicSourceCard({
  name, sourceKey, color, docs, cites, hIndex,
}: {
  name: string; sourceKey: 'openalex' | 'scopus' | 'wos' | 'trdizin' | 'scholar' | 'sobiad';
  color: string;
  docs?: number; cites?: number; hIndex?: number;
}) {
  const fmt = (n?: number) => (typeof n === 'number' && n > 0) ? n.toLocaleString('tr-TR') : '—';
  return (
    <div className="border p-4 bg-white" style={{ borderColor: 'rgba(15, 36, 68, 0.12)', borderRadius: 1 }}>
      <div className="flex items-center gap-3 mb-3 pb-3 border-b" style={{ borderColor: 'rgba(15, 36, 68, 0.08)' }}>
        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
          style={{ background: color, borderRadius: 1 }}>
          <PublicSourceLogo source={sourceKey} />
        </div>
        <p className="text-sm font-semibold" style={{ color: '#0f2444' }}>{name}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[9px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: '#a88a3f' }}>Yayın</p>
          <p className="text-xl font-bold tabular-nums" style={{ fontFamily: 'Playfair Display, serif', color: fmt(docs) === '—' ? '#d4d0c8' : '#0f2444' }}>{fmt(docs)}</p>
        </div>
        <div>
          <p className="text-[9px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: '#a88a3f' }}>Atıf</p>
          <p className="text-xl font-bold tabular-nums" style={{ fontFamily: 'Playfair Display, serif', color: fmt(cites) === '—' ? '#d4d0c8' : '#0f2444' }}>{fmt(cites)}</p>
        </div>
        <div>
          <p className="text-[9px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: '#a88a3f' }}>h-index</p>
          <p className="text-xl font-bold tabular-nums" style={{ fontFamily: 'Playfair Display, serif', color: fmt(hIndex) === '—' ? '#d4d0c8' : '#0f2444' }}>{fmt(hIndex)}</p>
        </div>
      </div>
    </div>
  );
}

function PublicSourceLogo({ source }: { source: 'openalex' | 'scopus' | 'wos' | 'trdizin' | 'scholar' | 'sobiad' }) {
  const size = 22;
  const c = '#ffffff';
  switch (source) {
    case 'openalex':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2" />
          <circle cx="12" cy="12" r="3" fill={c} />
          <circle cx="5" cy="9" r="1.5" fill={c} />
          <circle cx="19" cy="9" r="1.5" fill={c} />
          <circle cx="8" cy="18" r="1.5" fill={c} />
          <circle cx="16" cy="18" r="1.5" fill={c} />
          <path d="M5 9 L12 12 L19 9 M8 18 L12 12 L16 18" stroke={c} strokeWidth="1.2" />
        </svg>
      );
    case 'scopus':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M17 7.5c-1.5-1.5-3.5-2-5.5-2-3 0-5 1.5-5 3.5 0 2 2 3 4.5 3.5l1 .2c2.5.5 4.5 1.5 4.5 4 0 2.3-2 4-5.5 4-2.5 0-4.5-.8-6-2.5"
            stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'wos':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2" />
          <ellipse cx="12" cy="12" rx="4" ry="9" stroke={c} strokeWidth="1.5" />
          <line x1="3" y1="12" x2="21" y2="12" stroke={c} strokeWidth="1.5" />
        </svg>
      );
    case 'scholar':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={c}>
          <path d="M12 3L1 9l11 6 9-4.9V17h2V9L12 3z" />
          <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
        </svg>
      );
    case 'trdizin':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4 4.5A2.5 2.5 0 016.5 2h11A2.5 2.5 0 0120 4.5v15a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 19.5v-15z"
            stroke={c} strokeWidth="1.8" fill="none" />
          <text x="12" y="15" textAnchor="middle" fill={c} fontSize="8" fontWeight="bold" fontFamily="sans-serif">TR</text>
        </svg>
      );
    case 'sobiad':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4 6c2-1 5-1 8 0v14c-3-1-6-1-8 0V6z"
            stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round" />
          <path d="M12 6c3-1 6-1 8 0v14c-2-1-5-1-8 0V6z"
            stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round" />
        </svg>
      );
  }
}

function ExtLink({ label, href, color }: { label: string; href: string; color: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="px-3 py-1.5 text-[11px] font-semibold text-white tracking-wide transition-opacity hover:opacity-85"
      style={{ background: color, borderRadius: 1 }}
    >
      {label} ↗
    </a>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="py-20 text-center border-t border-b" style={{ borderColor: 'rgba(15, 36, 68, 0.12)' }}>
      <p className="text-lg italic" style={{ fontFamily: 'Playfair Display, serif', color: '#8a7a52' }}>{text}</p>
    </div>
  );
}
