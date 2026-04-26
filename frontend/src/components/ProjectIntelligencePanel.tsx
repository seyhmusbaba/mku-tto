'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts';

/**
 * Proje Zekâsı Dashboard - proje oluşturma/düzenleme sayfalarının ALTINA
 * yerleştirilen, full-width karar destek panosu.
 *
 * Mimari:
 *  - Hero: AI synthesis (4-boyutlu composite skor ring + narrative)
 *  - 2-col grid: 6 büyük görsel widget
 *  - Alt: SDG chips, konseptler, Türkiye benchmark, kontrol listesi
 *  - Sağ altta: Funding simulator (interactive) + Collaboration network
 *
 * Her widget bağımsız - biri patlarsa diğerleri çalışır.
 */

export interface PipProps {
  title?: string;
  description?: string;
  keywords?: string[];
  type?: string;
  budget?: number;
  faculty?: string;
  /** Synthesis hesaplandığında callback - oluşturma anında raporu yakalamak için */
  onSynthesisReady?: (data: any) => void;
}

/* ─── Icons ─── */
type IconName =
  | 'sparkles' | 'star' | 'brain' | 'target' | 'zap'
  | 'book' | 'euro' | 'globe' | 'patent' | 'users' | 'leaf'
  | 'chart' | 'flag' | 'tag' | 'list' | 'info' | 'check' | 'external'
  | 'alert' | 'lock' | 'award' | 'rocket' | 'fire' | 'shield' | 'trending'
  | 'network' | 'simulator' | 'download';

const I: Record<IconName, string> = {
  sparkles:  'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  star:      'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  brain:     'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  target:    'M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z',
  zap:       'M13 10V3L4 14h7v7l9-11h-7z',
  book:      'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  euro:      'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  globe:     'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  patent:    'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  users:     'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  leaf:      'M7 20l4-16m2 16l4-16M6 9h14M4 15h14',
  chart:     'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  flag:      'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
  tag:       'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  list:      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  info:      'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  check:     'M5 13l4 4L19 7',
  external:  'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
  alert:     'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  lock:      'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  award:     'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  rocket:    'M13 10V3L4 14h7v7l9-11h-7z',
  fire:      'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 7.341 18 9.5 18.998 9.5 19.657 9.343z',
  shield:    'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  trending:  'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  network:   'M13 10V3L4 14h7v7l9-11h-7z',
  simulator: 'M3 10h18M3 14h18m-9-11v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
  download:  'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
};

function Icon({ name, className = 'w-4 h-4', strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d={I[name]} />
    </svg>
  );
}

const QUARTILE_COLORS: Record<string, string> = { Q1: '#059669', Q2: '#2563eb', Q3: '#d97706', Q4: '#dc2626' };
const SDG_COLORS = ['#e5243b','#dda63a','#4c9f38','#c5192d','#ff3a21','#26bde2','#fcc30b','#a21942','#fd6925','#dd1367','#fd9d24','#bf8b2e','#3f7e44','#0a97d9','#56c02b','#00689d','#19486a'];

/* Debounce hook */
function useDebounced<T>(value: T, delay = 900): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

