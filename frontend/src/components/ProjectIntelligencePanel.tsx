'use client';
import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';

/**
 * Proje Zekası Paneli — proje oluşturma/düzenleme sayfasının sağına
 * yerleştirilen canlı karar destek widget'ları.
 *
 * Her widget bağımsız çalışır — biri patlarsa diğerleri etkilenmez.
 * Kullanıcı formda yazdıkça, debounce ile arkaplan sorgular tetiklenir.
 */

export interface PipProps {
  title?: string;
  description?: string;
  keywords?: string[];      // virgülle ayrılmış kelimeler array olarak
  type?: string;            // proje türü (tubitak, eu, bap, industry)
  budget?: number;
  faculty?: string;
}

/* ─── Icon helper ─── */
type IconName = 'book' | 'euro' | 'globe' | 'patent' | 'users' | 'leaf' | 'chart' | 'flag' | 'tag' | 'list' | 'info' | 'check' | 'external' | 'alert' | 'lock';
const ICONS: Record<IconName, string> = {
  book:     'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  euro:     'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  globe:    'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  patent:   'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  users:    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  leaf:     'M7 20l4-16m2 16l4-16M6 9h14M4 15h14',
  chart:    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  flag:     'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
  tag:      'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  list:     'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  info:     'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  check:    'M5 13l4 4L19 7',
  external: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
  alert:    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  lock:     'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
};

function Icon({ name, className = 'w-4 h-4', strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[name]} />
    </svg>
  );
}

const QUARTILE_COLORS: Record<string, string> = { Q1: '#059669', Q2: '#2563eb', Q3: '#d97706', Q4: '#dc2626' };
const SDG_COLORS = ['#e5243b','#dda63a','#4c9f38','#c5192d','#ff3a21','#26bde2','#fcc30b','#a21942','#fd6925','#dd1367','#fd9d24','#bf8b2e','#3f7e44','#0a97d9','#56c02b','#00689d','#19486a'];

/* Debounce hook */
function useDebounced<T>(value: T, delay = 800): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

