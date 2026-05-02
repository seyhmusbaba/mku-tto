'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * Yıllık Kurumsal Bibliyometri Raporu - yazdırılabilir PDF.
 * Rektörlük, dekanlık, senato için dönem sonu kapak raporudur.
 */

const STATUS_LABELS: Record<string, string> = {
  application: 'Başvuru', pending: 'Beklemede', active: 'Aktif',
  completed: 'Tamamlandı', suspended: 'Askıda', cancelled: 'İptal',
};
function statusTr(s: string) { return STATUS_LABELS[s] || s || '-'; }

const TYPE_LABELS: Record<string, string> = {
  tubitak: 'TÜBİTAK', bap: 'BAP', eu: 'AB Projesi',
  industry: 'Sanayi', international: 'Uluslararası',
  other: 'Diğer', '': 'Belirtilmemiş',
};
function typeTr(t: string) { return TYPE_LABELS[t] || t || 'Belirtilmemiş'; }

const IP_STATUS_LABELS: Record<string, string> = {
  pending: 'Başvuru Aşamasında', registered: 'Tescilli',
  published: 'Yayımlandı', none: 'Yok',
};
const IP_TYPE_LABELS: Record<string, string> = {
  patent: 'Patent', faydali_model: 'Faydalı Model', marka: 'Marka',
  tasarim: 'Tasarım', telif: 'Telif Hakkı', ticari_sir: 'Ticari Sır',
  belirtilmemis: 'Belirtilmemiş',
};
const STATUS_COLORS: Record<string, string> = {
  application: '#d97706', pending: '#d97706', active: '#059669',
  completed: '#2563eb', suspended: '#6b7280', cancelled: '#dc2626',
};
const QUARTILE_COLORS: Record<string, string> = {
  Q1: '#059669', Q2: '#2563eb', Q3: '#d97706', Q4: '#dc2626', unknown: '#94a3b8',
};
const SDG_COLORS = ['#e5243b','#dda63a','#4c9f38','#c5192d','#ff3a21','#26bde2','#fcc30b','#a21942','#fd6925','#dd1367','#fd9d24','#bf8b2e','#3f7e44','#0a97d9','#56c02b','#00689d','#19486a'];

// ISO 3166-1 alpha-2 kodundan ülke adı
const COUNTRY_NAMES: Record<string, string> = {
  US: 'Amerika Birleşik Devletleri', GB: 'Birleşik Krallık', DE: 'Almanya', FR: 'Fransa',
  IT: 'İtalya', ES: 'İspanya', NL: 'Hollanda', JP: 'Japonya', CN: 'Çin', IN: 'Hindistan',
  CA: 'Kanada', AU: 'Avustralya', RU: 'Rusya', BR: 'Brezilya', SA: 'Suudi Arabistan',
  IR: 'İran', IQ: 'Irak', SY: 'Suriye', EG: 'Mısır', AE: 'BAE', QA: 'Katar', KW: 'Kuveyt',
  PL: 'Polonya', BE: 'Belçika', CH: 'İsviçre', AT: 'Avusturya', SE: 'İsveç', NO: 'Norveç',
  DK: 'Danimarka', FI: 'Finlandiya', GR: 'Yunanistan', PT: 'Portekiz', IE: 'İrlanda',
  CZ: 'Çekya', HU: 'Macaristan', RO: 'Romanya', BG: 'Bulgaristan', RS: 'Sırbistan',
  UA: 'Ukrayna', BY: 'Belarus', RO_: 'Romanya', KR: 'Güney Kore', SG: 'Singapur',
  MY: 'Malezya', TH: 'Tayland', PK: 'Pakistan', ID: 'Endonezya', VN: 'Vietnam',
  MX: 'Meksika', AR: 'Arjantin', CL: 'Şili', ZA: 'Güney Afrika', NG: 'Nijerya',
  TR: 'Türkiye', IL: 'İsrail', AZ: 'Azerbaycan', GE: 'Gürcistan', AM: 'Ermenistan',
  UZ: 'Özbekistan', KZ: 'Kazakistan', KG: 'Kırgızistan', TJ: 'Tacikistan', TM: 'Türkmenistan',
};
function countryName(code: string) { return COUNTRY_NAMES[code] || code; }
function countryFlag(code: string) {
  // Emoji flag - ISO alpha-2 code'a karşılık gelen regional indicator
  if (!code || code.length !== 2) return '';
  const cp = code.toUpperCase().split('').map(c => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...cp);
}