function Loader({ inline = false }: { inline?: boolean }) {
  return <div className={inline ? 'inline-block' : 'flex justify-center py-3'}>
    <div className="w-5 h-5 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
  </div>;
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center cursor-help">
      <Icon name="info" className="w-3.5 h-3.5 text-muted" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 rounded-lg text-xs font-normal leading-relaxed
        opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 shadow-lg"
        style={{ background: '#0f2444', color: 'white' }}>
        {text}
      </span>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export function ProjectIntelligencePanel({ title, description, keywords = [], type, budget, faculty, onSynthesisReady }: PipProps) {
  const dTitle = useDebounced(title, 900);
  const dDesc = useDebounced(description, 900);
  const dKw = useDebounced(keywords.join(','), 900);
  const dType = useDebounced(type, 900);
  const dBudget = useDebounced(budget, 900);
  const dFaculty = useDebounced(faculty, 900);

  const kw = useMemo(() => dKw.split(',').map(s => s.trim()).filter(Boolean), [dKw]);
  const minReady = (dTitle && dTitle.length > 8) || kw.length > 0;

  if (!minReady) {
    return (
      <div className="card p-8 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)', color: 'white' }}>
        <div className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(circle at 20% 30%, #c8a45a 0%, transparent 45%), radial-gradient(circle at 80% 70%, #ffffff 0%, transparent 40%)' }} />
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Icon name="brain" className="w-7 h-7" strokeWidth={1.6} />
          </div>
          <h3 className="font-display text-lg font-bold mb-1">Proje Zekâsı</h3>
          <p className="text-sm opacity-80 max-w-md mx-auto">
            Proje başlığı veya anahtar kelime girmeye başladığınızda
            <strong className="text-white"> 13 akademik kaynak</strong> paralelde analiz edilir -
            literatür, fonlama, dergi uyumu, patent manzarası, ekip önerileri ve daha fazlası.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero başlık */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0f2444', color: 'white' }}>
          <Icon name="brain" className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold text-navy">Proje Zekâsı</h2>
          <p className="text-xs text-muted">Scopus · Web of Science · OpenAlex · Crossref · SCImago · EPO · OpenAIRE · PubMed · arXiv verisinden sentezlenmiş karar destek</p>
        </div>
      </div>

      {/* ═══ HERO: AI Synthesis + 4 Score ═══ */}
      <SynthesisHero title={dTitle} description={dDesc} keywords={kw} type={dType} budget={dBudget} faculty={dFaculty} onReady={onSynthesisReady} />

      {/* ═══ Üst grid: 3 ana widget ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <GlobalSimilarModule title={dTitle || ''} description={dDesc} />
        <EuOpportunitiesModule keywords={kw} />
        <TargetJournalsModule keywords={kw} title={dTitle} />
      </div>

      {/* ═══ Orta grid: 3 widget ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <PatentLandscapeModule keywords={kw} />
        <PotentialTeamModule keywords={kw} faculty={dFaculty} />
        <ImpactGaugeModule type={dType} budget={dBudget} />
      </div>

      {/* ═══ Alt grid: 2 widget - SDG + Konsept ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SdgEvidenceModule title={dTitle || ''} description={dDesc} />
        <ConceptsModule title={dTitle || ''} description={dDesc} />
      </div>

      {/* ═══ Funding Simulator + Collaboration Network ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <FundingSimulatorModule type={dType} faculty={dFaculty} initialBudget={dBudget} />
        <CollaborationNetworkModule keywords={kw} title={dTitle} />
      </div>

      {/* ═══ Türkiye Benchmark + Kontrol Listesi ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TurkeyBenchmarkModule keywords={kw} />
        <ChecklistModule type={dType} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 *  HERO - AI Synthesis + 4-dim Composite Score
 * ═══════════════════════════════════════════════════════════════════════ */

function SynthesisHero({ title, description, keywords, type, budget, faculty, onReady }: any) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ((!title || title.length < 8) && keywords.length === 0) return;
    setLoading(true);
    const params: any = { title, description, keywords: keywords.join(','), type, budget, faculty };
    api.get('/intelligence/synthesis', { params })
      .then(r => {
        setData(r.data);
        if (onReady && r.data) onReady(r.data);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [title, description, keywords.join(','), type, budget, faculty]);

  if (loading && !data) {
    return (
      <div className="card p-6 flex items-center justify-center" style={{ minHeight: 200 }}>
        <div className="text-center">
          <Loader />
          <p className="text-sm text-muted mt-3">Yapay zekâ 13 kaynağı analiz ediyor...</p>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const scoreDims = [
    { key: 'originalityScore', label: 'Özgünlük',       hint: 'Dünyada emsal çalışma ne kadar az' },
    { key: 'competitionScore', label: 'Rekabet',        hint: 'Yüksek skor = alanında az rakip' },
    { key: 'fitScore',          label: 'Dergi Uyumu',    hint: 'Q1 dergilerin hedef listede oranı' },
    { key: 'successProbability',label: 'Başarı Tahmini', hint: 'MKÜ\'deki benzer projelerin tamamlanma oranı' },
  ];

  const aiBadge = data.source === 'ai'
    ? { label: 'Claude AI', color: '#7c3aed' }
    : { label: 'Kural tabanlı', color: '#6b7280' };

  return (
    <div className="card p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #faf8f4 0%, #ffffff 100%)', border: '1px solid #e8e4dc' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#0f2444', color: 'white' }}>
            <Icon name="sparkles" className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-navy">Yönetici Özeti</h3>
            <p className="text-xs text-muted">Tüm sinyaller tek paragrafta</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5"
          style={{ background: aiBadge.color + '18', color: aiBadge.color }}>
          <Icon name="brain" className="w-3 h-3" />
          {aiBadge.label}
        </span>
      </div>

      {/* 4 score + composite */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <div className="col-span-2 md:col-span-1 flex flex-col items-center justify-center p-4 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)', color: 'white' }}>
          <p className="text-[10px] uppercase tracking-wider opacity-70">Proje Zekâsı Skoru</p>
          <p className="font-display text-4xl font-bold my-1">{data.overallScore}</p>
          <p className="text-[10px] opacity-70">/ 100</p>
        </div>
        {scoreDims.map(d => {
          const v = data[d.key] || 0;
          const color = v >= 70 ? '#059669' : v >= 50 ? '#c8a45a' : v >= 30 ? '#d97706' : '#dc2626';
          return (
            <div key={d.key} className="p-3 rounded-xl border" style={{ borderColor: '#e8e4dc', background: 'white' }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-navy">{d.label}</p>
                <InfoTip text={d.hint} />
              </div>
              <p className="font-display text-2xl font-bold mt-1" style={{ color }}>%{v}</p>
              <div className="h-1.5 rounded-full mt-1.5" style={{ background: '#f0ede8' }}>
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Narrative */}
      {data.narrative && (
        <div className="p-4 rounded-xl mb-4 text-sm leading-relaxed text-navy"
          style={{ background: 'white', border: '1px solid #e8e4dc' }}>
          {data.narrative.split('\n').map((p: string, i: number) => <p key={i} className={i > 0 ? 'mt-2' : ''}>{p}</p>)}
        </div>
      )}

      {/* Highlights + Risks + Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {data.highlights?.length > 0 && (
          <div className="p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
            <p className="text-xs font-bold text-green-700 mb-2 inline-flex items-center gap-1.5">
              <Icon name="star" className="w-3.5 h-3.5" />
              GÜÇLÜ YÖNLER
            </p>
            <ul className="space-y-1">
              {data.highlights.map((h: string, i: number) => (
                <li key={i} className="text-xs text-green-900 flex gap-1.5">
                  <span>•</span><span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.risks?.length > 0 && (
          <div className="p-3 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
            <p className="text-xs font-bold text-red-700 mb-2 inline-flex items-center gap-1.5">
              <Icon name="alert" className="w-3.5 h-3.5" />
              RİSKLER
            </p>
            <ul className="space-y-1">
              {data.risks.map((r: string, i: number) => (
                <li key={i} className="text-xs text-red-900 flex gap-1.5">
                  <span>•</span><span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.recommendations?.length > 0 && (
          <div className="p-3 rounded-xl" style={{ background: '#eff6ff', border: '1px solid #93c5fd' }}>
            <p className="text-xs font-bold text-blue-700 mb-2 inline-flex items-center gap-1.5">
              <Icon name="target" className="w-3.5 h-3.5" />
              ÖNERİLER
            </p>
            <ul className="space-y-1">
              {data.recommendations.map((r: string, i: number) => (
                <li key={i} className="text-xs text-blue-900 flex gap-1.5">
                  <span>•</span><span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 *  MODULES
 * ═══════════════════════════════════════════════════════════════════════ */

function ModuleCard({ icon, title, subtitle, badge, children }: any) {
  return (
    <div className="card p-5 h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name={icon} className="w-4 h-4 text-navy" />
          <h4 className="font-display text-sm font-semibold text-navy">{title}</h4>
        </div>
        {badge && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#0f2444', color: 'white' }}>{badge}</span>}
      </div>
      {subtitle && <p className="text-xs text-muted mb-3">{subtitle}</p>}
      <div className="flex-1">{children}</div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs text-muted italic text-center py-4">{text}</p>;
}

/**
 * Context-aware durum mesajı - kullanıcıya neden boş olduğunu açıklar.
 * tone: 'input' (sarı, kullanıcı eylem gerekli), 'empty' (gri, gerçekten veri yok),
 *       'error' (kırmızı, çağrı hatası), 'config' (mavi, env eksik)
 */
function StatusNote({ tone, title, hint }: { tone: 'input' | 'empty' | 'error' | 'config'; title: string; hint?: string }) {
  const palette = {
    input:  { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: 'info'   as IconName },
    empty:  { bg: '#f8fafc', border: '#e2e8f0', text: '#475569', icon: 'info'   as IconName },
    error:  { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: 'alert'  as IconName },
    config: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: 'lock'   as IconName },
  }[tone];
  return (
    <div className="text-xs p-3 rounded-xl flex items-start gap-2"
      style={{ background: palette.bg, border: `1px solid ${palette.border}`, color: palette.text }}>
      <Icon name={palette.icon} className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold leading-snug">{title}</p>
        {hint && <p className="mt-0.5 text-[11px] opacity-90 leading-snug">{hint}</p>}
      </div>
    </div>
  );
}

/* ─── Küresel Benzer ─── */
function GlobalSimilarModule({ title, description }: { title: string; description?: string }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const inputReady = !!(title && title.length >= 8);

  useEffect(() => {
    if (!inputReady) { setData(null); return; }
    setLoading(true); setError(false);
    api.get('/intelligence/global-similar', { params: { title, description } })
      .then(r => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [title, description, inputReady]);

  return (
    <ModuleCard icon="globe" title="Küresel Literatür Haritası"
      subtitle="OpenAlex - dünyada aynı konuda yapılmış yayınlar"
      badge={data?.total ? `${data.total}` : undefined}>
      {!inputReady ? (
        <StatusNote tone="input" title="Proje başlığı en az 8 karakter olmalı"
          hint="OpenAlex API başlığınızı arar - ne kadar net o kadar isabetli." />
      ) : loading ? <Loader /> : error ? (
        <StatusNote tone="error" title="OpenAlex çağrısı başarısız"
          hint="İnternet bağlantısı veya servis kesintisi olabilir, birazdan tekrar deneyin." />
      ) : !data || data.total === 0 ? (
        <StatusNote tone="empty" title="Bu konuda global literatür eşleşmesi yok"
          hint="Başlığı sadeleştirin veya alanın İngilizce karşılığını kullanın - örn. 'sürdürülebilir tarım' yerine 'sustainable agriculture'." />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg" style={{ background: '#eff6ff' }}>
              <p className="font-display text-xl font-bold" style={{ color: '#1e40af' }}>{data.total}</p>
              <p className="text-[10px] text-muted">Yayın</p>
            </div>
            <div className="p-2 rounded-lg" style={{ background: '#fef3c7' }}>
              <p className="font-display text-xl font-bold" style={{ color: '#92400e' }}>{data.avgCitations}</p>
              <p className="text-[10px] text-muted">Ort. Atıf</p>
            </div>
            <div className="p-2 rounded-lg" style={{ background: '#f0fdf4' }}>
              <p className="font-display text-xl font-bold" style={{ color: '#059669' }}>{data.peakYear || '-'}</p>
              <p className="text-[10px] text-muted">Zirve Yıl</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase text-muted">EN ÇOK ATIF ALAN 3</p>
            {data.items.slice(0, 3).map((w: any, i: number) => (
              <div key={i} className="text-xs p-2 rounded-lg border" style={{ borderColor: '#f0ede8' }}>
                <p className="font-semibold text-navy line-clamp-2 leading-snug">{w.title}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted">{w.year} · {w.journal?.slice(0, 30) || '-'}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#c8a45a33', color: '#92651a' }}>
                    {w.citedBy} atıf
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ModuleCard>
  );
}

/* ─── AB Fırsatları ─── */
function EuOpportunitiesModule({ keywords }: { keywords: string[] }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const inputReady = keywords.length > 0;

  useEffect(() => {
    if (!inputReady) { setData(null); return; }
    setLoading(true); setError(false);
    api.get('/intelligence/eu-opportunities', { params: { keywords: keywords.join(',') } })
      .then(r => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [keywords.join(','), inputReady]);

  const frameworkData = data?.frameworks ? Object.entries(data.frameworks).map(([k, v]: any) => ({ name: k, value: v })) : [];

  return (
    <ModuleCard icon="euro" title="AB Fon Manzarası"
      subtitle="CORDIS - Horizon / H2020 / FP7 emsal projeleri"
      badge={data?.total ? `${data.total}` : undefined}>
      {!inputReady ? (
        <StatusNote tone="input" title="Anahtar kelime ekleyin"
          hint="CORDIS aramaları virgülle ayrılmış İngilizce terimlerle daha iyi sonuç verir - örn. 'biofuel, microalgae, photobioreactor'." />
      ) : loading ? <Loader /> : error ? (
        <StatusNote tone="error" title="CORDIS servisine ulaşılamadı"
          hint="AB sunucusu yavaş yanıt veriyor olabilir, birazdan tekrar deneyin." />
      ) : !data || data.total === 0 ? (
        <StatusNote tone="empty" title="Bu konuda AB fonlu proje bulunamadı"
          hint="Anahtar kelimelerinizin İngilizce karşılığını veya daha geniş bir terim deneyin." />
      ) : (
        <div className="space-y-3">
          {data.avgBudget > 0 && (
            <div className="p-3 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, #0891b2 0%, #0284c7 100%)', color: 'white' }}>
              <p className="text-[10px] uppercase opacity-80">Ortalama AB Katkısı</p>
              <p className="font-display text-2xl font-bold">€{Number(data.avgBudget).toLocaleString()}</p>
            </div>
          )}

          {frameworkData.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-muted mb-1">PROGRAM DAĞILIMI</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={frameworkData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
                  <Bar dataKey="value" fill="#0891b2" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-1.5">
            {data.items.slice(0, 3).map((p: any, i: number) => (
              <div key={i} className="text-xs p-2 rounded-lg border" style={{ borderColor: '#f0ede8' }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: '#0891b2' }}>{p.framework}</span>
                  {p.acronym && <span className="font-bold text-navy">{p.acronym}</span>}
                </div>
                <p className="font-semibold text-navy line-clamp-2 leading-snug">{p.title}</p>
                {p.ecMaxContribution && <p className="text-[10px] text-emerald-600 font-bold mt-0.5">€{Number(p.ecMaxContribution).toLocaleString()}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </ModuleCard>
  );
}

/* ─── Hedef Dergi Radar ─── */
function TargetJournalsModule({ keywords, title }: { keywords: string[]; title?: string }) {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const inputReady = !!(title && title.length >= 8) || keywords.length > 0;

  useEffect(() => {
    if (!inputReady) { setData(null); return; }
    setLoading(true); setError(false);
    api.get('/intelligence/target-journals', { params: { keywords: keywords.join(','), title } })
      .then(r => setData(r.data || []))
      .catch(() => { setData([]); setError(true); })
      .finally(() => setLoading(false));
  }, [keywords.join(','), title, inputReady]);

  const withQ = (data || []).filter(j => j.sjrQuartile);
  const qCounts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
  for (const j of withQ) if (j.sjrQuartile && qCounts[j.sjrQuartile as keyof typeof qCounts] !== undefined) qCounts[j.sjrQuartile as keyof typeof qCounts]++;

  return (
    <ModuleCard icon="book" title="Hedef Dergi Radarı"
      subtitle="SCImago Q-sınıflı + konu uyumlu"
      badge={data?.length ? `${data.length}` : undefined}>
      {!inputReady ? (
        <StatusNote tone="input" title="Başlık (en az 8 karakter) veya anahtar kelime ekleyin"
          hint="Dergi önerisi için OpenAlex konsept çıkarımı yapılır - net bir başlık yeter." />
      ) : loading ? <Loader /> : error ? (
        <StatusNote tone="error" title="Dergi servisine ulaşılamadı"
          hint="OpenAlex / SCImago kaynağı yanıt vermiyor olabilir." />
      ) : !data || data.length === 0 ? (
        <StatusNote tone="empty" title="Konu uyumlu dergi bulunamadı"
          hint="Başlığı sadeleştirin veya anahtar kelimelerin İngilizce karşılıklarını ekleyin." />
      ) : (
        <div className="space-y-3">
          {withQ.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {['Q1','Q2','Q3','Q4'].map(q => (
                <div key={q} className="text-center p-2 rounded-lg"
                  style={{ background: (QUARTILE_COLORS[q] || '#94a3b8') + '18' }}>
                  <p className="font-display text-lg font-bold" style={{ color: QUARTILE_COLORS[q] }}>
                    {qCounts[q as keyof typeof qCounts]}
                  </p>
                  <p className="text-[10px] font-bold" style={{ color: QUARTILE_COLORS[q] }}>{q}</p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase text-muted">EN İYİ UYUM 4</p>
            {data.slice(0, 4).map((j, i) => (
              <div key={i} className="text-xs p-2 rounded-lg border flex items-center gap-2" style={{ borderColor: '#f0ede8' }}>
                {j.sjrQuartile && (
                  <span className="text-[10px] font-bold w-7 h-7 rounded flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: QUARTILE_COLORS[j.sjrQuartile] || '#94a3b8' }}>
                    {j.sjrQuartile}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy truncate leading-snug">{j.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
                    {j.fitScore !== undefined && <span>Uyum: {j.fitScore}</span>}
                    {j.sjrScore && <span>SJR: {j.sjrScore}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ModuleCard>
  );
}

/* ─── Patent Manzarası ─── */
function PatentLandscapeModule({ keywords }: { keywords: string[] }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (keywords.length === 0) return;
    setLoading(true);
    api.get('/intelligence/patent-landscape', { params: { keywords: keywords.join(',') } })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [keywords.join(',')]);

  const total = data ? (data.trCount + data.epCount) : 0;
  const risk = total === 0 ? 'Düşük' : total < 10 ? 'Orta' : 'Yüksek';
  const riskColor = total === 0 ? '#059669' : total < 10 ? '#d97706' : '#dc2626';

  return (
    <ModuleCard icon="shield" title="Patent Manzarası"
      subtitle="EPO OPS - prior art ve rekabet analizi"
      badge={data?.configured ? `TR:${data.trCount} · EP:${data.epCount}` : undefined}>
      {loading ? <Loader /> : !data ? <EmptyNote text="Veri yüklenemedi" /> :
       !data.configured ? (
        <div className="p-3 rounded-lg text-xs flex items-start gap-2" style={{ background: '#fffbeb', color: '#92400e' }}>
          <Icon name="lock" className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">EPO OPS yapılandırılmamış</p>
            <p className="mt-0.5 opacity-80">EPO_CONSUMER_KEY + EPO_CONSUMER_SECRET env değişkenleri gerekli.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg" style={{ background: '#fef2f2' }}>
              <p className="font-display text-2xl font-bold" style={{ color: '#dc2626' }}>{data.trCount}</p>
              <p className="text-[10px] text-muted">TR Patent</p>
            </div>
            <div className="text-center p-2 rounded-lg" style={{ background: '#eff6ff' }}>
              <p className="font-display text-2xl font-bold" style={{ color: '#1e40af' }}>{data.epCount}</p>
              <p className="text-[10px] text-muted">AB Patent</p>
            </div>
            <div className="text-center p-2 rounded-lg" style={{ background: riskColor + '20' }}>
              <p className="font-display text-sm font-bold mt-1" style={{ color: riskColor }}>{risk}</p>
              <p className="text-[10px] text-muted">Risk</p>
            </div>
          </div>
          {data.samples?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-muted mb-1">ÖRNEK PATENTLER</p>
              <div className="space-y-1">
                {data.samples.slice(0, 3).map((s: any, i: number) => (
                  <p key={i} className="text-xs text-navy line-clamp-1">• {s.title}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ModuleCard>
  );
}

/* ─── Potansiyel Ekip ─── */
function PotentialTeamModule({ keywords, faculty }: { keywords: string[]; faculty?: string }) {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const inputReady = keywords.length > 0;

  useEffect(() => {
    if (!inputReady) { setData(null); return; }
    setLoading(true); setError(false);
    api.get('/intelligence/potential-team', { params: { keywords: keywords.join(','), faculty } })
      .then(r => setData(r.data || []))
      .catch(() => { setData([]); setError(true); })
      .finally(() => setLoading(false));
  }, [keywords.join(','), faculty, inputReady]);

  const internal = (data || []).filter(d => d.source === 'internal');
  const external = (data || []).filter(d => d.source === 'external');

  return (
    <ModuleCard icon="users" title="Ekip Önerileri"
      subtitle="Alanında uzman MKÜ + dış araştırmacılar"
      badge={data?.length ? `${data.length}` : undefined}>
      {!inputReady ? (
        <StatusNote tone="input" title="Anahtar kelime ekleyin"
          hint="MKÜ akademisyenleri ve OpenAlex'teki dış araştırmacılar konu uyumuna göre listelenir." />
      ) : loading ? <Loader /> : error ? (
        <StatusNote tone="error" title="Eşleştirme servisi yanıt vermedi"
          hint="OpenAlex sorgusu zaman aşımına uğramış olabilir." />
      ) : !data || data.length === 0 ? (
        <StatusNote tone="empty" title="Eşleşen araştırmacı bulunamadı"
          hint="MKÜ akademisyenlerinin ORCID/Scopus eşleşmesi olmayabilir veya konu çok dar - daha genel bir terim deneyin." />
      ) : (
        <div className="space-y-3">
          {internal.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-muted mb-1.5">MKÜ İÇİNDEN ({internal.length})</p>
              <div className="space-y-1">
                {internal.slice(0, 4).map((p, i) => (
                  <Link key={i} href={p.userId ? `/users/${p.userId}` : '#'}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#faf8f4] transition-colors">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
                      {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-navy truncate">{p.name}</p>
                      <p className="text-[10px] text-muted truncate">
                        {p.faculty || '-'}
                        {p.hIndex ? ` · h: ${p.hIndex}` : ''}
                      </p>
                    </div>
                    {p.matchScore !== undefined && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: '#059669' + '20', color: '#059669' }}>
                        %{p.matchScore}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {external.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-muted mb-1.5">DIŞ ORTAK ADAYLARI ({external.length})</p>
              <div className="space-y-1">
                {external.slice(0, 4).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#faf8f4' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                      {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-navy truncate">{p.name}</p>
                      <p className="text-[10px] text-muted truncate">{p.institution || '-'}</p>
                    </div>
                    <span className="text-[10px] text-muted">
                      {p.publicationCount} yay.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ModuleCard>
  );
}

/* ─── Etki Gauge ─── */
function ImpactGaugeModule({ type, budget }: { type?: string; budget?: number }) {
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
    <ModuleCard icon="rocket" title="Etki Tahmini"
      subtitle="MKÜ geçmiş benzer projelerinden"
      badge={data?.sampleSize ? `n=${data.sampleSize}` : undefined}>
      {!type ? (
        <StatusNote tone="input" title="Proje türü seçin"
          hint="Tamamlanma tahmini için 'Tür' alanı zorunlu - aynı türdeki MKÜ projelerinin geçmiş performansından hesaplanır." />
      ) : loading ? <Loader /> : !data || data.sampleSize === 0 ? (
        <StatusNote tone="empty" title="Bu türde emsal veri yok"
          hint="Sistemde bu türde tamamlanmış proje bulunmuyor. Birkaç proje sonra tahmin etkinleşir." />
      ) : (
        <div className="space-y-3">
          {/* Big gauge */}
          <div className="relative flex flex-col items-center py-3">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#f0ede8" strokeWidth="12" />
                <circle cx="60" cy="60" r="52" fill="none"
                  stroke={data.avgCompletionRate >= 70 ? '#059669' : data.avgCompletionRate >= 50 ? '#c8a45a' : '#dc2626'}
                  strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${(data.avgCompletionRate / 100) * 326.7} 326.7`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="font-display text-3xl font-bold text-navy">%{data.avgCompletionRate}</p>
                <p className="text-[10px] text-muted">Tamamlanma</p>
              </div>
            </div>
          </div>

          {data.budgetPercentile !== undefined && (
            <div className="p-3 rounded-lg" style={{ background: '#eff6ff' }}>
              <p className="text-xs text-blue-900">
                Bütçeniz benzer projelerin <strong>%{data.budgetPercentile}</strong> üstünde
              </p>
              <div className="h-2 bg-white rounded-full mt-1.5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${data.budgetPercentile}%`, background: '#1e40af' }} />
              </div>
            </div>
          )}
          {data.note && (
            <p className="text-[10px] text-muted italic">ℹ {data.note}</p>
          )}
        </div>
      )}
    </ModuleCard>
  );
}

/* ─── SDG Evidence ─── */
function SdgEvidenceModule({ title, description }: { title: string; description?: string }) {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const inputReady = !!(title && title.length >= 8);

  useEffect(() => {
    if (!inputReady) { setData(null); return; }
    setLoading(true); setError(false);
    api.get('/intelligence/sdg-evidence', { params: { title, description } })
      .then(r => setData(r.data || []))
      .catch(() => { setData([]); setError(true); })
      .finally(() => setLoading(false));
  }, [title, description, inputReady]);

  return (
    <ModuleCard icon="leaf" title="SDG Katkı Analizi"
      subtitle="OpenAlex ile otomatik SDG eşlemesi + emsal"
      badge={data?.length ? `${data.length} SDG` : undefined}>
      {!inputReady ? (
        <StatusNote tone="input" title="Proje başlığı en az 8 karakter olmalı"
          hint="OpenAlex SDG sınıflandırması başlık + özetten otomatik çıkarılır." />
      ) : loading ? <Loader /> : error ? (
        <StatusNote tone="error" title="SDG servisine ulaşılamadı"
          hint="OpenAlex yanıt vermiyor olabilir, birazdan tekrar deneyin." />
      ) : !data || data.length === 0 ? (
        <StatusNote tone="empty" title="SDG eşleşmesi bulunamadı"
          hint="Bu konu BM Sürdürülebilir Kalkınma Hedefleri ile doğrudan örtüşmüyor olabilir - özet alanına BM SDG anahtar kelimeleri ekleyin (örn. eşitlik, iklim, su)." />
      ) : (
        <div className="space-y-1.5">
          {data.slice(0, 6).map((s, i) => {
            const num = parseInt(s.sdgId?.match(/\d+/)?.[0] || '0');
            const color = SDG_COLORS[(num - 1) % SDG_COLORS.length];
            const max = data[0].projectCount;
            const pct = (s.projectCount / max) * 100;
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0" style={{ background: color }}>{num}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-navy truncate">{s.sdgName}</p>
                    <span className="font-bold text-navy text-[11px]">{s.projectCount}</span>
                  </div>
                  <div className="h-1.5 rounded-full mt-1" style={{ background: '#f0ede8' }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModuleCard>
  );
}

/* ─── Konseptler ─── */
function ConceptsModule({ title, description }: { title: string; description?: string }) {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const inputReady = !!(title && title.length >= 8);

  useEffect(() => {
    if (!inputReady) { setData(null); return; }
    setLoading(true); setError(false);
    api.get('/intelligence/concepts', { params: { title, description } })
      .then(r => setData(r.data || []))
      .catch(() => { setData([]); setError(true); })
      .finally(() => setLoading(false));
  }, [title, description, inputReady]);

  return (
    <ModuleCard icon="tag" title="Otomatik Konu Taksonomisi"
      subtitle="OpenAlex hiyerarşik kavram eşleşmesi"
      badge={data?.length ? `${data.length}` : undefined}>
      {!inputReady ? (
        <StatusNote tone="input" title="Proje başlığı en az 8 karakter olmalı"
          hint="Başlık + özet alanlarından OpenAlex konu hiyerarşisi otomatik çıkarılır." />
      ) : loading ? <Loader /> : error ? (
        <StatusNote tone="error" title="Konsept çıkarımı başarısız"
          hint="OpenAlex servisi yanıt vermiyor olabilir." />
      ) : !data || data.length === 0 ? (
        <StatusNote tone="empty" title="Konu çıkarılamadı"
          hint="Başlık çok kısa veya genel olabilir - özet alanına 2-3 cümle daha ekleyin." />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {data.slice(0, 15).map((c, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{
                background: c.level === 0 ? '#0f2444' : c.level === 1 ? '#c8a45a22' : '#f0ede8',
                color: c.level === 0 ? 'white' : c.level === 1 ? '#92651a' : '#374151',
                border: c.level === 1 ? '1px solid #c8a45a44' : undefined,
              }}>
              {c.name}
            </span>
          ))}
        </div>
      )}
    </ModuleCard>
  );
}

/* ─── Funding Simulator (interactive) ─── */
function FundingSimulatorModule({ type, faculty, initialBudget }: { type?: string; faculty?: string; initialBudget?: number }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState(initialBudget || 0);
  const [duration, setDuration] = useState(12);

  useEffect(() => {
    if (initialBudget) setBudget(initialBudget);
  }, [initialBudget]);

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    api.get('/intelligence/funding-simulator', { params: { type, budget, durationMonths: duration, faculty } })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [type, budget, duration, faculty]);

  return (
    <ModuleCard icon="simulator" title="Fonlama Simülatörü"
      subtitle="Bütçe ve süreyi değiştir - başarı olasılığı canlı güncellenir">
      {!type ? (
        <StatusNote tone="input" title="Proje türü seçin"
          hint="Başarı olasılığı hesaplaması için 'Tür' alanı zorunlu - aynı türdeki MKÜ projelerinden öğrenir." />
      ) : (
        <div className="space-y-3">
          {/* Sliders */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-navy">Bütçe</label>
                <span className="text-sm font-bold text-navy">{budget.toLocaleString('tr-TR')} ₺</span>
              </div>
              <input type="range" min={0} max={5000000} step={10000} value={budget} onChange={e => setBudget(+e.target.value)}
                className="w-full accent-navy" />
              <div className="flex justify-between text-[10px] text-muted">
                <span>0</span><span>5M</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-navy">Süre</label>
                <span className="text-sm font-bold text-navy">{duration} ay</span>
              </div>
              <input type="range" min={3} max={60} step={3} value={duration} onChange={e => setDuration(+e.target.value)}
                className="w-full accent-navy" />
              <div className="flex justify-between text-[10px] text-muted">
                <span>3 ay</span><span>5 yıl</span>
              </div>
            </div>
          </div>

          {/* Result */}
          {loading ? <Loader /> : !data ? (
            <StatusNote tone="error" title="Simülatör verisi alınamadı"
              hint="Backend yanıtı boş - birazdan tekrar deneyin." />
          ) : data.sampleSize === 0 ? (
            <StatusNote tone="empty" title="Bu türde emsal proje yok"
              hint={`Sistemde bu proje türü${faculty ? ` (${faculty})` : ''} için tarihsel veri yok - ilk emsal sizden gelecek. Birkaç proje sonra simülatör daha akıllı çalışır.`} />
          ) : (
            <div className="space-y-2">
              <div className="p-3 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: 'white' }}>
                <p className="text-[10px] uppercase opacity-80">Başarı Olasılığı</p>
                <p className="font-display text-3xl font-bold">%{data.estimatedSuccessProbability}</p>
                <p className="text-[10px] opacity-80">{data.sampleSize} emsal proje üzerinden</p>
              </div>

              {data.recommendedBudgetRange && (
                <div className="text-xs p-2 rounded-lg" style={{ background: '#faf8f4' }}>
                  <p className="text-muted mb-1">Önerilen bütçe aralığı:</p>
                  <p className="text-navy font-semibold">
                    {Number(data.recommendedBudgetRange.min).toLocaleString()} –{' '}
                    <span className="text-navy font-bold">{Number(data.recommendedBudgetRange.median).toLocaleString()}</span> –{' '}
                    {Number(data.recommendedBudgetRange.max).toLocaleString()} ₺
                  </p>
                </div>
              )}

              {data.analogs?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted mt-2 mb-1">EN YAKIN EMSALLER</p>
                  <div className="space-y-1">
                    {data.analogs.slice(0, 3).map((a: any, i: number) => (
                      <Link key={i} href={`/projects/${a.id}`} className="flex items-center gap-2 p-1.5 rounded hover:bg-[#faf8f4] transition-colors">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0`}
                          style={{ background: a.status === 'completed' ? '#059669' : a.status === 'cancelled' ? '#dc2626' : '#c8a45a' }} />
                        <span className="text-xs text-navy truncate flex-1">{a.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ModuleCard>
  );
}

/* ─── Collaboration Network (topic-based, mevcut vs potansiyel) ─── */
function CollaborationNetworkModule({ keywords, title }: { keywords?: string[]; title?: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    const params: any = { userId: user.id };
    if (keywords && keywords.length > 0) params.keywords = keywords.join(',');
    if (title) params.title = title;
    api.get('/intelligence/collaboration-network', { params })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user?.id, keywords?.join(','), title]);

  const getNodeColor = (type: string) => {
    if (type === 'both') return '#c8a45a';              // altın - hem tanıdık hem alanında
    if (type === 'existing-coauthor') return '#7c3aed';  // mor - tanıdık
    return '#94a3b8';                                     // gri - sadece konu uzmanı
  };

  const centerIsTopic = data?.center?.type === 'topic';
  const centerLabel = data?.center?.label || 'Sen';

  return (
    <ModuleCard icon="network" title={centerIsTopic ? 'Konu Ağı - Potansiyel Ortaklar' : 'Ortak Yazar Ağı'}
      subtitle={centerIsTopic ? 'Bu konuda aktif araştırmacılar + mevcut ortaklarınız vurgulu' : 'OpenAlex üzerinden yayın ortaklarınız'}
      badge={data?.nodes?.length ? `${data.nodes.length}` : undefined}>
      {!user?.id ? (
        <StatusNote tone="input" title="Giriş yapmış kullanıcı gerekli"
          hint="Ağ analizi sizin ORCID kayıtlarınız üzerinden çalışır." />
      ) : loading ? <Loader /> : !data || data.nodes?.length === 0 ? (
        <StatusNote tone="empty" title="Ağ oluşturulamadı"
          hint="Profilinizde ORCID tanımlı olmalı veya proje konusu daha geniş olmalı. Profilim → ORCID alanını doldurun." />
      ) : (
        <div className="space-y-3">
          {/* Legend */}
          <div className="flex flex-wrap gap-2 text-[10px]">
            {data.stats?.commonCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: '#c8a45a22', color: '#92651a' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: '#c8a45a' }} />
                Hem tanıdık hem alanında: {data.stats.commonCount}
              </span>
            )}
            {data.stats?.existingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: '#7c3aed22', color: '#6d28d9' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: '#7c3aed' }} />
                Eski ortak: {data.stats.existingCount}
              </span>
            )}
            {data.stats?.topicExpertCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: '#94a3b822', color: '#475569' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: '#94a3b8' }} />
                Yeni potansiyel: {data.stats.topicExpertCount}
              </span>
            )}
          </div>

          {/* Radial SVG */}
          <div className="relative w-full" style={{ aspectRatio: '1 / 0.95' }}>
            <svg viewBox="-210 -200 420 400" className="w-full h-full">
              {/* Edges - tip bazlı renk */}
              {data.nodes.slice(0, 18).map((n: any, i: number) => {
                const angle = (i / Math.min(data.nodes.length, 18)) * 2 * Math.PI - Math.PI / 2;
                const r = 130 + (i % 3) * 18;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                const maxWeight = Math.max(...data.nodes.map((nd: any) => nd.weight));
                const color = getNodeColor(n.type);
                const isPersonal = n.type === 'both' || n.type === 'existing-coauthor';
                return (
                  <line key={`e${i}`} x1="0" y1="0" x2={x} y2={y}
                    stroke={color} strokeOpacity={isPersonal ? 0.6 : 0.25}
                    strokeWidth={Math.max(0.5, (n.weight / maxWeight) * 2.5)}
                    strokeDasharray={isPersonal ? undefined : '2 3'} />
                );
              })}

              {/* Nodes */}
              {data.nodes.slice(0, 18).map((n: any, i: number) => {
                const angle = (i / Math.min(data.nodes.length, 18)) * 2 * Math.PI - Math.PI / 2;
                const r = 130 + (i % 3) * 18;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                const maxWeight = Math.max(...data.nodes.map((nd: any) => nd.weight));
                const size = 6 + (n.weight / maxWeight) * 7;
                const color = getNodeColor(n.type);
                return (
                  <g key={`n${i}`}>
                    <circle cx={x} cy={y} r={size} fill={color}
                      stroke={n.type === 'both' ? '#92651a' : 'white'} strokeWidth={n.type === 'both' ? 2 : 1.5} />
                    <text x={x} y={y + size + 11} textAnchor="middle" fontSize="8.5" fill="#374151">
                      {n.name.split(' ').slice(-1)[0].slice(0, 14)}
                    </text>
                  </g>
                );
              })}

              {/* Center - proje konusu veya kullanıcı */}
              <circle cx="0" cy="0" r="26" fill={centerIsTopic ? '#0f2444' : '#059669'} stroke="#c8a45a" strokeWidth="2.5" />
              <text x="0" y="-2" textAnchor="middle" fontSize={centerIsTopic ? 9 : 11} fill="white" fontWeight="bold">
                {centerIsTopic ? 'KONU' : 'SEN'}
              </text>
              {centerIsTopic && (
                <text x="0" y="9" textAnchor="middle" fontSize="6.5" fill="white" opacity="0.8">
                  {centerLabel.slice(0, 18)}
                </text>
              )}
            </svg>
          </div>

          {/* Top listeleri - kategori bazlı */}
          <div className="space-y-2">
            {data.nodes.filter((n: any) => n.type === 'both').length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#92651a' }}>TANIDIK + ALANINDA UZMAN</p>
                <div className="space-y-0.5">
                  {data.nodes.filter((n: any) => n.type === 'both').slice(0, 3).map((n: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded" style={{ background: '#c8a45a15' }}>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-navy truncate">{n.name}</p>
                        {n.institution && <p className="text-[10px] text-muted truncate">{n.institution}</p>}
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: '#c8a45a' }}>{n.pubCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.nodes.filter((n: any) => n.type === 'topic-expert').length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase mb-1 text-muted">YENİ POTANSİYEL ORTAKLAR</p>
                <div className="space-y-0.5 max-h-28 overflow-y-auto">
                  {data.nodes.filter((n: any) => n.type === 'topic-expert').slice(0, 5).map((n: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs py-0.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-navy truncate">{n.name}</p>
                        {n.institution && <p className="text-[10px] text-muted truncate">{n.institution}</p>}
                      </div>
                      <span className="text-[10px] text-muted">{n.pubCount} yay.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ModuleCard>
  );
}

/* ─── Türkiye Benchmark ─── */
function TurkeyBenchmarkModule({ keywords }: { keywords: string[] }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const inputReady = keywords.length > 0;

  useEffect(() => {
    if (!inputReady) { setData(null); return; }
    setLoading(true); setError(false);
    api.get('/intelligence/turkey-benchmark', { params: { keywords: keywords.join(',') } })
      .then(r => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [keywords.join(','), inputReady]);

  return (
    <ModuleCard icon="flag" title="Türkiye Benchmark"
      subtitle="Bu konuda Türk kurumlarının AB projeleri"
      badge={data?.total ? `${data.total}` : undefined}>
      {!inputReady ? (
        <StatusNote tone="input" title="Anahtar kelime ekleyin"
          hint="CORDIS'te 'TR' lokasyonlu kurumların projeleri sıralanır - en az 1 İngilizce terim verin." />
      ) : loading ? <Loader /> : error ? (
        <StatusNote tone="error" title="CORDIS servisi yanıt vermedi"
          hint="AB sunucusu yavaş - birazdan tekrar deneyin." />
      ) : !data || data.total === 0 ? (
        <StatusNote tone="empty" title="Türk kurumlarında emsal proje bulunamadı"
          hint="Bu konuda Türkiye'den henüz fonlanmış AB projesi yok - yeni başlayan bir alan olabilir, ilk olabilirsiniz." />
      ) : (
        <div className="space-y-1.5">
          {data.topInstitutions.slice(0, 8).map((i: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg" style={{ background: idx < 3 ? '#fef3c7' : '#faf8f4' }}>
              <span className="font-semibold text-navy truncate flex-1">{idx + 1}. {i.name}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: idx < 3 ? '#c8a45a' : '#0f2444' }}>{i.count}</span>
            </div>
          ))}
        </div>
      )}
    </ModuleCard>
  );
}

/* ─── Checklist ─── */
function ChecklistModule({ type }: { type?: string }) {
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

  if (!type) return (
    <ModuleCard icon="list" title="Başvuru Kontrol Listesi" subtitle="">
      <StatusNote tone="input" title="Proje türü seçin"
        hint="Her proje türünün TÜBİTAK / BAP / AB / Sanayi başvuruları için ayrı kontrol listesi var." />
    </ModuleCard>
  );
  if (!data) return <ModuleCard icon="list" title="Başvuru Kontrol Listesi" subtitle=""><Loader /></ModuleCard>;

  const groups = data.reduce((acc: any, it: any) => {
    acc[it.category] = acc[it.category] || [];
    acc[it.category].push(it);
    return acc;
  }, {} as Record<string, any[]>);
  const done = checked.size;
  const total = data.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <ModuleCard icon="list" title="Başvuru Kontrol Listesi"
      subtitle={`${done}/${total} tamamlandı · %${pct}`}
      badge={pct >= 75 ? 'İyi' : pct >= 40 ? 'Orta' : undefined}>
      {loading ? <Loader /> : (
        <>
          <div className="h-2 rounded-full mb-3" style={{ background: '#f0ede8' }}>
            <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 75 ? '#059669' : pct >= 40 ? '#c8a45a' : '#dc2626' }} />
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Object.entries(groups).map(([cat, items]: any) => (
              <div key={cat}>
                <p className="text-[10px] font-bold text-muted mb-0.5">{cat.toUpperCase()}</p>
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
        </>
      )}
    </ModuleCard>
  );
}