/* Widget wrapper */
function Widget({ icon, title, children, badge, subtitle, empty }: {
  icon: IconName; title: string; children?: React.ReactNode; badge?: string; subtitle?: string; empty?: boolean;
}) {
  const [open, setOpen] = useState(!empty);
  return (
    <div className="card overflow-hidden" style={{ opacity: empty ? 0.65 : 1 }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-3 text-left hover:bg-[#faf8f4] transition-colors">
        <Icon name={icon} className="w-4 h-4 text-navy flex-shrink-0" />
        <span className="font-semibold text-navy text-sm flex-1 truncate">{title}</span>
        {badge && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#c8a45a', color: '#0f2444' }}>{badge}</span>}
        <svg className="w-3.5 h-3.5 text-muted" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {subtitle && open && <p className="text-xs text-muted px-3 pb-2 -mt-1">{subtitle}</p>}
      {open && children && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function Loader() {
  return <div className="flex justify-center py-2"><div className="w-5 h-5 border-2 border-navy/20 border-t-navy rounded-full animate-spin" /></div>;
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs text-muted italic">{text}</p>;
}

/* ═══════════════════════════════════════════════════════════ */

export function ProjectIntelligencePanel({ title, description, keywords = [], type, budget, faculty }: PipProps) {
  const dTitle = useDebounced(title, 900);
  const dDesc = useDebounced(description, 900);
  const dKw = useDebounced(keywords.join(','), 900);
  const dType = useDebounced(type, 900);
  const dBudget = useDebounced(budget, 900);
  const dFaculty = useDebounced(faculty, 900);

  const effectiveKeywords = useMemo(() => dKw.split(',').map(s => s.trim()).filter(Boolean), [dKw]);
  const minReady = (dTitle && dTitle.length > 8) || effectiveKeywords.length > 0;

  return (
    <aside className="space-y-3 sticky top-4" style={{ maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}>
      <div className="p-3 rounded-xl text-xs" style={{ background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)', color: 'white' }}>
        <p className="font-bold flex items-center gap-1.5">
          <Icon name="chart" className="w-3.5 h-3.5" />
          Proje Zekası
        </p>
        <p className="opacity-80 mt-1 leading-relaxed">
          Yazdıkça Scopus · WoS · OpenAlex · Crossref · SCImago · EPO · CORDIS kaynaklarından
          karar destek bilgisi gelir.
        </p>
      </div>

      {!minReady && (
        <div className="card p-4 text-center">
          <Icon name="info" className="w-6 h-6 mx-auto text-muted" />
          <p className="text-xs text-muted mt-2">Proje başlığı veya anahtar kelime girdikçe bu panel dolar.</p>
        </div>
      )}

      {minReady && <>
        <TargetJournalsWidget keywords={effectiveKeywords} title={dTitle} />
        <GlobalSimilarWidget title={dTitle || ''} description={dDesc} />
        <EuOpportunitiesWidget keywords={effectiveKeywords} />
        <PatentLandscapeWidget keywords={effectiveKeywords} />
        <PotentialTeamWidget keywords={effectiveKeywords} faculty={dFaculty} />
        <SdgEvidenceWidget title={dTitle || ''} description={dDesc} />
        <ConceptsWidget title={dTitle || ''} description={dDesc} />
        <TurkeyBenchmarkWidget keywords={effectiveKeywords} />
        <SuccessEstimateWidget type={dType} budget={dBudget} />
        <ChecklistWidget type={dType} />
      </>}
    </aside>
  );
}

/* ─── 1. HEDEF DERGİ ─── */
function TargetJournalsWidget({ keywords, title }: { keywords: string[]; title?: string }) {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!title && keywords.length === 0) return;
    setLoading(true);
    api.get('/intelligence/target-journals', { params: { keywords: keywords.join(','), title } })
      .then(r => setData(r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [keywords.join(','), title]);

  const withQuality = (data || []).filter(j => j.sjrQuartile);

  return (
    <Widget icon="book" title="Hedef Dergi Önerisi"
      subtitle="Benzer yayınların dergileri + SCImago kalite sıralaması"
      badge={withQuality.length > 0 ? `${withQuality.length} Q dergi` : undefined}
      empty={!loading && (!data || data.length === 0)}>
      {loading ? <Loader /> : (data && data.length > 0) ? (
        <div className="space-y-1.5">
          {data.slice(0, 6).map((j, i) => (
            <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: '#faf8f4' }}>
              {j.sjrQuartile && (
                <span className="text-[10px] font-bold w-6 h-6 rounded flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: QUARTILE_COLORS[j.sjrQuartile] || '#94a3b8' }}>
                  {j.sjrQuartile}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-navy truncate">{j.title}</p>
                {j.sjrScore && <p className="text-muted text-[10px]">SJR: {j.sjrScore}{j.hIndex ? ` · h-idx: ${j.hIndex}` : ''}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyNote text="Bu konuyla eşleşen dergi bulunamadı" />}
    </Widget>
  );
}

/* ─── 2. KÜRESEL BENZERLİK ─── */
function GlobalSimilarWidget({ title, description }: { title: string; description?: string }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!title || title.length < 8) return;
    setLoading(true);
    api.get('/intelligence/global-similar', { params: { title, description } })
      .then(r => setData(r.data))
      .catch(() => setData({ total: 0, items: [] }))
      .finally(() => setLoading(false));
  }, [title, description]);

  return (
    <Widget icon="globe" title="Küresel Benzer Çalışma"
      subtitle="Dünya literatüründe aynı konuda yapılmış yayınlar"
      badge={data?.total ? `${data.total} bulundu` : undefined}
      empty={!loading && (!data || data.items.length === 0)}>
      {loading ? <Loader /> : (data && data.items.length > 0) ? (
        <div className="space-y-1.5">
          {data.items.slice(0, 5).map((it: any, i: number) => (
            <div key={i} className="text-xs p-2 rounded-lg border" style={{ borderColor: '#f0ede8' }}>
              <p className="font-semibold text-navy line-clamp-2">{it.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {it.year && <span className="text-muted">{it.year}</span>}
                {it.journal && <span className="text-muted truncate">{it.journal}</span>}
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#c8a45a33', color: '#92651a' }}>
                  {it.citedBy} atıf
                </span>
              </div>
              {it.doi && (
                <a href={`https://doi.org/${it.doi}`} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-navy hover:underline inline-flex items-center gap-0.5 mt-1">
                  DOI <Icon name="external" className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      ) : <EmptyNote text="Bu başlıkla global literatür eşleşmesi yok" />}
    </Widget>
  );
}

/* ─── 3. AB FIRSATLARI ─── */
function EuOpportunitiesWidget({ keywords }: { keywords: string[] }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (keywords.length === 0) return;
    setLoading(true);
    api.get('/intelligence/eu-opportunities', { params: { keywords: keywords.join(',') } })
      .then(r => setData(r.data))
      .catch(() => setData({ total: 0, items: [] }))
      .finally(() => setLoading(false));
  }, [keywords.join(',')]);

  const topCountries = data?.countries ? Object.entries(data.countries).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5) : [];

  return (
    <Widget icon="euro" title="AB Fırsatları"
      subtitle="Bu konuda finanse edilmiş Horizon/H2020/FP7 projeleri"
      badge={data?.total ? `${data.total} proje` : undefined}
      empty={!loading && (!data || data.total === 0)}>
      {loading ? <Loader /> : (data && data.total > 0) ? (
        <div className="space-y-2">
          {topCountries.length > 0 && (
            <div className="text-xs">
              <p className="text-muted mb-1">En aktif partner ülkeler:</p>
              <div className="flex flex-wrap gap-1">
                {topCountries.map(([country, n]: any) => (
                  <span key={country} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#eff6ff', color: '#1e40af' }}>
                    {country}: {n}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.items.slice(0, 3).map((p: any, i: number) => (
            <div key={i} className="text-xs p-2 rounded-lg border" style={{ borderColor: '#f0ede8' }}>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: '#0891b2' }}>{p.framework}</span>
                {p.acronym && <span className="font-bold text-navy">{p.acronym}</span>}
              </div>
              <p className="font-semibold text-navy line-clamp-2 mt-1">{p.title}</p>
              {p.ecMaxContribution && <p className="text-[10px] text-emerald-600 font-bold mt-1">€{Number(p.ecMaxContribution).toLocaleString()}</p>}
            </div>
          ))}
        </div>
      ) : <EmptyNote text="Bu konuda AB fonlu proje bulunamadı" />}
    </Widget>
  );
}

/* ─── 4. PATENT MANZARASI ─── */
function PatentLandscapeWidget({ keywords }: { keywords: string[] }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (keywords.length === 0) return;
    setLoading(true);
    api.get('/intelligence/patent-landscape', { params: { keywords: keywords.join(',') } })
      .then(r => setData(r.data))
      .catch(() => setData({ configured: false }))
      .finally(() => setLoading(false));
  }, [keywords.join(',')]);

  return (
    <Widget icon="patent" title="Patent Manzarası (EPO)"
      subtitle="Bu konuda mevcut patent/başvuru sayısı — prior art riski"
      badge={data?.configured ? `TR: ${data.trCount} · EP: ${data.epCount}` : undefined}
      empty={!loading && (!data || !data.configured)}>
      {loading ? <Loader /> : data?.configured === false ? (
        <div className="text-xs p-2 rounded-lg" style={{ background: '#fffbeb', color: '#92400e' }}>
          <Icon name="lock" className="w-3.5 h-3.5 inline mr-1" />
          EPO OPS yapılandırılmamış. EPO_CONSUMER_KEY + SECRET gerekli.
        </div>
      ) : data && (data.trCount + data.epCount) > 0 ? (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-lg" style={{ background: '#fef2f2' }}>
              <p className="text-lg font-bold" style={{ color: '#dc2626' }}>{data.trCount}</p>
              <p className="text-[10px] text-muted">TR Patent</p>
            </div>
            <div className="p-2 rounded-lg" style={{ background: '#eff6ff' }}>
              <p className="text-lg font-bold" style={{ color: '#1e40af' }}>{data.epCount}</p>
              <p className="text-[10px] text-muted">AB Patent</p>
            </div>
          </div>
          {data.samples?.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-muted mb-1">Örnekler:</p>
              {data.samples.slice(0, 2).map((p: any, i: number) => (
                <p key={i} className="text-xs text-navy line-clamp-1">• {p.title}</p>
              ))}
            </div>
          )}
        </div>
      ) : <EmptyNote text="Bu konuda patent kaydı bulunamadı" />}
    </Widget>
  );
}

/* ─── 5. POTANSİYEL EKİP ─── */
function PotentialTeamWidget({ keywords, faculty }: { keywords: string[]; faculty?: string }) {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (keywords.length === 0) return;
    setLoading(true);
    api.get('/intelligence/potential-team', { params: { keywords: keywords.join(','), faculty } })
      .then(r => setData(r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [keywords.join(','), faculty]);

  const internal = (data || []).filter(d => d.source === 'internal');
  const external = (data || []).filter(d => d.source === 'external');

  return (
    <Widget icon="users" title="Potansiyel Ekip"
      subtitle="Alanında aktif MKÜ + dış araştırmacılar"
      badge={data?.length ? `${internal.length} iç · ${external.length} dış` : undefined}
      empty={!loading && (!data || data.length === 0)}>
      {loading ? <Loader /> : data && data.length > 0 ? (
        <div className="space-y-2">
          {internal.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted mb-1">MKÜ İÇİNDEN</p>
              {internal.map((p, i) => (
                <div key={i} className="text-xs py-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#059669' }} />
                  <span className="font-semibold text-navy truncate flex-1">{p.name}</span>
                  {p.hIndex && <span className="text-[10px] text-muted">h: {p.hIndex}</span>}
                </div>
              ))}
            </div>
          )}
          {external.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted mb-1">DIŞ KURUMLAR</p>
              {external.map((p, i) => (
                <div key={i} className="text-xs py-1">
                  <p className="font-semibold text-navy truncate">{p.name}</p>
                  {p.institution && <p className="text-[10px] text-muted truncate">{p.institution} · {p.publicationCount} ortak yayın</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : <EmptyNote text="Ekip önerisi bulunamadı" />}
    </Widget>
  );
}

/* ─── 6. SDG KANITI ─── */
function SdgEvidenceWidget({ title, description }: { title: string; description?: string }) {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!title || title.length < 8) return;
    setLoading(true);
    api.get('/intelligence/sdg-evidence', { params: { title, description } })
      .then(r => setData(r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [title, description]);

  return (
    <Widget icon="leaf" title="SDG Emsal Referansları"
      subtitle="Projenin değdiği SDG'ler — dünyada kaç emsal proje var"
      badge={data?.length ? `${data.length} SDG` : undefined}
      empty={!loading && (!data || data.length === 0)}>
      {loading ? <Loader /> : data && data.length > 0 ? (
        <div className="space-y-2">
          {data.slice(0, 5).map((s, i) => {
            const num = parseInt(s.sdgId?.match(/\d+/)?.[0] || '0');
            const color = SDG_COLORS[(num - 1) % SDG_COLORS.length];
            return (
              <div key={i} className="flex items-start gap-2 text-xs">
                <div className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0" style={{ background: color }}>{num}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy">{s.sdgName}</p>
                  <p className="text-[10px] text-muted">{s.projectCount} örnek proje</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : <EmptyNote text="SDG eşleşmesi tespit edilmedi" />}
    </Widget>
  );
}

/* ─── 7. KONSEPT ETİKETLERİ ─── */
function ConceptsWidget({ title, description }: { title: string; description?: string }) {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!title || title.length < 8) return;
    setLoading(true);
    api.get('/intelligence/concepts', { params: { title, description } })
      .then(r => setData(r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [title, description]);

  return (
    <Widget icon="tag" title="Otomatik Konu Etiketleri"
      subtitle="OpenAlex konsept hiyerarşisi"
      badge={data?.length ? `${data.length} kavram` : undefined}
      empty={!loading && (!data || data.length === 0)}>
      {loading ? <Loader /> : data && data.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {data.slice(0, 12).map((c, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: c.level === 0 ? '#0f2444' : c.level === 1 ? '#1a3a6b33' : '#f0ede8', color: c.level === 0 ? 'white' : '#0f2444' }}>
              {c.name}
            </span>
          ))}
        </div>
      ) : <EmptyNote text="Konsept etiketi üretilemedi" />}
    </Widget>
  );
}

/* ─── 8. TÜRKİYE BENCHMARK ─── */
function TurkeyBenchmarkWidget({ keywords }: { keywords: string[] }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (keywords.length === 0) return;
    setLoading(true);
    api.get('/intelligence/turkey-benchmark', { params: { keywords: keywords.join(',') } })
      .then(r => setData(r.data))
      .catch(() => setData({ total: 0, topInstitutions: [] }))
      .finally(() => setLoading(false));
  }, [keywords.join(',')]);

  return (
    <Widget icon="flag" title="Türkiye Benchmark"
      subtitle="Bu konuda Türk üniversitelerinin AB projesi sayısı"
      badge={data?.total ? `${data.total} TR proje` : undefined}
      empty={!loading && (!data || data.total === 0)}>
      {loading ? <Loader /> : data && data.total > 0 ? (
        <div className="space-y-1">
          {data.topInstitutions.slice(0, 6).map((i: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-navy truncate flex-1">{i.name}</span>
              <span className="font-bold ml-2" style={{ color: '#0f2444' }}>{i.count}</span>
            </div>
          ))}
        </div>
      ) : <EmptyNote text="Türk kurumlarında emsal proje bulunamadı" />}
    </Widget>
  );
}

/* ─── 9. BAŞARI TAHMİNİ ─── */
function SuccessEstimateWidget({ type, budget }: { type?: string; budget?: number }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    api.get('/intelligence/success-estimate', { params: { type, budget } })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [type, budget]);

  return (
    <Widget icon="chart" title="Başarı Tahmini"
      subtitle="MKÜ'deki benzer tipteki projelerden"
      badge={data?.sampleSize ? `${data.sampleSize} örnek` : undefined}
      empty={!loading && (!data || data.sampleSize === 0)}>
      {loading ? <Loader /> : data && data.sampleSize > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-lg" style={{ background: '#f0fdf4' }}>
              <p className="text-xl font-bold" style={{ color: '#059669' }}>%{data.avgCompletionRate}</p>
              <p className="text-[10px] text-muted">Tamamlanma</p>
            </div>
            {data.budgetPercentile !== undefined && (
              <div className="p-2 rounded-lg" style={{ background: '#eff6ff' }}>
                <p className="text-xl font-bold" style={{ color: '#1e40af' }}>%{data.budgetPercentile}</p>
                <p className="text-[10px] text-muted">Bütçe Percentile</p>
              </div>
            )}
          </div>
          {data.budgetPercentile !== undefined && (
            <p className="text-[10px] text-muted">
              Bu bütçe benzer projelerin %{data.budgetPercentile} üstünde
            </p>
          )}
        </div>
      ) : <EmptyNote text="Yeterli emsal veri yok" />}
    </Widget>
  );
}

/* ─── 10. BAŞVURU KONTROL LİSTESİ ─── */
function ChecklistWidget({ type }: { type?: string }) {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    api.get('/intelligence/checklist', { params: { type } })
      .then(r => setData(r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [type]);

  if (!data) return null;
  const groups = data.reduce((acc: any, it: any) => {
    acc[it.category] = acc[it.category] || [];
    acc[it.category].push(it);
    return acc;
  }, {} as Record<string, any[]>);
  const done = checked.size;
  const total = data.length;

  return (
    <Widget icon="list" title="Başvuru Kontrol Listesi"
      subtitle={`${done}/${total} tamamlandı`}
      badge={total > 0 ? `%${Math.round((done / total) * 100)}` : undefined}>
      {loading ? <Loader /> : data.length > 0 ? (
        <div className="space-y-2">
          {Object.entries(groups).map(([cat, items]: any) => (
            <div key={cat}>
              <p className="text-[10px] font-bold text-muted mb-1">{cat.toUpperCase()}</p>
              {items.map((it: any) => {
                const key = it.label;
                const isChecked = checked.has(key);
                return (
                  <label key={key} className="flex items-center gap-2 text-xs cursor-pointer py-0.5 hover:bg-[#faf8f4] rounded">
                    <input type="checkbox" checked={isChecked} onChange={e => {
                      const next = new Set(checked);
                      if (e.target.checked) next.add(key); else next.delete(key);
                      setChecked(next);
                    }} />
                    <span className={isChecked ? 'line-through text-muted' : 'text-navy'}>
                      {it.label}
                      {it.required && !isChecked && <span className="text-red-500 ml-1">*</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      ) : <EmptyNote text="Proje türü seçilmemiş" />}
    </Widget>
  );
}