function formatTry(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}
function formatNum(n: number) {
  return new Intl.NumberFormat('tr-TR').format(n || 0);
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
  const [timeline, setTimeline] = useState<any[]>([]);
  const [funding, setFunding] = useState<any>(null);
  const [budget, setBudget] = useState<any>(null);
  const [peerBench, setPeerBench] = useState<any>(null);
  const [reportExtras, setReportExtras] = useState<any>(null);
  // ADMIN AYARI: Bibliyometri gosterimi sistem genelinde kapaliysa rapor da
  // bibliyometri bolumlerini icermez. Varsayilan: acik.
  const [bibliometricsEnabled, setBibliometricsEnabled] = useState<boolean>(true);
  const [narrative, setNarrative] = useState<{preface: string; evaluation: string; outlook: string}>({ preface: '', evaluation: '', outlook: '' });
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [siteName, setSiteName] = useState('MKÜ TTO');
  const [institutionName, setInstitutionName] = useState('Hatay Mustafa Kemal Üniversitesi');
  const [rectorName, setRectorName] = useState('Prof. Dr. Veysel EREN');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<{ name: string; title?: string; role?: string } | null>(null);
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

    // Once ayarlari cek - bibliyometri gostermesi gerekiyor mu?
    axios.get(`${base}/settings`, { headers })
      .then(r => {
        const settings = r.data || {};
        if (settings.site_name) setSiteName(settings.site_name);
        if (settings.institution_name) setInstitutionName(settings.institution_name);
        if (settings.rector_name) setRectorName(settings.rector_name);
        if (settings.logo_url) setLogoUrl(settings.logo_url);
        const showBib = settings.show_bibliometrics;
        // 'false' string disinda her sey acik kabul edilir
        const enabled = !(showBib === 'false' || showBib === false);
        setBibliometricsEnabled(enabled);
        return enabled;
      })
      .catch(() => true)
      .then((enabled) => {
        // Proje bazli endpointler her zaman cagrilir
        const projectCalls: Promise<any>[] = [
          axios.get(`${base}/analytics/overview`, { headers }).then(r => r.data).catch(() => null),
          axios.get(`${base}/analytics/institutional/faculty-radar`, { headers }).then(r => r.data).catch(() => []),
          axios.get(`${base}/analytics/institutional/collaboration-matrix`, { headers }).then(r => r.data).catch(() => null),
          axios.get(`${base}/analytics/institutional/sdg-heatmap`, { headers }).then(r => r.data).catch(() => null),
          axios.get(`${base}/analytics/researcher-productivity`, { headers, params: { limit: 25 } }).then(r => r.data).catch(() => []),
          axios.get(`${base}/integrations/cordis/organization`, { headers, params: { name: 'Mustafa Kemal University', limit: 20 } }).then(r => r.data).catch(() => []),
          axios.get(`${base}/analytics/timeline`, { headers }).then(r => r.data).catch(() => []),
          axios.get(`${base}/analytics/funding-success`, { headers }).then(r => r.data).catch(() => null),
          axios.get(`${base}/analytics/budget-utilization`, { headers }).then(r => r.data).catch(() => null),
          // Yeni: rapor ekstralari (etik + IP + ortak + demografi + bu yil tamamlanan)
          axios.get(`${base}/analytics/report-extras`, { headers }).then(r => r.data).catch(() => null),
        ];
        // Bibliyometri endpointleri sadece admin acmissa cagrilir
        const bibCalls: Promise<any>[] = enabled
          ? [
              axios.get(`${base}/analytics/bibliometrics/institutional`, { headers }).then(r => r.data).catch(() => null),
              axios.get(`${base}/analytics/bibliometrics/peer-benchmark`, { headers }).then(r => r.data).catch(() => null),
            ]
          : [Promise.resolve(null), Promise.resolve(null)];

        // Kullanici bilgisi (paralel, sonucu beklenmez)
        axios.get(`${base}/users/me`, { headers }).then(r => {
          const u = r.data;
          if (u) {
            const fullName = [u.title, u.firstName, u.lastName].filter(Boolean).join(' ').trim();
            setCurrentUser({ name: fullName || u.email, title: u.title, role: u.role?.name });
          }
        }).catch(() => {});

        return Promise.all([...projectCalls, ...bibCalls]);
      })
      .then((all) => {
        const [ov, rad, col, sdg, res, cord, tml, fnd, bud, extras, inst, peer] = all;
        setOverview(ov); setRadar(rad); setCollab(col); setSdgHeat(sdg);
        setResearchers(res); setCordisProjects(cord || []);
        setTimeline(tml || []); setFunding(fnd); setBudget(bud);
        setReportExtras(extras);
        setInstitutional(inst); setPeerBench(peer);
      })
      .catch(() => setError('Rapor hazırlanırken hata oluştu'))
      .finally(() => setLoading(false));
  }, []);

  // Ana veri geldiğinde AI narrative'ı iste (background, blocking değil)
  useEffect(() => {
    if (loading || error) return;
    if (!overview) return;
    if (narrative.preface) return;
    // Bibliyometri kapaliysa institutional veri yok - narrative yine cagrilabilir
    // (proje verisine dayali). Bibliyometri varsa o veriyi de ekle.
    const hasBib = bibliometricsEnabled && institutional;
    if (bibliometricsEnabled && !institutional) return; // bekleniyor

    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const token = localStorage.getItem('tto_token') || '';
    if (!token) return;
    const headers = { Authorization: 'Bearer ' + token };

    const byYear: any[] = (hasBib && institutional?.byYear) || [];
    const lastYearPt = byYear.length >= 1 ? byYear[byYear.length - 1] : null;
    const prevYearPt = byYear.length >= 2 ? byYear[byYear.length - 2] : null;
    const pubGrowth = lastYearPt && prevYearPt && prevYearPt.count > 0
      ? Math.round(((lastYearPt.count - prevYearPt.count) / prevYearPt.count) * 100)
      : null;

    const qTotal = hasBib
      ? ['Q1','Q2','Q3','Q4','unknown'].reduce((x: number, k: string) => x + (institutional.quartileDistribution?.[k] || 0), 0)
      : 0;
    const topFac = radar.length > 0 ? [...radar].sort((a: any, b: any) => b.successRate - a.successRate)[0]?.faculty : undefined;
    const mkuPeer = peerBench?.peers?.find((p: any) => p.isMku);
    const mkuRank = mkuPeer && peerBench?.peers
      ? peerBench.peers.filter((p: any) => p.worksCount > mkuPeer.worksCount).length + 1
      : undefined;

    setNarrativeLoading(true);
    axios.post(`${base}/ai/annual-report-narrative`, {
      year,
      siteName,
      bibliometricsEnabled: hasBib,
      totalProjects: overview.total || 0,
      activeProjects: overview.activeProjects || 0,
      completedProjects: overview.completedProjects || 0,
      successRate: overview.successRate || 0,
      totalBudget: overview.totalBudget || 0,
      totalPublications: hasBib ? (institutional.total || 0) : null,
      totalCitations: hasBib ? (institutional.totalCitations || 0) : null,
      hIndex: hasBib ? (institutional.hIndex || 0) : null,
      avgFwci: hasBib ? institutional.avgFwci : null,
      top1PctCount: hasBib ? (institutional.top1PctCount || 0) : null,
      top10PctCount: hasBib ? (institutional.top10PctCount || 0) : null,
      openAccessRatio: hasBib ? (institutional.openAccessRatio || 0) : null,
      q1Count: hasBib ? (institutional.quartileDistribution?.Q1 || 0) : null,
      quartileTotal: hasBib ? (qTotal - (institutional.quartileDistribution?.unknown || 0)) : null,
      sdgCovered: new Set((sdgHeat?.cells || []).map((c: any) => c.sdgCode)).size,
      internationalCoauthorRatio: hasBib ? (institutional.internationalCoauthorRatio || 0) : null,
      pubGrowthPct: pubGrowth,
      topFaculty: topFac,
      peerRank: mkuPeer && peerBench?.peers ? { mkuWorks: mkuPeer.worksCount, peerCount: peerBench.peers.length, position: mkuRank } : undefined,
    }, { headers, timeout: 35000 })
      .then(r => setNarrative(r.data))
      .catch(() => {})
      .finally(() => setNarrativeLoading(false));
  }, [loading, error, institutional, overview, radar, sdgHeat, peerBench, siteName, year, narrative.preface, bibliometricsEnabled]);

  useEffect(() => {
    // Narrative tamamlandıktan (veya 6sn sonra) print tetikle
    if (!loading && !error && !narrativeLoading) {
      const t = setTimeout(() => window.print(), 1200);
      return () => clearTimeout(t);
    }
    // Narrative gelmezse 12 saniye sonra yine de print aç
    if (!loading && !error) {
      const fallback = setTimeout(() => window.print(), 12000);
      return () => clearTimeout(fallback);
    }
  }, [loading, error, narrativeLoading]);

  if (loading) return <div style={s.center}><p style={s.muted}>Kurumsal rapor hazırlanıyor... (~25 saniye)</p></div>;
  if (error) return <div style={s.center}><p style={s.err}>{error}</p></div>;

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
  const quartileKnown = quartileTotal - (institutional?.quartileDistribution?.unknown || 0);

  // Yillik buyume hesabi - guvenli array erisim
  const byYear: any[] = Array.isArray(institutional?.byYear) ? institutional.byYear : [];
  const latestYears = byYear.slice(-5);
  const lastYear = byYear.length >= 1 ? byYear[byYear.length - 1] : null;
  const prevYear = byYear.length >= 2 ? byYear[byYear.length - 2] : null;
  const pubGrowthPct = lastYear && prevYear && prevYear.count > 0
    ? Math.round(((lastYear.count - prevYear.count) / prevYear.count) * 100)
    : null;

  // Kurumsal yayın listesi - en çok atıf alanlar
  const instPublications: any[] = institutional?.publications || [];
  const topCited = [...instPublications]
    .sort((a, b) => (b?.citedBy?.best || 0) - (a?.citedBy?.best || 0))
    .slice(0, 15);

  // Q1 dergilerdeki yayınlar
  const q1Pubs = instPublications
    .filter(p => p?.quality?.sjrQuartile === 'Q1')
    .sort((a, b) => (b?.citedBy?.best || 0) - (a?.citedBy?.best || 0))
    .slice(0, 10);

  // Max bar scales
  const maxYearPub = Math.max(1, ...byYear.map(y => y.count || 0));
  const maxYearCit = Math.max(1, ...byYear.map(y => y.citations || 0));

  // Fakülte toplamları
  const totalFacultyProjects = radar.reduce((x, f: any) => x + (f.totalProjects || 0), 0);
  const totalIp = radar.reduce((x, f: any) => x + (f.ipCount || 0), 0);
  const totalMembers = radar.reduce((x, f: any) => x + (f.memberTotal || 0), 0);

  const totalEuBudget = cordisProjects.reduce((x, p: any) => x + (Number(p.ecMaxContribution) || 0), 0);

  // SDG listesi
  const sdgDist: any[] = institutional?.sdgDistribution || [];

  // Ülke işbirliği
  const countries: Array<{code: string; count: number}> = institutional?.countryCollaboration || [];
  const topCountries = countries.slice(0, 15);
  const totalIntlPubs = institutional?.internationalCoauthorCount || 0;

  // Top dergiler
  const topJournals: Array<{name: string; count: number}> = institutional?.topJournals || [];

  // Peer kıyaslama
  const peers: any[] = peerBench?.peers || [];
  const mkuPeer = peers.find(p => p.isMku);

  return (
    <>
      {/* Print-only page numbering via CSS counter */}
      <style>{`
        @page {
          size: A4;
          margin: 15mm 14mm 18mm 14mm;
          @bottom-right {
            content: "Sayfa " counter(page) " / " counter(pages);
            font-family: system-ui, sans-serif;
            font-size: 9pt;
            color: #6b7280;
          }
          @bottom-left {
            content: "${institutionName.replace(/"/g, '\\"')} · Yıllık Rapor ${year}";
            font-family: system-ui, sans-serif;
            font-size: 9pt;
            color: #9ca3af;
          }
        }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div style={s.page}>
        {/* Yazdırma kontrol bar */}
        <div className="no-print" style={s.toolbar}>
          <button onClick={() => window.print()} style={s.btnPrimary}>PDF olarak kaydet</button>
          <button onClick={() => window.close()} style={s.btnSecondary}>Kapat</button>
          <span style={s.tbHint}>
            {narrativeLoading ? 'AI yorumu hazırlanıyor…' : 'Sayfa hazır olunca otomatik print açılır'}
          </span>
        </div>

        {/* ═══ KAPAK ═══ */}
        <div style={{ ...s.section, ...s.coverPage }}>
          <div style={s.coverTop}>
            <div>
              <p style={s.coverDate}>{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style={s.coverInst}>{institutionName}</p>
            </div>
            <div style={s.coverLogoBox} aria-label="Kurum logosu">
              {logoUrl ? (
                <img src={logoUrl} alt={institutionName + ' logosu'} style={{ display: 'block', maxWidth: 60, maxHeight: 60, objectFit: 'contain' }} />
              ) : (
                <svg viewBox="0 0 60 60" width="60" height="60" style={{ display: 'block' }}>
                  <circle cx="30" cy="30" r="28" fill="none" stroke="#c8a45a" strokeWidth="1.5" />
                  <text x="30" y="36" textAnchor="middle" fill="#c8a45a" fontSize="18" fontWeight="700" fontFamily="system-ui">MKÜ</text>
                </svg>
              )}
            </div>
          </div>
          <div style={s.coverMid}>
            <h1 style={s.coverTitle}>
              YILLIK KURUMSAL<br/>
              {bibliometricsEnabled ? 'BİBLİYOMETRİ RAPORU' : 'FAALİYET RAPORU'}
            </h1>
            <p style={s.coverYear}>{year}</p>
            <p style={s.coverSubtitle}>
              {bibliometricsEnabled
                ? 'Proje portföyü, araştırma çıktıları, kurumsal karşılaştırma ve sürdürülebilir kalkınma katkısının çok kaynaklı değerlendirmesi'
                : 'Proje portföyü, fakülte performansı, fonlama, fikri mülkiyet ve sürdürülebilir kalkınma hedeflerine kurumsal katkı'}
            </p>
            {bibliometricsEnabled ? (
              <div style={s.coverFactBox}>
                <div><p style={s.coverFactNum}>{formatNum(overview?.total || 0)}</p><p style={s.coverFactLbl}>Proje</p></div>
                <div><p style={s.coverFactNum}>{formatNum(institutional?.total || 0)}</p><p style={s.coverFactLbl}>Yayın</p></div>
                <div><p style={s.coverFactNum}>{formatNum(institutional?.totalCitations || 0)}</p><p style={s.coverFactLbl}>Atıf</p></div>
                <div><p style={s.coverFactNum}>{institutional?.hIndex || 0}</p><p style={s.coverFactLbl}>h-index</p></div>
                <div><p style={s.coverFactNum}>{institutional?.twoYearMeanCitedness !== undefined ? (+institutional.twoYearMeanCitedness).toFixed(2) : '-'}</p><p style={s.coverFactLbl}>2yr Atıf Ort.</p></div>
                <div><p style={s.coverFactNum}>{sdgsCovered}/17</p><p style={s.coverFactLbl}>SKH</p></div>
              </div>
            ) : (
              <div style={{ ...s.coverFactBox, gridTemplateColumns: 'repeat(5, 1fr)' }}>
                <div><p style={s.coverFactNum}>{formatNum(overview?.total || 0)}</p><p style={s.coverFactLbl}>Proje</p></div>
                <div><p style={s.coverFactNum}>{formatNum(overview?.activeProjects || 0)}</p><p style={s.coverFactLbl}>Aktif</p></div>
                <div><p style={s.coverFactNum}>{formatNum(overview?.completedProjects || 0)}</p><p style={s.coverFactLbl}>Tamamlanan</p></div>
                <div><p style={s.coverFactNum}>{reportExtras?.ip?.total || 0}</p><p style={s.coverFactLbl}>Fikri Mülkiyet</p></div>
                <div><p style={s.coverFactNum}>{sdgsCovered}/17</p><p style={s.coverFactLbl}>SKH</p></div>
              </div>
            )}
          </div>
          <div style={s.coverBottom}>
            <p style={s.coverDataSrc}>
              {bibliometricsEnabled
                ? 'Veri kaynakları: Scopus · Web of Science · OpenAlex · Crossref · SCImago · Unpaywall · PubMed · arXiv · Semantic Scholar · CORDIS · EPO OPS'
                : 'Veri kaynakları: Kurumsal proje veri tabanı · CORDIS (AB projeleri) · Sistem audit kayıtları'}
            </p>
          </div>
        </div>

        {/* ═══ İÇİNDEKİLER ═══ - bibliyometri durumuna gore dinamik */}
        <div style={s.section}>
          <h2 style={s.h2}>İÇİNDEKİLER</h2>
          <ol style={s.toc}>
            <li>Önsöz</li>
            <li>Yönetici Özeti ve Ana Bulgular</li>
            <li>Proje Portföyü ve Durum Dağılımı</li>
            <li>Fakülte Performans Karşılaştırması</li>
            {bibliometricsEnabled && <li>Bibliyometrik Göstergeler (FWCI, Top 1%, Q1-Q4)</li>}
            {bibliometricsEnabled && <li>Yıllara Göre Yayın ve Atıf Trendi</li>}
            {bibliometricsEnabled && <li>Peer Üniversite Karşılaştırması</li>}
            {bibliometricsEnabled && <li>Uluslararası İşbirliği (Ülke Bazlı)</li>}
            {bibliometricsEnabled && <li>En Çok Atıf Alan Yayınlar</li>}
            {bibliometricsEnabled && <li>Q1 Dergi Yayınları</li>}
            {bibliometricsEnabled && <li>En Çok Yayın Yapılan Dergiler</li>}
            <li>Sürdürülebilir Kalkınma Hedeflerine Katkı</li>
            <li>Fakülteler Arası İşbirlikleri</li>
            <li>Uluslararası Fonlama (CORDIS - AB Projeleri)</li>
            <li>Bütçe Kullanımı ve Fonlama Başarısı</li>
            <li>Etik Kurul Süreçleri</li>
            <li>Fikri Mülkiyet Portföyü</li>
            <li>Sanayi ve Akademik Ortak Ağı</li>
            <li>Akademik Personel Demografisi</li>
            <li>Yıl İçinde Tamamlanan Önemli Projeler</li>
            <li>Proje Zaman Çizelgesi</li>
            <li>En Üretken Araştırmacılar</li>
            <li>Profesyonel Değerlendirme ve Gelecek Bakış</li>
            <li>Metodoloji ve Sınırlılıklar</li>
          </ol>
          {!bibliometricsEnabled && (
            <div style={{ marginTop: 10, padding: 8, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4 }}>
              <p style={{ ...s.pSmall, color: '#1e40af', margin: 0 }}>
                <strong>Bilgi:</strong> Sistem yöneticisi tarafından bibliyometri (yayın/atıf/h-index/SCImago) gösterimi
                kapatıldığı için bu rapor yalnızca proje, fakülte, fonlama ve sürdürülebilirlik göstergelerini içerir.
              </p>
            </div>
          )}
        </div>

        {/* ═══ 1. ÖNSÖZ ═══ */}
        {narrative.preface && (
          <div style={s.section}>
            <h2 style={s.h2}>1. ÖNSÖZ</h2>
            <div style={s.prefaceBox}>
              {narrative.preface.split('\n').filter(Boolean).map((para, i) => (
                <p key={i} style={s.prefacePara}>{para}</p>
              ))}
              <p style={s.prefaceSign}>- {institutionName} Teknoloji Transfer Ofisi · {year}</p>
            </div>
          </div>
        )}

        {/* ═══ 2. YÖNETİCİ ÖZETİ ═══ */}
        <div style={s.section}>
          <h2 style={s.h2}>2. YÖNETİCİ ÖZETİ VE ANA BULGULAR</h2>

          <div style={s.highlightBox}>
            <h3 style={s.highlightTitle}>Raporun Öne Çıkan Bulguları</h3>
            <ul style={s.highlightList}>
              <li>
                Toplamda <strong>{formatNum(overview?.total || 0)}</strong> proje izlenmekte olup,
                bunların <strong>{formatNum(overview?.activeProjects || 0)}</strong>'i aktif,
                <strong> {formatNum(overview?.completedProjects || 0)}</strong>'si tamamlanmıştır.
                Kararlaşan projeler üzerinde <strong>%{overview?.successRate || 0}</strong> başarı oranı
                elde edilmiştir.
              </li>

              {/* Bibliyometrik buletler - sadece aciksa */}
              {bibliometricsEnabled && institutional && (
                <>
                  <li>
                    Kurumumuz toplam <strong>{formatNum(institutional?.total || 0)}</strong> yayın
                    ve <strong>{formatNum(institutional?.totalCitations || 0)}</strong> atıfa sahiptir.
                    Kurumsal h-index <strong>{institutional?.hIndex || 0}</strong>, i10-index <strong>{formatNum(institutional?.i10Index || 0)}</strong>'dir.
                    {institutional?.twoYearMeanCitedness !== undefined && (
                      <> Son 2 yıllık ortalama atıf oranı <strong>{(+institutional.twoYearMeanCitedness).toFixed(2)}</strong>'dir
                      - bu değer {(+institutional.twoYearMeanCitedness) >= 1.5 ? 'global ortalamanın belirgin üstünde' : (+institutional.twoYearMeanCitedness) >= 1.0 ? 'global ortalamayla uyumlu' : 'global ortalamanın altında'}.</>
                    )}
                  </li>
                  <li style={{ fontSize: 10, color: '#78350f' }}>
                    <em>Not: Raporun FWCI, Top 1%/10%, açık erişim ve dergi kalite göstergeleri
                    kurumun en çok atıf alan {institutional?.sampleSize || 500} yayını üzerinden
                    örneklem bazlı hesaplanmıştır - doğal olarak kurumsal ortalamanın üstündedir.</em>
                  </li>
                  {pubGrowthPct !== null && (
                    <li>
                      Yayın üretimi bir önceki yıla göre <strong style={{ color: pubGrowthPct >= 0 ? '#059669' : '#dc2626' }}>
                        {pubGrowthPct >= 0 ? '+' : ''}%{pubGrowthPct}
                      </strong> değişim göstermiştir.
                    </li>
                  )}
                  <li>
                    Uluslararası ortak yazarlı yayın oranı <strong>%{institutional?.internationalCoauthorRatio || 0}</strong>
                    - toplam <strong>{(institutional?.countryCollaboration?.length || 0)}</strong> farklı ülkeyle işbirliği kurulmuştur.
                  </li>
                </>
              )}

              <li>
                Projeler <strong>{sdgsCovered}/17</strong> Sürdürülebilir Kalkınma Hedefi'ne değmekte;
                <strong> {facultyTotalSdg}</strong> fakülte-SKH eşlemesi tespit edilmiştir.
              </li>
              <li>
                Toplam bütçe <strong>{formatTry(overview?.totalBudget || 0)}</strong> olup
                proje başına ortalama <strong>{formatTry(overview?.avgBudget || 0)}</strong>'dir.
                {totalEuBudget > 0 && <> CORDIS kaynaklı AB fonlaması <strong>€{Number(totalEuBudget).toLocaleString('tr-TR')}</strong>'u bulmaktadır.</>}
              </li>

              {/* Yeni: rapor extras tabanli buletler */}
              {reportExtras?.ip?.total > 0 && (
                <li>
                  Kurum portföyünde <strong>{reportExtras.ip.total}</strong> projede fikri mülkiyet kaydı
                  bulunmakta; bunların <strong>{(reportExtras.ip.byStatus?.find((s: any) => s.key === 'registered')?.count) || 0}</strong>'i tescilli
                  durumdadır.
                </li>
              )}
              {reportExtras?.partners?.total > 0 && (
                <li>
                  Toplam <strong>{reportExtras.partners.total}</strong> farklı sanayi/akademik ortakla
                  <strong> {reportExtras.partners.totalLinks}</strong> proje düzeyinde işbirliği kurulmuştur.
                </li>
              )}
              {reportExtras?.ethics?.required > 0 && (
                <li>
                  Etik kurul gerektiren <strong>{reportExtras.ethics.required}</strong> projeden
                  <strong> {reportExtras.ethics.approved}</strong>'i onaylanmış,
                  <strong> {reportExtras.ethics.pending}</strong>'i süreçtedir.
                </li>
              )}
              {reportExtras?.completedThisYear?.length > 0 && (
                <li>
                  {year} yılı içinde <strong>{reportExtras.completedThisYear.length}</strong> proje
                  başarıyla tamamlanmıştır.
                </li>
              )}
            </ul>
          </div>

          {overview && (
            <>
              <h3 style={s.h3}>Ana Göstergeler</h3>
              <div style={s.kpiGrid}>
                <Kpi label="Toplam Proje" value={formatNum(overview.total || 0)} color="#1a3a6b" />
                <Kpi label="Aktif Proje" value={formatNum(overview.activeProjects || 0)} color="#059669" />
                <Kpi label="Tamamlanan" value={formatNum(overview.completedProjects || 0)} color="#2563eb" />
                <Kpi label="Toplam Bütçe" value={formatTry(overview.totalBudget || 0)} color="#c8a45a" />
                <Kpi label="Başarı Oranı" value={`%${overview.successRate || 0}`} color="#7c3aed" sub="kararlaşan" />
                <Kpi label="Ortalama Bütçe" value={formatTry(overview.avgBudget || 0)} color="#0891b2" />
              </div>
            </>
          )}

          {bibliometricsEnabled && institutional && institutional.configured !== false && (
            <>
              <h3 style={s.h3}>Kurumsal Akademik Çıktı (OpenAlex kurum endpoint - TÜM yayınlar)</h3>
              <div style={s.kpiGrid}>
                <Kpi label="Toplam Yayın" value={formatNum(institutional.total || 0)} color="#1a3a6b" />
                <Kpi label="Toplam Atıf" value={formatNum(institutional.totalCitations || 0)} color="#7c3aed" />
                <Kpi label="h-index" value={institutional.hIndex || 0} color="#c8a45a" />
                <Kpi label="i10-index" value={formatNum(institutional.i10Index || 0)} color="#059669" />
                {institutional.twoYearMeanCitedness !== undefined && (
                  <Kpi label="2 Yıllık Ort. Atıf" value={(+institutional.twoYearMeanCitedness).toFixed(2)} color="#0891b2" sub="OpenAlex kurum metriği" />
                )}
              </div>

              <div style={{ marginTop: 14, padding: 10, background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: 4 }}>
                <p style={{ ...s.pSmall, color: '#92400e', margin: 0 }}>
                  <strong>⚠ Aşağıdaki metrikler örneklem bazlıdır.</strong> Kurumumuzun en çok atıf alan
                  {' '}{institutional.sampleSize || 500} yayını üzerinden hesaplanmıştır. Bu yüzden FWCI,
                  Top 1%/10%, açık erişim oranı ve kalite dağılımı gerçek kurumsal ortalamanın üstünde
                  görünür - sample yayınlar doğal olarak üst-tier'dandır.
                </p>
              </div>

              <h3 style={s.h3}>Örneklem Bazlı Göstergeler (top {institutional.sampleSize || 500} yayın)</h3>
              <div style={s.kpiGrid}>
                <Kpi label="Sample Açık Erişim" value={`%${institutional.openAccessRatio || 0}`} sub={`${formatNum(institutional.openAccessCount || 0)} yayın`} color="#0891b2" />
                <Kpi label="Q1 (sample)" value={formatNum(institutional.quartileDistribution?.Q1 || 0)} color="#059669" sub={`%${quartileKnown > 0 ? Math.round(((institutional.quartileDistribution?.Q1 || 0) / quartileKnown) * 100) : 0}`} />
                <Kpi label="Örnek. Ort. FWCI" value={institutional.avgFwci !== null && institutional.avgFwci !== undefined ? institutional.avgFwci : '-'} color="#7c3aed" sub="sample üst-tier" />
                <Kpi label="Örnek. Top 1%" value={formatNum(institutional.top1PctCount || 0)} color="#059669" sub={`sample ${institutional.sampleSize || 500}'de`} />
                <Kpi label="Örnek. Top 10%" value={formatNum(institutional.top10PctCount || 0)} color="#2563eb" sub={`sample ${institutional.sampleSize || 500}'de`} />
                <Kpi label="Uluslararası Ortaklık" value={`%${institutional.internationalCoauthorRatio || 0}`} color="#c8a45a" sub={`${formatNum(institutional.internationalCoauthorCount || 0)} sample yayın`} />
              </div>
            </>
          )}
        </div>

        {/* ═══ 3. PROJE DURUMU ═══ */}
        {overview && (
          <div style={s.section}>
            <h2 style={s.h2}>3. PROJE PORTFÖYÜ VE DURUM DAĞILIMI</h2>
            <p style={s.p}>
              Proje portföyü, başvuru aşamasından iptal edilenlere kadar tüm durumlardaki kayıtları kapsamaktadır.
              Aktif proje sayısı kurumun mevcut araştırma kapasitesini, tamamlanan proje sayısı ise üretkenliği gösterir.
            </p>

            <h3 style={s.h3}>Durum Dağılımı</h3>
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

            {overview.byType && overview.byType.length > 0 && (
              <>
                <h3 style={s.h3}>Proje Türüne Göre Dağılım</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Proje Türü</th>
                      <th style={s.thR}>Adet</th>
                      <th style={s.thR}>Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.byType.map((t: any) => (
                      <tr key={t.type}>
                        <td style={s.td}>{typeTr(t.type)}</td>
                        <td style={s.tdR}>{t.count}</td>
                        <td style={s.tdR}>%{overview.total > 0 ? Math.round((t.count / overview.total) * 100) : 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ═══ 4. FAKÜLTE KARŞILAŞTIRMASI ═══ */}
        {radar.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>4. FAKÜLTE PERFORMANS KARŞILAŞTIRMASI</h2>
            <p style={s.p}>
              Fakülteler 6 boyutta değerlendirildi: Proje Ölçeği, Bütçe, Başarı, SDG Kapsamı, Fikri Mülkiyet, Etik Uyum.
              Aşağıdaki tabloda her fakültenin tüm göstergeleri yan yana verilmiş; takip eden kartlarda ise başarı oranında
              öne çıkan üç fakülte detaylandırılmıştır.
            </p>

            <h3 style={s.h3}>Tüm Fakülteler - Karşılaştırmalı Görünüm</h3>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Fakülte</th>
                  <th style={s.thR}>Proje</th>
                  <th style={s.thR}>Aktif</th>
                  <th style={s.thR}>Tamam.</th>
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
                <tr style={{ background: '#f8f6f0', fontWeight: 700 }}>
                  <td style={s.td}>TOPLAM</td>
                  <td style={s.tdR}>{totalFacultyProjects}</td>
                  <td style={s.tdR}>{radar.reduce((x, f: any) => x + (f.activeProjects || 0), 0)}</td>
                  <td style={s.tdR}>{radar.reduce((x, f: any) => x + (f.completedProjects || 0), 0)}</td>
                  <td style={s.tdR}>-</td>
                  <td style={s.tdR}>{formatTry(radar.reduce((x, f: any) => x + (f.totalBudget || 0), 0))}</td>
                  <td style={s.tdR}>{sdgsCovered}/17</td>
                  <td style={s.tdR}>{totalIp}</td>
                  <td style={s.tdR}>{radar.reduce((x, f: any) => x + (f.ethicsApprovedCount || 0), 0)}</td>
                  <td style={s.tdR}>{totalMembers}</td>
                </tr>
              </tbody>
            </table>

            <h3 style={s.h3}>Başarı Oranında Öne Çıkan Fakülteler</h3>
            <div style={s.facultyCards}>
              {[...radar].sort((a: any, b: any) => b.successRate - a.successRate).slice(0, 3).map((f: any, i: number) => (
                <div key={f.faculty} style={s.facultyCard}>
                  <p style={s.facultyRank}>#{i + 1}</p>
                  <p style={s.facultyName}>{f.faculty}</p>
                  <div style={s.facultyGrid}>
                    <div><p style={s.facultyVal}>%{f.successRate}</p><p style={s.facultyLbl}>Başarı</p></div>
                    <div><p style={s.facultyVal}>{f.completedProjects}</p><p style={s.facultyLbl}>Tamamlanan</p></div>
                    <div><p style={s.facultyVal}>{f.totalProjects}</p><p style={s.facultyLbl}>Toplam</p></div>
                    <div><p style={s.facultyVal}>{f.ipCount}</p><p style={s.facultyLbl}>IP</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ 5. BİBLİYOMETRİK GÖSTERGELER ═══ */}
        {bibliometricsEnabled && institutional && institutional.configured !== false && (
          <div style={s.section}>
            <h2 style={s.h2}>5. BİBLİYOMETRİK GÖSTERGELER (FWCI, TOP 1%, Q1-Q4)</h2>
            <p style={s.p}>
              Kurumumuzun OpenAlex kaynağından çekilen yayın havuzu üzerinden hesaplanmıştır.
              <strong> FWCI</strong> (Field-Weighted Citation Impact), atıf sayısını yayının alanına ve
              yayımlandığı yıla göre normalize eder - 1.00 global ortalamadır. 2.00 değeri,
              yayının alanı ve yılı için beklenenin iki katı atıf aldığı anlamına gelir.
              <strong> Top 1%</strong> ve <strong>Top 10%</strong> yayınlar, alan-yıl normalize sıralamasında
              en yüksek yüzdelikte olanlardır.
            </p>

            {quartileTotal > 0 && (
              <>
                <h3 style={s.h3}>Dergi Kalite Dağılımı (SCImago SJR)</h3>
                {quartileData.map(q => {
                  const key = q.name === 'Bilinmiyor' ? 'unknown' : q.name;
                  const pct = quartileTotal > 0 ? (q.value / quartileTotal) * 100 : 0;
                  return (
                    <div key={q.name} style={s.statusRow}>
                      <span style={{ ...s.statusLabel, color: QUARTILE_COLORS[key] || '#94a3b8' }}>{q.name}</span>
                      <div style={s.barTrack}>
                        <div style={{ ...s.barFill, width: `${pct}%`, background: QUARTILE_COLORS[key] || '#94a3b8' }} />
                      </div>
                      <span style={s.statusCount}>{q.value}</span>
                      <span style={s.statusPct}>%{Math.round(pct)}</span>
                    </div>
                  );
                })}
                <p style={s.pSmall}>
                  <em>Yorum: Q1+Q2 payı akademik üretim kalitesinin en temel göstergesidir.
                  "Bilinmiyor" kategorisi, derginin ISSN eşleşmesinin SCImago kapsamında bulunamadığı yayınları içerir.</em>
                </p>
              </>
            )}

            {institutional.avgFwci !== null && institutional.avgFwci !== undefined && (
              <div style={{ marginTop: 12, padding: 10, background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd' }}>
                <p style={{ ...s.pSmall, color: '#1e40af', margin: 0 }}>
                  <strong>FWCI yorumu:</strong> Ortalama {institutional.avgFwci},
                  {institutional.avgFwci >= 1.5 ? ' global ortalamanın belirgin üzerinde - güçlü akademik etki.' :
                   institutional.avgFwci >= 1.0 ? ' global ortalamayla uyumlu - makul akademik etki.' :
                   ' global ortalamanın altında - seçici yayın stratejisi önerilir.'}
                  {' '}FWCI verisi mevcut yayın: <strong>{institutional.fwciCoverage || 0}</strong> / {institutional.total || 0}.
                </p>
              </div>
            )}

            {/* Yayın Türüne Göre Dağılım */}
            {institutional.typeDistribution && institutional.typeDistribution.length > 0 && (
              <>
                <h3 style={s.h3}>Yayın Türüne Göre Dağılım (sample)</h3>
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
                    {institutional.typeDistribution.map((t: any) => {
                      const totalSample = institutional.typeDistribution.reduce((x: number, y: any) => x + y.count, 0);
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
                <p style={s.pSmall}>
                  <em>Yayın türü OpenAlex'in tespit ettiği kategorilere göre - makale, kitap, kitap bölümü,
                  tez, ön baskı, bildiri, inceleme, rapor vs. Bu tablo en çok atıf alan {institutional.sampleSize || 500}
                  yayın sample'ı içindeki dağılımı gösterir; kurum geneli dağılımı bunun farklı olabilir.</em>
                </p>
              </>
            )}
          </div>
        )}

        {/* ═══ 6. YILLIK TREND ═══ */}
        {bibliometricsEnabled && byYear.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>6. YILLARA GÖRE YAYIN VE ATIF TRENDİ</h2>
            <p style={s.p}>
              {byYear[0]?.year}-{byYear[byYear.length - 1]?.year} aralığındaki yıllık yayın sayısı ve
              bu yayınların güncel toplam atıflarının dağılımı. Her yayın ilk yayımlandığı yılda sayılır;
              atıflar o yayının bugüne kadar aldığı toplamdır.
            </p>

            <h3 style={s.h3}>Yıllık Yayın Sayısı</h3>
            <div style={s.trendChart}>
              {byYear.map(y => {
                const h = maxYearPub > 0 ? (y.count / maxYearPub) * 100 : 0;
                return (
                  <div key={y.year} style={s.trendBarCol}>
                    <div style={s.trendBarWrap}>
                      <span style={s.trendVal}>{y.count}</span>
                      <div style={{ ...s.trendBar, height: `${h}%`, background: '#1a3a6b' }} />
                    </div>
                    <p style={s.trendYear}>{y.year}</p>
                  </div>
                );
              })}
            </div>

            <h3 style={s.h3}>Yıllık Atıf Birikimi</h3>
            <div style={s.trendChart}>
              {byYear.map(y => {
                const h = maxYearCit > 0 ? (y.citations / maxYearCit) * 100 : 0;
                return (
                  <div key={y.year} style={s.trendBarCol}>
                    <div style={s.trendBarWrap}>
                      <span style={s.trendVal}>{y.citations}</span>
                      <div style={{ ...s.trendBar, height: `${h}%`, background: '#c8a45a' }} />
                    </div>
                    <p style={s.trendYear}>{y.year}</p>
                  </div>
                );
              })}
            </div>

            {latestYears.length > 1 && (
              <>
                <h3 style={s.h3}>Son 5 Yılın Ayrıntısı</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Yıl</th>
                      <th style={s.thR}>Yayın</th>
                      <th style={s.thR}>Atıf</th>
                      <th style={s.thR}>Yayın Değişimi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestYears.map((y, i) => {
                      const prev = i > 0 ? latestYears[i - 1] : null;
                      const pubChange = prev && prev.count > 0 ? Math.round(((y.count - prev.count) / prev.count) * 100) : null;
                      return (
                        <tr key={y.year}>
                          <td style={s.td}>{y.year}</td>
                          <td style={s.tdR}>{y.count}</td>
                          <td style={s.tdR}>{y.citations}</td>
                          <td style={s.tdR}>
                            {pubChange === null ? '-' : <span style={{ color: pubChange >= 0 ? '#059669' : '#dc2626' }}>
                              {pubChange >= 0 ? '+' : ''}%{pubChange}
                            </span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Her yılın en çok atıf alan örnek yayınları */}
                {latestYears.slice().reverse().slice(0, 3).map((y) => {
                  const yearPubs = instPublications
                    .filter((p: any) => p.year === y.year)
                    .sort((a: any, b: any) => (b?.citedBy?.best || 0) - (a?.citedBy?.best || 0))
                    .slice(0, 5);
                  if (yearPubs.length === 0) return null;
                  return (
                    <div key={y.year} style={{ marginTop: 14, pageBreakInside: 'avoid' }}>
                      <h3 style={s.h3}>{y.year} Yılının En Çok Atıf Alan Yayınları (örnek)</h3>
                      <table style={s.table}>
                        <thead>
                          <tr>
                            <th style={s.th}>#</th>
                            <th style={s.th}>Başlık</th>
                            <th style={s.th}>Dergi</th>
                            <th style={s.thR}>Q</th>
                            <th style={s.thR}>Atıf</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yearPubs.map((p: any, i: number) => (
                            <tr key={p.doi || i}>
                              <td style={s.td}>{i + 1}</td>
                              <td style={s.tdSmall}>{p.title}</td>
                              <td style={s.tdSmall}>{p.journal || '-'}</td>
                              <td style={s.tdR}>
                                {p.quality?.sjrQuartile ? (
                                  <span style={{ ...s.qBadge, background: QUARTILE_COLORS[p.quality.sjrQuartile] }}>
                                    {p.quality.sjrQuartile}
                                  </span>
                                ) : '-'}
                              </td>
                              <td style={{ ...s.tdR, fontWeight: 700 }}>{p.citedBy?.best || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ═══ 7. PEER BENCHMARK ═══ */}
        {bibliometricsEnabled && peers.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>7. PEER ÜNİVERSİTE KARŞILAŞTIRMASI</h2>
            <p style={s.p}>
              Kurumumuzun bölgesel ve benzer ölçekli peer üniversitelerle OpenAlex verileri üzerinden
              karşılaştırması. 2yr_mean_citedness sütunu, derginin son 2 yılında ortalama atıf katsayısını gösterir.
              Satır koyu renkli ise MKÜ'nün pozisyonudur.
            </p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Kurum</th>
                  <th style={s.thR}>Toplam Yayın</th>
                  <th style={s.thR}>Toplam Atıf</th>
                  <th style={s.thR}>h-index</th>
                  <th style={s.thR}>2yr Mean Cit.</th>
                  <th style={s.thR}>Son Yıl Yayın</th>
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
                    <td style={s.tdR}>{p.worksLastYear || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mkuPeer && (
              <p style={s.pSmall}>
                <em>
                  MKÜ, {peers.length} kurumluk peer setinde toplam yayın sayısında
                  <strong> {peers.filter(p => p.worksCount > mkuPeer.worksCount).length + 1}. sırada</strong> yer almaktadır.
                  {peerBench?.note && <> {peerBench.note}</>}
                </em>
              </p>
            )}
          </div>
        )}

        {/* ═══ 8. ULUSLARARASI İŞBİRLİĞİ ═══ */}
        {bibliometricsEnabled && topCountries.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>8. ULUSLARARASI İŞBİRLİĞİ (ÜLKE BAZLI)</h2>
            <p style={s.p}>
              Kurumumuzun yayın havuzunda ortak yazarlık kurulan ülkeler ve bunların üretken işbirliği sayıları.
              Toplam <strong>{formatNum(totalIntlPubs)}</strong> yayında en az bir yabancı ülke ortaklığı bulunmakta;
              işbirliği kurulan farklı ülke sayısı <strong>{countries.length}</strong>'dir.
            </p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Ülke</th>
                  <th style={s.thR}>Ortak Yayın</th>
                  <th style={s.thR}>Pay</th>
                </tr>
              </thead>
              <tbody>
                {topCountries.map((c, i) => (
                  <tr key={c.code}>
                    <td style={s.td}>{i + 1}</td>
                    <td style={s.td}>
                      <span style={{ marginRight: 6 }}>{countryFlag(c.code)}</span>
                      {countryName(c.code)} <span style={{ color: '#9ca3af', fontSize: 9 }}>({c.code})</span>
                    </td>
                    <td style={{ ...s.tdR, fontWeight: 700 }}>{c.count}</td>
                    <td style={s.tdR}>%{totalIntlPubs > 0 ? Math.round((c.count / totalIntlPubs) * 100) : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={s.pSmall}>
              <em>Yorum: İlk sıradaki ülkelerle derin işbirliği, öncelikli mobilite ve ortak proje
              programlarının hedefi olmalıdır. Çeşitlilik (farklı ülke sayısı) kurumun küresel görünürlüğünü,
              yoğunluk ise stratejik ortaklıkları gösterir.</em>
            </p>

            {/* İlk 5 ülke için ortak yayın örnekleri */}
            {topCountries.slice(0, 5).map((c) => {
              const pubs = instPublications
                .filter((p: any) => Array.isArray(p.countries) && p.countries.includes(c.code))
                .sort((a: any, b: any) => (b?.citedBy?.best || 0) - (a?.citedBy?.best || 0))
                .slice(0, 5);
              if (pubs.length === 0) return null;
              return (
                <div key={c.code} style={{ marginTop: 14, pageBreakInside: 'avoid' }}>
                  <h3 style={s.h3}>
                    <span style={{ marginRight: 6 }}>{countryFlag(c.code)}</span>
                    {countryName(c.code)} - En Çok Atıf Alan Ortak Yayınlar
                  </h3>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>#</th>
                        <th style={s.th}>Başlık</th>
                        <th style={s.th}>Dergi</th>
                        <th style={s.thR}>Yıl</th>
                        <th style={s.thR}>Atıf</th>
                      </tr>
                    </thead>
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

        {/* ═══ 9. EN ÇOK ATIF ALAN YAYINLAR ═══ */}
        {bibliometricsEnabled && topCited.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>9. EN ÇOK ATIF ALAN YAYINLAR (TOP {topCited.length})</h2>
            <p style={s.p}>
              Kurumumuzun bugüne kadarki en etkili çalışmaları - atıf sayısına göre sıralı.
              Her yayının yayımlandığı dergi ve Q kademesi ile birlikte listelendi.
            </p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Başlık</th>
                  <th style={s.th}>Dergi</th>
                  <th style={s.thR}>Yıl</th>
                  <th style={s.thR}>Q</th>
                  <th style={s.thR}>Atıf</th>
                </tr>
              </thead>
              <tbody>
                {topCited.map((p, i) => (
                  <tr key={p.doi || i}>
                    <td style={s.td}>{i + 1}</td>
                    <td style={s.tdSmall}>{p.title}</td>
                    <td style={s.tdSmall}>{p.journal || '-'}</td>
                    <td style={s.tdR}>{p.year || '-'}</td>
                    <td style={s.tdR}>
                      {p.quality?.sjrQuartile ? (
                        <span style={{ ...s.qBadge, background: QUARTILE_COLORS[p.quality.sjrQuartile] }}>
                          {p.quality.sjrQuartile}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ ...s.tdR, fontWeight: 700 }}>{p.citedBy?.best || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ 10. Q1 DERGİ YAYINLARI ═══ */}
        {bibliometricsEnabled && q1Pubs.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>10. Q1 DERGİ YAYINLARI (İLK {q1Pubs.length})</h2>
            <p style={s.p}>
              SCImago SJR sıralamasında ilk %25'te yer alan dergilerde yayımlanan çalışmalar -
              kurumumuzun yüksek kaliteli yayın ürettiği alanları gösterir.
            </p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Başlık</th>
                  <th style={s.th}>Dergi</th>
                  <th style={s.thR}>Yıl</th>
                  <th style={s.thR}>Atıf</th>
                  <th style={s.thR}>OA</th>
                </tr>
              </thead>
              <tbody>
                {q1Pubs.map((p, i) => (
                  <tr key={p.doi || i}>
                    <td style={s.td}>{i + 1}</td>
                    <td style={s.tdSmall}>{p.title}</td>
                    <td style={s.tdSmall}>{p.journal || '-'}</td>
                    <td style={s.tdR}>{p.year || '-'}</td>
                    <td style={{ ...s.tdR, fontWeight: 700 }}>{p.citedBy?.best || 0}</td>
                    <td style={s.tdR}>{p.openAccess?.isOa ? 'Açık' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ 11. TOP DERGİLER ═══ */}
        {bibliometricsEnabled && topJournals.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>11. EN ÇOK YAYIN YAPILAN DERGİLER (TOP {Math.min(topJournals.length, 15)})</h2>
            <p style={s.p}>
              Kurum araştırmasının dergi konsantrasyonu - üst sıralardaki derginin payı, araştırma odağının
              ne ölçüde belirli bir akademik topluluğa bağlı olduğunu gösterir.
            </p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Dergi</th>
                  <th style={s.thR}>Yayın</th>
                  <th style={s.thR}>Toplam Pay</th>
                </tr>
              </thead>
              <tbody>
                {topJournals.slice(0, 15).map((j, i) => (
                  <tr key={j.name}>
                    <td style={s.td}>{i + 1}</td>
                    <td style={s.tdSmall}>{j.name}</td>
                    <td style={{ ...s.tdR, fontWeight: 700 }}>{j.count}</td>
                    <td style={s.tdR}>%{institutional?.total > 0 ? Math.round((j.count / institutional.total) * 1000) / 10 : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ 12. SKH KATKISI ═══ */}
        {((sdgHeat && sdgHeat.sdgs?.length > 0) || (bibliometricsEnabled && sdgDist.length > 0)) && (
          <div style={s.section}>
            <h2 style={s.h2}>12. SÜRDÜRÜLEBİLİR KALKINMA HEDEFLERİNE KATKI</h2>
            <p style={s.p}>
              BM'nin 17 Sürdürülebilir Kalkınma Hedefi'nden kurumumuz projeleri
              <strong> {sdgsCovered}/17</strong> hedefe değmektedir.
              {bibliometricsEnabled && ' Ek olarak OpenAlex yayın tabanlı analiz, araştırmaların hangi SKH\'lere yönelik olduğunu tespit eder.'}
            </p>

            {sdgHeat?.sdgs?.length > 0 && (
              <>
                <h3 style={s.h3}>Proje Tabanlı SDG Dağılımı</h3>
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
              </>
            )}

            {bibliometricsEnabled && sdgDist.length > 0 && (
              <>
                <h3 style={s.h3}>Yayın Tabanlı SKH Katkısı (İlk 10)</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th>
                      <th style={s.th}>SDG</th>
                      <th style={s.thR}>Yayın</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sdgDist.slice(0, 10).map((sd: any, i: number) => {
                      const num = parseInt(sd.id?.match(/\d+/)?.[0] || String(i + 1));
                      const color = SDG_COLORS[(num - 1) % SDG_COLORS.length];
                      return (
                        <tr key={sd.id}>
                          <td style={s.td}>
                            <span style={{ ...s.sdgNumSmall, background: color }}>{num}</span>
                          </td>
                          <td style={s.td}>{sd.name}</td>
                          <td style={{ ...s.tdR, fontWeight: 700 }}>{sd.count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            {/* Her SDG'ye değen projelerin detayı - en yoğun 5 SDG */}
            {sdgHeat?.cells?.length > 0 && (() => {
              // SDG başına proje listesi
              const sdgToProjects = new Map<string, any[]>();
              for (const c of sdgHeat.cells) {
                const cur = sdgToProjects.get(c.sdgCode) || [];
                if (Array.isArray(c.projects)) cur.push(...c.projects);
                sdgToProjects.set(c.sdgCode, cur);
              }
              const topSdgs = (sdgHeat.sdgs || []).slice().sort((a: string, b: string) => {
                const ca = (sdgToProjects.get(a) || []).length;
                const cb = (sdgToProjects.get(b) || []).length;
                return cb - ca;
              }).slice(0, 5);
              return topSdgs.map((sdg: string) => {
                const projs = sdgToProjects.get(sdg) || [];
                if (projs.length === 0) return null;
                const num = parseInt(sdg.match(/\d+/)?.[0] || '0');
                const color = SDG_COLORS[(num - 1) % SDG_COLORS.length];
                // Deduplike
                const uniq = Array.from(new Map(projs.map(p => [p.id, p])).values()).slice(0, 10);
                return (
                  <div key={sdg} style={{ marginTop: 14, pageBreakInside: 'avoid' }}>
                    <h3 style={s.h3}>
                      <span style={{ ...s.sdgNumSmall, background: color, marginRight: 6 }}>{num}</span>
                      SKH {num} - Projeler ({projs.length} katkı)
                    </h3>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>#</th>
                          <th style={s.th}>Proje</th>
                          <th style={s.th}>Yürütücü</th>
                          <th style={s.th}>Fakülte / Bölüm</th>
                          <th style={s.thR}>Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uniq.map((p: any, i: number) => (
                          <tr key={p.id || i}>
                            <td style={s.td}>{i + 1}</td>
                            <td style={s.tdSmall}>{p.name}</td>
                            <td style={s.tdSmall}>{p.owner || '-'}</td>
                            <td style={s.tdSmall}>
                              {p.faculty || '-'}
                              {p.department && <span style={{ color: '#6b7280' }}> / {p.department}</span>}
                            </td>
                            <td style={s.tdR}>{statusTr(p.status)}</td>
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

        {/* ═══ 13. İŞBİRLİKLERİ ═══ */}
        {collab && collab.cells?.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>13. FAKÜLTELER ARASI İŞBİRLİKLERİ</h2>
            <p style={s.p}>
              Aynı projede farklı fakültelerden üyeler - kurum içi disiplinlerarası işbirliğinin
              en doğrudan göstergesi.
            </p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Fakülte A</th>
                  <th style={s.th}>Fakülte B</th>
                  <th style={s.thR}>Ortak Proje</th>
                </tr>
              </thead>
              <tbody>
                {collab.cells.slice(0, 20).map((c: any, i: number) => (
                  <tr key={i}>
                    <td style={s.td}>{i + 1}</td>
                    <td style={s.td}>{c.facultyA}</td>
                    <td style={s.td}>{c.facultyB}</td>
                    <td style={{ ...s.tdR, fontWeight: 700 }}>{c.sharedProjects}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* İlk 5 işbirliği çifti için proje detayı */}
            {collab.cells.slice(0, 5).map((c: any, idx: number) => {
              if (!c.projects || c.projects.length === 0) return null;
              return (
                <div key={`pair-${idx}`} style={{ marginTop: 14, pageBreakInside: 'avoid' }}>
                  <h3 style={s.h3}>
                    {c.facultyA} ↔ {c.facultyB} - Ortak Projeler ({c.sharedProjects})
                  </h3>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>#</th>
                        <th style={s.th}>Proje</th>
                        <th style={s.th}>Yürütücü</th>
                        <th style={s.th}>Diğer Ortak Yürütücüler</th>
                        <th style={s.thR}>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.projects.slice(0, 10).map((p: any, i: number) => {
                        const others = (p.collaborators || [])
                          .filter((x: any) => x.faculty === c.facultyA || x.faculty === c.facultyB)
                          .map((x: any) => `${x.name} (${x.faculty})`)
                          .slice(0, 4)
                          .join(', ');
                        return (
                          <tr key={p.id || i}>
                            <td style={s.td}>{i + 1}</td>
                            <td style={s.tdSmall}>{p.name}</td>
                            <td style={s.tdSmall}>
                              {p.owner || '-'}
                              {p.ownerFaculty && <span style={{ color: '#6b7280' }}> · {p.ownerFaculty}</span>}
                            </td>
                            <td style={s.tdSmall}>{others || '-'}</td>
                            <td style={s.tdR}>{statusTr(p.status)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ 14. AB PROJELERİ ═══ */}
        {cordisProjects.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>14. ULUSLARARASI FONLAMA (CORDIS - AB)</h2>
            <p style={s.p}>
              Kurumumuzun katıldığı AB araştırma projeleri - Horizon Europe, Horizon 2020, FP7 programları.
              Toplam AB katkısı: <strong>€{Number(totalEuBudget).toLocaleString('tr-TR')}</strong>.
            </p>
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
                {cordisProjects.slice(0, 15).map((p: any) => (
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

        {/* ═══ 15. BÜTÇE VE FONLAMA ═══ */}
        {(funding || budget) && (
          <div style={s.section}>
            <h2 style={s.h2}>15. BÜTÇE KULLANIMI VE FONLAMA BAŞARISI</h2>
            <p style={s.p}>
              Projelerin bütçe tüketim oranları ile fonlama kaynaklarına göre başarı oranları.
            </p>

            {budget?.byProject && budget.byProject.length > 0 && (
              <>
                <h3 style={s.h3}>En Yüksek Bütçeli Aktif 10 Proje</h3>
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
                    {budget.byProject.slice(0, 10).map((p: any) => (
                      <tr key={p.id}>
                        <td style={s.tdSmall}>{p.name || p.title}</td>
                        <td style={s.tdR}>{formatTry(p.budget || 0)}</td>
                        <td style={s.tdR}>{formatTry(p.spent || 0)}</td>
                        <td style={{ ...s.tdR, fontWeight: 700 }}>%{p.utilizationPct || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {funding?.bySource && funding.bySource.length > 0 && (
              <>
                <h3 style={s.h3}>Fonlama Kaynağına Göre Başarı</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Kaynak</th>
                      <th style={s.thR}>Başvuru</th>
                      <th style={s.thR}>Kabul</th>
                      <th style={s.thR}>Başarı Oranı</th>
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
              </>
            )}
          </div>
        )}

        {/* ═══ ETİK KURUL SÜREÇLERİ - GENİŞLETİLMİŞ ═══ */}
        {reportExtras?.ethics && reportExtras.ethics.total > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>16. ETİK KURUL SÜREÇLERİ</h2>
            <p style={s.p}>
              Kurum projelerinin etik kurul süreçlerine girip girmediği, onay durumu, fakülte ve proje
              türü bazlı detaylar ile bekleyen kritik başvurular. Etik onay, özellikle insan ve hayvan denek
              içeren çalışmalar ile sosyal araştırmalar için yasal bir gerekliliktir.
            </p>

            <h3 style={s.h3}>Genel Durum</h3>
            <div style={s.kpiGrid}>
              <Kpi label="Toplam Proje" value={formatNum(reportExtras.ethics.total)} color="#1a3a6b" />
              <Kpi label="Etik Gerekli" value={formatNum(reportExtras.ethics.required)} color="#d97706" sub={`%${reportExtras.ethics.total > 0 ? Math.round((reportExtras.ethics.required / reportExtras.ethics.total) * 100) : 0}`} />
              <Kpi label="Onaylanmış" value={formatNum(reportExtras.ethics.approved)} color="#059669" />
              <Kpi label="Bekliyor" value={formatNum(reportExtras.ethics.pending)} color="#dc2626" />
              <Kpi label="Etik Gerekmez" value={formatNum(reportExtras.ethics.notRequired)} color="#6b7280" />
              <Kpi
                label="Onay Oranı"
                value={`%${reportExtras.ethics.required > 0 ? Math.round((reportExtras.ethics.approved / reportExtras.ethics.required) * 100) : 0}`}
                color="#7c3aed"
                sub="onay/gerekli"
              />
            </div>

            {reportExtras.ethics.byFaculty?.length > 0 && (
              <>
                <h3 style={s.h3}>Fakülte Bazlı Etik Süreçler</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Fakülte</th>
                      <th style={s.thR}>Etik Gerekli</th>
                      <th style={s.thR}>Onaylanmış</th>
                      <th style={s.thR}>Bekleyen</th>
                      <th style={s.thR}>Onay Oranı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportExtras.ethics.byFaculty.map((f: any) => (
                      <tr key={f.faculty}>
                        <td style={s.td}>{f.faculty}</td>
                        <td style={s.tdR}>{f.required}</td>
                        <td style={{ ...s.tdR, color: '#059669', fontWeight: 700 }}>{f.approved}</td>
                        <td style={{ ...s.tdR, color: f.pending > 0 ? '#dc2626' : '#6b7280' }}>{f.pending}</td>
                        <td style={{ ...s.tdR, fontWeight: 700 }}>%{f.approvalRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {reportExtras.ethics.byType?.length > 0 && (
              <>
                <h3 style={s.h3}>Proje Türüne Göre Etik Süreç</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Proje Türü</th>
                      <th style={s.thR}>Etik Gerekli</th>
                      <th style={s.thR}>Onaylanmış</th>
                      <th style={s.thR}>Bekleyen</th>
                      <th style={s.thR}>Onay Oranı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportExtras.ethics.byType.map((t: any) => (
                      <tr key={t.type}>
                        <td style={s.td}>{typeTr(t.type)}</td>
                        <td style={s.tdR}>{t.required}</td>
                        <td style={{ ...s.tdR, color: '#059669', fontWeight: 700 }}>{t.approved}</td>
                        <td style={{ ...s.tdR, color: t.pending > 0 ? '#dc2626' : '#6b7280' }}>{t.pending}</td>
                        <td style={{ ...s.tdR, fontWeight: 700 }}>%{t.approvalRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {reportExtras.ethics.pendingProjects?.length > 0 && (
              <>
                <h3 style={s.h3}>Onay Bekleyen Projeler (En Eski 10)</h3>
                <p style={s.pSmall}>
                  <em>Bu projeler etik kurul kararını bekliyor. Eski tarihli olanların öncelikle ele alınması önerilir.</em>
                </p>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th>
                      <th style={s.th}>Proje</th>
                      <th style={s.th}>Yürütücü</th>
                      <th style={s.th}>Fakülte</th>
                      <th style={s.th}>Tür</th>
                      <th style={s.thR}>Açılış</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportExtras.ethics.pendingProjects.map((p: any, i: number) => {
                      const ageDays = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={p.id}>
                          <td style={s.td}>{i + 1}</td>
                          <td style={s.tdSmall}>{p.title}</td>
                          <td style={s.tdSmall}>{p.owner}</td>
                          <td style={s.td}>{p.faculty || '-'}</td>
                          <td style={s.td}>{typeTr(p.type)}</td>
                          <td style={{ ...s.tdR, color: ageDays > 90 ? '#dc2626' : ageDays > 30 ? '#d97706' : '#6b7280' }}>
                            {new Date(p.createdAt).toLocaleDateString('tr-TR')}
                            <br/>
                            <span style={{ fontSize: 8 }}>{ageDays} gün</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ═══ FİKRİ MÜLKİYET PORTFÖYÜ ═══ */}
        {reportExtras?.ip && reportExtras.ip.total > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>17. FİKRİ MÜLKİYET PORTFÖYÜ</h2>
            <p style={s.p}>
              Patent, faydalı model, marka, tasarım, telif hakkı ve ticari sır niteliğinde tescil edilen
              veya başvurusu yapılan kurum çıktıları. Toplam <strong>{formatNum(reportExtras.ip.total)}</strong>
              {' '}projede fikri mülkiyet kaydı bulunmaktadır.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {reportExtras.ip.byStatus.length > 0 && (
                <div>
                  <h3 style={s.h3}>Tescil Durumu</h3>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Durum</th>
                        <th style={s.thR}>Adet</th>
                        <th style={s.thR}>Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportExtras.ip.byStatus.map((it: any) => {
                        const labels: Record<string, string> = {
                          pending: 'Başvuru Aşamasında', registered: 'Tescilli', published: 'Yayımlandı',
                        };
                        const pct = reportExtras.ip.total > 0 ? Math.round((it.count / reportExtras.ip.total) * 100) : 0;
                        return (
                          <tr key={it.key}>
                            <td style={s.td}>{labels[it.key] || it.key}</td>
                            <td style={{ ...s.tdR, fontWeight: 700 }}>{it.count}</td>
                            <td style={s.tdR}>%{pct}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {reportExtras.ip.byType.length > 0 && (
                <div>
                  <h3 style={s.h3}>Mülkiyet Türü</h3>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Tür</th>
                        <th style={s.thR}>Adet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportExtras.ip.byType.map((it: any) => (
                        <tr key={it.key}>
                          <td style={s.td}>{IP_TYPE_LABELS[it.key] || it.key}</td>
                          <td style={{ ...s.tdR, fontWeight: 700 }}>{it.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {reportExtras.ip.byFaculty?.length > 0 && (
              <>
                <h3 style={s.h3}>Fakülteye Göre Fikri Mülkiyet</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Fakülte</th>
                      <th style={s.thR}>FM Sayısı</th>
                      <th style={s.thR}>Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportExtras.ip.byFaculty.map((f: any) => {
                      const pct = reportExtras.ip.total > 0 ? Math.round((f.count / reportExtras.ip.total) * 100) : 0;
                      return (
                        <tr key={f.faculty}>
                          <td style={s.td}>{f.faculty}</td>
                          <td style={{ ...s.tdR, fontWeight: 700 }}>{f.count}</td>
                          <td style={s.tdR}>%{pct}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            {reportExtras.ip.details?.length > 0 && (
              <>
                <h3 style={s.h3}>Fikri Mülkiyet Detay Listesi (Top {reportExtras.ip.details.length})</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th>
                      <th style={s.th}>Proje</th>
                      <th style={s.th}>Yürütücü</th>
                      <th style={s.th}>Fakülte</th>
                      <th style={s.th}>Tür</th>
                      <th style={s.th}>Durum</th>
                      <th style={s.th}>Tescil No</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportExtras.ip.details.map((d: any, i: number) => (
                      <tr key={d.id}>
                        <td style={s.td}>{i + 1}</td>
                        <td style={s.tdSmall}>{d.title}</td>
                        <td style={s.tdSmall}>{d.owner}</td>
                        <td style={s.td}>{d.faculty || '-'}</td>
                        <td style={s.td}>{IP_TYPE_LABELS[d.ipType] || d.ipType}</td>
                        <td style={s.td}>{IP_STATUS_LABELS[d.ipStatus] || d.ipStatus}</td>
                        <td style={s.td}>{d.ipRegistrationNo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ═══ ORTAK AĞI (PARTNERS) ═══ */}
        {reportExtras?.partners && reportExtras.partners.total > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>18. SANAYİ VE AKADEMİK ORTAK AĞI</h2>
            <p style={s.p}>
              Kurum projelerinde ortak olarak yer alan sanayi, kamu ve akademik kuruluşların özeti.
              Toplam <strong>{reportExtras.partners.total}</strong> farklı ortakla
              <strong> {reportExtras.partners.totalLinks}</strong> proje düzeyinde işbirliği kurulmuştur.
            </p>
            {reportExtras.partners.bySector.length > 0 && (
              <>
                <h3 style={s.h3}>Sektöre Göre Dağılım</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Sektör</th>
                      <th style={s.thR}>Ortak Sayısı</th>
                      <th style={s.thR}>Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportExtras.partners.bySector.map((s2: any) => {
                      const pct = reportExtras.partners.total > 0
                        ? Math.round((s2.count / reportExtras.partners.total) * 100) : 0;
                      return (
                        <tr key={s2.sector}>
                          <td style={s.td}>{s2.sector === '-' ? 'Belirtilmemiş' : s2.sector}</td>
                          <td style={{ ...s.tdR, fontWeight: 700 }}>{s2.count}</td>
                          <td style={s.tdR}>%{pct}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
            {reportExtras.partners.top.length > 0 && (
              <>
                <h3 style={s.h3}>En Çok Proje Yürütülen Ortaklar</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th>
                      <th style={s.th}>Ortak</th>
                      <th style={s.th}>Sektör</th>
                      <th style={s.thR}>Proje Sayısı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportExtras.partners.top.map((p: any, i: number) => (
                      <tr key={i}>
                        <td style={s.td}>{i + 1}</td>
                        <td style={{ ...s.td, fontWeight: i < 3 ? 700 : 400 }}>{p.name}</td>
                        <td style={s.td}>{p.sector === '-' ? '-' : p.sector}</td>
                        <td style={{ ...s.tdR, fontWeight: 700 }}>{p.projectCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ═══ DEMOGRAFİK DAĞILIM - GENİŞLETİLMİŞ ═══ */}
        {reportExtras?.demographics && reportExtras.demographics.totalActive > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>19. AKADEMİK PERSONEL DEMOGRAFİSİ</h2>
            <p style={s.p}>
              Sistemde aktif <strong>{reportExtras.demographics.totalActive}</strong> akademik personelin
              unvan, rol ve proje üretkenliği dağılımı. Aşağıdaki tablolar her unvanın kaç proje
              yürüttüğünü, kaçının aktif/tamamlandığını ve tür bazında dağılımını gösterir.
            </p>

            {reportExtras.demographics.byTitle.length > 0 && (
              <>
                <h3 style={s.h3}>Unvan Bazlı Üretkenlik</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Unvan</th>
                      <th style={s.thR}>Personel</th>
                      <th style={s.thR}>Toplam Proje</th>
                      <th style={s.thR}>Aktif</th>
                      <th style={s.thR}>Tamamlanan</th>
                      <th style={s.thR}>Kişi Başı Ort.</th>
                      <th style={s.thR}>Toplam Bütçe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportExtras.demographics.byTitle.map((it: any) => (
                      <tr key={it.title}>
                        <td style={{ ...s.td, fontWeight: 700 }}>{it.title}</td>
                        <td style={s.tdR}>{it.count}</td>
                        <td style={{ ...s.tdR, fontWeight: 700, color: '#1a3a6b' }}>{it.totalProjects}</td>
                        <td style={{ ...s.tdR, color: '#059669' }}>{it.activeProjects}</td>
                        <td style={{ ...s.tdR, color: '#2563eb' }}>{it.completedProjects}</td>
                        <td style={s.tdR}>{it.avgProjectsPerPerson}</td>
                        <td style={s.tdR}>{it.totalBudget > 0 ? formatTry(it.totalBudget) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={s.pSmall}>
                  <em>Kişi başı ortalama: o unvana sahip kullanıcıların ortalama proje sayısı.
                  Bir kullanıcı yürütücü ve/veya üye olarak bulunduğu her projeye 1 katkı sayar.</em>
                </p>
              </>
            )}

            {reportExtras.demographics.titleTypeMatrix?.length > 0 && (
              <>
                <h3 style={s.h3}>Unvana Göre Proje Türü Dağılımı (Yürütücü Bazlı)</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Unvan</th>
                      <th style={s.th}>Tür Dağılımı</th>
                      <th style={s.thR}>Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportExtras.demographics.titleTypeMatrix.map((row: any) => (
                      <tr key={row.title}>
                        <td style={{ ...s.td, fontWeight: 700 }}>{row.title}</td>
                        <td style={s.tdSmall}>
                          {row.types.map((t: any, i: number) => (
                            <span key={t.type} style={{ marginRight: 8 }}>
                              <strong>{typeTr(t.type)}:</strong> {t.count}
                              {i < row.types.length - 1 ? ' ·' : ''}
                            </span>
                          ))}
                        </td>
                        <td style={{ ...s.tdR, fontWeight: 700 }}>{row.totalProjects}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {reportExtras.demographics.byRole.length > 0 && (
              <>
                <h3 style={s.h3}>Sistem Rolü Dağılımı</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Rol</th>
                      <th style={s.thR}>Kişi Sayısı</th>
                      <th style={s.thR}>Toplam Proje Katkısı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportExtras.demographics.byRole.map((it: any) => (
                      <tr key={it.role}>
                        <td style={s.td}>{it.role}</td>
                        <td style={{ ...s.tdR, fontWeight: 700 }}>{it.count}</td>
                        <td style={s.tdR}>{it.totalProjects}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ═══ YIL İÇİNDE TAMAMLANAN ÖNEMLİ PROJELER ═══ */}
        {reportExtras?.completedThisYear && reportExtras.completedThisYear.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>20. {year} YILINDA TAMAMLANAN ÖNEMLİ PROJELER</h2>
            <p style={s.p}>
              {year} yılı içerisinde tamamlanan
              <strong> {reportExtras.completedThisYear.length}</strong> projenin bütçe büyüklüğüne göre listesi.
              Bu liste, yıl içinde fiilen kapanan ve çıktı üretmiş kurumsal araştırmaları gösterir.
            </p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Proje</th>
                  <th style={s.th}>Yürütücü</th>
                  <th style={s.th}>Fakülte / Bölüm</th>
                  <th style={s.th}>Tür</th>
                  <th style={s.thR}>Ekip</th>
                  <th style={s.thR}>Bütçe</th>
                  <th style={s.thR}>Bitiş</th>
                </tr>
              </thead>
              <tbody>
                {reportExtras.completedThisYear.map((p: any, i: number) => (
                  <tr key={p.id}>
                    <td style={s.td}>{i + 1}</td>
                    <td style={{ ...s.tdSmall, fontWeight: i < 3 ? 700 : 400 }}>{p.title}</td>
                    <td style={s.tdSmall}>{p.owner || '-'}</td>
                    <td style={s.tdSmall}>
                      {p.faculty || '-'}
                      {p.department && <span style={{ color: '#6b7280' }}> / {p.department}</span>}
                    </td>
                    <td style={s.td}>{typeTr(p.type)}</td>
                    <td style={s.tdR}>{(p.memberCount || 0) + 1} kişi</td>
                    <td style={s.tdR}>{p.budget ? formatTry(p.budget) : '-'}</td>
                    <td style={s.tdR}>{p.endDate ? new Date(p.endDate).toLocaleDateString('tr-TR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ ZAMAN ÇİZELGESİ - veriyi normalize et + boş donemleri ele + grafik ═══ */}
        {(() => {
          // Backend'den gelen veriyi normalize et: period | month, started | count, completed, cancelled
          const tlNorm = (timeline || []).map((t: any) => ({
            period: t.period || t.month || '-',
            started: +(t.started ?? t.count ?? 0) || 0,
            completed: +(t.completed ?? 0) || 0,
            cancelled: +(t.cancelled ?? 0) || 0,
            active: +(t.active ?? 0) || 0,
          })).filter((t: any) => t.period && t.period !== '-');
          // Bos donemleri ele: hepsi 0 olanlari atla
          const tlMeaningful = tlNorm.filter((t: any) =>
            t.started > 0 || t.completed > 0 || t.cancelled > 0 || t.active > 0);
          if (tlMeaningful.length === 0) return null;
          // Son 24 donem
          const last24 = tlMeaningful.slice(-24);
          const maxStarted = Math.max(1, ...last24.map(t => t.started));
          const totalStarted = last24.reduce((s, t) => s + t.started, 0);
          const totalCompleted = last24.reduce((s, t) => s + t.completed, 0);
          const totalCancelled = last24.reduce((s, t) => s + t.cancelled, 0);

          return (
          <div style={s.section}>
            <h2 style={s.h2}>21. PROJE ZAMAN ÇİZELGESİ</h2>
            <p style={s.p}>
              Son <strong>{last24.length}</strong> dönemde <strong>{totalStarted}</strong> proje başlatılmış,
              <strong> {totalCompleted}</strong> proje tamamlanmış,
              <strong> {totalCancelled}</strong> proje iptal edilmiştir.
              Aşağıdaki grafik ve tablo dönem bazlı (aylık) hareketi gösterir.
            </p>

            {/* Bar grafik */}
            <h3 style={s.h3}>Aylık Başlatılan Proje Trendi</h3>
            <div style={s.trendChart}>
              {last24.map((t) => {
                const h = maxStarted > 0 ? (t.started / maxStarted) * 100 : 0;
                return (
                  <div key={t.period} style={s.trendBarCol}>
                    <div style={s.trendBarWrap}>
                      <span style={s.trendVal}>{t.started || ''}</span>
                      <div style={{ ...s.trendBar, height: `${h}%`, background: '#1a3a6b' }} />
                    </div>
                    <p style={{ ...s.trendYear, fontSize: 7 }}>{t.period.split('-').slice(0, 2).join('-')}</p>
                  </div>
                );
              })}
            </div>

            <h3 style={s.h3}>Dönem Detayı</h3>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Dönem</th>
                  <th style={s.thR}>Başlatılan</th>
                  <th style={s.thR}>Tamamlanan</th>
                  <th style={s.thR}>İptal</th>
                  <th style={s.thR}>Net Birikim</th>
                </tr>
              </thead>
              <tbody>
                {last24.map((t, i, arr) => {
                  // Birikimli net: o doneme kadar baslatilan - tamamlanan - iptal
                  const cumNet = arr.slice(0, i + 1).reduce((acc, x) => acc + x.started - x.completed - x.cancelled, 0);
                  return (
                    <tr key={t.period}>
                      <td style={s.td}>{t.period}</td>
                      <td style={{ ...s.tdR, fontWeight: 700, color: '#1a3a6b' }}>{t.started}</td>
                      <td style={{ ...s.tdR, color: '#059669' }}>{t.completed}</td>
                      <td style={{ ...s.tdR, color: '#dc2626' }}>{t.cancelled}</td>
                      <td style={{ ...s.tdR, fontWeight: 700 }}>{cumNet}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: '#f8f6f0', fontWeight: 700 }}>
                  <td style={s.td}>TOPLAM</td>
                  <td style={s.tdR}>{totalStarted}</td>
                  <td style={s.tdR}>{totalCompleted}</td>
                  <td style={s.tdR}>{totalCancelled}</td>
                  <td style={s.tdR}>-</td>
                </tr>
              </tbody>
            </table>
            <p style={s.pSmall}>
              <em>Net birikim: o dönemin sonuna kadar başlatılan projelerden tamamlananların ve iptal
              edilenlerin çıkarılmış halidir - aktif portföyün büyüklüğünü gösterir.</em>
            </p>
          </div>
          );
        })()}


        {/* ═══ 17. EN ÜRETKEN ARAŞTIRMACILAR ═══ */}
        {researchers.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>22. EN ÜRETKEN ARAŞTIRMACILAR</h2>
            <p style={s.p}>
              Proje sayısı ve tamamlanan proje oranına göre ilk {researchers.length} araştırmacı.
            </p>
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
        )}

        {/* ═══ 18. DEĞERLENDİRME + BAKIŞLAR ═══ */}
        {(narrative.evaluation || narrative.outlook) && (
          <div style={s.section}>
            <h2 style={s.h2}>23. PROFESYONEL DEĞERLENDİRME VE GELECEK BAKIŞ</h2>

            {narrative.evaluation && (
              <>
                <h3 style={s.h3}>Analitik Değerlendirme</h3>
                <div style={s.evalBox}>
                  {narrative.evaluation.split('\n').filter(Boolean).map((p, i) => (
                    <p key={i} style={s.evalPara}>{p}</p>
                  ))}
                </div>
              </>
            )}

            {narrative.outlook && (
              <>
                <h3 style={s.h3}>Gelecek Yıla Dair Öngörüler</h3>
                <div style={s.outlookBox}>
                  {narrative.outlook.split('\n').filter(Boolean).map((p, i) => (
                    <p key={i} style={s.evalPara}>{p}</p>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ 19. METODOLOJİ + SINIRLILIKLAR ═══ */}
        <div style={s.section}>
          <h2 style={s.h2}>24. METODOLOJİ VE SINIRLILIKLAR</h2>

          <h3 style={s.h3}>Veri Birleştirme ve Metrik Hesaplama</h3>
          {bibliometricsEnabled && (
            <>
              <p style={s.p}>
                <strong>Dedupe:</strong> Yayınlar DOI bazlı birleştirme ile her kaynaktan bir kez sayılır.
                Atıf sayısında kaynaklar arasında en yüksek değer baz alınır.
              </p>
              <p style={s.p}>
                <strong>FWCI:</strong> Field-Weighted Citation Impact - OpenAlex tarafından yayın alanı ve
                yayın yılına göre normalize edilen atıf değeri. 1.00 dünya ortalamasıdır.
              </p>
              <p style={s.p}>
                <strong>Top %1 / Top %10:</strong> OpenAlex'in cited_by_percentile_year alanından -
                yayının alan-yıl sıralamasında üst %1 / %10'a girip girmediği.
              </p>
              <p style={s.p}>
                <strong>Uluslararası işbirliği:</strong> Yayın yazarlarının en az birinin Türkiye dışı bir kuruma
                bağlı olması. Authorships.institutions.country_code üzerinden hesaplanır.
              </p>
              <p style={s.p}>
                <strong>Peer benchmark:</strong> OpenAlex institution summary endpoint üzerinden -
                kurumun toplam yayın, atıf, h-index ve 2 yıllık ortalama atıf metrikleri çekilir.
                Karşılaştırılan üniversite seti PEER_OPENALEX_IDS env değişkeni ile özelleştirilebilir.
              </p>
            </>
          )}
          <p style={s.p}>
            <strong>Başarı oranı:</strong> Karara bağlanmış (tamamlanmış + iptal edilmiş) projeler
            arasında tamamlananların payıdır.
            <br/>
            <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>
              Başarı Oranı = Tamamlanan / (Tamamlanan + İptal) × 100
            </code>
            <br/>
            Henüz devam etmekte olan (aktif) ve başvuru aşamasındaki projeler dahil edilmez,
            çünkü bunların sonucu belirsizdir. Bu kıstas TÜBİTAK ve AB başvuru başarı raporlarıyla aynıdır.
          </p>
          <p style={s.p}>
            <strong>Aktif oran / Tamamlanma oranı / Başvuru oranı:</strong> Tüm proje portföyü
            (kararlaşmamışlar dahil) içinde her durum kategorisinin yüzdesidir.
          </p>
          <p style={s.p}>
            <strong>Etik onay oranı:</strong> Etik kurul gerektiren projeler arasında onay almış olanların
            payı; etik kurul gerektirmeyen projeler hesaba katılmaz.
          </p>
          <p style={s.p}>
            <strong>Tamamlanan projeler:</strong> Bitiş tarihi cari yıla denk düşen ve durumu
            "tamamlandı" olarak işaretlenmiş projeler. Bütçe büyüklüğüne göre sıralanır.
          </p>
          <p style={s.p}>
            <strong>Ortak listesi:</strong> Aynı isimli ortaklar tekleştirilir; bir ortak birden fazla projede
            yer alıyorsa proje sayısı kümülatif sayılır.
          </p>

          <h3 style={s.h3}>Sınırlılıklar</h3>
          <div style={s.limitBox}>
            <ul style={s.limitList}>
              {bibliometricsEnabled && (
                <>
                  <li>
                    <strong>Yayın havuzu sınırı:</strong> OpenAlex institution endpoint'inden en çok atıf alan
                    ilk 500 yayın çekilir. Uzun kuyruktaki düşük atıflı yayınlar istatistiklere dahil olur ama liste olarak gösterilmez.
                  </li>
                  <li>
                    <strong>ORCID kapsam boşluğu:</strong> ORCID kaydı olmayan araştırmacıların yayınları bu havuza
                    yalnızca yazar-kurum eşleşmesi OpenAlex tarafından tanındığında dahil olur.
                  </li>
                  <li>
                    <strong>SCImago kuartil eşleşmesi:</strong> ISSN eşleşmesi yapılamayan dergiler "Bilinmiyor"
                    kategorisine düşer. Sosyal bilimler ve Türkçe dergiler bu grupta yoğunlaşabilir.
                  </li>
                  <li>
                    <strong>FWCI kapsamı:</strong> OpenAlex FWCI'yi yalnızca belirli alan-yıl kesitleri için hesaplar;
                    raporda FWCI coverage sayısı kaç yayın için bu metriğin mevcut olduğunu gösterir.
                  </li>
                  <li>
                    <strong>Peer seçimi:</strong> Varsayılan peer seti bölgesel ve ölçek benzerliğine göre seçilmiştir;
                    farklı bir benchmark için PEER_OPENALEX_IDS env değişkeniyle özelleştirme mümkündür.
                  </li>
                </>
              )}
              {!bibliometricsEnabled && (
                <li>
                  <strong>Bibliyometri kapalı:</strong> Sistem yöneticisi yayın/atıf/h-index/SCImago
                  göstergelerini kapatmış olduğundan bu rapor yalnızca dahili proje veri tabanına dayanır.
                  Bibliyometri açıldığında 11 dış veri kaynağından (OpenAlex, Scopus, WoS, CORDIS, SCImago vb.)
                  zenginleştirilmiş veri eklenir.
                </li>
              )}
              <li>
                <strong>CORDIS kapsamı:</strong> "Mustafa Kemal University" tam eşleşmesiyle bulunan projeler listelenir.
                İsim varyasyonlarından kaçan projeler olabilir.
              </li>
              <li>
                <strong>Etik kurul kayıtları:</strong> Sadece sisteme girilmiş etik kurul kararları sayılır;
                eski projelerde alan boş olabilir.
              </li>
              <li>
                <strong>Fikri mülkiyet:</strong> Sadece sistemde "ipStatus" alanı doldurulan projeler dahil edilir;
                tescil tarihinden bağımsız olarak tüm aktif kayıtlar sayılır.
              </li>
              <li>
                <strong>YZ değerlendirmesi:</strong> Önsöz, değerlendirme ve gelecek bakış paragrafları Claude
                tarafından üretilir ve rapor verisini temel alır. Üretilen metnin profesyonel edit geçmesi önerilir.
              </li>
              <li>
                <strong>Veri tazeliği:</strong> Dış veri kaynakları farklı güncelleme döngülerine sahiptir -
                raporun tarih damgası verinin çekildiği anı gösterir.
              </li>
            </ul>
          </div>

          <div style={s.footerMeta}>
            <p>Rapor üretici: {institutionName} Teknoloji Transfer Ofisi · Yıl {year}</p>
            <p>Oluşturulma: {new Date().toLocaleString('tr-TR')}</p>
            <p>Bu rapor otomatik olarak üretilmiştir. Veri kaynakları sürekli güncellendiği için
               farklı tarihlerde üretilen raporlar arasında küçük farklar olabilir.</p>
            <div style={s.signatureBlock}>
              <div style={s.signCell}>
                <div style={s.signLine}></div>
                <p style={s.signLbl}>Hazırlayan</p>
                {/* Sistem Yoneticisi (Super Admin) raporlarda gorunmesin */}
                {(() => {
                  const isSuperAdmin = currentUser?.role === 'Süper Admin';
                  const showName = !isSuperAdmin && currentUser?.name;
                  const showRole = !isSuperAdmin && currentUser?.role;
                  return (
                    <>
                      <p style={s.signName}>{showName ? currentUser!.name : 'TTO Direktörlüğü'}</p>
                      {showRole && <p style={s.signRole}>{currentUser!.role}</p>}
                    </>
                  );
                })()}
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
  coverTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 11, opacity: 0.9 },
  coverLogoBox: { background: 'rgba(255,255,255,0.08)', padding: 8, borderRadius: 12, border: '1px solid rgba(200,164,90,0.4)' },
  coverDate: { margin: 0 },
  coverInst: { margin: '4px 0 0', fontWeight: 700, fontSize: 13 },
  coverMid: { textAlign: 'center' },
  coverTitle: { fontSize: 36, fontWeight: 700, color: '#ffffff', margin: 0, lineHeight: 1.15, letterSpacing: 1 },
  coverYear: { fontSize: 64, fontWeight: 700, color: '#c8a45a', margin: '30px 0 10px' },
  coverSubtitle: { fontSize: 13, margin: '10px auto 0', maxWidth: 500, opacity: 0.85, lineHeight: 1.6 },
  coverFactBox: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, maxWidth: 600, margin: '36px auto 0' },
  coverFactNum: { fontSize: 22, fontWeight: 700, color: '#c8a45a', margin: 0, lineHeight: 1 },
  coverFactLbl: { fontSize: 9, margin: '4px 0 0', opacity: 0.7, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  coverBottom: { fontSize: 9, opacity: 0.6, textAlign: 'center' },
  coverDataSrc: { margin: 0 },

  h2: { fontSize: 14, fontWeight: 700, color: '#0f2444', margin: '0 0 6px', paddingBottom: 6, borderBottom: '2px solid #0f2444' },
  h3: { fontSize: 12, fontWeight: 700, color: '#374151', margin: '14px 0 6px' },
  p: { fontSize: 11, margin: '0 0 10px', color: '#4b5563' },
  pSmall: { fontSize: 10, margin: '6px 0 0', color: '#6b7280' },

  toc: { fontSize: 11, lineHeight: 1.9, color: '#374151', paddingLeft: 20 },

  highlightBox: { background: '#faf8f4', border: '1px solid #e8e4dc', borderLeft: '4px solid #c8a45a', padding: 12, borderRadius: 4, marginBottom: 14 },
  highlightTitle: { fontSize: 12, fontWeight: 700, color: '#0f2444', margin: '0 0 8px' },
  highlightList: { fontSize: 11, margin: 0, paddingLeft: 18, lineHeight: 1.7, color: '#374151' },

  prefaceBox: { background: 'linear-gradient(135deg, #faf8f4 0%, #fef9e7 100%)', border: '1px solid #e8e4dc', padding: 16, borderRadius: 6 },
  prefacePara: { fontSize: 11.5, margin: '0 0 10px', color: '#1f2937', lineHeight: 1.75, textAlign: 'justify' as const },
  prefaceSign: { fontSize: 11, margin: '14px 0 0', color: '#6b7280', fontStyle: 'italic' as const, textAlign: 'right' as const },

  evalBox: { background: '#f8fafc', border: '1px solid #e2e8f0', padding: 12, borderRadius: 6 },
  evalPara: { fontSize: 11.5, margin: '0 0 10px', color: '#1f2937', lineHeight: 1.7, textAlign: 'justify' as const },
  outlookBox: { background: '#fef7ed', border: '1px solid #fdba74', padding: 12, borderRadius: 6 },

  limitBox: { background: '#fffbeb', border: '1px solid #fde68a', padding: 10, borderRadius: 4 },
  limitList: { fontSize: 10.5, margin: 0, paddingLeft: 18, lineHeight: 1.7, color: '#78350f' },

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
  sdgNumSmall: { width: 22, height: 22, borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 11 },
  sdgText: { fontSize: 9 },
  sdgCount: { margin: 0, color: '#0f2444', fontSize: 10 },
  sdgFac: { margin: 0, color: '#6b7280', fontSize: 9 },

  facultyCards: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 },
  facultyCard: { padding: 10, border: '1px solid #e8e4dc', borderRadius: 6, background: '#faf8f4' },
  facultyRank: { fontSize: 20, fontWeight: 700, color: '#c8a45a', margin: 0 },
  facultyName: { fontSize: 11, fontWeight: 700, color: '#0f2444', margin: '2px 0 8px' },
  facultyGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  facultyVal: { fontSize: 14, fontWeight: 700, color: '#1a3a6b', margin: 0 },
  facultyLbl: { fontSize: 8, color: '#6b7280', margin: 0, textTransform: 'uppercase' as const, letterSpacing: 0.3 },

  trendChart: { display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, padding: '8px 0', background: 'linear-gradient(to top, #f9fafb 0%, transparent 100%)', borderBottom: '1px solid #e8e4dc', marginBottom: 4 },
  trendBarCol: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 },
  trendBarWrap: { flex: 1, width: '100%', display: 'flex', flexDirection: 'column' as const, justifyContent: 'flex-end', alignItems: 'center', position: 'relative' as const, minHeight: 80 },
  trendBar: { width: '80%', minHeight: 2, borderRadius: '2px 2px 0 0' },
  trendVal: { fontSize: 8, color: '#374151', fontWeight: 600, position: 'absolute' as const, top: 0 },
  trendYear: { fontSize: 9, color: '#6b7280', margin: 0 },

  footerMeta: { marginTop: 14, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 9, color: '#9ca3af', textAlign: 'center' as const },
  signatureBlock: { marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' },
  signCell: { textAlign: 'center' as const },
  signLine: { height: 1, background: '#374151', margin: '30px 10px 6px' },
  signLbl: { fontSize: 9, color: '#6b7280', margin: 0, textTransform: 'uppercase' as const, letterSpacing: 1 },
  signName: { fontSize: 11, color: '#0f2444', margin: '4px 0 0', fontWeight: 700 },
  signRole: { fontSize: 9, color: '#6b7280', margin: '2px 0 0', fontStyle: 'italic' as const },
};
