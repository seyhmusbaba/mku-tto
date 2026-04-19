'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend } from 'recharts';

/**
 * AVESIS-sınıfı bibliyometri paneli.
 * /analytics/bibliometrics/{researcher|faculty|institutional} endpoint'lerini tüketir.
 */

type IconName =
  | 'book' | 'quote' | 'h-index' | 'open' | 'fire' | 'globe' | 'trending' | 'layers'
  | 'sparkles' | 'award' | 'alert' | 'user' | 'refresh' | 'info' | 'external';

const ICONS: Record<IconName, string> = {
  book:      'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  quote:     'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
  'h-index': 'M4 6h16M4 12h8m-8 6h16',
  open:      'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  fire:      'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 7.341 18 9.5 18.998 9.5 19.657 9.343z',
  globe:     'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  trending:  'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  layers:    'M19 11H5m14-7H5m14 14H5',
  sparkles:  'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  award:     'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  alert:     'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  user:      'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  refresh:   'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  info:      'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  external:  'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
};

function Icon({ name, className = 'w-4 h-4', strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[name]} />
    </svg>
  );
}

// Metriklere hover tooltip — kullanıcı "bu nedir?" diye merak ederse
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

const QUARTILE_COLORS: Record<string, string> = {
  Q1: '#059669', Q2: '#2563eb', Q3: '#d97706', Q4: '#dc2626', unknown: '#94a3b8',
};

const SOURCE_LABELS: Record<string, string> = {
  crossref: 'Crossref', openalex: 'OpenAlex', wos: 'Web of Science',
  scopus: 'Scopus', pubmed: 'PubMed', arxiv: 'arXiv', semanticScholar: 'Semantic Scholar',
};

const SOURCE_COLORS: Record<string, string> = {
  crossref: '#1a3a6b', openalex: '#7c3aed', wos: '#dc2626',
  scopus: '#ea580c', pubmed: '#059669', arxiv: '#0891b2', semanticScholar: '#c8a45a',
};

type Mode = 'researcher' | 'faculty' | 'institutional';

