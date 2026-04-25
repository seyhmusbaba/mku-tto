'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

/**
 * Araştırmacı Akademik Scorecard - yazdırılabilir (PDF için) tam sayfa dokümant.
 * AVESIS'in "Akademik CV" karşılığı; üzerine bibliyometrik agregalar eklenmiştir.
 *
 * Token transferi: parent /users/[id]/page.tsx, scorecard'ı yeni sekmede açar ve
 * sessionStorage['tto_print_token'] olarak token'ı set eder. Bu sayfa oradan
 * okur, Authorization header'ı oluşturur, API'yi çağırır.
 */

const QUARTILE_COLORS: Record<string, string> = {
  Q1: '#059669', Q2: '#2563eb', Q3: '#d97706', Q4: '#dc2626', unknown: '#94a3b8',
};

const SDG_COLORS = ['#e5243b','#dda63a','#4c9f38','#c5192d','#ff3a21','#26bde2','#fcc30b','#a21942','#fd6925','#dd1367','#fd9d24','#bf8b2e','#3f7e44','#0a97d9','#56c02b','#00689d','#19486a'];

const SOURCE_LABELS: Record<string, string> = {
  crossref: 'Crossref', openalex: 'OpenAlex', wos: 'Web of Science',
  scopus: 'Scopus', pubmed: 'PubMed', arxiv: 'arXiv', semanticScholar: 'Semantic Scholar',
};

