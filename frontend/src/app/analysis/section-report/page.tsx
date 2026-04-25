'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';

/**
 * Sekme-Bazlı Yazdırılabilir Rapor.
 * /analysis sayfasındaki sekmelerden herhangi birinin verilerini PDF formatında sunar.
 * Yıllık kurumsal raporla aynı stili kullanır ama sadece tek bir konuya odaklanır.
 *
 * Desteklenen sekmeler: overview, institutional, bibliometrics, faculty, researcher, funding, timeline, scopus
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

const COUNTRY_NAMES: Record<string, string> = {
  US: 'Amerika Birleşik Devletleri', GB: 'Birleşik Krallık', DE: 'Almanya', FR: 'Fransa',
  IT: 'İtalya', ES: 'İspanya', NL: 'Hollanda', JP: 'Japonya', CN: 'Çin', IN: 'Hindistan',
  CA: 'Kanada', AU: 'Avustralya', RU: 'Rusya', BR: 'Brezilya', SA: 'Suudi Arabistan',
  IR: 'İran', IQ: 'Irak', SY: 'Suriye', EG: 'Mısır', AE: 'BAE', QA: 'Katar', KW: 'Kuveyt',
  PL: 'Polonya', BE: 'Belçika', CH: 'İsviçre', AT: 'Avusturya', SE: 'İsveç', NO: 'Norveç',
  DK: 'Danimarka', FI: 'Finlandiya', GR: 'Yunanistan', PT: 'Portekiz', IE: 'İrlanda',
  CZ: 'Çekya', HU: 'Macaristan', RO: 'Romanya', BG: 'Bulgaristan', RS: 'Sırbistan',
  UA: 'Ukrayna', BY: 'Belarus', KR: 'Güney Kore', SG: 'Singapur', MY: 'Malezya',
  TH: 'Tayland', PK: 'Pakistan', ID: 'Endonezya', VN: 'Vietnam', MX: 'Meksika',
  AR: 'Arjantin', CL: 'Şili', ZA: 'Güney Afrika', NG: 'Nijerya', TR: 'Türkiye',
  IL: 'İsrail', AZ: 'Azerbaycan', GE: 'Gürcistan', AM: 'Ermenistan', UZ: 'Özbekistan',
  KZ: 'Kazakistan', KG: 'Kırgızistan', TJ: 'Tacikistan', TM: 'Türkmenistan',
};
function countryName(code: string) { return COUNTRY_NAMES[code] || code; }
function countryFlag(code: string) {
  if (!code || code.length !== 2) return '';
  const cp = code.toUpperCase().split('').map(c => 0x1f1e6 + (c.charCodeAt(0) - 65));
  try { return String.fromCodePoint(...cp); } catch { return ''; }
}

const TAB_TITLES: Record<string, string> = {
  overview: 'Genel Bakış Raporu',
  institutional: 'Kurumsal Karşılaştırma Raporu',
  bibliometrics: 'Bibliyometri Raporu',
  faculty: 'Fakülte Analiz Raporu',
  researcher: 'Araştırmacı Analiz Raporu',
  funding: 'Fon Analizi Raporu',
  timeline: 'Zaman Serisi Raporu',
  scopus: 'Scopus Analitik Raporu',
};

function formatTry(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n || 0);
}
function formatNum(n: number) {
  return new Intl.NumberFormat('tr-TR').format(n || 0);
}

function SectionReportContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'overview';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [institutionName, setInstitutionName] = useState('Hatay Mustafa Kemal Üniversitesi');
  const [rectorName, setRectorName] = useState('Prof. Dr. Veysel EREN');
  const [currentUser, setCurrentUser] = useState<{ name: string; role?: string } | null>(null);
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

    // Her sekme için farklı veri seti çek
    const fetchTabData = async (): Promise<any> => {
      switch (tab) {
        case 'overview':
          return {
            overview: await axios.get(`${base}/analytics/overview`, { headers }).then(r => r.data).catch(() => null),
          };
        case 'institutional':
          return {
            radar: await axios.get(`${base}/analytics/institutional/faculty-radar`, { headers }).then(r => r.data).catch(() => []),
            collab: await axios.get(`${base}/analytics/institutional/collaboration-matrix`, { headers }).then(r => r.data).catch(() => null),
            sdgHeat: await axios.get(`${base}/analytics/institutional/sdg-heatmap`, { headers }).then(r => r.data).catch(() => null),
          };
        case 'bibliometrics':
          return {
            institutional: await axios.get(`${base}/analytics/bibliometrics/institutional`, { headers }).then(r => r.data).catch(() => null),
            peerBench: await axios.get(`${base}/analytics/bibliometrics/peer-benchmark`, { headers }).then(r => r.data).catch(() => null),
          };
        case 'faculty':
          return {
            radar: await axios.get(`${base}/analytics/institutional/faculty-radar`, { headers }).then(r => r.data).catch(() => []),
            facultyPerf: await axios.get(`${base}/analytics/faculty-performance`, { headers }).then(r => r.data).catch(() => []),
          };
        case 'researcher':
          return {
            researchers: await axios.get(`${base}/analytics/researcher-productivity`, { headers, params: { limit: 50 } }).then(r => r.data).catch(() => []),
          };
        case 'funding':
          return {
            funding: await axios.get(`${base}/analytics/funding-success`, { headers }).then(r => r.data).catch(() => null),
            budget: await axios.get(`${base}/analytics/budget-utilization`, { headers }).then(r => r.data).catch(() => null),
            cordis: await axios.get(`${base}/integrations/cordis/organization`, { headers, params: { name: 'Mustafa Kemal University', limit: 20 } }).then(r => r.data).catch(() => []),
          };
        case 'timeline':
          return {
            timeline: await axios.get(`${base}/analytics/timeline`, { headers }).then(r => r.data).catch(() => []),
          };
        case 'scopus':
          return {
            scopus: await axios.get(`${base}/scopus/dashboard`, { headers }).then(r => r.data).catch(() => null),
          };
        default:
          return null;
      }
    };

    Promise.all([
      fetchTabData(),
      axios.get(`${base}/settings`, { headers }).then(r => {
        if (r.data?.institution_name) setInstitutionName(r.data.institution_name);
        if (r.data?.rector_name) setRectorName(r.data.rector_name);
      }).catch(() => {}),
      axios.get(`${base}/users/me`, { headers }).then(r => {
        const u = r.data;
        if (u) {
          const fullName = [u.title, u.firstName, u.lastName].filter(Boolean).join(' ').trim();
          setCurrentUser({ name: fullName || u.email, role: u.role?.name });
        }
      }).catch(() => {}),
    ])
      .then(([d]) => { setData(d); })
      .catch(() => setError('Rapor hazırlanamadı'))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    if (!loading && !error && data) {
      const t = setTimeout(() => window.print(), 900);
      return () => clearTimeout(t);
    }
  }, [loading, error, data]);

  if (loading) return <div style={s.center}><p style={s.muted}>Rapor hazırlanıyor...</p></div>;
  if (error) return <div style={s.center}><p style={s.err}>{error}</p></div>;

  const title = TAB_TITLES[tab] || 'Analiz Raporu';

  return (
    <>
      <style>{`
        @page {
          size: A4;
          margin: 15mm 14mm 18mm 14mm;
          @bottom-right {
            content: "Sayfa " counter(page) " / " counter(pages);
            font-family: system-ui, sans-serif; font-size: 9pt; color: #6b7280;
          }
          @bottom-left {
            content: "${institutionName.replace(/"/g, '\\"')} · ${title.replace(/"/g, '\\"')} ${year}";
            font-family: system-ui, sans-serif; font-size: 9pt; color: #9ca3af;
          }
        }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div style={s.page}>
        <div className="no-print" style={s.toolbar}>
          <button onClick={() => window.print()} style={s.btnPrimary}>PDF olarak kaydet</button>
          <button onClick={() => window.close()} style={s.btnSecondary}>Kapat</button>
          <span style={s.tbHint}>Yükleme tamamlandı - otomatik print açılıyor</span>
        </div>

        {/* KAPAK */}
        <div style={{ ...s.section, ...s.coverPage }}>
          <div style={s.coverTop}>
            <div>
              <p style={s.coverDate}>{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style={s.coverInst}>{institutionName}</p>
            </div>
            <div style={s.coverLogoBox}>
              <svg viewBox="0 0 60 60" width="60" height="60" style={{ display: 'block' }}>
                <circle cx="30" cy="30" r="28" fill="none" stroke="#c8a45a" strokeWidth="1.5" />
                <text x="30" y="36" textAnchor="middle" fill="#c8a45a" fontSize="18" fontWeight="700" fontFamily="system-ui">MKÜ</text>
              </svg>
            </div>
          </div>
          <div style={s.coverMid}>
            <h1 style={s.coverTitle}>{title.toUpperCase()}</h1>
            <p style={s.coverYear}>{year}</p>
            <p style={s.coverSubtitle}>
              Analiz & Raporlama modülünden otomatik üretilen sekme bazlı rapor
            </p>
          </div>
          <div style={s.coverBottom}>
            <p style={s.coverDataSrc}>{institutionName} - Teknoloji Transfer Ofisi</p>
          </div>
        </div>

        {/* Sekmeye göre ilgili bölümü render et */}
        {tab === 'overview' && <OverviewSection data={data} />}
        {tab === 'institutional' && <InstitutionalSection data={data} />}
        {tab === 'bibliometrics' && <BibliometricsSection data={data} />}
        {tab === 'faculty' && <FacultySection data={data} />}
        {tab === 'researcher' && <ResearcherSection data={data} />}
        {tab === 'funding' && <FundingSection data={data} />}
        {tab === 'timeline' && <TimelineSection data={data} />}
        {tab === 'scopus' && <ScopusSection data={data} />}

        {/* İmza + Meta */}
        <div style={s.section}>
          <div style={s.footerMeta}>
            <p>Rapor üretici: {institutionName} Teknoloji Transfer Ofisi</p>
            <p>Rapor türü: {title} · Yıl: {year}</p>
            <p>Oluşturulma: {new Date().toLocaleString('tr-TR')}</p>
            <p>Bu rapor otomatik olarak üretilmiştir.</p>
            <div style={s.signatureBlock}>
              <div style={s.signCell}>
                <div style={s.signLine}></div>
                <p style={s.signLbl}>Hazırlayan</p>
                <p style={s.signName}>{currentUser?.name || 'TTO Direktörlüğü'}</p>
                {currentUser?.role && <p style={s.signRole}>{currentUser.role}</p>}
              </div>
              <div style={s.signCell}>
                <div style={s.signLine}></div>
                <p style={s.signLbl}>Onaylayan</p>
                <p style={s.signName}>{rectorName}</p>
                <p style={s.signRole}>Rektör</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ────────────── SEKME BÖLÜMLERI ────────────── */

function OverviewSection({ data }: { data: any }) {
  const ov = data?.overview;
  if (!ov) return <EmptySection msg="Genel bakış verisi alınamadı" />;

  return (
    <>
      <div style={s.section}>
        <h2 style={s.h2}>GENEL BAKIŞ</h2>
        <div style={s.kpiGrid}>
          <Kpi label="Toplam Proje" value={formatNum(ov.total)} color="#1a3a6b" />
          <Kpi label="Aktif Proje" value={formatNum(ov.activeProjects)} color="#059669" />
          <Kpi label="Tamamlanan" value={formatNum(ov.completedProjects)} color="#2563eb" />
          <Kpi label="Toplam Bütçe" value={formatTry(ov.totalBudget)} color="#c8a45a" />
          <Kpi label="Başarı Oranı" value={`%${ov.successRate || 0}`} color="#7c3aed" />
          <Kpi label="Ortalama Bütçe" value={formatTry(ov.avgBudget)} color="#0891b2" />
        </div>
      </div>

      {ov.byStatus && (
        <div style={s.section}>
          <h2 style={s.h2}>PROJE DURUM DAĞILIMI</h2>
          {ov.byStatus.filter((b: any) => b.count > 0).map((b: any) => {
            const pct = ov.total > 0 ? (b.count / ov.total) * 100 : 0;
            return (
              <div key={b.status} style={s.statusRow}>
                <span style={{ ...s.statusLabel, color: STATUS_COLORS[b.status] }}>{STATUS_LABELS[b.status] || b.status}</span>
                <div style={s.barTrack}><div style={{ ...s.barFill, width: `${pct}%`, background: STATUS_COLORS[b.status] }} /></div>
                <span style={s.statusCount}>{b.count}</span>
                <span style={s.statusPct}>%{Math.round(pct)}</span>
              </div>
            );
          })}
        </div>
      )}

      {ov.byType && ov.byType.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>PROJE TÜRÜNE GÖRE DAĞILIM</h2>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Tür</th><th style={s.thR}>Adet</th><th style={s.thR}>Pay</th></tr></thead>
            <tbody>
              {ov.byType.map((t: any) => (
                <tr key={t.type}>
                  <td style={s.td}>{t.type}</td>
                  <td style={s.tdR}>{t.count}</td>
                  <td style={s.tdR}>%{ov.total > 0 ? Math.round((t.count / ov.total) * 100) : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function InstitutionalSection({ data }: { data: any }) {
  const radar = data?.radar || [];
  const collab = data?.collab;
  const sdgHeat = data?.sdgHeat;

  return (
    <>
      {radar.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>FAKÜLTE KARŞILAŞTIRMASI</h2>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Fakülte</th>
                <th style={s.thR}>Proje</th>
                <th style={s.thR}>Aktif</th>
                <th style={s.thR}>Tamam.</th>
                <th style={s.thR}>Başarı</th>
                <th style={s.thR}>Bütçe</th>
                <th style={s.thR}>SDG</th>
                <th style={s.thR}>IP</th>
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
                  <td style={s.tdR}>{f.memberTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {collab?.cells?.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>FAKÜLTELER ARASI İŞBİRLİĞİ</h2>
          <table style={s.table}>
            <thead><tr><th style={s.th}>#</th><th style={s.th}>Fakülte A</th><th style={s.th}>Fakülte B</th><th style={s.thR}>Ortak Proje</th></tr></thead>
            <tbody>
              {collab.cells.slice(0, 15).map((c: any, i: number) => (
                <tr key={i}>
                  <td style={s.td}>{i + 1}</td>
                  <td style={s.td}>{c.facultyA}</td>
                  <td style={s.td}>{c.facultyB}</td>
                  <td style={{ ...s.tdR, fontWeight: 700 }}>{c.sharedProjects}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* İlk 5 çift için proje detayı */}
          {collab.cells.slice(0, 5).map((c: any, idx: number) => {
            if (!c.projects || c.projects.length === 0) return null;
            return (
              <div key={`pair-${idx}`} style={{ marginTop: 14, pageBreakInside: 'avoid' }}>
                <h3 style={s.h3}>{c.facultyA} ↔ {c.facultyB} - Ortak Projeler ({c.sharedProjects})</h3>
                <table style={s.table}>
                  <thead><tr><th style={s.th}>#</th><th style={s.th}>Proje</th><th style={s.thR}>Durum</th></tr></thead>
                  <tbody>
                    {c.projects.slice(0, 10).map((p: any, i: number) => (
                      <tr key={p.id || i}>
                        <td style={s.td}>{i + 1}</td>
                        <td style={s.tdSmall}>{p.name}</td>
                        <td style={s.tdR}>{p.status || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {sdgHeat?.sdgs?.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>SDG × FAKÜLTE ISI HARITASI</h2>
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

          {/* En yoğun 5 SDG için projeler */}
          {(() => {
            const sdgToProjects = new Map<string, any[]>();
            for (const c of sdgHeat.cells) {
              const cur = sdgToProjects.get(c.sdgCode) || [];
              if (Array.isArray(c.projects)) cur.push(...c.projects);
              sdgToProjects.set(c.sdgCode, cur);
            }
            const top = (sdgHeat.sdgs || []).slice().sort((a: string, b: string) => {
              const ca = (sdgToProjects.get(a) || []).length;
              const cb = (sdgToProjects.get(b) || []).length;
              return cb - ca;
            }).slice(0, 5);
            return top.map((sdg: string) => {
              const projs = sdgToProjects.get(sdg) || [];
              if (projs.length === 0) return null;
              const num = parseInt(sdg.match(/\d+/)?.[0] || '0');
              const uniq = Array.from(new Map(projs.map(p => [p.id, p])).values()).slice(0, 10);
              return (
                <div key={sdg} style={{ marginTop: 14, pageBreakInside: 'avoid' }}>
                  <h3 style={s.h3}>SDG {num} Projeler ({projs.length} katkı)</h3>
                  <table style={s.table}>
                    <thead><tr><th style={s.th}>#</th><th style={s.th}>Proje</th><th style={s.thR}>Durum</th></tr></thead>
                    <tbody>
                      {uniq.map((p: any, i: number) => (
                        <tr key={p.id || i}>
                          <td style={s.td}>{i + 1}</td>
                          <td style={s.tdSmall}>{p.name}</td>
                          <td style={s.tdR}>{p.status || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            });
          })()}
        </div>
      )}
    </>
  );
}

function BibliometricsSection({ data }: { data: any }) {
  const inst = data?.institutional;
  const peerBench = data?.peerBench;
  if (!inst || inst.configured === false) return <EmptySection msg="Bibliyometri verisi yok - kurumsal OpenAlex ID ayarlı değil" />;

  const quartileTotal = ['Q1','Q2','Q3','Q4','unknown'].reduce((x, k) => x + (inst.quartileDistribution?.[k] || 0), 0);
  const quartileKnown = quartileTotal - (inst.quartileDistribution?.unknown || 0);
  const peers: any[] = peerBench?.peers || [];
  const mkuPeer = peers.find(p => p.isMku);
  const countries: any[] = inst.countryCollaboration || [];
  const topCountries = countries.slice(0, 15);
  const topCited = [...(inst.publications || [])]
    .sort((a, b) => (b?.citedBy?.best || 0) - (a?.citedBy?.best || 0)).slice(0, 15);
  const topJournals = inst.topJournals || [];

  return (
    <>
      <div style={s.section}>
        <h2 style={s.h2}>BİBLİYOMETRİK GÖSTERGELER</h2>
        <div style={s.kpiGrid}>
          <Kpi label="Toplam Yayın" value={formatNum(inst.total)} color="#1a3a6b" />
          <Kpi label="Toplam Atıf" value={formatNum(inst.totalCitations)} color="#7c3aed" />
          <Kpi label="h-index" value={inst.hIndex} color="#c8a45a" />
          <Kpi label="i10-index" value={inst.i10Index} color="#059669" />
          <Kpi label="Açık Erişim" value={`%${inst.openAccessRatio}`} color="#0891b2" />
          <Kpi label="Q1 Yayın" value={formatNum(inst.quartileDistribution?.Q1 || 0)} color="#059669" sub={`%${quartileKnown > 0 ? Math.round(((inst.quartileDistribution?.Q1 || 0) / quartileKnown) * 100) : 0}`} />
          <Kpi label="Ort. FWCI" value={inst.avgFwci !== null && inst.avgFwci !== undefined ? inst.avgFwci : '-'} color="#7c3aed" />
          <Kpi label="Top 1% Yayın" value={formatNum(inst.top1PctCount || 0)} color="#059669" sub={`%${inst.top1PctRatio || 0}`} />
          <Kpi label="Top 10% Yayın" value={formatNum(inst.top10PctCount || 0)} color="#2563eb" sub={`%${inst.top10PctRatio || 0}`} />
          <Kpi label="Uluslararası Ortaklık" value={`%${inst.internationalCoauthorRatio || 0}`} color="#c8a45a" />
          <Kpi label="Ort. Yazar/Makale" value={inst.avgAuthorsPerPaper || 0} color="#0891b2" />
          <Kpi label="Ort. Ülke/Makale" value={inst.avgCountriesPerPaper !== null ? inst.avgCountriesPerPaper : '-'} color="#1a3a6b" />
        </div>
      </div>

      {quartileTotal > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>DERGİ KALİTE DAĞILIMI</h2>
          {['Q1','Q2','Q3','Q4','unknown'].map(k => {
            const count = inst.quartileDistribution?.[k] || 0;
            const pct = quartileTotal > 0 ? (count / quartileTotal) * 100 : 0;
            return (
              <div key={k} style={s.statusRow}>
                <span style={{ ...s.statusLabel, color: QUARTILE_COLORS[k] }}>{k === 'unknown' ? 'Bilinmiyor' : k}</span>
                <div style={s.barTrack}><div style={{ ...s.barFill, width: `${pct}%`, background: QUARTILE_COLORS[k] }} /></div>
                <span style={s.statusCount}>{count}</span>
                <span style={s.statusPct}>%{Math.round(pct)}</span>
              </div>
            );
          })}
        </div>
      )}

      {peers.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>PEER ÜNİVERSİTE KARŞILAŞTIRMASI</h2>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Kurum</th>
                <th style={s.thR}>Yayın</th>
                <th style={s.thR}>Atıf</th>
                <th style={s.thR}>h-index</th>
                <th style={s.thR}>2yr Mean</th>
              </tr>
            </thead>
            <tbody>
              {peers.map((p, i) => (
                <tr key={p.id} style={p.isMku ? { background: '#fef3c7', fontWeight: 700 } : {}}>
                  <td style={s.td}>{i + 1}</td>
                  <td style={s.td}>{p.displayName} {p.isMku && <span style={{ color: '#c8a45a' }}>★</span>}</td>
                  <td style={s.tdR}>{formatNum(p.worksCount)}</td>
                  <td style={s.tdR}>{formatNum(p.citedByCount)}</td>
                  <td style={s.tdR}>{p.hIndex || '-'}</td>
                  <td style={s.tdR}>{p.twoYearMeanCitedness !== undefined ? (+p.twoYearMeanCitedness).toFixed(2) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {mkuPeer && (
            <p style={s.pSmall}>
              <em>
                {institutionName()} {peers.length} kurumluk sette <strong>{peers.filter(p => p.worksCount > mkuPeer.worksCount).length + 1}. sırada</strong>.
              </em>
            </p>
          )}
        </div>
      )}

      {topCountries.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>ULUSLARARASI İŞBİRLİĞİ - ÜLKE BAZLI</h2>
          <table style={s.table}>
            <thead><tr><th style={s.th}>#</th><th style={s.th}>Ülke</th><th style={s.thR}>Ortak Yayın</th></tr></thead>
            <tbody>
              {topCountries.map((c, i) => (
                <tr key={c.code}>
                  <td style={s.td}>{i + 1}</td>
                  <td style={s.td}><span style={{ marginRight: 6 }}>{countryFlag(c.code)}</span>{countryName(c.code)} <span style={{ color: '#9ca3af', fontSize: 9 }}>({c.code})</span></td>
                  <td style={{ ...s.tdR, fontWeight: 700 }}>{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* İlk 3 ülke için yayın detayı */}
          {topCountries.slice(0, 3).map((c) => {
            const pubs = (inst.publications || [])
              .filter((p: any) => Array.isArray(p.countries) && p.countries.includes(c.code))
              .sort((a: any, b: any) => (b?.citedBy?.best || 0) - (a?.citedBy?.best || 0)).slice(0, 5);
            if (pubs.length === 0) return null;
            return (
              <div key={c.code} style={{ marginTop: 14, pageBreakInside: 'avoid' }}>
                <h3 style={s.h3}>
                  <span style={{ marginRight: 6 }}>{countryFlag(c.code)}</span>
                  {countryName(c.code)} - Ortak Yayınlar
                </h3>
                <table style={s.table}>
                  <thead><tr><th style={s.th}>#</th><th style={s.th}>Başlık</th><th style={s.th}>Dergi</th><th style={s.thR}>Yıl</th><th style={s.thR}>Atıf</th></tr></thead>
                  <tbody>
                    {pubs.map((p: any, i: number) => (
                      <tr key={p.doi || i}>
                        <td style={s.td}>{i + 1}</td>
                        <td style={s.tdSmall}>{p.title}</td>
                        <td style={s.tdSmall}>{p.journal || '-'}</td>
                        <td style={s.tdR}>{p.year || '-'}</td>
                        <td style={{ ...s.tdR, fontWeight: 700 }}>{p?.citedBy?.best || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {topCited.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>EN ÇOK ATIF ALAN YAYINLAR</h2>
          <table style={s.table}>
            <thead><tr><th style={s.th}>#</th><th style={s.th}>Başlık</th><th style={s.th}>Dergi</th><th style={s.thR}>Yıl</th><th style={s.thR}>Q</th><th style={s.thR}>Atıf</th></tr></thead>
            <tbody>
              {topCited.map((p, i) => (
                <tr key={p.doi || i}>
                  <td style={s.td}>{i + 1}</td>
                  <td style={s.tdSmall}>{p.title}</td>
                  <td style={s.tdSmall}>{p.journal || '-'}</td>
                  <td style={s.tdR}>{p.year || '-'}</td>
                  <td style={s.tdR}>{p.quality?.sjrQuartile ? <span style={{ ...s.qBadge, background: QUARTILE_COLORS[p.quality.sjrQuartile] }}>{p.quality.sjrQuartile}</span> : '-'}</td>
                  <td style={{ ...s.tdR, fontWeight: 700 }}>{p.citedBy?.best || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {topJournals.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>EN ÇOK YAYIN YAPILAN DERGİLER</h2>
          <table style={s.table}>
            <thead><tr><th style={s.th}>#</th><th style={s.th}>Dergi</th><th style={s.thR}>Yayın</th></tr></thead>
            <tbody>
              {topJournals.slice(0, 15).map((j: any, i: number) => (
                <tr key={j.name}>
                  <td style={s.td}>{i + 1}</td>
                  <td style={s.tdSmall}>{j.name}</td>
                  <td style={{ ...s.tdR, fontWeight: 700 }}>{j.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inst.typeDistribution && inst.typeDistribution.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>YAYIN TÜRÜNE GÖRE DAĞILIM</h2>
          <p style={s.p}>OpenAlex'in tespit ettiği türlere göre - makale, kitap, kitap bölümü, tez, ön baskı, bildiri, inceleme vs.</p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Tür</th>
                <th style={s.thR}>Adet</th>
                <th style={s.thR}>Toplam Atıf</th>
                <th style={s.thR}>Ort. Atıf/Yayın</th>
                <th style={s.thR}>Pay</th>
              </tr>
            </thead>
            <tbody>
              {inst.typeDistribution.map((t: any) => {
                const totalSample = inst.typeDistribution.reduce((x: number, y: any) => x + y.count, 0);
                const pct = totalSample > 0 ? (t.count / totalSample) * 100 : 0;
                const avgCit = t.count > 0 ? (t.citations / t.count).toFixed(1) : '-';
                return (
                  <tr key={t.type}>
                    <td style={s.td}>{t.label}</td>
                    <td style={{ ...s.tdR, fontWeight: 700 }}>{t.count}</td>
                    <td style={s.tdR}>{formatNum(t.citations)}</td>
                    <td style={s.tdR}>{avgCit}</td>
                    <td style={s.tdR}>%{pct.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// Placeholder helper (only used in BibliometricsSection JSX string interpolation)
function institutionName() { return 'Kurumumuz'; }

function FacultySection({ data }: { data: any }) {
  const radar = data?.radar || [];
  if (radar.length === 0) return <EmptySection msg="Fakülte verisi yok" />;

  return (
    <div style={s.section}>
      <h2 style={s.h2}>FAKÜLTE PERFORMANS DETAYI</h2>
      <p style={s.p}>Fakülteler toplam proje sayısına göre sıralandı. Her fakültenin 9 metriği yan yana verilmiştir.</p>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>#</th>
            <th style={s.th}>Fakülte</th>
            <th style={s.thR}>Toplam</th>
            <th style={s.thR}>Aktif</th>
            <th style={s.thR}>Tamam.</th>
            <th style={s.thR}>Başarı</th>
            <th style={s.thR}>Bütçe</th>
            <th style={s.thR}>Ort. Bütçe</th>
            <th style={s.thR}>SDG</th>
            <th style={s.thR}>IP</th>
            <th style={s.thR}>Etik</th>
            <th style={s.thR}>Üye</th>
          </tr>
        </thead>
        <tbody>
          {radar.map((f: any, i: number) => (
            <tr key={f.faculty}>
              <td style={s.td}>{i + 1}</td>
              <td style={s.td}>{f.faculty}</td>
              <td style={s.tdR}>{f.totalProjects}</td>
              <td style={s.tdR}>{f.activeProjects}</td>
              <td style={s.tdR}>{f.completedProjects}</td>
              <td style={{ ...s.tdR, fontWeight: 700 }}>%{f.successRate}</td>
              <td style={s.tdR}>{formatTry(f.totalBudget)}</td>
              <td style={s.tdR}>{formatTry(f.avgBudget)}</td>
              <td style={s.tdR}>{f.sdgCoverage}/17</td>
              <td style={s.tdR}>{f.ipCount}</td>
              <td style={s.tdR}>{f.ethicsApprovedCount}</td>
              <td style={s.tdR}>{f.memberTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResearcherSection({ data }: { data: any }) {
  const researchers = data?.researchers || [];
  if (researchers.length === 0) return <EmptySection msg="Araştırmacı verisi yok" />;

  return (
    <div style={s.section}>
      <h2 style={s.h2}>EN ÜRETKEN ARAŞTIRMACILAR (TOP {researchers.length})</h2>
      <p style={s.p}>Toplam proje sayısına göre sıralanmıştır.</p>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>#</th>
            <th style={s.th}>Araştırmacı</th>
            <th style={s.th}>Fakülte</th>
            <th style={s.th}>Bölüm</th>
            <th style={s.thR}>Toplam</th>
            <th style={s.thR}>Aktif</th>
            <th style={s.thR}>Tamam.</th>
            <th style={s.thR}>Bütçe</th>
          </tr>
        </thead>
        <tbody>
          {researchers.map((r: any, i: number) => (
            <tr key={r.userId}>
              <td style={s.td}>{i + 1}</td>
              <td style={{ ...s.td, fontWeight: i < 3 ? 700 : 400 }}>{r.name}</td>
              <td style={s.td}>{r.faculty || '-'}</td>
              <td style={s.td}>{r.department || '-'}</td>
              <td style={s.tdR}>{r.total}</td>
              <td style={s.tdR}>{r.active}</td>
              <td style={s.tdR}>{r.completed}</td>
              <td style={s.tdR}>{formatTry(r.totalBudget)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FundingSection({ data }: { data: any }) {
  const funding = data?.funding;
  const budget = data?.budget;
  const cordis: any[] = data?.cordis || [];
  const totalEu = cordis.reduce((x, p) => x + (Number(p.ecMaxContribution) || 0), 0);

  return (
    <>
      {funding?.bySource && funding.bySource.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>FONLAMA KAYNAĞINA GÖRE BAŞARI</h2>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Kaynak</th>
                <th style={s.thR}>Başvuru</th>
                <th style={s.thR}>Kabul</th>
                <th style={s.thR}>Başarı</th>
                <th style={s.thR}>Toplam Bütçe</th>
              </tr>
            </thead>
            <tbody>
              {funding.bySource.map((f: any) => (
                <tr key={f.source}>
                  <td style={s.td}>{f.source || '-'}</td>
                  <td style={s.tdR}>{f.totalApplications || 0}</td>
                  <td style={s.tdR}>{f.accepted || 0}</td>
                  <td style={{ ...s.tdR, fontWeight: 700 }}>%{f.successRate || 0}</td>
                  <td style={s.tdR}>{formatTry(f.totalBudget || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {budget?.byProject && budget.byProject.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>BÜTÇE KULLANIMI (TOP 15)</h2>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Proje</th>
                <th style={s.thR}>Bütçe</th>
                <th style={s.thR}>Harcanan</th>
                <th style={s.thR}>Kullanım</th>
              </tr>
            </thead>
            <tbody>
              {budget.byProject.slice(0, 15).map((p: any) => (
                <tr key={p.id}>
                  <td style={s.tdSmall}>{p.name || p.title}</td>
                  <td style={s.tdR}>{formatTry(p.budget || 0)}</td>
                  <td style={s.tdR}>{formatTry(p.spent || 0)}</td>
                  <td style={{ ...s.tdR, fontWeight: 700 }}>%{p.utilizationPct || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cordis.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>CORDIS - AB PROJELERİ</h2>
          <p style={s.p}>Toplam AB katkısı: <strong>€{Number(totalEu).toLocaleString('tr-TR')}</strong></p>
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
              {cordis.slice(0, 15).map((p: any) => (
                <tr key={p.id}>
                  <td style={s.td}>{p.framework}</td>
                  <td style={s.td}>{p.acronym || '-'}</td>
                  <td style={s.tdSmall}>{p.title}</td>
                  <td style={s.td}>{p.coordinator?.name || '-'}</td>
                  <td style={s.tdR}>{p.ecMaxContribution ? '€' + Number(p.ecMaxContribution).toLocaleString('tr-TR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function TimelineSection({ data }: { data: any }) {
  const timeline = data?.timeline || [];
  if (timeline.length === 0) return <EmptySection msg="Zaman serisi verisi yok" />;

  return (
    <div style={s.section}>
      <h2 style={s.h2}>PROJE ZAMAN ÇİZELGESİ</h2>
      <p style={s.p}>Dönem başına başlatılan, tamamlanan ve iptal edilen proje hacimleri.</p>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Dönem</th>
            <th style={s.thR}>Başlatılan</th>
            <th style={s.thR}>Tamamlanan</th>
            <th style={s.thR}>İptal</th>
          </tr>
        </thead>
        <tbody>
          {timeline.slice(-36).map((t: any) => (
            <tr key={t.period}>
              <td style={s.td}>{t.period}</td>
              <td style={s.tdR}>{t.started || 0}</td>
              <td style={s.tdR}>{t.completed || 0}</td>
              <td style={s.tdR}>{t.cancelled || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScopusSection({ data }: { data: any }) {
  const scopus = data?.scopus;
  if (!scopus) return <EmptySection msg="Scopus verisi yok" />;
  return (
    <div style={s.section}>
      <h2 style={s.h2}>SCOPUS ANALİTİĞİ</h2>
      <p style={s.p}>Scopus entegrasyon özet bilgileri.</p>
      <pre style={{ ...s.pSmall, whiteSpace: 'pre-wrap', background: '#faf8f4', padding: 10, borderRadius: 4 }}>
        {JSON.stringify(scopus, null, 2).slice(0, 2000)}
      </pre>
    </div>
  );
}

function EmptySection({ msg }: { msg: string }) {
  return <div style={s.section}><p style={s.p}>{msg}</p></div>;
}

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
  page: { maxWidth: '210mm', margin: '0 auto', padding: '14mm', background: 'white', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1f2937', fontSize: 11, lineHeight: 1.45 },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' },
  muted: { color: '#6b7280' },
  err: { color: '#dc2626' },

  toolbar: { position: 'sticky', top: 0, background: '#0f2444', padding: '10px 14mm', margin: '-14mm -14mm 16px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 10 },
  btnPrimary: { background: '#c8a45a', color: '#0f2444', padding: '8px 16px', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 },
  btnSecondary: { background: 'white', color: '#0f2444', padding: '8px 16px', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 },
  tbHint: { color: 'white', fontSize: 11, opacity: 0.7 },

  section: { marginBottom: 22, pageBreakInside: 'avoid' },
  coverPage: { minHeight: '260mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)', color: 'white', padding: '24mm', margin: '-14mm -14mm 22px', pageBreakAfter: 'always' },
  coverTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 11, opacity: 0.9 },
  coverLogoBox: { background: 'rgba(255,255,255,0.08)', padding: 8, borderRadius: 12, border: '1px solid rgba(200,164,90,0.4)' },
  coverDate: { margin: 0 },
  coverInst: { margin: '4px 0 0', fontWeight: 700, fontSize: 13 },
  coverMid: { textAlign: 'center' },
  coverTitle: { fontSize: 32, fontWeight: 700, margin: 0, lineHeight: 1.15, letterSpacing: 1 },
  coverYear: { fontSize: 64, fontWeight: 700, color: '#c8a45a', margin: '30px 0 10px' },
  coverSubtitle: { fontSize: 13, margin: '10px auto 0', maxWidth: 500, opacity: 0.85, lineHeight: 1.6 },
  coverBottom: { fontSize: 9, opacity: 0.6, textAlign: 'center' },
  coverDataSrc: { margin: 0 },

  h2: { fontSize: 14, fontWeight: 700, color: '#0f2444', margin: '0 0 6px', paddingBottom: 6, borderBottom: '2px solid #0f2444' },
  h3: { fontSize: 12, fontWeight: 700, color: '#374151', margin: '14px 0 6px' },
  p: { fontSize: 11, margin: '0 0 10px', color: '#4b5563' },
  pSmall: { fontSize: 10, margin: '6px 0 0', color: '#6b7280' },

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

  qBadge: { color: 'white', padding: '2px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700 },

  sdgGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 },
  sdgItem: { display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: '#f9fafb', borderRadius: 4 },
  sdgNum: { width: 26, height: 26, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  sdgText: { fontSize: 9 },
  sdgCount: { margin: 0, color: '#0f2444', fontSize: 10 },
  sdgFac: { margin: 0, color: '#6b7280', fontSize: 9 },

  footerMeta: { marginTop: 14, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 9, color: '#9ca3af', textAlign: 'center' as const },
  signatureBlock: { marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' },
  signCell: { textAlign: 'center' as const },
  signLine: { height: 1, background: '#374151', margin: '30px 10px 6px' },
  signLbl: { fontSize: 9, color: '#6b7280', margin: 0, textTransform: 'uppercase' as const, letterSpacing: 1 },
  signName: { fontSize: 11, color: '#0f2444', margin: '4px 0 0', fontWeight: 700 },
  signRole: { fontSize: 9, color: '#6b7280', margin: '2px 0 0', fontStyle: 'italic' as const },
};

export default function SectionReportPage() {
  return (
    <Suspense fallback={<div style={s.center}><p style={s.muted}>Yükleniyor...</p></div>}>
      <SectionReportContent />
    </Suspense>
  );
}
