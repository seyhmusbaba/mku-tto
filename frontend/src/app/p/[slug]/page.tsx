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
  year?: number; doi?: string; url?: string; type: string;
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
    // Tüm verileri paralelde çek (tabs değiştiğinde hızlı olsun)
    Promise.all([
      publicApi.profilePubs(slug).catch(() => ({ data: [] })),
      publicApi.profileProjects(slug).catch(() => ({ data: [] })),
      publicApi.profileCollaborations(slug).catch(() => ({ data: { organizations: [], coResearchers: [] } })),
    ]).then(([p, pr, c]) => {
      setPubs(p.data || []);
      setProjects(pr.data || []);
      setCollab(c.data);
    });
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
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <svg className="w-14 h-14 mx-auto text-[#0f2444]/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
          </svg>
          <h1 className="mt-4 text-lg font-semibold text-[#0f2444]">Araştırmacı bulunamadı</h1>
          <p className="text-sm text-muted mt-2">Aradığınız profil kaldırılmış veya gizli olabilir.</p>
          <Link href="/p/arastirmacilar" className="inline-block mt-6 px-4 py-2 rounded-full bg-[#0f2444] text-white text-sm font-semibold hover:bg-[#1a3a6b]">
            Araştırmacıları Keşfet
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const totalScopusH = profile.scopusHIndex || 0;
  const totalWosH = profile.wosHIndex || 0;
  const citations = (profile.scopusCitedBy || 0) + (profile.wosCitedBy || 0);

  return (
    <PublicLayout showSearch={false}>
      {/* ═════ Hero header ═════ */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 55%, #264d82 100%)' }}>
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 80% 40%, rgba(200,164,90,0.5), transparent 50%)' }} />
        <div className="max-w-7xl mx-auto px-4 py-10 relative">
          <Link href="/p/arastirmacilar" className="text-white/60 hover:text-white text-xs flex items-center gap-1 mb-6">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Araştırmacılara dön
          </Link>

          <div className="flex flex-col md:flex-row items-start md:items-end gap-5">
            {/* Avatar */}
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="w-28 h-28 rounded-2xl object-cover flex-shrink-0"
                style={{ border: '3px solid rgba(200,164,90,0.5)' }} />
            ) : (
              <div className="w-28 h-28 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #c8a45a 0%, #e8c97a 100%)',
                  border: '3px solid rgba(200,164,90,0.5)',
                }}>
                {getInitials(profile.firstName, profile.lastName)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              {profile.title && <p className="text-[#c8a45a] font-semibold text-sm">{profile.title}</p>}
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight mt-0.5">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-white/70 text-sm mt-1.5">
                {profile.faculty}{profile.department ? ` · ${profile.department}` : ''}
              </p>
              {profile.expertiseArea && (
                <p className="text-white/60 text-xs mt-2 italic max-w-xl">{profile.expertiseArea}</p>
              )}

              {/* External links */}
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.orcidId && <ExtLink label="ORCID" href={`https://orcid.org/${profile.orcidId}`} color="#a6ce39" />}
                {profile.scopusAuthorId && <ExtLink label="Scopus" href={`https://www.scopus.com/authid/detail.uri?authorId=${profile.scopusAuthorId}`} color="#e9711c" />}
                {profile.googleScholarId && <ExtLink label="Scholar" href={`https://scholar.google.com/citations?user=${profile.googleScholarId}`} color="#4285f4" />}
                {profile.wosResearcherId && <ExtLink label="WoS" href={`https://www.webofscience.com/wos/author/record/${profile.wosResearcherId}`} color="#5e33bf" />}
                {profile.researchGateUrl && <ExtLink label="ResearchGate" href={profile.researchGateUrl} color="#00d0af" />}
                {profile.academiaUrl && <ExtLink label="Academia" href={profile.academiaUrl} color="#41454a" />}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════ Stats bar ═════ */}
      <section className="max-w-7xl mx-auto px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl border shadow-sm p-4 grid grid-cols-2 md:grid-cols-6 gap-3" style={{ borderColor: '#e8e4dc' }}>
          <Metric label="Yayın (Scopus)" value={profile.scopusDocCount || 0} />
          <Metric label="Atıf (Scopus)" value={profile.scopusCitedBy || 0} />
          <Metric label="h-index (Scopus)" value={totalScopusH} />
          <Metric label="Yayın (WoS)" value={profile.wosDocCount || 0} />
          <Metric label="Atıf (WoS)" value={profile.wosCitedBy || 0} />
          <Metric label="h-index (WoS)" value={totalWosH} />
        </div>
      </section>

      {/* ═════ Tabs ═════ */}
      <section className="max-w-7xl mx-auto px-4 mt-6">
        <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: '#e8e4dc' }}>
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
                className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  tab === t ? 'text-[#0f2444] border-[#c8a45a]' : 'text-muted border-transparent hover:text-[#0f2444]'
                }`}
              >
                {TAB_LABELS[t]}
                {count !== undefined && count > 0 && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#f0ede8]">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ═════ Tab content ═════ */}
      <section className="max-w-7xl mx-auto px-4 mt-6 mb-16">
        {tab === 'about' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-white rounded-xl border p-5" style={{ borderColor: '#e8e4dc' }}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#0f2444]/60 mb-3">Biyografi</h2>
              {profile.bio ? (
                <p className="text-sm leading-relaxed text-[#0f2444] whitespace-pre-wrap">{profile.bio}</p>
              ) : (
                <p className="text-sm text-muted italic">Bu araştırmacı henüz biyografi eklememiş.</p>
              )}
            </div>

            <aside className="bg-white rounded-xl border p-5 space-y-3" style={{ borderColor: '#e8e4dc' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Kurum</p>
                <p className="text-sm font-semibold text-[#0f2444] mt-1">{profile.faculty || '—'}</p>
                {profile.department && <p className="text-xs text-muted">{profile.department}</p>}
              </div>
              {profile.expertiseArea && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Uzmanlık Alanı</p>
                  <p className="text-xs text-[#0f2444] mt-1">{profile.expertiseArea}</p>
                </div>
              )}
              {profile.memberSince && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Üyelik</p>
                  <p className="text-xs text-[#0f2444] mt-1">{new Date(profile.memberSince).getFullYear()} yılından beri</p>
                </div>
              )}
            </aside>
          </div>
        )}

        {tab === 'publications' && (
          <div className="space-y-2">
            {pubs.length === 0 ? (
              <EmptyBlock text="Bu araştırmacının portalda listelenmiş yayını yok." />
            ) : (
              pubs.map(p => (
                <div key={p.id} className="bg-white rounded-xl border p-4" style={{ borderColor: '#e8e4dc' }}>
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-[#0f2444] leading-snug flex-1 min-w-0">{p.title}</h3>
                    {p.isFeatured && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⭐ Öne çıkan</span>}
                    {p.quartile && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{p.quartile}</span>}
                    {p.year && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f0ede8] text-[#0f2444]">{p.year}</span>}
                    {p.isOpenAccess && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🔓 OA</span>}
                  </div>
                  {p.authors && <p className="text-xs text-muted mt-1.5">{p.authors}</p>}
                  <div className="mt-1.5 text-xs text-muted flex flex-wrap gap-x-3">
                    {p.journal && <span className="italic">📘 {p.journal}</span>}
                    {typeof p.citations === 'number' && p.citations > 0 && <span>📊 {p.citations} atıf</span>}
                    {p.doi && <a className="text-blue-600 hover:underline" href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">DOI: {p.doi}</a>}
                    {p.url && <a className="text-blue-600 hover:underline" href={p.url} target="_blank" rel="noreferrer">Link →</a>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'projects' && (
          <div className="space-y-2">
            {projects.length === 0 ? (
              <EmptyBlock text="Bu araştırmacının kamuya açık projesi yok." />
            ) : (
              projects.map(p => (
                <div key={p.id} className="bg-white rounded-xl border p-4" style={{ borderColor: '#e8e4dc' }}>
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-[#0f2444] flex-1">{p.title}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0ede8] text-[#0f2444]">{p.type}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : p.status === 'completed' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.status === 'active' ? 'Aktif' : p.status === 'completed' ? 'Tamamlanan' : p.status}
                    </span>
                  </div>
                  {p.description && <p className="text-xs text-muted mt-2 leading-relaxed">{p.description}</p>}
                  <div className="mt-2 text-xs text-muted flex flex-wrap gap-x-3">
                    {p.startDate && <span>📅 {p.startDate}{p.endDate ? ` → ${p.endDate}` : ''}</span>}
                    {p.fundingSource && <span>💰 {p.fundingSource}</span>}
                    {p.faculty && <span>🏛️ {p.faculty}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'collaborations' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#e8e4dc' }}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#0f2444]/60 mb-3">Kurumsal Ortaklar</h2>
              {!collab?.organizations.length ? (
                <p className="text-sm text-muted italic">Henüz kurumsal işbirliği kaydı yok.</p>
              ) : (
                <div className="space-y-2">
                  {collab.organizations.map(o => (
                    <div key={o.name} className="flex items-center justify-between p-2.5 rounded-lg bg-[#faf8f4]">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0f2444] truncate">{o.name}</p>
                        {o.sectors?.length ? <p className="text-[10px] text-muted">{o.sectors.join(', ')}</p> : null}
                      </div>
                      <span className="text-xs font-bold text-[#c8a45a] flex-shrink-0 ml-2">×{o.projectCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#e8e4dc' }}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#0f2444]/60 mb-3">Birlikte Çalıştığı Araştırmacılar</h2>
              {!collab?.coResearchers.length ? (
                <p className="text-sm text-muted italic">Henüz co-author kaydı yok.</p>
              ) : (
                <div className="space-y-2">
                  {collab.coResearchers.map(c => (
                    <Link key={c.id} href={`/p/${c.slug || c.id}`} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#faf8f4] transition-colors">
                      {c.avatar ? (
                        <img src={c.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ background: 'linear-gradient(135deg, #0f2444, #1a3a6b)' }}>
                          {getInitials(c.firstName, c.lastName)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0f2444] truncate">{c.firstName} {c.lastName}</p>
                        <p className="text-[10px] text-muted truncate">{c.faculty || '—'}</p>
                      </div>
                      <span className="text-[10px] font-bold text-[#c8a45a]">×{c.count}</span>
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
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">{label}</p>
      <p className="text-lg font-bold text-[#0f2444] tabular-nums mt-0.5">{new Intl.NumberFormat('tr-TR').format(value)}</p>
    </div>
  );
}

function ExtLink({ label, href, color }: { label: string; href: string; color: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-white transition-transform hover:scale-105"
      style={{ background: color }}
    >
      {label}
    </a>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-xl border py-12 text-center" style={{ borderColor: '#e8e4dc' }}>
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}