export default function ResearcherScorecardPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [siteName, setSiteName] = useState('MKÜ TTO');

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    let token = '';
    try {
      token = sessionStorage.getItem('tto_print_token') || localStorage.getItem('tto_token') || '';
      sessionStorage.removeItem('tto_print_token');
    } catch {}
    if (!token) { setError('Oturum bulunamadı'); setLoading(false); return; }
    const headers = { Authorization: 'Bearer ' + token };

    Promise.all([
      axios.get(`${base}/analytics/bibliometrics/researcher/${id}?includeList=true`, { headers }),
      axios.get(`${base}/settings`, { headers }).catch(() => null),
    ])
      .then(([r, s]) => {
        setData(r.data);
        if (s?.data?.site_name) setSiteName(s.data.site_name);
      })
      .catch(e => setError(e?.response?.data?.message || 'Veri alınamadı'))
      .finally(() => setLoading(false));
  }, [id]);

  // Veri yüklenince otomatik print diyaloğunu aç (kısa gecikme - DOM hazır olsun)
  useEffect(() => {
    if (data && !loading) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [data, loading]);

  if (loading) return <div style={style.center}><p style={style.muted}>Scorecard hazırlanıyor...</p></div>;
  if (error) return <div style={style.center}><p style={style.err}>{error}</p></div>;
  if (!data) return null;

  const { user, summary, topCited, publications = [], sourceCoverage = {} } = data;
  const pubs = publications.length > 0 ? publications : topCited;

  const quartiles = [
    { name: 'Q1', value: summary.quartileDistribution.Q1, color: QUARTILE_COLORS.Q1 },
    { name: 'Q2', value: summary.quartileDistribution.Q2, color: QUARTILE_COLORS.Q2 },
    { name: 'Q3', value: summary.quartileDistribution.Q3, color: QUARTILE_COLORS.Q3 },
    { name: 'Q4', value: summary.quartileDistribution.Q4, color: QUARTILE_COLORS.Q4 },
    { name: 'Bilinmiyor', value: summary.quartileDistribution.unknown, color: QUARTILE_COLORS.unknown },
  ];

  return (
    <div style={style.page}>
      {/* Yazdırma kontrol barı - @media print ile gizlenir */}
      <div className="no-print" style={style.toolbar}>
        <button onClick={() => window.print()} style={style.btnPrimary}>PDF olarak kaydet</button>
        <button onClick={() => window.close()} style={style.btnSecondary}>Kapat</button>
        <span style={style.muted}>Tarayıcı yazdırma diyaloğundan "PDF olarak kaydet" seçin</span>
      </div>

      {/* ═══ HEADER ═══ */}
      <div style={style.header}>
        <div>
          <h1 style={style.hdTitle}>AKADEMİK SCORECARD</h1>
          <p style={style.hdSubtitle}>Çok kaynaklı bibliyometrik değerlendirme raporu</p>
        </div>
        <div style={style.hdInst}>
          <p style={style.hdInstName}>{siteName}</p>
          <p style={style.hdDate}>{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* ═══ KİMLİK ═══ */}
      <section style={style.section}>
        <div style={style.identity}>
          <h2 style={style.personName}>{user.name}</h2>
          <p style={style.personOrg}>
            {user.faculty}{user.department ? ' · ' + user.department : ''}
          </p>
          <div style={style.ids}>
            {user.orcidId && <span style={{ ...style.idBadge, background: '#a6ce3918', color: '#5a8a00' }}>ORCID: {user.orcidId}</span>}
            {user.scopusAuthorId && <span style={{ ...style.idBadge, background: '#e07a2b18', color: '#c2410c' }}>Scopus: {user.scopusAuthorId}</span>}
            {user.wosResearcherId && <span style={{ ...style.idBadge, background: '#dc262618', color: '#991b1b' }}>WoS: {user.wosResearcherId}</span>}
          </div>
        </div>
      </section>

      {/* ═══ KPI ÖZETİ ═══ */}
      <section style={style.section}>
        <h3 style={style.sectionTitle}>GENEL PERFORMANS</h3>
        <div style={style.kpiGrid}>
          {[
            { label: 'Toplam Yayın', value: summary.total, color: '#1a3a6b' },
            { label: 'Toplam Atıf', value: summary.totalCitations, color: '#7c3aed' },
            { label: 'h-index', value: summary.hIndex, color: '#c8a45a' },
            { label: 'i10-index', value: summary.i10Index, color: '#059669' },
            { label: 'Açık Erişim', value: `%${summary.openAccessRatio}`, sub: `${summary.openAccessCount} yayın`, color: '#0891b2' },
            { label: 'Kaynak Sayısı', value: Object.keys(sourceCoverage).length, sub: 'veritabanı', color: '#dc2626' },
          ].map((k, i) => (
            <div key={i} style={{ ...style.kpi, borderColor: k.color + '33' }}>
              <p style={{ ...style.kpiValue, color: k.color }}>{k.value}</p>
              <p style={style.kpiLabel}>{k.label}</p>
              {k.sub && <p style={style.kpiSub}>{k.sub}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ═══ DERGİ KALİTE DAĞILIMI ═══ */}
      <section style={style.section}>
        <h3 style={style.sectionTitle}>DERGİ KALİTE DAĞILIMI (SCIMAGO SJR)</h3>
        <div style={style.quartBars}>
          {quartiles.map(q => {
            const pct = summary.total > 0 ? (q.value / summary.total) * 100 : 0;
            return (
              <div key={q.name} style={style.quartRow}>
                <span style={{ ...style.quartLabel, color: q.color }}>{q.name}</span>
                <div style={style.quartBarTrack}>
                  <div style={{ ...style.quartBarFill, width: `${pct}%`, background: q.color }} />
                </div>
                <span style={style.quartCount}>{q.value}</span>
                <span style={style.quartPct}>%{Math.round(pct)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ YILLIK TREND ═══ */}
      {summary.byYear?.length > 0 && (
        <section style={style.section}>
          <h3 style={style.sectionTitle}>YILLARA GÖRE YAYIN VE ATIF</h3>
          <div style={style.yearTable}>
            {summary.byYear.map((y: any) => {
              const maxCount = Math.max(...summary.byYear.map((x: any) => x.count));
              const maxCit = Math.max(...summary.byYear.map((x: any) => x.citations));
              const cntW = maxCount > 0 ? (y.count / maxCount) * 100 : 0;
              const citW = maxCit > 0 ? (y.citations / maxCit) * 100 : 0;
              return (
                <div key={y.year} style={style.yearRow}>
                  <span style={style.yearLabel}>{y.year}</span>
                  <div style={style.yearBarGroup}>
                    <div style={{ ...style.yearBar, width: `${cntW}%`, background: '#1a3a6b' }} />
                    <span style={style.yearCount}>{y.count} yayın</span>
                  </div>
                  <div style={style.yearBarGroup}>
                    <div style={{ ...style.yearBar, width: `${citW}%`, background: '#c8a45a' }} />
                    <span style={style.yearCount}>{y.citations} atıf</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ SDG KATKI ═══ */}
      {summary.sdgDistribution?.length > 0 && (
        <section style={style.section}>
          <h3 style={style.sectionTitle}>SÜRDÜRÜLEBİLİR KALKINMA HEDEFLERİNE KATKI</h3>
          <div style={style.sdgGrid}>
            {summary.sdgDistribution.slice(0, 12).map((s: any) => {
              const num = parseInt(s.id?.match(/\d+/)?.[0] || '0');
              const color = SDG_COLORS[(num - 1) % SDG_COLORS.length];
              return (
                <div key={s.id} style={style.sdgItem}>
                  <div style={{ ...style.sdgNum, background: color }}>{num}</div>
                  <div style={style.sdgText}>
                    <p style={style.sdgName}>{s.name}</p>
                    <p style={style.sdgCount}><strong>{s.count}</strong> yayın</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ KAYNAK KAPSAMI ═══ */}
      {Object.keys(sourceCoverage).length > 0 && (
        <section style={style.section}>
          <h3 style={style.sectionTitle}>KAYNAK KAPSAMI</h3>
          <p style={style.smallMuted}>Bu rapor aşağıdaki akademik veritabanlarının birleştirilmiş verilerinden hesaplanmıştır:</p>
          <div style={style.sourceList}>
            {Object.entries(sourceCoverage).sort(([, a], [, b]) => (b as number) - (a as number)).map(([k, v]) => (
              <span key={k} style={style.sourceChip}>
                <strong>{SOURCE_LABELS[k] || k}:</strong> {v as number} yayın
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ═══ YAYIN LİSTESİ ═══ */}
      <section style={style.section}>
        <h3 style={style.sectionTitle}>YAYIN LİSTESİ ({pubs.length})</h3>
        <ol style={style.pubList}>
          {pubs.map((p: any, i: number) => (
            <li key={p.externalIds?.doi || p.externalIds?.openalex || i} style={style.pubItem}>
              <span style={style.pubNum}>{i + 1}.</span>
              <p style={style.pubTitle}>{p.title}</p>
              <p style={style.pubMeta}>
                {p.authors?.slice(0, 5).map((a: any) => a.name).filter(Boolean).join(', ')}
                {p.authors?.length > 5 ? ' et al.' : ''}
              </p>
              <p style={style.pubMeta}>
                <em>{p.journal || '-'}</em>{p.year ? `, ${p.year}` : ''}
                {p.quality?.sjrQuartile && (
                  <span style={{ ...style.pubBadge, background: QUARTILE_COLORS[p.quality.sjrQuartile], color: 'white' }}>
                    {p.quality.sjrQuartile}
                  </span>
                )}
                {p.openAccess?.isOa && (
                  <span style={{ ...style.pubBadge, background: '#059669', color: 'white' }}>OA</span>
                )}
                <span style={style.pubCit}>Atıf: <strong>{p.citedBy?.best || 0}</strong></span>
              </p>
              {p.doi && <p style={style.pubDoi}>DOI: {p.doi}</p>}
            </li>
          ))}
        </ol>
      </section>

      {/* ═══ FOOTER ═══ */}
      <div style={style.footer}>
        <p style={style.footerText}>
          Bu rapor {siteName} tarafından otomatik olarak üretilmiştir.
          Veri kaynakları: Scopus · Web of Science · OpenAlex · Crossref · SCImago · Unpaywall · PubMed · arXiv · Semantic Scholar.
          Bibliyometrik göstergeler çok kaynaklı DOI eşleşmesi ile hesaplanmış, tekrar sayımlar önlenmiştir.
        </p>
        <p style={style.footerText}>
          Rapor tarihi: {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

/* ─── Inline stiller (yazdırma için güvenli) ─── */
const style: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: '210mm',
    margin: '0 auto',
    padding: '14mm',
    background: 'white',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1f2937',
    fontSize: 11,
    lineHeight: 1.4,
  },
  center: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'system-ui',
  },
  muted: { color: '#6b7280' },
  err: { color: '#dc2626' },

  toolbar: {
    position: 'sticky', top: 0, background: '#0f2444', padding: '10px 14mm', margin: '-14mm -14mm 16px',
    display: 'flex', alignItems: 'center', gap: 10,
    zIndex: 10,
  },
  btnPrimary: { background: '#c8a45a', color: '#0f2444', padding: '8px 16px', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 },
  btnSecondary: { background: 'white', color: '#0f2444', padding: '8px 16px', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 },

  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingBottom: 12, borderBottom: '3px solid #0f2444', marginBottom: 18,
  },
  hdTitle: { fontSize: 22, fontWeight: 700, color: '#0f2444', margin: 0, letterSpacing: 1 },
  hdSubtitle: { fontSize: 10, color: '#6b7280', margin: '4px 0 0' },
  hdInst: { textAlign: 'right' },
  hdInstName: { fontSize: 14, fontWeight: 700, color: '#0f2444', margin: 0 },
  hdDate: { fontSize: 10, color: '#6b7280', margin: '2px 0 0' },

  section: { marginBottom: 18, pageBreakInside: 'avoid' },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1.2,
    marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #e5e7eb',
  },

  identity: { textAlign: 'left' },
  personName: { fontSize: 20, fontWeight: 700, color: '#0f2444', margin: '0 0 4px' },
  personOrg: { fontSize: 12, color: '#6b7280', margin: '0 0 8px' },
  ids: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  idBadge: { fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4 },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 },
  kpi: { padding: 10, border: '1.5px solid', borderRadius: 8, textAlign: 'center' },
  kpiValue: { fontSize: 20, fontWeight: 700, margin: 0, lineHeight: 1 },
  kpiLabel: { fontSize: 9, color: '#6b7280', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiSub: { fontSize: 9, fontWeight: 600, margin: 0, color: '#6b7280' },

  quartBars: { display: 'flex', flexDirection: 'column', gap: 6 },
  quartRow: { display: 'flex', alignItems: 'center', gap: 10 },
  quartLabel: { width: 60, fontWeight: 700, fontSize: 11 },
  quartBarTrack: { flex: 1, height: 18, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  quartBarFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s' },
  quartCount: { width: 36, textAlign: 'right', fontWeight: 700, fontSize: 11 },
  quartPct: { width: 40, textAlign: 'right', fontSize: 10, color: '#6b7280' },

  yearTable: { display: 'flex', flexDirection: 'column', gap: 4 },
  yearRow: { display: 'grid', gridTemplateColumns: '50px 1fr 1fr', gap: 8, alignItems: 'center' },
  yearLabel: { fontWeight: 700, fontSize: 11 },
  yearBarGroup: { display: 'flex', alignItems: 'center', gap: 6 },
  yearBar: { height: 12, borderRadius: 2, minWidth: 2 },
  yearCount: { fontSize: 9, color: '#6b7280', whiteSpace: 'nowrap' },

  sdgGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  sdgItem: { display: 'flex', alignItems: 'center', gap: 8, padding: 6, background: '#f9fafb', borderRadius: 6 },
  sdgNum: { width: 28, height: 28, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  sdgText: { flex: 1, minWidth: 0 },
  sdgName: { fontSize: 10, fontWeight: 600, margin: 0, color: '#0f2444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sdgCount: { fontSize: 9, color: '#6b7280', margin: '2px 0 0' },

  smallMuted: { fontSize: 10, color: '#6b7280', margin: '0 0 8px' },
  sourceList: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  sourceChip: { fontSize: 10, padding: '4px 8px', background: '#f3f4f6', borderRadius: 4, color: '#374151' },

  pubList: { padding: 0, margin: 0, listStyle: 'none' },
  pubItem: {
    padding: '8px 0', borderBottom: '1px solid #f0ede8',
    pageBreakInside: 'avoid',
    position: 'relative', paddingLeft: 26,
  },
  pubNum: { position: 'absolute', left: 0, top: 8, fontSize: 10, fontWeight: 700, color: '#6b7280', width: 22 },
  pubTitle: { fontSize: 11, fontWeight: 700, color: '#0f2444', margin: '0 0 2px' },
  pubMeta: { fontSize: 10, color: '#374151', margin: 0 },
  pubBadge: { fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, marginLeft: 6 },
  pubCit: { marginLeft: 10, fontSize: 10, color: '#0f2444' },
  pubDoi: { fontSize: 9, color: '#6b7280', margin: '2px 0 0', fontFamily: 'monospace' },

  footer: {
    marginTop: 22, paddingTop: 10, borderTop: '1px solid #e5e7eb',
    fontSize: 9, color: '#9ca3af', textAlign: 'center',
  },
  footerText: { margin: '2px 0' },
};
