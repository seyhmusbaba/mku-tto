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

  const totalPubs = Math.max(profile.scopusDocCount || 0, profile.wosDocCount || 0, pubs.length);
  const totalCitations = Math.max(profile.scopusCitedBy || 0, profile.wosCitedBy || 0);

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

      {/* ═════ Stats — ölçü şeridi ═════ */}
      <section className="border-b" style={{ borderColor: 'rgba(15, 36, 68, 0.12)', background: '#ffffff' }}>
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x" style={{ borderColor: 'rgba(15, 36, 68, 0.12)' }}>
            <StatInline label="Toplam Yayın" value={totalPubs} hero />
            <StatInline label="Toplam Atıf" value={totalCitations} hero />
            <StatInline label="Scopus h-index" value={profile.scopusHIndex || 0} />
            <StatInline label="WoS h-index" value={profile.wosHIndex || 0} />
            <StatInline label="Projeler" value={projects.length} />
          </div>
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
function StatInline({ label, value, hero }: { label: string; value: number; hero?: boolean }) {
  return (
    <div className="px-5 md:px-6 py-6">
      <p className="text-[10px] tracking-[0.22em] uppercase font-bold mb-2" style={{ color: '#8a7a52' }}>{label}</p>
      <p className={`${hero ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'} font-bold tabular-nums tracking-tight`}
        style={{ fontFamily: 'Playfair Display, serif', color: '#0f2444' }}>
        {value > 0 ? new Intl.NumberFormat('tr-TR').format(value) : '—'}
      </p>
    </div>
  );
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
