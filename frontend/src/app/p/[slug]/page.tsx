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
  about:          'Ana Sayfa',
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
    return (
      <PublicLayout>
        <div className="flex justify-center py-20"><div className="spinner" /></div>
      </PublicLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <PublicLayout>
        <div className="max-w-xl mx-auto px-6 py-24 text-center">
          <svg className="w-14 h-14 mx-auto" fill="none" viewBox="0 0 24 24" stroke="#d1d5db" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h1 className="mt-5 text-lg font-semibold" style={{ color: '#0f2444' }}>Araştırmacı bulunamadı</h1>
          <p className="mt-2 text-sm" style={{ color: '#6b7280' }}>Aradığınız profil kaldırılmış veya gizli olabilir.</p>
          <Link href="/p/arastirmacilar" className="inline-block mt-6 px-4 py-2 rounded text-sm font-semibold text-white"
            style={{ background: '#0f2444' }}>
            Araştırmacıları Keşfet
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const totalPubsEstimate = Math.max(
    profile.scopusDocCount || 0,
    profile.wosDocCount || 0,
    pubs.length,
  );
  const totalCitationsEstimate = Math.max(
    profile.scopusCitedBy || 0,
    profile.wosCitedBy || 0,
  );

  return (
    <PublicLayout showSearch={false}>
      {/* ═════ Hero ═════ */}
      <section className="border-b" style={{ borderColor: '#e5e7eb', background: '#fafaf9' }}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Link href="/p/arastirmacilar" className="text-xs flex items-center gap-1 mb-6 hover:underline" style={{ color: '#6b7280' }}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Araştırmacılara dön
          </Link>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar */}
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="w-32 h-32 rounded object-cover flex-shrink-0"
                style={{ border: '1px solid #e5e7eb' }} />
            ) : (
              <div className="w-32 h-32 rounded flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
                style={{ background: '#0f2444' }}>
                {getInitials(profile.firstName, profile.lastName)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              {profile.title && (
                <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: '#c8a45a' }}>{profile.title}</p>
              )}
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1" style={{ color: '#0f2444' }}>
                {profile.firstName} {profile.lastName}
              </h1>
              <div className="mt-2 space-y-0.5 text-sm" style={{ color: '#4b5563' }}>
                {profile.faculty && <p>{profile.faculty}</p>}
                {profile.department && <p style={{ color: '#6b7280' }}>{profile.department}</p>}
              </div>
              {profile.expertiseArea && (
                <p className="mt-3 text-sm italic max-w-2xl" style={{ color: '#6b7280' }}>
                  {profile.expertiseArea}
                </p>
              )}

              {/* External profile chips */}
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.orcidId && <ExtLink label="ORCID" href={`https://orcid.org/${profile.orcidId}`} bg="#a6ce39" />}
                {profile.scopusAuthorId && <ExtLink label="Scopus" href={`https://www.scopus.com/authid/detail.uri?authorId=${profile.scopusAuthorId}`} bg="#e9711c" />}
                {profile.googleScholarId && <ExtLink label="Google Scholar" href={`https://scholar.google.com/citations?user=${profile.googleScholarId}`} bg="#4285f4" />}
                {profile.wosResearcherId && <ExtLink label="Web of Science" href={`https://www.webofscience.com/wos/author/record/${profile.wosResearcherId}`} bg="#5e33bf" />}
                {profile.researchGateUrl && <ExtLink label="ResearchGate" href={profile.researchGateUrl} bg="#00d0af" />}
                {profile.academiaUrl && <ExtLink label="Academia" href={profile.academiaUrl} bg="#41454a" />}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════ Stats strip ═════ */}
      <section className="border-b" style={{ borderColor: '#e5e7eb' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x" style={{ borderColor: '#e5e7eb' }}>
            <StatInline label="Toplam Yayın" value={totalPubsEstimate} />
            <StatInline label="Toplam Atıf" value={totalCitationsEstimate} />
            <StatInline label="Scopus h-index" value={profile.scopusHIndex || 0} />
            <StatInline label="WoS h-index" value={profile.wosHIndex || 0} />
            <StatInline label="Projeler" value={projects.length} />
          </div>
        </div>
      </section>

      {/* ═════ Tabs ═════ */}
      <section className="max-w-7xl mx-auto px-6">
        <div className="flex border-b overflow-x-auto" style={{ borderColor: '#e5e7eb' }}>
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => {
            const count =
              t === 'publications' ? pubs.length :
              t === 'projects' ? projects.length :
              t === 'collaborations' ? ((collab?.organizations.length || 0) + (collab?.coResearchers.length || 0)) :
              undefined;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors"
                style={{
                  color: tab === t ? '#0f2444' : '#6b7280',
                  borderColor: tab === t ? '#c8a45a' : 'transparent',
                }}
              >
                {TAB_LABELS[t]}
                {count !== undefined && count > 0 && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded tabular-nums"
                    style={{ background: tab === t ? '#0f2444' : '#f3f4f6', color: tab === t ? '#ffffff' : '#6b7280' }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ═════ Tab content ═════ */}
      <section className="max-w-7xl mx-auto px-6 py-8 pb-16">
        {tab === 'about' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6b7280' }}>Biyografi</h2>
              {profile.bio ? (
                <div className="prose prose-sm max-w-none text-[#374151]" style={{ lineHeight: 1.7 }}>
                  <p className="whitespace-pre-wrap">{profile.bio}</p>
                </div>
              ) : (
                <p className="text-sm italic" style={{ color: '#9ca3af' }}>Bu araştırmacı henüz biyografi eklememiş.</p>
              )}
            </div>

            <aside>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6b7280' }}>Künye</h2>
              <dl className="space-y-4 text-sm">
                {profile.faculty && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>Fakülte</dt>
                    <dd className="mt-0.5 font-medium" style={{ color: '#0f2444' }}>{profile.faculty}</dd>
                  </div>
                )}
                {profile.department && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>Bölüm</dt>
                    <dd className="mt-0.5" style={{ color: '#374151' }}>{profile.department}</dd>
                  </div>
                )}
                {profile.expertiseArea && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>Uzmanlık Alanı</dt>
                    <dd className="mt-0.5" style={{ color: '#374151' }}>{profile.expertiseArea}</dd>
                  </div>
                )}
                {profile.memberSince && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>Sistem Üyeliği</dt>
                    <dd className="mt-0.5" style={{ color: '#374151' }}>{new Date(profile.memberSince).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })}</dd>
                  </div>
                )}
              </dl>
            </aside>
          </div>
        )}

        {tab === 'publications' && (
          <div>
            {pubsLoading ? (
              <div className="flex justify-center py-16"><div className="spinner" /></div>
            ) : pubs.length === 0 ? (
              <EmptyBlock text="Portalda listelenmiş yayın yok. Scopus/ORCID/manuel kayıt bulunamadı." />
            ) : (
              <>
                <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
                  {pubs.length.toLocaleString('tr-TR')} yayın · Scopus, OpenAlex ve manuel kayıtlardan birleştirilmiştir
                </p>
                <div className="bg-white rounded-lg border divide-y" style={{ borderColor: '#e5e7eb' }}>
                  {pubs.map(p => (
                    <article key={p.id} className="p-5 hover:bg-[#fafaf9] transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm leading-snug" style={{ color: '#0f2444' }}>{p.title}</h3>
                          {p.authors && (
                            <p className="mt-1.5 text-xs line-clamp-2" style={{ color: '#6b7280' }}>{p.authors}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: '#6b7280' }}>
                            {p.journal && <span className="italic">{p.journal}</span>}
                            {typeof p.citations === 'number' && p.citations > 0 && (
                              <span><b style={{ color: '#0f2444' }}>{p.citations}</b> atıf</span>
                            )}
                            {p.doi && (
                              <a className="hover:underline inline-flex items-center gap-0.5" style={{ color: '#0f2444' }}
                                href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">
                                DOI ↗
                              </a>
                            )}
                            {p.url && !p.doi && (
                              <a className="hover:underline inline-flex items-center gap-0.5" style={{ color: '#0f2444' }}
                                href={p.url} target="_blank" rel="noreferrer">
                                Tam metin ↗
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {p.year && (
                            <span className="text-lg font-bold tabular-nums" style={{ color: '#0f2444' }}>{p.year}</span>
                          )}
                          <div className="flex gap-1">
                            {p.quartile && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  background: p.quartile === 'Q1' ? '#dcfce7' : p.quartile === 'Q2' ? '#fef3c7' : '#f3f4f6',
                                  color: p.quartile === 'Q1' ? '#15803d' : p.quartile === 'Q2' ? '#92400e' : '#374151',
                                }}>
                                {p.quartile}
                              </span>
                            )}
                            {p.isOpenAccess && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700" title="Open Access">
                                OA
                              </span>
                            )}
                            {p.isFeatured && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700" title="Öne çıkarılmış">
                                ⭐
                              </span>
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
              <EmptyBlock text="Araştırmacının kamuya açık projesi yok. Proje sahibi aksini belirtmedikçe projeler kapalı tutulur." />
            ) : (
              <div className="bg-white rounded-lg border divide-y" style={{ borderColor: '#e5e7eb' }}>
                {projects.map(p => (
                  <article key={p.id} className="p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <h3 className="font-semibold text-sm flex-1 min-w-0" style={{ color: '#0f2444' }}>{p.title}</h3>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded border" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
                          {p.type}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{
                            background: p.status === 'active' ? '#dcfce7' : p.status === 'completed' ? '#f3f4f6' : '#fef3c7',
                            color: p.status === 'active' ? '#15803d' : p.status === 'completed' ? '#374151' : '#92400e',
                          }}>
                          {p.status === 'active' ? 'Aktif' : p.status === 'completed' ? 'Tamamlandı' : p.status}
                        </span>
                      </div>
                    </div>
                    {p.description && (
                      <p className="mt-2 text-xs leading-relaxed" style={{ color: '#4b5563' }}>{p.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: '#9ca3af' }}>
                      {p.startDate && <span>📅 {p.startDate}{p.endDate ? ` — ${p.endDate}` : ''}</span>}
                      {p.fundingSource && <span>💰 {p.fundingSource}</span>}
                      {p.faculty && <span>🏛 {p.faculty}</span>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'collaborations' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6b7280' }}>
                Kurumsal Ortaklar
              </h2>
              {!collab?.organizations.length ? (
                <p className="text-sm italic" style={{ color: '#9ca3af' }}>Henüz kurumsal işbirliği kaydı yok.</p>
              ) : (
                <div className="bg-white rounded-lg border divide-y" style={{ borderColor: '#e5e7eb' }}>
                  {collab.organizations.map(o => (
                    <div key={o.name} className="flex items-center justify-between p-3 hover:bg-[#fafaf9] transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#0f2444' }}>{o.name}</p>
                        {o.sectors?.length ? (
                          <p className="text-[11px]" style={{ color: '#9ca3af' }}>{o.sectors.join(' · ')}</p>
                        ) : null}
                      </div>
                      <span className="text-xs font-semibold tabular-nums ml-2 flex-shrink-0" style={{ color: '#c8a45a' }}>
                        {o.projectCount} proje
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6b7280' }}>
                Çalışma Arkadaşları
              </h2>
              {!collab?.coResearchers.length ? (
                <p className="text-sm italic" style={{ color: '#9ca3af' }}>Henüz birlikte proje yürüttüğü araştırmacı yok.</p>
              ) : (
                <div className="bg-white rounded-lg border divide-y" style={{ borderColor: '#e5e7eb' }}>
                  {collab.coResearchers.map(c => (
                    <Link key={c.id} href={`/p/${c.slug || c.id}`}
                      className="flex items-center gap-3 p-3 hover:bg-[#fafaf9] transition-colors">
                      {c.avatar ? (
                        <img src={c.avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                          style={{ background: '#0f2444' }}>
                          {getInitials(c.firstName, c.lastName)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#0f2444' }}>
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: '#6b7280' }}>{c.faculty || '—'}</p>
                      </div>
                      <span className="text-xs font-semibold tabular-nums flex-shrink-0" style={{ color: '#c8a45a' }}>×{c.count}</span>
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
function StatInline({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-6 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1 tracking-tight" style={{ color: '#0f2444' }}>
        {new Intl.NumberFormat('tr-TR').format(value)}
      </p>
    </div>
  );
}

function ExtLink({ label, href, bg }: { label: string; href: string; bg: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="px-2.5 py-1 rounded text-[11px] font-semibold text-white hover:opacity-90 transition-opacity"
      style={{ background: bg }}
    >
      {label}
    </a>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-lg border py-16 text-center" style={{ borderColor: '#e5e7eb' }}>
      <p className="text-sm" style={{ color: '#9ca3af' }}>{text}</p>
    </div>
  );
}
