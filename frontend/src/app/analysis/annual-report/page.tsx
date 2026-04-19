'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * Yıllık Kurumsal Bibliyometri Raporu — yazdırılabilir PDF.
 * Rektörlük, dekanlık, senato için dönem sonu kapak raporudur.
 *
 * Sayfalar (yaklaşık):
 *  1. Kapak + Yönetici Özeti (KPI'lar)
 *  2. Proje Portföyü + Durum Dağılımı
 *  3. Fakülte Performans Karşılaştırması
 *  4. Bibliyometrik Özet (h-index, atıf, açık erişim, Q1-Q4)
 *  5. SDG Katkısı
 *  6. Fikri Mülkiyet + Uluslararası İşbirliği
 *  7. En Üretken Araştırmacılar
 *  8. Ek: Metodoloji + Veri Kaynakları
 */

const STATUS_LABELS: Record<string, string> = {
  application: 'Başvuru', pending: 'Beklemede', active: 'Aktif',
  completed: 'Tamamlandı', suspended: 'Askıda', cancelled: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  application: '#d97706', pending: '#d97706', active: '#059669',
  completed: '#2563eb', suspended: '#6b7280', cancelled: '#dc2626',
};
const QUARTILE_COLORS: Record<string, string> = {
  Q1: '#059669', Q2: '#2563eb', Q3: '#d97706', Q4: '#dc2626', unknown: '#94a3b8',
};
const SDG_COLORS = ['#e5243b','#dda63a','#4c9f38','#c5192d','#ff3a21','#26bde2','#fcc30b','#a21942','#fd6925','#dd1367','#fd9d24','#bf8b2e','#3f7e44','#0a97d9','#56c02b','#00689d','#19486a'];

function formatTry(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

export default function AnnualReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [radar, setRadar] = useState<any[]>([]);
  const [collab, setCollab] = useState<any>(null);
  const [sdgHeat, setSdgHeat] = useState<any>(null);
  const [researchers, setResearchers] = useState<any[]>([]);
  const [institutional, setInstitutional] = useState<any>(null);
  const [cordisProjects, setCordisProjects] = useState<any[]>([]);
  const [siteName, setSiteName] = useState('MKÜ TTO');
  const year = new Date().getFullYear();

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
      axios.get(`${base}/analytics/overview`, { headers }).then(r => r.data).catch(() => null),
      axios.get(`${base}/analytics/institutional/faculty-radar`, { headers }).then(r => r.data).catch(() => []),
      axios.get(`${base}/analytics/institutional/collaboration-matrix`, { headers }).then(r => r.data).catch(() => null),
      axios.get(`${base}/analytics/institutional/sdg-heatmap`, { headers }).then(r => r.data).catch(() => null),
      axios.get(`${base}/analytics/researcher-productivity`, { headers, params: { limit: 15 } }).then(r => r.data).catch(() => []),
      axios.get(`${base}/analytics/bibliometrics/institutional`, { headers }).then(r => r.data).catch(() => null),
      axios.get(`${base}/integrations/cordis/organization`, { headers, params: { name: 'Mustafa Kemal University', limit: 20 } }).then(r => r.data).catch(() => []),
      axios.get(`${base}/settings`, { headers }).then(r => { if (r.data?.site_name) setSiteName(r.data.site_name); }).catch(() => {}),
    ])
      .then(([ov, rad, col, sdg, res, inst, cord]) => {
        setOverview(ov); setRadar(rad); setCollab(col); setSdgHeat(sdg);
        setResearchers(res); setInstitutional(inst); setCordisProjects(cord || []);
      })
      .catch(() => setError('Rapor hazırlanırken hata oluştu'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && !error) {
      const t = setTimeout(() => window.print(), 800);
      return () => clearTimeout(t);
    }
  }, [loading, error]);

  if (loading) return <div style={s.center}><p style={s.muted}>Kurumsal rapor hazırlanıyor... (~15 saniye)</p></div>;
  if (error) return <div style={s.center}><p style={s.err}>{error}</p></div>;

  // Fakültelerin toplam SDG sayısı
  const facultyTotalSdg = sdgHeat?.cells?.length || 0;
  const sdgsCovered = new Set((sdgHeat?.cells || []).map((c: any) => c.sdgCode)).size;

  const quartileData = institutional ? [
    { name: 'Q1', value: institutional.quartileDistribution?.Q1 || 0 },
    { name: 'Q2', value: institutional.quartileDistribution?.Q2 || 0 },
    { name: 'Q3', value: institutional.quartileDistribution?.Q3 || 0 },
    { name: 'Q4', value: institutional.quartileDistribution?.Q4 || 0 },
    { name: 'Bilinmiyor', value: institutional.quartileDistribution?.unknown || 0 },
  ] : [];
  const quartileTotal = quartileData.reduce((x, q) => x + q.value, 0);

  return (
    <div style={s.page}>
      {/* Yazdırma kontrol bar */}
      <div className="no-print" style={s.toolbar}>
        <button onClick={() => window.print()} style={s.btnPrimary}>PDF olarak kaydet</button>
        <button onClick={() => window.close()} style={s.btnSecondary}>Kapat</button>
        <span style={s.tbHint}>Sayfa yüklenince otomatik print diyaloğu açılır</span>
      </div>

      {/* ═══ KAPAK ═══ */}
      <div style={{ ...s.section, ...s.coverPage }}>
        <div style={s.coverTop}>
          <p style={s.coverDate}>{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p style={s.coverInst}>{siteName}</p>
        </div>
        <div style={s.coverMid}>
          <h1 style={s.coverTitle}>YILLIK KURUMSAL<br/>BİBLİYOMETRİ RAPORU</h1>
          <p style={s.coverYear}>{year}</p>
          <p style={s.coverSubtitle}>
            Proje portföyü, araştırma çıktıları, kurumsal karşılaştırma ve
            sürdürülebilir kalkınma katkısının çok kaynaklı değerlendirmesi
          </p>
        </div>
        <div style={s.coverBottom}>
          <p style={s.coverDataSrc}>
            Veri kaynakları: Scopus · Web of Science · OpenAlex · Crossref ·
            SCImago · Unpaywall · PubMed · arXiv · Semantic Scholar · CORDIS · EPO OPS
          </p>
        </div>
      </div>

      {/* ═══ YÖNETİCİ ÖZETİ ═══ */}
      <div style={s.section}>
        <h2 style={s.h2}>1. YÖNETİCİ ÖZETİ</h2>
        {overview && (
          <>
            <div style={s.kpiGrid}>
              <Kpi label="Toplam Proje" value={overview.total || 0} color="#1a3a6b" />
              <Kpi label="Aktif Proje" value={overview.activeProjects || 0} color="#059669" />
              <Kpi label="Tamamlanan" value={overview.completedProjects || 0} color="#2563eb" />
              <Kpi label="Toplam Bütçe" value={formatTry(overview.totalBudget || 0)} color="#c8a45a" />
              <Kpi label="Başarı Oranı" value={`%${overview.successRate || 0}`} color="#7c3aed" sub="tamamlanan / karara bağlanan" />
              <Kpi label="Ortalama Bütçe" value={formatTry(overview.avgBudget || 0)} color="#0891b2" />
            </div>

            <div style={{ marginTop: 12 }}>
              <h3 style={s.h3}>Proje Durum Dağılımı</h3>
              {(overview.byStatus || []).filter((b: any) => b.count > 0).map((b: any) => {
                const pct = overview.total > 0 ? (b.count / overview.total) * 100 : 0;
                return (
                  <div key={b.status} style={s.statusRow}>
                    <span style={{ ...s.statusLabel, color: STATUS_COLORS[b.status] }}>{STATUS_LABELS[b.status] || b.status}</span>
                    <div style={s.barTrack}>
                      <div style={{ ...s.barFill, width: `${pct}%`, background: STATUS_COLORS[b.status] }} />
                    </div>
                    <span style={s.statusCount}>{b.count}</span>
                    <span style={s.statusPct}>%{Math.round(pct)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ═══ FAKÜLTE KARŞILAŞTIRMASI ═══ */}
      {radar.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>2. FAKÜLTE PERFORMANS KARŞILAŞTIRMASI</h2>
          <p style={s.p}>Fakülteler 6 boyutta değerlendirildi: Proje Ölçeği, Bütçe, Başarı, SDG Kapsamı, Fikri Mülkiyet, Etik Uyum.</p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Fakülte</th>
                <th style={s.thR}>Proje</th>
                <th style={s.thR}>Aktif</th>
                <th style={s.thR}>Tamamlanan</th>
                <th style={s.thR}>Başarı</th>
                <th style={s.thR}>Toplam Bütçe</th>
                <th style={s.thR}>SDG</th>
                <th style={s.thR}>IP</th>
                <th style={s.thR}>Etik</th>
                <th style={s.thR}>Üye</th>
              </tr>
            </thead>
            <tbody>
              {radar.map((f: any) => (
                <tr key={f.faculty}>
                  <td style={s.td}>{f.faculty}</td>
                  <td style={s.tdR}>{f.totalProjects}</td>
                  <td style={s.tdR}>{f.activeProjects}</td>
                  <td style={s.tdR}>{f.completedProjects}</td>
                  <td style={{ ...s.tdR, fontWeight: 700 }}>%{f.successRate}</td>
                  <td style={s.tdR}>{formatTry(f.totalBudget)}</td>
                  <td style={s.tdR}>{f.sdgCoverage}/17</td>
                  <td style={s.tdR}>{f.ipCount}</td>
                  <td style={s.tdR}>{f.ethicsApprovedCount}</td>
                  <td style={s.tdR}>{f.memberTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ BİBLİYOMETRİK ÖZET ═══ */}
      {institutional && institutional.configured !== false && (
        <div style={s.section}>
          <h2 style={s.h2}>3. BİBLİYOMETRİK ÖZET</h2>
          <p style={s.p}>Kurumumuzun OpenAlex kaynağından çekilen yayın havuzu üzerinden hesaplanmıştır.</p>

          <div style={s.kpiGrid}>
            <Kpi label="Toplam Yayın" value={institutional.total || 0} color="#1a3a6b" />
            <Kpi label="Toplam Atıf" value={institutional.totalCitations || 0} color="#7c3aed" />
            <Kpi label="h-index" value={institutional.hIndex || 0} color="#c8a45a" />
            <Kpi label="i10-index" value={institutional.i10Index || 0} color="#059669" />
            <Kpi label="Açık Erişim" value={`%${institutional.openAccessRatio || 0}`} sub={`${institutional.openAccessCount || 0} yayın`} color="#0891b2" />
          </div>

          {quartileTotal > 0 && (
            <div style={{ marginTop: 12 }}>
              <h3 style={s.h3}>Dergi Kalite Dağılımı (SCImago SJR)</h3>
              {quartileData.map(q => {
                const pct = quartileTotal > 0 ? (q.value / quartileTotal) * 100 : 0;
                return (
                  <div key={q.name} style={s.statusRow}>
                    <span style={{ ...s.statusLabel, color: QUARTILE_COLORS[q.name] || '#94a3b8' }}>{q.name}</span>
                    <div style={s.barTrack}>
                      <div style={{ ...s.barFill, width: `${pct}%`, background: QUARTILE_COLORS[q.name] || '#94a3b8' }} />
                    </div>
                    <span style={s.statusCount}>{q.value}</span>
                    <span style={s.statusPct}>%{Math.round(pct)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ SDG KATKISI ═══ */}
      {sdgHeat && sdgHeat.sdgs?.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>4. SÜRDÜRÜLEBİLİR KALKINMA HEDEFLERİNE KATKI</h2>
          <p style={s.p}>
            Kurum bünyesindeki projeler <strong>{sdgsCovered}/17</strong> SDG'ye değiyor.
            Toplam <strong>{facultyTotalSdg}</strong> fakülte-SDG eşlemesi tespit edildi.
          </p>
          <div style={s.sdgGrid}>
            {sdgHeat.sdgs.map((sdg: string) => {
              const num = parseInt(sdg.match(/\d+/)?.[0] || '0');
              const color = SDG_COLORS[(num - 1) % SDG_COLORS.length];
              const count = (sdgHeat.cells || []).filter((c: any) => c.sdgCode === sdg).reduce((x: number, c: any) => x + c.count, 0);
              const facCount = (sdgHeat.cells || []).filter((c: any) => c.sdgCode === sdg).length;
              return (
                <div key={sdg} style={s.sdgItem}>
                  <div style={{ ...s.sdgNum, background: color }}>{num}</div>
                  <div style={s.sdgText}>
                    <p style={s.sdgCount}><strong>{count}</strong> proje</p>
                    <p style={s.sdgFac}>{facCount} fakülte</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ ULUSLARARASI İŞBİRLİĞİ ═══ */}
      {collab && collab.cells?.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>5. CROSS-FAKÜLTE İŞBİRLİKLERİ</h2>
          <p style={s.p}>Aynı projede farklı fakültelerden üyeler — kurum içi disiplinlerarası işbirliğinin göstergesi.</p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Fakülte A</th>
                <th style={s.th}>Fakülte B</th>
                <th style={s.thR}>Ortak Proje</th>
              </tr>
            </thead>
            <tbody>
              {collab.cells.slice(0, 15).map((c: any, i: number) => (
                <tr key={i}>
                  <td style={s.td}>{c.facultyA}</td>
                  <td style={s.td}>{c.facultyB}</td>
                  <td style={{ ...s.tdR, fontWeight: 700 }}>{c.sharedProjects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ AB PROJELERİ ═══ */}
      {cordisProjects.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>6. ULUSLARARASI FONLAMA (CORDIS)</h2>
          <p style={s.p}>Kurumumuzun katıldığı AB araştırma projeleri — Horizon Europe / H2020 / FP7.</p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Program</th>
                <th style={s.th}>Akronim</th>
                <th style={s.th}>Başlık</th>
                <th style={s.th}>Koordinatör</th>
                <th style={s.thR}>AB Katkısı</th>
              </tr>
            </thead>
            <tbody>
              {cordisProjects.slice(0, 10).map((p: any) => (
                <tr key={p.id}>
                  <td style={s.td}>{p.framework}</td>
                  <td style={s.td}>{p.acronym || '—'}</td>
                  <td style={s.tdSmall}>{p.title}</td>
                  <td style={s.td}>{p.coordinator?.name || '—'}</td>
                  <td style={s.tdR}>{p.ecMaxContribution ? '€' + Number(p.ecMaxContribution).toLocaleString('tr-TR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ EN ÜRETKEN ARAŞTIRMACILAR ═══ */}
      {researchers.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>7. EN ÜRETKEN ARAŞTIRMACILAR</h2>
          <p style={s.p}>Proje sayısı ve tamamlanan proje oranına göre ilk {researchers.length} araştırmacı.</p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Araştırmacı</th>
                <th style={s.th}>Fakülte</th>
                <th style={s.th}>Bölüm</th>
                <th style={s.thR}>Toplam</th>
                <th style={s.thR}>Aktif</th>
                <th style={s.thR}>Tamamlanan</th>
                <th style={s.thR}>Bütçe</th>
              </tr>
            </thead>
            <tbody>
              {researchers.map((r: any, i: number) => (
                <tr key={r.userId}>
                  <td style={s.td}>{i + 1}</td>
                  <td style={s.td}>{r.name}</td>
                  <td style={s.td}>{r.faculty || '—'}</td>
                  <td style={s.td}>{r.department || '—'}</td>
                  <td style={s.tdR}>{r.total}</td>
                  <td style={s.tdR}>{r.active}</td>
                  <td style={s.tdR}>{r.completed}</td>
                  <td style={s.tdR}>{formatTry(r.totalBudget)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ METODOLOJİ ═══ */}
      <div style={s.section}>
        <h2 style={s.h2}>EK: METODOLOJİ</h2>
        <p style={s.p}>
          <strong>Veri birleştirme:</strong> Yayınlar DOI bazlı dedupe ile her kaynaktan bir kez sayılır.
          Atıf sayısında kaynaklar arasında en yüksek değer baz alınır.
        </p>
        <p style={s.p}>
          <strong>Başarı oranı:</strong> Sadece karara bağlanmış projeler (tamamlanan + iptal edilen)
          üzerinden hesaplanır. Devam eden projeler oranı bozmaz.
        </p>
        <p style={s.p}>
          <strong>Normalize değerler:</strong> Fakülte radar'ındaki 0-100 skorları, en yüksek değere sahip
          fakülteye göre göreceli olarak ölçeklenir.
        </p>
        <p style={s.p}>
          <strong>SDG eşleştirmesi:</strong> İki yoldan gelir: (a) projeye sahibi tarafından atanan SDG'ler,
          (b) OpenAlex'in yayın bazlı otomatik SDG tahminleri.
        </p>
        <p style={s.p}>
          <strong>Dergi kalitesi:</strong> SCImago Journal Rank en güncel veri seti kullanılır. Q1-Q4
          kuartilleri ilgili dergi için "Best Quartile" alanından alınır.
        </p>

        <div style={s.footerMeta}>
          <p>Rapor üretici: {siteName} · Yıl {year}</p>
          <p>Oluşturulma: {new Date().toLocaleString('tr-TR')}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Yardımcı bileşen ─── */
function Kpi({ label, value, sub, color }: { label: string; value: any; sub?: string; color: string }) {
  return (
    <div style={{ ...s.kpi, borderColor: color + '44' }}>
      <p style={{ ...s.kpiValue, color }}>{value}</p>
      <p style={s.kpiLabel}>{label}</p>
      {sub && <p style={s.kpiSub}>{sub}</p>}
    </div>
  );
}

/* ─── Stiller ─── */
const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: '210mm',
    margin: '0 auto',
    padding: '14mm',
    background: 'white',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1f2937',
    fontSize: 11,
    lineHeight: 1.45,
  },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' },
  muted: { color: '#6b7280' },
  err: { color: '#dc2626' },

  toolbar: {
    position: 'sticky', top: 0, background: '#0f2444', padding: '10px 14mm', margin: '-14mm -14mm 16px',
    display: 'flex', alignItems: 'center', gap: 10, zIndex: 10,
  },
  btnPrimary: { background: '#c8a45a', color: '#0f2444', padding: '8px 16px', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 },
  btnSecondary: { background: 'white', color: '#0f2444', padding: '8px 16px', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 },
  tbHint: { color: 'white', fontSize: 11, opacity: 0.7 },

  section: { marginBottom: 22, pageBreakInside: 'avoid' },
  coverPage: {
    minHeight: '260mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)',
    color: 'white', padding: '24mm',
    margin: '-14mm -14mm 22px',
    pageBreakAfter: 'always',
  },
  coverTop: { display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.8 },
  coverDate: { margin: 0 },
  coverInst: { margin: 0, fontWeight: 700 },
  coverMid: { textAlign: 'center' },
  coverTitle: { fontSize: 36, fontWeight: 700, margin: 0, lineHeight: 1.15, letterSpacing: 1 },
  coverYear: { fontSize: 64, fontWeight: 700, color: '#c8a45a', margin: '30px 0 10px' },
  coverSubtitle: { fontSize: 13, margin: '10px auto 0', maxWidth: 500, opacity: 0.85, lineHeight: 1.6 },
  coverBottom: { fontSize: 9, opacity: 0.6, textAlign: 'center' },
  coverDataSrc: { margin: 0 },

  h2: { fontSize: 14, fontWeight: 700, color: '#0f2444', margin: '0 0 6px', paddingBottom: 6, borderBottom: '2px solid #0f2444' },
  h3: { fontSize: 12, fontWeight: 700, color: '#374151', margin: '12px 0 6px' },
  p: { fontSize: 11, margin: '0 0 10px', color: '#4b5563' },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 },
  kpi: { padding: 10, border: '1.5px solid', borderRadius: 8, textAlign: 'center' },
  kpiValue: { fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1 },
  kpiLabel: { fontSize: 9, color: '#6b7280', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiSub: { fontSize: 9, fontWeight: 600, margin: 0, color: '#6b7280' },

  statusRow: { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' },
  statusLabel: { width: 100, fontSize: 11, fontWeight: 600 },
  barTrack: { flex: 1, height: 14, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  statusCount: { width: 40, textAlign: 'right', fontSize: 11, fontWeight: 700 },
  statusPct: { width: 40, textAlign: 'right', fontSize: 10, color: '#6b7280' },

  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 10 },
  th: { textAlign: 'left' as const, padding: '6px 8px', background: '#faf8f4', borderBottom: '1px solid #e8e4dc', fontWeight: 700, color: '#374151' },
  thR: { textAlign: 'right' as const, padding: '6px 8px', background: '#faf8f4', borderBottom: '1px solid #e8e4dc', fontWeight: 700, color: '#374151' },
  td: { padding: '5px 8px', borderBottom: '1px solid #f0ede8' },
  tdR: { padding: '5px 8px', borderBottom: '1px solid #f0ede8', textAlign: 'right' as const },
  tdSmall: { padding: '5px 8px', borderBottom: '1px solid #f0ede8', fontSize: 9, maxWidth: 300 },

  sdgGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 },
  sdgItem: { display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: '#f9fafb', borderRadius: 4 },
  sdgNum: { width: 26, height: 26, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  sdgText: { fontSize: 9 },
  sdgCount: { margin: 0, color: '#0f2444', fontSize: 10 },
  sdgFac: { margin: 0, color: '#6b7280', fontSize: 9 },

  footerMeta: { marginTop: 14, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 9, color: '#9ca3af', textAlign: 'center' as const },
};