export function BibliometricsPanel({
  mode,
  userId,
  faculty,
}: {
  mode: Mode;
  userId?: string;
  faculty?: string;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const url = mode === 'researcher' && userId
      ? `/analytics/bibliometrics/researcher/${userId}`
      : mode === 'faculty' && faculty
      ? `/analytics/bibliometrics/faculty?faculty=${encodeURIComponent(faculty)}`
      : mode === 'institutional'
      ? `/analytics/bibliometrics/institutional`
      : null;
    if (!url) { setLoading(false); return; }
    api.get(url)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.message || 'Bibliyometri verisi yüklenemedi'))
      .finally(() => setLoading(false));
  }, [mode, userId, faculty]);

  if (loading) return <div className="card flex justify-center py-20"><div className="spinner" /></div>;
  if (error) return (
    <div className="card py-12 text-center">
      <Icon name="alert" className="w-10 h-10 mx-auto text-red-500" strokeWidth={1.5} />
      <p className="text-sm font-semibold text-navy mt-3">{error}</p>
      <p className="text-xs text-muted mt-1">Bu araştırmacının ORCID veya Scopus ID'si eksik olabilir.</p>
    </div>
  );
  if (!data) return null;

  // Institutional modu farklı shape döner
  if (mode === 'institutional' && data.configured === false) {
    return (
      <div className="card py-10 text-center">
        <Icon name="info" className="w-8 h-8 mx-auto text-muted" />
        <p className="text-sm font-semibold text-navy mt-2">Kurumsal bibliyometri yapılandırılmamış</p>
        <p className="text-xs text-muted mt-1 max-w-md mx-auto">{data.message}</p>
      </div>
    );
  }

  const summary = data.summary || data;
  const user = data.user;
  const topCited = data.topCited || [];
  const sourceCoverage = data.sourceCoverage || {};
  const topResearchers = data.topResearchers || [];

  if (summary.total === 0) {
    return (
      <div className="card py-12 text-center">
        <Icon name="book" className="w-10 h-10 mx-auto text-muted" strokeWidth={1.5} />
        <p className="text-sm font-semibold text-navy mt-3">Henüz kaydedilmiş yayın bulunamadı</p>
        <p className="text-xs text-muted mt-1 max-w-md mx-auto">
          Araştırmacının ORCID ID'si profil sayfasından eklendikten sonra veriler otomatik çekilir.
        </p>
      </div>
    );
  }

  const quartileData = [
    { name: 'Q1', value: summary.quartileDistribution.Q1, color: QUARTILE_COLORS.Q1 },
    { name: 'Q2', value: summary.quartileDistribution.Q2, color: QUARTILE_COLORS.Q2 },
    { name: 'Q3', value: summary.quartileDistribution.Q3, color: QUARTILE_COLORS.Q3 },
    { name: 'Q4', value: summary.quartileDistribution.Q4, color: QUARTILE_COLORS.Q4 },
    { name: 'Bilinmiyor', value: summary.quartileDistribution.unknown, color: QUARTILE_COLORS.unknown },
  ].filter(d => d.value > 0);

  const sourceCoverageData = Object.entries(sourceCoverage)
    .map(([k, v]) => ({ name: SOURCE_LABELS[k] || k, value: v as number, color: SOURCE_COLORS[k] || '#94a3b8' }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      {/* Kullanıcı başlığı — researcher modu */}
      {mode === 'researcher' && user && (
        <div className="card p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-navy bg-cream">
              <Icon name="user" className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-lg font-bold text-navy truncate">{user.name}</h3>
              <p className="text-xs text-muted">{user.faculty}{user.department ? ' · ' + user.department : ''}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {user.orcidId && (
                <a href={`https://orcid.org/${user.orcidId}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded-full font-semibold inline-flex items-center gap-1"
                  style={{ background: '#a6ce3918', color: '#5a8a00', border: '1px solid #a6ce3944' }}>
                  <span className="w-3.5 h-3.5 rounded text-white text-[8px] font-bold flex items-center justify-center" style={{ background: '#a6ce39' }}>iD</span>
                  ORCID
                </a>
              )}
              {user.scopusAuthorId && (
                <span className="text-xs px-2 py-1 rounded-full font-semibold inline-flex items-center gap-1"
                  style={{ background: '#e07a2b18', color: '#c2410c', border: '1px solid #e07a2b44' }}>
                  <span className="w-3.5 h-3.5 rounded text-white text-[8px] font-bold flex items-center justify-center" style={{ background: '#e07a2b' }}>SC</span>
                  Scopus
                </span>
              )}
              {user.wosResearcherId && (
                <span className="text-xs px-2 py-1 rounded-full font-semibold inline-flex items-center gap-1"
                  style={{ background: '#dc262618', color: '#991b1b', border: '1px solid #dc262644' }}>
                  <span className="w-3.5 h-3.5 rounded text-white text-[8px] font-bold flex items-center justify-center" style={{ background: '#dc2626' }}>WoS</span>
                  WoS
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Faculty başlık */}
      {mode === 'faculty' && (
        <div className="card p-5">
          <h3 className="font-display text-lg font-bold text-navy">{data.faculty}</h3>
          <p className="text-xs text-muted mt-1">
            {data.researcherCount} araştırmacı · {data.withIdentifiersCount} tanesinin akademik kimliği var
          </p>
        </div>
      )}

      {/* Bilgilendirme çerçevesi */}
      <div className="p-4 rounded-2xl flex items-start gap-3 text-xs" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
        <Icon name="info" className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="leading-relaxed">
          <strong className="font-semibold">Bu panel nasıl hesaplanır?</strong> Yayınlar birden fazla kaynaktan
          (Scopus · Web of Science · OpenAlex · Crossref · PubMed · arXiv · Semantic Scholar)
          DOI üzerinden birleştirilip tekrar sayılmaz. Atıf sayısında en yüksek kaynak baz alınır.
          Dergi kalitesi SCImago SJR'dan, açık erişim bilgisi Unpaywall'dan,
          SDG eşleştirmesi OpenAlex'ten gelir.
        </div>
      </div>

      {/* KPI kartları — her birinin altında açıklama */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiBig label="Toplam Yayın" value={summary.total} icon="book" color="#1a3a6b"
          desc="Birden fazla kaynakta geçen yayın tek sayılır (DOI bazlı dedupe)." />
        <KpiBig label="Toplam Atıf" value={summary.totalCitations} icon="quote" color="#7c3aed"
          desc="Tüm yayınların aldığı toplam atıf — kaynaklar arasında en yüksek değer kullanılır." />
        <KpiBig label="h-index" value={summary.hIndex} icon="h-index" color="#c8a45a"
          desc="En az h tane yayını h veya daha fazla atıf almış demektir. Araştırmacının hem üretkenliğini hem etkisini ölçer." />
        <KpiBig label="Açık Erişim" value={`%${summary.openAccessRatio}`} sub={`${summary.openAccessCount} yayın`}
          icon="open" color="#059669"
          desc="Açık erişim (OA) yayın oranı — okuyucunun ücret ödemeden erişebildiği makaleler." />
      </div>

      {/* Q1-Q4 dağılımı + Yıllık trend */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-5">
          <h4 className="font-display text-sm font-semibold text-navy mb-1 inline-flex items-center gap-2">
            <Icon name="award" className="w-4 h-4" />
            Dergi Kalite Dağılımı
            <InfoTip text="SCImago Journal Rank'a göre dergilerin çeyrek sıralaması. Q1 ilk %25 (en prestijli), Q4 en alttaki %25. 'Bilinmiyor' — dergisi SCImago'da indeksli değil veya ISSN eşleşmesi yapılamadı." />
          </h4>
          <p className="text-xs text-muted mb-4">Her çeyrek kaç yayını kapsıyor (SCImago SJR kaynaklı)</p>
          {quartileData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={quartileData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={45} outerRadius={85}
                    label={(d: any) => d.value > 0 ? d.name : ''} labelLine={false}>
                    {quartileData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                {quartileData.map(q => (
                  <div key={q.name}>
                    <div className="w-full h-1.5 rounded-full" style={{ background: q.color }} />
                    <p className="font-bold text-navy mt-1">{q.value}</p>
                    <p className="text-muted">{q.name}</p>
                  </div>
                ))}
              </div>
              {summary.quartileDistribution.unknown > 0 && summary.quartileDistribution.unknown === summary.total && (
                <div className="mt-3 p-2.5 rounded-lg text-xs" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                  <strong>Hepsi bilinmiyor:</strong> SCImago dergi tablosu henüz yüklenmemiş olabilir (Railway'de ilk başlangıçta ~30 sn). Backend admin'i <code className="bg-white/50 px-1 rounded">POST /integrations/scimago/refresh</code> ile yeniden yükleyebilir.
                </div>
              )}
            </>
          ) : <p className="text-sm text-muted text-center py-8">SCImago verisi henüz yüklenmedi</p>}
        </div>

        <div className="card p-5">
          <h4 className="font-display text-sm font-semibold text-navy mb-1 inline-flex items-center gap-2">
            <Icon name="trending" className="w-4 h-4" />
            Yıllara Göre Yayın ve Atıf
            <InfoTip text="Sol eksen: o yıl yayımlanan makale sayısı. Sağ eksen: o yılın yayınlarının bugüne kadar aldığı toplam atıf." />
          </h4>
          <p className="text-xs text-muted mb-4">Yayın sayısı (mavi) vs. atıf birikimi (altın)</p>
          {summary.byYear?.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={summary.byYear}>
                <defs>
                  <linearGradient id="bg-cnt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1a3a6b" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#1a3a6b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bg-cit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c8a45a" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#c8a45a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="left" type="monotone" dataKey="count" name="Yayın" stroke="#1a3a6b" strokeWidth={2} fill="url(#bg-cnt)" />
                <Area yAxisId="right" type="monotone" dataKey="citations" name="Atıf" stroke="#c8a45a" strokeWidth={2} fill="url(#bg-cit)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted text-center py-8">Yıl verisi yok</p>}
        </div>
      </div>

      {/* SDG dağılımı + Kaynak kapsamı */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-5">
          <h4 className="font-display text-sm font-semibold text-navy mb-1 inline-flex items-center gap-2">
            <Icon name="globe" className="w-4 h-4" />
            Sürdürülebilir Kalkınma Hedefleri Katkısı
            <InfoTip text="BM'nin 17 SDG'sinden hangilerine katkı sağlıyor. OpenAlex, yayının içeriğine bakarak her SDG için bir olasılık skoru verir; biz 0.3 üstü olanları sayarız." />
          </h4>
          <p className="text-xs text-muted mb-4">Hangi hedeflere kaç yayınla katkı sağlanmış (OpenAlex)</p>
          {summary.sdgDistribution?.length > 0 ? (
            <div className="space-y-2">
              {summary.sdgDistribution.slice(0, 8).map((s: any, i: number) => {
                const max = summary.sdgDistribution[0]?.count || 1;
                const pct = (s.count / max) * 100;
                const sdgColors = ['#e5243b', '#dda63a', '#4c9f38', '#c5192d', '#ff3a21', '#26bde2', '#fcc30b', '#a21942', '#fd6925', '#dd1367', '#fd9d24', '#bf8b2e', '#3f7e44', '#0a97d9', '#56c02b', '#00689d', '#19486a'];
                const num = parseInt(s.id?.match(/\d+/)?.[0] || String(i + 1));
                const color = sdgColors[(num - 1) % sdgColors.length];
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: color }}>
                      {num}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-navy truncate">{s.name}</p>
                      <div className="h-1.5 rounded-full mt-1" style={{ background: '#f0ede8' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-navy">{s.count}</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-muted text-center py-8">OpenAlex SDG verisi bulunamadı</p>}
        </div>

        {mode === 'researcher' && (
          <div className="card p-5">
            <h4 className="font-display text-sm font-semibold text-navy mb-1 inline-flex items-center gap-2">
              <Icon name="layers" className="w-4 h-4" />
              Kaynak Kapsamı
              <InfoTip text="Her akademik veritabanı farklı yayınları indeksler. Bu grafik her kaynağın toplam yayın havuzuna katkısını gösterir — eksik kaynakları da ortaya koyar." />
            </h4>
            <p className="text-xs text-muted mb-4">Her akademik veritabanının sağladığı yayın sayısı</p>
            {sourceCoverageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sourceCoverageData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {sourceCoverageData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted text-center py-8">Kaynak verisi yok</p>}
          </div>
        )}

        {mode === 'faculty' && topResearchers.length > 0 && (
          <div className="card p-5">
            <h4 className="font-display text-sm font-semibold text-navy mb-4 inline-flex items-center gap-2">
              <Icon name="award" className="w-4 h-4" />
              En Üretken Araştırmacılar (h-index)
            </h4>
            <div className="space-y-2">
              {topResearchers.map((r: any, i: number) => (
                <Link key={r.userId} href={`/users/${r.userId}`}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#faf8f4] transition-colors">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: i < 3 ? '#c8a45a' : '#f0ede8', color: i < 3 ? 'white' : '#6b7280' }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">{r.name}</p>
                  </div>
                  <div className="flex gap-3 text-xs text-right flex-shrink-0">
                    <div><p className="font-bold text-navy">{r.hIndex}</p><p className="text-muted">h-idx</p></div>
                    <div><p className="font-bold text-navy">{r.citations}</p><p className="text-muted">atıf</p></div>
                    <div><p className="font-bold text-navy">{r.docs}</p><p className="text-muted">yayın</p></div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top 5 cited */}
      {mode === 'researcher' && topCited.length > 0 && (
        <div className="card p-5">
          <h4 className="font-display text-sm font-semibold text-navy mb-1 inline-flex items-center gap-2">
            <Icon name="fire" className="w-4 h-4 text-amber-500" />
            En Çok Atıf Alan Yayınlar
            <InfoTip text="Atıf sayısı — bir yayının etkisinin temel göstergesi. Her yayın kartında o yayının hangi dergide (Q kademesi), açık erişim mi, hangi kaynaklarda indeksli olduğu gösterilir." />
          </h4>
          <p className="text-xs text-muted mb-4">En etkili çalışmalarınız — atıf sayısına göre sıralı</p>
          <div className="space-y-3">
            {topCited.map((p: any, i: number) => (
              <div key={p.externalIds?.doi || p.externalIds?.openalex || i} className="flex gap-3 pb-3 border-b last:border-0" style={{ borderColor: '#f0ede8' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: '#fef3c7', color: '#92400e' }}>
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy line-clamp-2">{p.title}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {p.journal ? p.journal + ' · ' : ''}{p.year || '—'}
                    {p.quality?.sjrQuartile && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded text-white font-bold"
                        style={{ background: QUARTILE_COLORS[p.quality.sjrQuartile] }}>
                        {p.quality.sjrQuartile}
                      </span>
                    )}
                    {p.openAccess?.isOa && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">OA</span>
                    )}
                  </p>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {p.sources?.map((s: string) => (
                      <span key={s} className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: (SOURCE_COLORS[s] || '#94a3b8') + '20', color: SOURCE_COLORS[s] || '#94a3b8' }}>
                        {SOURCE_LABELS[s] || s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-navy">{p.citedBy?.best || 0}</p>
                  <p className="text-xs text-muted">atıf</p>
                  {p.doi && (
                    <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-navy-mid hover:underline inline-flex items-center gap-0.5 mt-1">
                      DOI <Icon name="external" className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Yardımcı KPI bileşeni ─── */
function KpiBig({ label, value, sub, icon, color, desc }: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: IconName;
  color: string;
  desc?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: color + '18', color }}>
          <Icon name={icon} className="w-5 h-5" />
        </div>
        {desc && <InfoTip text={desc} />}
      </div>
      <p className="font-display text-2xl font-bold text-navy leading-tight">{value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
      {sub && <p className="text-xs font-semibold mt-0.5" style={{ color }}>{sub}</p>}
    </div>
  );
}
