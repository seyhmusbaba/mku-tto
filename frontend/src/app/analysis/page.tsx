'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api, projectTypesApi, facultiesApi, scopusApi } from '@/lib/api';
import { ProjectTypeItem, FacultyItem } from '@/types';
import { formatCurrency, getProjectTypeLabel, getProjectTypeColor } from '@/lib/utils';
import { GanttChart } from '@/components/GanttChart';
import { BibliometricsPanel } from '@/components/BibliometricsPanel';
import { showBibliometrics, subscribeSettings, loadSettings } from '@/lib/settings-store';
import { InstitutionalPanel } from '@/components/InstitutionalPanel';
import { useAuth } from '@/lib/auth-context';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

/* ─── Icon helper ───────────────────────────────────── */
type AIconName = 'folder' | 'dollar' | 'check' | 'chart' | 'beaker' | 'target' | 'lock' | 'alert' | 'download' | 'globe' | 'search' | 'info' | 'link' | 'document' | 'user' | 'inbox' | 'book' | 'tag' | 'building' | 'award';
const A_I: Record<AIconName, string> = {
  folder:   'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  book:     'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  tag:      'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  award:    'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  dollar:   'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  check:    'M5 13l4 4L19 7',
  chart:    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  beaker:   'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  target:   'M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z',
  lock:     'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  alert:    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  globe:    'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  info:     'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  link:     'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  user:     'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  inbox:    'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
};
function AIcon({ name, className = 'w-4 h-4', strokeWidth = 1.8 }: { name: AIconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={A_I[name]} />
    </svg>
  );
}

const C = ['#0f2444','#1a3a6b','#c8a45a','#e8c97a','#2d5aff','#94a3b8','#059669','#dc2626','#7c3aed','#ea580c'];

const STATUS_LABELS: Record<string,string> = {
  application:'Başvuru', pending:'Beklemede', active:'Aktif',
  completed:'Tamamlandı', suspended:'Askıya Alındı', cancelled:'İptal',
};
const STATUS_COLORS: Record<string,string> = {
  application:'#d97706', pending:'#d97706', active:'#059669', completed:'#2563eb',
  suspended:'#6b7280', cancelled:'#dc2626',
};
// Fon kaynağı panelindeki bar renkleri - MKÜ paletine uyumlu
const SOURCE_COLORS = ['#0f2444', '#c8a45a', '#059669', '#7c3aed', '#e9711c', '#4285f4', '#dc2626', '#5e33bf'];

type Tab = 'overview' | 'institutional' | 'bibliometrics' | 'faculty' | 'researcher' | 'funding' | 'timeline' | 'gantt' | 'scopus';

export default function AnalysisPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [biblioScope, setBiblioScope] = useState<'me' | 'faculty-compare' | 'dept-compare' | 'institutional'>('me');
  const [overview, setOverview] = useState<any>(null);
  const [facultyData, setFacultyData] = useState<any[]>([]);
  const [researcherData, setResearcherData] = useState<any[]>([]);
  const [fundingData, setFundingData] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeItem[]>([]);
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterType, setFilterType] = useState('');
  const [exporting, setExporting] = useState(false);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [researcherLimit, setResearcherLimit] = useState<number>(10);
  const [timelineGran, setTimelineGran] = useState<'month' | 'quarter' | 'year'>('month');
  const [fundingSourceData, setFundingSourceData] = useState<any[]>([]);
  const [drilldown, setDrilldown] = useState<{ filter: Record<string, string>; title: string } | null>(null);
  const [biblioEnabled, setBiblioEnabled] = useState<boolean>(showBibliometrics());

  useEffect(() => {
    loadSettings().then(() => setBiblioEnabled(showBibliometrics()));
    return subscribeSettings(() => setBiblioEnabled(showBibliometrics()));
  }, []);

  useEffect(() => {
    Promise.all([
      projectTypesApi.getAll().then(r => setProjectTypes(r.data)).catch(() => {}),
      facultiesApi.getAll().then(r => setFaculties(r.data)).catch(() => {}),
      api.get('/analytics/faculty-performance').then(r => setFacultyData(r.data || [])).catch(e => setDataError(e?.response?.data?.message || e?.message || 'Fakülte verisi alınamadı')),
      api.get('/analytics/researcher-productivity', { params: { limit: 10 } }).then(r => setResearcherData(r.data || [])).catch(() => {}),
      api.get('/analytics/funding-success').then(r => setFundingData(r.data || [])).catch(() => {}),
      api.get('/analytics/timeline').then(r => setTimelineData(r.data || [])).catch(() => {}),
      api.get('/analytics/export').then(r => setAllProjects(r.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setOverviewLoading(true);
    const filterParams = { year: filterYear, faculty: filterFaculty, type: filterType };

    api.get('/analytics/overview', { params: filterParams })
      .then(r => setOverview(r.data))
      .catch(() => {})
      .finally(() => setOverviewLoading(false));

    // Filtre değişince tüm diğer sekmeler de yeniden çekilsin - tutarlı görünüm için
    api.get('/analytics/faculty-performance', { params: filterParams })
      .then(r => setFacultyData(r.data || []))
      .catch(() => {});
    api.get('/analytics/researcher-productivity', { params: { ...filterParams, limit: researcherLimit } })
      .then(r => setResearcherData(r.data || []))
      .catch(() => {});
    api.get('/analytics/funding-success', { params: filterParams })
      .then(r => setFundingData(r.data || []))
      .catch(() => {});
    api.get('/analytics/funding-source-breakdown', { params: filterParams })
      .then(r => setFundingSourceData(r.data || []))
      .catch(() => {});
    api.get('/analytics/timeline', { params: { ...filterParams, granularity: timelineGran } })
      .then(r => setTimelineData(r.data || []))
      .catch(() => {});
  }, [filterYear, filterFaculty, filterType, researcherLimit, timelineGran]);

  const handleOpenTabReport = () => {
    setExporting(true);
    try {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('tto_token');
        if (token) sessionStorage.setItem('tto_print_token', token);
      }
      window.open(`/analysis/section-report?tab=${tab}`, '_blank');
    } finally {
      setExporting(false);
    }
  };

  // ═════════ ROL BAZLI ERİŞİM KONTROLÜ ═════════
  // Prensipler:
  //  - Süper Admin / Rektör: TÜM sekmeler
  //  - Dekan: kendi fakültesinin özet + karşılaştırma (scope backend'de otomatik)
  //  - Bölüm Başkanı: kendi bölümünün özet + karşılaştırma
  //  - Diğer (Akademisyen / Araştırma Görevlisi): SADECE kendi projelerinin özeti
  // Kurumsal Karşılaştırma (fakülteler arası radar) SADECE Süper Admin / Rektör
  const roleName = user?.role?.name || '';
  const isSuperAdmin = roleName === 'Süper Admin';
  const isRector     = roleName === 'Rektör';
  const isDean       = roleName === 'Dekan';
  const isHead       = roleName === 'Bölüm Başkanı';
  const isInstitutionWide = isSuperAdmin || isRector;
  const isFacultyWide     = isInstitutionWide || isDean;
  const isDeptWide        = isFacultyWide || isHead;
  // Akademisyen / Araştırma Görevlisi / diğer: sadece kendi projelerinin analizi

  const TABS: { key: Tab; label: string }[] = [
    // Genel Bakış herkese açık (scope backend'de otomatik kısıtlanır: user → sadece kendisi)
    { key: 'overview', label: 'Genel Bakış' },

    // Kurumsal Karşılaştırma - SADECE rektörlük seviyesi
    ...(isInstitutionWide ? [{ key: 'institutional' as Tab, label: 'Kurumsal Karşılaştırma' }] : []),

    // Bibliyometri - biblioEnabled + en az fakülte-genişliğinde yetki gerek
    ...(biblioEnabled && isDeptWide ? [{ key: 'bibliometrics' as Tab, label: 'Bibliyometri' }] : []),

    // Fakülteler karşılaştırması - Dekan+ görür (dekan sadece kendi fakültesi context'inde)
    ...(isFacultyWide ? [{ key: 'faculty' as Tab, label: 'Fakülteler' }] : []),

    // Araştırmacı verimliliği - Bölüm Başkanı+ görür (kendi kapsamında)
    ...(isDeptWide ? [{ key: 'researcher' as Tab, label: 'Araştırmacılar' }] : []),

    // Fon Analizi - Bölüm Başkanı+ (kendi kapsamında)
    ...(isDeptWide ? [{ key: 'funding' as Tab, label: 'Fon Analizi' }] : []),

    // Zaman ve Gantt - kendi projeleri herkese faydalı, scope otomatik
    { key: 'timeline', label: 'Zaman Serisi' },
    { key: 'gantt',    label: 'Gantt'        },

    // Scopus Analitik - biblioEnabled + en az fakülte-genişliğinde
    ...(biblioEnabled && isFacultyWide ? [{ key: 'scopus' as Tab, label: 'Scopus Analitik' }] : []),
  ];

  // URL'den gelen sekme yetkiye sığmıyorsa overview'a düş
  useEffect(() => {
    if (!TABS.find(t => t.key === tab)) {
      setTab('overview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleName]);

  const years = Array.from({length: 6}, (_, i) => String(new Date().getFullYear() - i));

  return (
    <DashboardLayout>
      <Header title="Analiz & Raporlama" />
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">

        {/* Sekmeler + Export */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f0ede8' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: tab === t.key ? 'white' : 'transparent', color: tab === t.key ? '#0f2444' : '#6b7280',
                  boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 no-print">
            {(() => {
              const perms = user?.role?.permissions?.map((p: any) => p.name) || [];
              const canSeeAnnualReport = perms.includes('analytics:annual-report');
              const canSeePeriodReport = perms.includes('analytics:period-report');
              return (canSeeAnnualReport || canSeePeriodReport) ? (
                <>
                  {canSeeAnnualReport && (
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          const token = localStorage.getItem('tto_token');
                          if (token) sessionStorage.setItem('tto_print_token', token);
                        }
                        window.open('/analysis/annual-report', '_blank');
                      }}
                      className="btn-primary text-sm inline-flex items-center gap-1.5"
                      title="Tüm kurumsal metrikleri içeren yıllık PDF raporu"
                    >
                      <AIcon name="document" className="w-3.5 h-3.5" />
                      Yıllık Kurumsal Rapor
                    </button>
                  )}
                  {canSeePeriodReport && (
                    <button
                      onClick={() => setPeriodModalOpen(true)}
                      className="btn-secondary text-sm inline-flex items-center gap-1.5"
                      title="Belirli bir tarih aralığı için özel rapor (haftalık, aylık, dönemsel)"
                    >
                      <AIcon name="chart" className="w-3.5 h-3.5" />
                      Dönemsel Rapor
                    </button>
                  )}
                </>
              ) : null;
            })()}
            <button onClick={handleOpenTabReport} disabled={exporting || tab === 'gantt'} className="btn-secondary text-sm inline-flex items-center gap-1.5"
              title={tab === 'gantt' ? 'Gantt sekmesi için rapor desteği yok' : 'Bu sekmenin verilerini PDF raporuna çevir'}>
              {exporting ? <span className="spinner w-3 h-3" /> : <AIcon name="document" className="w-3.5 h-3.5" />}
              Bu Sekmeyi Raporla
            </button>
          </div>
        </div>

        {/* Dönemsel Rapor Modal */}
        {periodModalOpen && (
          <PeriodReportModal onClose={() => setPeriodModalOpen(false)} />
        )}

        {/* Drilldown Modal - KPI/chart tıklayınca proje listesi */}
        {drilldown && (
          <DrilldownModal
            filter={drilldown.filter}
            title={drilldown.title}
            onClose={() => setDrilldown(null)}
          />
        )}

        {/* Filtreler (overview sekmesinde) */}
        {tab === 'overview' && (
          <div className="flex gap-3 flex-wrap">
            <select className="input text-sm py-1.5 w-40" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">Tüm Yıllar</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="input text-sm py-1.5 w-48" value={filterFaculty} onChange={e => setFilterFaculty(e.target.value)}>
              <option value="">Tüm Fakülteler</option>
              {faculties.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
            </select>
            <select className="input text-sm py-1.5 w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">Tüm Türler</option>
              {projectTypes.map(t => <option key={t.id} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        )}

        {dataError && (
          <div className="p-4 rounded-xl text-sm text-red-700 mb-4 inline-flex items-start gap-2" style={{background:'#fef2f2',border:'1px solid #fecaca'}}>
            <AIcon name="alert" className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{dataError}</span>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : (
          <>
            {/* ── GENEL BAKIŞ ── */}
            {tab === 'overview' && overviewLoading && <div className="flex justify-center py-10"><div className="spinner" /></div>}
            {tab === 'overview' && !overviewLoading && !overview && <p className="text-sm text-muted text-center py-10">Veri bulunamadı. Henüz proje eklenmemiş olabilir.</p>}
            {tab === 'overview' && !overviewLoading && overview && (
              <div className="space-y-6">
                {overview.restricted && (
                  <div className="flex items-center gap-2 p-3 rounded-xl text-sm mb-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                    <AIcon name="info" className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {overview.scope === 'faculty' && overview.scopeValue ? (
                        <><strong>{overview.scopeValue}</strong> fakültesi görünümü - kendi fakültenizin analiz verileri. Kurumsal Karşılaştırma sekmesinde diğer fakültelerle kıyaslayabilirsiniz.</>
                      ) : overview.scope === 'department' && overview.scopeValue ? (
                        <><strong>{overview.scopeValue}</strong> bölüm görünümü - kendi bölümünüzün analiz verileri. Fakülteler sekmesinde diğer bölümlerle karşılaştırabilirsiniz.</>
                      ) : (
                        <>Yalnızca yetkili olduğunuz projeler gösteriliyor. Tüm analizlere erişim için yöneticinizle iletişime geçin.</>
                      )}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                  {([
                    { label: 'Toplam Proje', val: overview.total, icon: 'folder' as AIconName, color: '#1a3a6b',
                      tip: 'Filtreye uyan tüm projeler. Tıkla → proje listesini gör',
                      href: `/projects${filterYear ? `?dateFrom=${filterYear}-01-01&dateTo=${filterYear}-12-31` : ''}${filterFaculty ? (filterYear ? '&' : '?') + `faculty=${encodeURIComponent(filterFaculty)}` : ''}${filterType ? (filterYear || filterFaculty ? '&' : '?') + `type=${filterType}` : ''}`,
                    },
                    { label: 'Toplam Bütçe', val: formatCurrency(overview.totalBudget), icon: 'dollar' as AIconName, color: '#c8a45a',
                      tip: 'Projelerde belirtilen toplam bütçe' },
                    { label: 'Ort. Bütçe', val: formatCurrency(overview.avgBudget), icon: 'chart' as AIconName, color: '#7c3aed',
                      tip: 'Toplam bütçe / proje sayısı' },
                    { label: 'Aktiflik', val: `%${overview.activeRate ?? 0}`, sub: `${overview.activeProjects} aktif`,
                      icon: 'bolt' as AIconName, color: '#059669',
                      tip: `${overview.activeProjects} / ${overview.total} proje aktif durumda (devam eden).`,
                      href: `/projects?status=active${filterFaculty ? `&faculty=${encodeURIComponent(filterFaculty)}` : ''}${filterType ? `&type=${filterType}` : ''}`,
                    },
                    { label: 'Tamamlanma', val: `%${overview.completedRate ?? 0}`, sub: `${overview.completedProjects} bitti`,
                      icon: 'check' as AIconName, color: '#2563eb',
                      tip: `${overview.completedProjects} / ${overview.total} proje tamamlandı.`,
                      href: `/projects?status=completed${filterFaculty ? `&faculty=${encodeURIComponent(filterFaculty)}` : ''}${filterType ? `&type=${filterType}` : ''}`,
                    },
                    { label: 'Başvuru Sürecinde', val: `%${overview.pendingRate ?? 0}`, sub: `${overview.pendingProjects} beklemede`,
                      icon: 'clock' as AIconName, color: '#d97706',
                      tip: `${overview.pendingProjects} / ${overview.total} proje henüz karar aşamasında (başvuru / beklemede).`,
                      href: `/projects?status=pending${filterFaculty ? `&faculty=${encodeURIComponent(filterFaculty)}` : ''}${filterType ? `&type=${filterType}` : ''}`,
                    },
                  ]).map(item => {
                    const Wrap: any = (item as any).href ? 'a' : 'div';
                    const wrapProps: any = (item as any).href
                      ? { href: (item as any).href, className: 'card p-5 text-center cursor-pointer hover:shadow-md transition-shadow block', title: item.tip }
                      : { className: 'card p-5 text-center', title: item.tip };
                    return (
                    <Wrap key={item.label} {...wrapProps}>
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-2"
                        style={{ background: item.color + '18', color: item.color }}>
                        <AIcon name={item.icon} className="w-5 h-5" />
                      </span>
                      <div className="font-display text-2xl font-bold" style={{ color: item.color }}>{item.val}</div>
                      <div className="text-xs text-muted mt-1">{item.label}</div>
                      {(item as any).sub && (
                        <div className="text-[10px] font-semibold mt-0.5" style={{ color: item.color }}>{(item as any).sub}</div>
                      )}
                      {(item as any).href && (
                        <div className="text-[10px] text-muted mt-1 italic">Tıkla →</div>
                      )}
                    </Wrap>
                    );
                  })}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="card p-5">
                    <h3 className="font-display text-sm font-semibold text-navy mb-4">Duruma Göre Dağılım</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={overview.byStatus.filter((s: any) => s.count > 0)} dataKey="count" nameKey="status"
                          cx="50%" cy="50%" outerRadius={80} label={({ status, count }) => count > 0 ? `${STATUS_LABELS[status]}: ${count}` : ''}>
                          {overview.byStatus.map((s: any, i: number) => (
                            <Cell key={i} fill={STATUS_COLORS[s.status] || C[i]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any, n: any) => [v, STATUS_LABELS[n] || n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="card p-5">
                    <h3 className="font-display text-sm font-semibold text-navy mb-4">Durum Detayı</h3>
                    <div className="space-y-3">
                      {overview.byStatus.filter((s: any) => s.count > 0).map((s: any) => (
                        <div key={s.status} className="flex items-center gap-3">
                          <span className="text-xs font-medium w-28 text-navy">{STATUS_LABELS[s.status] || s.status}</span>
                          <div className="flex-1 h-2.5 rounded-full" style={{ background: '#f0ede8' }}>
                            <div className="h-2.5 rounded-full transition-all"
                              style={{ width: `${overview.total > 0 ? (s.count / overview.total) * 100 : 0}%`,
                                background: STATUS_COLORS[s.status] || '#1a3a6b' }} />
                          </div>
                          <span className="text-xs font-bold text-navy w-8 text-right">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── FAKÜLTE ANALİZİ ── */}
            {tab === 'faculty' && isFacultyWide && (
              <div className="space-y-6">
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-4">Fakülte Bazlı Proje Dağılımı</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={facultyData.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="faculty" tick={{ fontSize: 10 }} width={160} />
                      <Tooltip />
                      <Bar dataKey="active" fill="#059669" name="Aktif" stackId="a" />
                      <Bar dataKey="completed" fill="#1a3a6b" name="Tamamlandı" stackId="a" />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid gap-3">
                  {facultyData.map((f, i) => (
                    <div key={i} className="card p-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="font-semibold text-navy text-sm">{f.faculty}</div>
                        <div className="flex gap-4 text-xs">
                          {[
                            { label: 'Toplam', val: f.total, color: '#1a3a6b' },
                            { label: 'Aktiflik', val: `%${f.activeRate ?? 0}`, color: '#059669' },
                            { label: 'Tamamlanma', val: `%${f.completedRate ?? 0}`, color: '#2563eb' },
                            { label: 'Başvuru Sürecinde', val: `%${f.pendingRate ?? 0}`, color: '#d97706' },
                            { label: 'Ort. Bütçe', val: formatCurrency(f.avgBudget), color: '#7c3aed' },
                          ].map(item => (
                            <div key={item.label} className="text-center">
                              <div className="font-bold" style={{ color: item.color }}>{item.val}</div>
                              <div className="text-muted">{item.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* 3 renkli stacked bar - aktif/tamamlanma/başvuru sürecinde */}
                      <div className="mt-2 h-2 rounded-full overflow-hidden flex" style={{ background: '#f0ede8' }}>
                        <div style={{ width: `${f.activeRate ?? 0}%`, background: '#059669' }} title={`Aktif: %${f.activeRate ?? 0}`} />
                        <div style={{ width: `${f.completedRate ?? 0}%`, background: '#2563eb' }} title={`Tamamlanan: %${f.completedRate ?? 0}`} />
                        <div style={{ width: `${f.pendingRate ?? 0}%`, background: '#d97706' }} title={`Başvuru: %${f.pendingRate ?? 0}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ARAŞTIRMACI VERİMLİLİĞİ ── */}
            {tab === 'researcher' && isDeptWide && (
              <div className="space-y-4">
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h3 className="font-display text-sm font-semibold text-navy inline-flex items-center gap-2">
                      <AIcon name="beaker" className="w-4 h-4 text-navy" />
                      Araştırmacı Üretkenlik Sıralaması
                      <span className="text-xs font-normal text-muted">({researcherData.length} araştırmacı)</span>
                    </h3>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted">Göster:</span>
                      {[10, 25, 50, 100, 0].map(n => (
                        <button key={n}
                          onClick={() => setResearcherLimit(n)}
                          className="px-2.5 py-1 rounded-md font-semibold transition-colors"
                          style={{
                            background: researcherLimit === n ? '#0f2444' : '#f0ede8',
                            color: researcherLimit === n ? 'white' : '#6b7280',
                          }}>
                          {n === 0 ? 'Tümü' : `Top ${n}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {researcherData.map((r, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 rounded-xl" style={{ background: i < 3 ? '#f8f6f2' : 'transparent', border: '1px solid #f0ede8' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: i === 0 ? '#c8a45a' : i === 1 ? '#94a3b8' : i === 2 ? '#ea580c' : '#f0ede8',
                            color: i < 3 ? 'white' : '#6b7280' }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-navy text-sm">{r.name}</p>
                          <p className="text-xs text-muted">{r.faculty} · {r.department}</p>
                        </div>
                        <div className="flex gap-4 text-xs text-right flex-shrink-0">
                          <div><p className="font-bold text-navy">{r.total}</p><p className="text-muted">Proje</p></div>
                          <div><p className="font-bold" style={{ color: '#059669' }}>{r.active}</p><p className="text-muted">Aktif</p></div>
                          <div><p className="font-bold" style={{ color: '#2563eb' }}>{r.completed}</p><p className="text-muted">Bitti</p></div>
                          <div><p className="font-bold" style={{ color: '#c8a45a' }}>{formatCurrency(r.totalBudget)}</p><p className="text-muted">Bütçe</p></div>
                        </div>
                      </div>
                    ))}
                    {researcherData.length === 0 && <p className="text-sm text-muted text-center py-6">Veri bulunamadı</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ── FON ANALİZİ ── */}
            {tab === 'funding' && isDeptWide && (
              <div className="space-y-6">
                {/* ═ Proje Türü Başarı Oranları ═ */}
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-1">Proje Türüne Göre Dağılım</h3>
                  <p className="text-xs text-muted mb-4">TÜBİTAK 1001, BAP, AB projesi gibi - proje türü bazlı başarı oranları</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={fundingData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                      <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" fill="#1a3a6b" name="Toplam" cursor="pointer"
                        onClick={(d: any) => d?.type && setDrilldown({ filter: { type: d.type }, title: `Proje türü: ${d.type}` })} />
                      <Bar dataKey="completed" fill="#059669" name="Tamamlandı" />
                      <Bar dataKey="active" fill="#c8a45a" name="Aktif" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* ═ YENİ: Fon Kaynağı Breakdown ═ */}
                {fundingSourceData.length > 0 && (
                  <div className="card p-5">
                    <h3 className="font-display text-sm font-semibold text-navy mb-1 inline-flex items-center gap-2">
                      <AIcon name="dollar" className="w-4 h-4" />
                      Fon Kaynağına Göre Dağılım
                    </h3>
                    <p className="text-xs text-muted mb-4">
                      Nereden geliyor - TÜBİTAK, Rektörlük/BAP, AB, Sanayi, Kalkınma Ajansları vs. (Normalleştirilmiş)
                    </p>

                    {/* Horizontal stacked bar */}
                    <div className="mb-5">
                      {(() => {
                        const maxTotal = Math.max(...fundingSourceData.map(f => f.total));
                        const totalBudgetAll = fundingSourceData.reduce((s, f) => s + f.totalBudget, 0);
                        return (
                          <div className="space-y-2">
                            {fundingSourceData.map((f, i) => {
                              const pct = (f.total / maxTotal) * 100;
                              const budgetShare = totalBudgetAll > 0 ? Math.round((f.totalBudget / totalBudgetAll) * 100) : 0;
                              const color = SOURCE_COLORS[i % SOURCE_COLORS.length];
                              return (
                                <div key={f.source}
                                  className="grid grid-cols-[180px_1fr_auto] items-center gap-3 text-xs cursor-pointer hover:bg-[#faf8f4] p-2 rounded-lg"
                                  onClick={() => setDrilldown({ filter: { fundingSource: f.source }, title: `Fon kaynağı: ${f.source}` })}
                                  title={`${f.source}: ${f.total} proje, ${formatCurrency(f.totalBudget)} toplam bütçe. Tıklayın → projeleri görün.`}>
                                  <span className="font-medium text-navy truncate">{f.source}</span>
                                  <div className="h-6 rounded" style={{ background: '#f0ede8', position: 'relative' }}>
                                    <div className="h-6 rounded flex items-center px-2 text-white text-[10px] font-semibold"
                                      style={{ width: `${pct}%`, background: color, minWidth: pct > 5 ? 'auto' : '0' }}>
                                      {pct > 15 && <span>{f.total} proje</span>}
                                    </div>
                                  </div>
                                  <div className="text-right whitespace-nowrap">
                                    <p className="font-bold tabular-nums" style={{ color }}>{f.total}</p>
                                    <p className="text-[10px] text-muted">%{budgetShare} bütçe</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Detay kartlar */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 pt-4 border-t" style={{ borderColor: '#f0ede8' }}>
                      {fundingSourceData.slice(0, 6).map((f, i) => (
                        <div key={f.source} className="rounded-xl p-3 border hover:shadow-sm transition-shadow cursor-pointer"
                          style={{ borderColor: SOURCE_COLORS[i % SOURCE_COLORS.length] + '40', background: SOURCE_COLORS[i % SOURCE_COLORS.length] + '08' }}
                          onClick={() => setDrilldown({ filter: { fundingSource: f.source }, title: `Fon kaynağı: ${f.source}` })}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm text-navy truncate">{f.source}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-[#f0ede8] text-[#0f2444]">
                              {f.total} proje
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-center text-[11px] mb-2">
                            <div><p className="font-bold" style={{ color: '#059669' }}>%{f.activeRate ?? 0}</p><p className="text-muted">Aktiflik</p></div>
                            <div><p className="font-bold" style={{ color: '#2563eb' }}>%{f.completedRate ?? 0}</p><p className="text-muted">Tamamlanma</p></div>
                            <div><p className="font-bold" style={{ color: '#d97706' }}>%{f.pendingRate ?? 0}</p><p className="text-muted">Başvuru</p></div>
                          </div>
                          <div className="pt-2 border-t text-[11px]" style={{ borderColor: SOURCE_COLORS[i % SOURCE_COLORS.length] + '30' }}>
                            <p className="flex items-center justify-between text-muted">
                              Toplam:<span className="font-semibold text-navy tabular-nums">{formatCurrency(f.totalBudget)}</span>
                            </p>
                            <p className="flex items-center justify-between text-muted mt-0.5">
                              Ort.:<span className="font-semibold text-navy tabular-nums">{formatCurrency(f.avgBudget)}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proje türü detay kartları */}
                <div className="grid md:grid-cols-2 gap-4">
                  {fundingData.map((f, i) => (
                    <div key={i} className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setDrilldown({ filter: { type: f.type }, title: `Proje türü: ${f.type}` })}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-navy">{f.type?.toUpperCase()}</span>
                        <span className="text-xs px-2 py-1 rounded-full font-bold bg-[#f0ede8] text-[#0f2444]">
                          {f.total} proje
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                        <div><p className="font-bold text-lg" style={{ color: '#059669' }}>%{f.activeRate ?? 0}</p><p className="text-muted">Aktiflik</p></div>
                        <div><p className="font-bold text-lg" style={{ color: '#2563eb' }}>%{f.completedRate ?? 0}</p><p className="text-muted">Tamamlanma</p></div>
                        <div><p className="font-bold text-lg" style={{ color: '#d97706' }}>%{f.pendingRate ?? 0}</p><p className="text-muted">Başvuru</p></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div><p className="font-bold text-navy text-lg">{f.total}</p><p className="text-muted">Toplam</p></div>
                        <div><p className="font-bold text-lg" style={{ color: '#2563eb' }}>{f.completed}</p><p className="text-muted">Bitti</p></div>
                        <div><p className="font-bold text-lg" style={{ color: '#c8a45a' }}>{formatCurrency(f.avgBudget)}</p><p className="text-muted">Ort. Bütçe</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ZAMAN SERİSİ ── */}
            {tab === 'timeline' && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="font-display text-sm font-semibold text-navy">
                    Proje Başlangıç Trendi
                    <span className="text-xs font-normal text-muted ml-2">
                      ({timelineGran === 'month' ? 'Aylık' : timelineGran === 'quarter' ? 'Çeyrek bazlı' : 'Yıllık'})
                    </span>
                  </h3>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted">Çözünürlük:</span>
                    {([
                      { v: 'month', l: 'Ay' },
                      { v: 'quarter', l: 'Çeyrek' },
                      { v: 'year', l: 'Yıl' },
                    ] as const).map(o => (
                      <button key={o.v}
                        onClick={() => setTimelineGran(o.v)}
                        className="px-2.5 py-1 rounded-md font-semibold transition-colors"
                        style={{
                          background: timelineGran === o.v ? '#0f2444' : '#f0ede8',
                          color: timelineGran === o.v ? 'white' : '#6b7280',
                        }}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#1a3a6b" strokeWidth={2.5} dot={{ r: 4 }} name="Başlayan Proje" />
                    <Line type="monotone" dataKey="completed" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name="Tamamlanan" />
                    <Line type="monotone" dataKey="active" stroke="#c8a45a" strokeWidth={2} dot={{ r: 3 }} name="Aktif" />
                  </LineChart>
                </ResponsiveContainer>
                {timelineData.length === 0 && (
                  <p className="text-sm text-muted text-center py-6 italic">
                    Seçili filtrelerle eşleşen proje yok.
                  </p>
                )}
              </div>
            )}

            {/* ── GANTT CHART - profesyonel versiyon ── */}
            {tab === 'gantt' && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-navy">Proje Zaman Çizelgesi</h3>
                    <p className="text-xs text-muted mt-0.5">
                      Filtre, gruplama, hover detayı ve gecikme/yaklaşan teslim uyarılarıyla profesyonel Gantt görünümü
                    </p>
                  </div>
                  <span className="text-xs text-muted">
                    Tarihli: <strong>{allProjects.filter((p: any) => p.startDate && p.endDate).length}</strong> /
                    Toplam: <strong>{allProjects.length}</strong>
                  </span>
                </div>
                <GanttChart projects={allProjects.map((p: any) => ({
                  id: p.id,
                  title: p.title,
                  startDate: p.startDate,
                  endDate: p.endDate,
                  status: p.status,
                  type: p.type,
                  progress: p.latestProgress,
                  faculty: p.faculty,
                  department: p.department,
                  owner: p.owner || (p.ownerName) || (p.ownerFirstName && p.ownerLastName ? `${p.ownerFirstName} ${p.ownerLastName}` : undefined),
                  budget: p.budget,
                  memberCount: p.memberCount,
                }))} />
              </div>
            )}

            {/* ── SCOPUS ANALİTİK ── */}
            {/* ── KURUMSAL KARŞILAŞTIRMA ── */}
            {tab === 'institutional' && isInstitutionWide && <InstitutionalPanel highlightFaculty={user?.faculty} />}

            {/* ── BİBLİYOMETRİ ── (admin panelden kapatılabilir) */}
            {tab === 'bibliometrics' && biblioEnabled && (
              <div className="space-y-4">
                <div className="card p-4 flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-navy">Kapsam:</span>
                  <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f0ede8' }}>
                    {(() => {
                      type BiblioScope = 'me' | 'faculty-compare' | 'dept-compare' | 'institutional';
                      // Permission bazlı yetki kontrolü - Roller & Yetkiler modülünden yönetilir
                      const perms = user?.role?.permissions?.map((p: any) => p.name) || [];
                      const has = (p: string) => perms.includes(p);
                      const canCompareFaculty = has('analytics:faculty-compare');
                      const canCompareDept = has('analytics:dept-compare');
                      const canSeeInstitutional = has('analytics:institutional');
                      const opts: Array<{ v: BiblioScope; l: string }> = [
                        { v: 'me',               l: 'Benim Scorecardım' },
                        ...(canCompareFaculty ? [{ v: 'faculty-compare' as BiblioScope, l: 'Fakülte Karşılaştırma' }] : []),
                        ...(canCompareDept    ? [{ v: 'dept-compare'    as BiblioScope, l: 'Bölüm Karşılaştırma'   }] : []),
                        ...(canSeeInstitutional ? [{ v: 'institutional' as BiblioScope, l: 'Kurumsal Analiz (HMKÜ)' }] : []),
                      ];
                      return opts.map(o => (
                      <button key={o.v} onClick={() => setBiblioScope(o.v)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: biblioScope === o.v ? 'white' : 'transparent',
                          color: biblioScope === o.v ? '#0f2444' : '#6b7280',
                          boxShadow: biblioScope === o.v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        }}>
                        {o.l}
                      </button>
                      ));
                    })()}
                  </div>
                </div>

                {(() => {
                  const perms = user?.role?.permissions?.map((p: any) => p.name) || [];
                  const has = (p: string) => perms.includes(p);
                  const canCompareFaculty = has('analytics:faculty-compare');
                  const canCompareDept = has('analytics:dept-compare');
                  const canSeeInstitutional = has('analytics:institutional');
                  return <>
                    {biblioScope === 'me' && user?.id && (
                      <BibliometricsPanel mode="researcher" userId={user.id} />
                    )}
                    {biblioScope === 'faculty-compare' && canCompareFaculty && (
                      <FacultyComparisonPanel highlightFaculty={user?.faculty} />
                    )}
                    {biblioScope === 'dept-compare' && canCompareDept && (
                      <DepartmentComparisonPanel userFaculty={user?.faculty} userDept={user?.department} roleName={user?.role?.name} />
                    )}
                    {biblioScope === 'institutional' && canSeeInstitutional && (
                      <BibliometricsPanel mode="institutional" />
                    )}
                    {/* Yetki yoksa uyarı */}
                    {((biblioScope === 'faculty-compare' && !canCompareFaculty) ||
                      (biblioScope === 'dept-compare' && !canCompareDept) ||
                      (biblioScope === 'institutional' && !canSeeInstitutional)) && (
                      <div className="card py-12 text-center">
                        <AIcon name="lock" className="w-10 h-10 mx-auto text-amber-500" strokeWidth={1.5} />
                        <p className="text-sm font-semibold text-navy mt-3">Bu analiz için yetkiniz yok</p>
                        <p className="text-xs text-muted mt-1">Sistem yöneticisinden Roller & Yetkiler modülü üzerinden ilgili analiz yetkisini tanımlamasını isteyin.</p>
                      </div>
                    )}
                  </>;
                })()}
              </div>
            )}

            {tab === 'scopus' && biblioEnabled && <ScopusAnalyticsTab />}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// ── SCOPUS ANALİTİK SEKMESİ ──────────────────────────────────────────────
function ScopusAnalyticsTab() {
  const [faculties, setFaculties]   = useState<any[]>([]);
  const [selected, setSelected]     = useState('');
  const [dept, setDept]             = useState('');
  const [metrics, setMetrics]       = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [searched, setSearched]     = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    facultiesApi.getActive()
      .then(r => setFaculties((r.data || []).map((f: any) => f.name)))
      .catch(() => {});
    scopusApi.status()
      .then(r => setConfigured(r.data?.configured ?? false))
      .catch(() => setConfigured(false));
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const r = await scopusApi.getFacultyMetrics(selected || undefined, dept || undefined);
      setMetrics(r.data);
    } catch { setMetrics(null); }
    finally { setLoading(false); }
  };

  if (configured === false) {
    return (
      <div className="card p-8 text-center">
        <AIcon name="beaker" className="w-10 h-10 mx-auto mb-3 text-muted" strokeWidth={1.4} />
        <p className="font-display font-semibold text-navy text-lg mb-2">Scopus Entegrasyonu Aktif Değil</p>
        <p className="text-sm text-muted mb-4">
          Bu özelliği kullanmak için backend <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">.env</code> dosyasına
          Scopus API anahtarını ekleyin.
        </p>
        <div className="inline-block text-left p-4 rounded-xl text-xs font-mono"
          style={{ background: '#1e293b', color: '#94a3b8' }}>
          SCOPUS_API_KEY=your_key_here<br />
          SCOPUS_INST_TOKEN=your_token_here
        </div>
      </div>
    );
  }

  const METRIC_COLORS = ['#7c3aed', '#059669', '#1a3a6b', '#d97706', '#dc2626'];

  return (
    <div className="space-y-5">
      {/* Filtre */}
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold text-navy mb-4 flex items-center gap-2">
          <AIcon name="globe" className="w-4 h-4 text-navy" />
          Scopus Fakülte / Bölüm Analitikleri
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Fakülte</label>
            <select className="input" value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">Tüm Fakülteler</option>
              {faculties.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Bölüm (isteğe bağlı)</label>
            <input className="input" placeholder="Bilgisayar Müh..." value={dept}
              onChange={e => setDept(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={handleSearch} disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <><span className="spinner w-4 h-4" />Hesaplanıyor...</> : <><AIcon name="search" className="w-4 h-4" />Analiz Et</>}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted mt-2 inline-flex items-start gap-1.5">
          <AIcon name="info" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Yalnızca Scopus Author ID tanımlı akademisyenler hesaba katılır. Profil sayfasından Scopus Author ID eklenebilir.</span>
        </p>
      </div>

      {/* Sonuçlar - zenginlestirilmis goruntu */}
      {searched && !loading && metrics && (
        <>
          {metrics.noScopusIds ? (
            <div className="card p-8 text-center">
              <AIcon name="inbox" className="w-10 h-10 mx-auto mb-2 text-muted" strokeWidth={1.4} />
              <p className="font-semibold text-navy text-sm">
                {selected || dept
                  ? `${selected || ''} ${dept || ''} için Scopus Author ID tanımlı akademisyen yok`
                  : 'Hiçbir kullanıcıda Scopus Author ID tanımlı değil'}
              </p>
              <p className="text-xs text-muted mt-2">
                Kullanıcı profilinden Scopus Author ID ekleyerek metrikleri görüntüleyebilirsiniz.
              </p>
            </div>
          ) : (
            <>
              {/* Ana KPI kartlari - 5 sutun */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {([
                  { label: 'Toplam Atıf',     value: metrics.totalCitations?.toLocaleString('tr-TR'), icon: 'link' as AIconName,    color: '#059669' },
                  { label: 'Toplam Yayın',    value: metrics.totalDocuments?.toLocaleString('tr-TR'), icon: 'document' as AIconName,color: '#1a3a6b' },
                  { label: 'Ortalama h-index',value: metrics.avgHIndex,                               icon: 'chart' as AIconName,   color: '#7c3aed' },
                  { label: 'En Yüksek h-index',value: metrics.maxHIndex || '-',                       icon: 'award' as AIconName,   color: '#c8a45a' },
                  { label: 'Scopus Yazar',    value: metrics.authorCount,                             icon: 'user' as AIconName,    color: '#d97706' },
                ]).map(m => (
                  <div key={m.label} className="card py-4 text-center">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-1"
                      style={{ background: m.color + '18', color: m.color }}>
                      <AIcon name={m.icon} className="w-5 h-5" />
                    </span>
                    <p className="font-display text-2xl font-bold" style={{ color: m.color }}>
                      {m.value ?? '-'}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Yıllık Trend - son 10 yil yayin + atif */}
              {metrics.yearlyTrend?.some((y: any) => y.pubs > 0 || y.citations > 0) && (
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-4 inline-flex items-center gap-2">
                    <AIcon name="chart" className="w-4 h-4 text-navy" />
                    Son 10 Yıl - Yayın ve Atıf Trendi
                  </h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={metrics.yearlyTrend} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#6b7280' }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#1a3a6b' }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#059669' }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar yAxisId="left" dataKey="pubs" name="Yayın" fill="#1a3a6b" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="citations" name="Toplam Atıf" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* En Üretken Yazarlar - tablo */}
              {metrics.topAuthors?.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-4 inline-flex items-center gap-2">
                    <AIcon name="user" className="w-4 h-4 text-navy" />
                    En Üretken Yazarlar (Top {Math.min(metrics.topAuthors.length, 15)})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b" style={{ borderColor: '#e8e4dc' }}>
                          <th className="text-left py-2 px-2 text-xs font-semibold text-muted">#</th>
                          <th className="text-left py-2 px-2 text-xs font-semibold text-muted">Yazar</th>
                          <th className="text-left py-2 px-2 text-xs font-semibold text-muted">Bölüm</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold text-muted">h-index</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold text-muted">Atıf</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold text-muted">Yayın</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.topAuthors.map((a: any, i: number) => (
                          <tr key={a.scopusId} className="border-b hover:bg-[#faf8f4]" style={{ borderColor: '#f0ede8' }}>
                            <td className="py-2 px-2 text-xs text-muted">{i + 1}</td>
                            <td className="py-2 px-2 text-sm font-semibold text-navy">{a.name}</td>
                            <td className="py-2 px-2 text-xs text-muted">{a.department || '-'}</td>
                            <td className="py-2 px-2 text-right font-bold text-navy">{a.hIndex || 0}</td>
                            <td className="py-2 px-2 text-right text-sm">{a.citations?.toLocaleString('tr-TR') || 0}</td>
                            <td className="py-2 px-2 text-right text-sm">{a.documents || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* En Çok Atıf Alan Yayınlar */}
              {metrics.topPublications?.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-4 inline-flex items-center gap-2">
                    <AIcon name="document" className="w-4 h-4 text-navy" />
                    En Çok Atıf Alan Yayınlar (Top {metrics.topPublications.length})
                  </h3>
                  <div className="space-y-2">
                    {metrics.topPublications.map((p: any, i: number) => (
                      <div key={p.scopusId || i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#faf8f4]" style={{ background: '#fcfaf6', border: '1px solid #f0ede8' }}>
                        <span className="text-xs font-bold w-6 text-muted text-right flex-shrink-0 mt-1">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy leading-snug">{p.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted flex-wrap">
                            {p.journal && <span>📖 {p.journal}</span>}
                            {p.year && <span>📅 {p.year}</span>}
                            {p.doi && (
                              <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer"
                                className="font-medium hover:underline" style={{ color: '#1a3a6b' }}>
                                DOI ↗
                              </a>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-bold flex-shrink-0 px-3 py-1 rounded-full"
                          style={{ background: '#059669' + '18', color: '#059669' }}>
                          {p.citedBy?.toLocaleString('tr-TR') || 0} atıf
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2 sütunlu: Top Dergiler + Konu Alanları */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Dergiler */}
                {metrics.topJournals?.length > 0 && (
                  <div className="card p-5">
                    <h3 className="font-display text-sm font-semibold text-navy mb-4 inline-flex items-center gap-2">
                      <AIcon name="book" className="w-4 h-4 text-navy" />
                      En Sık Yayın Yapılan Dergiler
                    </h3>
                    <div className="space-y-2">
                      {metrics.topJournals.slice(0, 10).map((j: any, i: number) => {
                        const maxCount = metrics.topJournals[0]?.count || 1;
                        const pct = Math.round((j.count / maxCount) * 100);
                        return (
                          <div key={i} className="text-xs">
                            <div className="flex justify-between mb-1">
                              <span className="font-semibold text-navy line-clamp-1 flex-1 min-w-0 mr-2" title={j.name}>{j.name}</span>
                              <span className="text-muted flex-shrink-0">{j.count} yayın · {j.citations} atıf</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f0ede8' }}>
                              <div className="h-1.5 rounded-full"
                                style={{ width: `${pct}%`, background: '#7c3aed' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Konu Alanları */}
                {metrics.topSubjects?.length > 0 && (
                  <div className="card p-5">
                    <h3 className="font-display text-sm font-semibold text-navy mb-4 inline-flex items-center gap-2">
                      <AIcon name="target" className="w-4 h-4 text-navy" />
                      Araştırma Alan Dağılımı
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={metrics.topSubjects} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#374151' }} width={75} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 12 }}
                          formatter={(v: any) => [v + ' yazar', 'Yazar Sayısı']} />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                          {metrics.topSubjects.map((_: any, i: number) => (
                            <Cell key={i} fill={METRIC_COLORS[i % METRIC_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Bölüm Karşılaştırması (sadece fakülte modunda + birden fazla bölüm varsa) */}
              {metrics.departmentBreakdown?.length > 1 && (
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-4 inline-flex items-center gap-2">
                    <AIcon name="building" className="w-4 h-4 text-navy" />
                    Bölüm Karşılaştırması
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b" style={{ borderColor: '#e8e4dc' }}>
                          <th className="text-left py-2 px-2 text-xs font-semibold text-muted">Bölüm</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold text-muted">Yazar</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold text-muted">Atıf</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold text-muted">Yayın</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold text-muted">Ort. h-index</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.departmentBreakdown.map((d: any, i: number) => (
                          <tr key={d.department} className="border-b hover:bg-[#faf8f4]" style={{ borderColor: '#f0ede8' }}>
                            <td className="py-2 px-2 text-sm font-semibold text-navy">{d.department}</td>
                            <td className="py-2 px-2 text-right text-sm">{d.authorCount}</td>
                            <td className="py-2 px-2 text-right text-sm font-semibold" style={{ color: '#059669' }}>{d.totalCitations.toLocaleString('tr-TR')}</td>
                            <td className="py-2 px-2 text-right text-sm">{d.totalDocuments.toLocaleString('tr-TR')}</td>
                            <td className="py-2 px-2 text-right font-bold text-navy">{d.avgHIndex}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Anahtar Kelime Bulutu */}
              {metrics.topKeywords?.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-4 inline-flex items-center gap-2">
                    <AIcon name="tag" className="w-4 h-4 text-navy" />
                    En Sık Kullanılan Anahtar Kelimeler
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {metrics.topKeywords.map((k: any, i: number) => {
                      const max = metrics.topKeywords[0]?.count || 1;
                      const ratio = k.count / max;
                      const fontSize = 10 + Math.round(ratio * 8); // 10-18px
                      const color = METRIC_COLORS[i % METRIC_COLORS.length];
                      return (
                        <span key={k.keyword}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-medium"
                          style={{
                            fontSize: `${fontSize}px`,
                            background: color + '15',
                            color,
                            border: `1px solid ${color}33`,
                          }}>
                          {k.keyword}
                          <span className="text-[10px] opacity-70 font-bold">{k.count}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {!searched && (
        <div className="card p-10 text-center">
          <p className="text-4xl mb-3">🌍</p>
          <p className="font-display font-semibold text-navy text-lg mb-1">Scopus Akademik Analitik</p>
          <p className="text-sm text-muted">
            Fakülte veya bölüm seçerek akademisyenlerin Scopus metriklerini görüntüleyin.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Dönemsel Rapor Modal ─── */
function PeriodReportModal({ onClose }: { onClose: () => void }) {
  const [preset, setPreset] = useState<'custom' | '7d' | '30d' | '90d' | '1y' | 'qtr' | 'ytd'>('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Preset'e göre tarihleri otomatik ayarla
  const applyPreset = (p: typeof preset) => {
    setPreset(p);
    const today = new Date();
    const toStr = today.toISOString().slice(0, 10);
    const back = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return d.toISOString().slice(0, 10);
    };
    switch (p) {
      case '7d':  setFrom(back(7));   setTo(toStr); break;
      case '30d': setFrom(back(30));  setTo(toStr); break;
      case '90d': setFrom(back(90));  setTo(toStr); break;
      case '1y':  setFrom(back(365)); setTo(toStr); break;
      case 'qtr': {
        // Bu çeyreğin başı
        const q = Math.floor(today.getMonth() / 3);
        const start = new Date(today.getFullYear(), q * 3, 1);
        setFrom(start.toISOString().slice(0, 10));
        setTo(toStr);
        break;
      }
      case 'ytd': {
        const start = new Date(today.getFullYear(), 0, 1);
        setFrom(start.toISOString().slice(0, 10));
        setTo(toStr);
        break;
      }
    }
  };

  // İlk açılışta 30 günlük preset uygula
  useEffect(() => { applyPreset('30d'); }, []); // eslint-disable-line

  const handleGenerate = () => {
    if (!from || !to) {
      toast.error('Tarih aralığı seçin');
      return;
    }
    if (from > to) {
      toast.error('Başlangıç tarihi bitişten sonra olamaz');
      return;
    }
    // Token'ı session'a geçir ve yeni sekmede aç
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('tto_token');
      if (token) sessionStorage.setItem('tto_print_token', token);
    }
    const url = `/analysis/period-report?from=${from}&to=${to}&preset=${preset}`;
    window.open(url, '_blank');
    onClose();
  };

  const presetBtn = (p: typeof preset, label: string) => (
    <button
      key={p}
      onClick={() => applyPreset(p)}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{
        background: preset === p ? '#1a3a6b' : '#f0ede8',
        color: preset === p ? 'white' : '#6b7280',
        border: preset === p ? '1.5px solid #1a3a6b' : '1.5px solid #e8e4dc',
      }}>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15, 36, 68, 0.6)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" style={{ border: '1px solid #c8a45a' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-navy">Dönemsel Rapor</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream" style={{ border: '1px solid #e8e4dc' }}>
            <svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-muted mb-4">Belirli bir tarih aralığı için PDF raporu üretir - başvurulan/aktifleşen/tamamlanan projeler dönem içinde.</p>

        <label className="label">Hazır Aralık</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {presetBtn('7d', 'Son 7 Gün')}
          {presetBtn('30d', 'Son 30 Gün')}
          {presetBtn('90d', 'Son 90 Gün')}
          {presetBtn('qtr', 'Bu Çeyrek')}
          {presetBtn('ytd', 'Yıl Başından Bugüne')}
          {presetBtn('1y', 'Son 1 Yıl')}
          {presetBtn('custom', 'Özel')}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Başlangıç</label>
            <input type="date" className="input" value={from} onChange={e => { setFrom(e.target.value); setPreset('custom'); }} />
          </div>
          <div>
            <label className="label">Bitiş</label>
            <input type="date" className="input" value={to} onChange={e => { setTo(e.target.value); setPreset('custom'); }} />
          </div>
        </div>

        {from && to && (
          <p className="text-xs text-muted mb-4">
            Seçilen aralık: <strong className="text-navy">{from}</strong> → <strong className="text-navy">{to}</strong> · {Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000)} gün
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={handleGenerate} disabled={!from || !to} className="btn-primary flex-1 inline-flex items-center justify-center gap-2">
            <AIcon name="document" className="w-4 h-4" />
            Raporu Oluştur
          </button>
          <button onClick={onClose} className="btn-secondary">İptal</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Fakülte Bibliyometri Karşılaştırma Panel ─── */
function FacultyComparisonPanel({ highlightFaculty }: { highlightFaculty?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/analytics/bibliometrics/faculty-comparison')
      .then(r => setData(r.data))
      .catch(e => setErr(e?.response?.data?.message || 'Karşılaştırma yüklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card flex justify-center py-20"><div className="spinner" /></div>;
  if (err) return <div className="card py-12 text-center text-sm text-red-500">{err}</div>;
  if (!data?.faculties?.length) return <div className="card py-12 text-center text-sm text-muted">Fakülte verisi bulunamadı.</div>;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl flex items-start gap-3 text-xs" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
        <AIcon name="info" className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="leading-relaxed">
          <strong>Fakülteler arası bibliyometri karşılaştırması.</strong> Her fakülteden en çok 5 araştırmacı örneklenmiştir - fakülte başına sayılar bu örneklemi yansıtır, tüm akademik kadroyu değil. Örneklem boyutu sağda gösterilir. Sarı satır sizin fakültenizdir.
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: '#faf8f4', borderBottom: '1px solid #e8e4dc' }}>
              <th className="text-left px-3 py-2 font-semibold text-muted">#</th>
              <th className="text-left px-3 py-2 font-semibold text-muted">Fakülte</th>
              <th className="text-right px-3 py-2 font-semibold text-muted">Örneklem</th>
              <th className="text-right px-3 py-2 font-semibold text-muted">Yayın</th>
              <th className="text-right px-3 py-2 font-semibold text-muted">Atıf</th>
              <th className="text-right px-3 py-2 font-semibold text-muted">h-index</th>
              <th className="text-right px-3 py-2 font-semibold text-muted">i10</th>
              <th className="text-right px-3 py-2 font-semibold text-muted">FWCI</th>
              <th className="text-right px-3 py-2 font-semibold text-muted">Top 1%</th>
              <th className="text-right px-3 py-2 font-semibold text-muted">Q1</th>
              <th className="text-right px-3 py-2 font-semibold text-muted">OA %</th>
              <th className="text-right px-3 py-2 font-semibold text-muted">Uluslararası %</th>
              <th className="text-left px-3 py-2 font-semibold text-muted">Top Araştırmacı</th>
            </tr>
          </thead>
          <tbody>
            {data.faculties.map((f: any, i: number) => {
              const isOwn = highlightFaculty && f.faculty === highlightFaculty;
              return (
                <tr key={f.faculty} className="border-b" style={{ borderColor: '#f5f2ee', background: isOwn ? '#fef3c7' : undefined, fontWeight: isOwn ? 700 : undefined }}>
                  <td className="px-3 py-2 text-muted">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-navy">
                    {f.faculty}
                    {isOwn && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded text-white font-bold" style={{ background: '#c8a45a' }}>SİZİN</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-muted">{f.sampleSize}/{f.withIdentifiersCount}</td>
                  <td className="px-3 py-2 text-right text-navy">{f.totalPubs}</td>
                  <td className="px-3 py-2 text-right text-navy">{f.totalCitations}</td>
                  <td className="px-3 py-2 text-right font-bold">{f.hIndex}</td>
                  <td className="px-3 py-2 text-right">{f.i10Index}</td>
                  <td className="px-3 py-2 text-right">{f.avgFwci !== null ? (+f.avgFwci).toFixed(2) : '-'}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{f.top1PctCount}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{f.q1Count}</td>
                  <td className="px-3 py-2 text-right">%{f.openAccessRatio}</td>
                  <td className="px-3 py-2 text-right">%{f.internationalRatio}</td>
                  <td className="px-3 py-2 text-xs">{f.topResearcher?.name || '-'}{f.topResearcher ? ` · h=${f.topResearcher.hIndex}` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.note && <p className="text-xs text-muted px-1">{data.note}</p>}
    </div>
  );
}

/* ─── Bölüm Bibliyometri Karşılaştırma Panel ─── */
function DepartmentComparisonPanel({ userFaculty, userDept, roleName }: { userFaculty?: string; userDept?: string; roleName?: string }) {
  const [selectedFaculty, setSelectedFaculty] = useState(userFaculty || '');
  const [facultyList, setFacultyList] = useState<string[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    // Süper Admin/Rektör için tüm fakülteler seçilebilir
    if (roleName === 'Süper Admin' || roleName === 'Rektör') {
      api.get('/analytics/institutional/faculty-radar').then(r => {
        setFacultyList((r.data || []).map((f: any) => f.faculty));
      }).catch(() => {});
    }
  }, [roleName]);

  useEffect(() => {
    if (!selectedFaculty) return;
    setLoading(true); setErr('');
    api.get('/analytics/bibliometrics/department-comparison', { params: { faculty: selectedFaculty } })
      .then(r => setData(r.data))
      .catch(e => setErr(e?.response?.data?.message || 'Karşılaştırma yüklenemedi'))
      .finally(() => setLoading(false));
  }, [selectedFaculty]);

  const canSelectFaculty = roleName === 'Süper Admin' || roleName === 'Rektör';

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl flex items-start gap-3 text-xs" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
        <AIcon name="info" className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="leading-relaxed flex-1">
          <strong>Bölümler arası bibliyometri karşılaştırması.</strong> Seçili fakülte içindeki bölümler - her bölümden en çok 3 araştırmacı örneklenmiştir.
          {canSelectFaculty && (
            <div className="mt-2">
              <select className="input text-sm py-1 w-72" value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)}>
                <option value="">Fakülte seçin...</option>
                {facultyList.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}
          {!canSelectFaculty && selectedFaculty && (
            <div className="mt-1"><strong>Fakülte:</strong> {selectedFaculty}</div>
          )}
        </div>
      </div>

      {!selectedFaculty && !canSelectFaculty && (
        <div className="card py-12 text-center text-sm text-muted">Profilinizde fakülte bilgisi bulunamadı.</div>
      )}
      {!selectedFaculty && canSelectFaculty && (
        <div className="card py-12 text-center text-sm text-muted">Karşılaştırmak istediğiniz fakülteyi seçin.</div>
      )}
      {loading && <div className="card flex justify-center py-20"><div className="spinner" /></div>}
      {err && <div className="card py-12 text-center text-sm text-red-500">{err}</div>}

      {!loading && !err && data?.departments?.length > 0 && (
        <>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#faf8f4', borderBottom: '1px solid #e8e4dc' }}>
                  <th className="text-left px-3 py-2 font-semibold text-muted">#</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted">Bölüm</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted">Örneklem</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted">Yayın</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted">Atıf</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted">h-index</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted">FWCI</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted">Q1</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted">OA %</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted">Top Araştırmacı</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((d: any, i: number) => {
                  const isOwn = userDept && d.department === userDept;
                  return (
                    <tr key={d.department} className="border-b" style={{ borderColor: '#f5f2ee', background: isOwn ? '#fef3c7' : undefined, fontWeight: isOwn ? 700 : undefined }}>
                      <td className="px-3 py-2 text-muted">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold text-navy">
                        {d.department}
                        {isOwn && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded text-white font-bold" style={{ background: '#c8a45a' }}>SİZİN</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-muted">{d.sampleSize}/{d.withIdentifiersCount}</td>
                      <td className="px-3 py-2 text-right text-navy">{d.totalPubs}</td>
                      <td className="px-3 py-2 text-right text-navy">{d.totalCitations}</td>
                      <td className="px-3 py-2 text-right font-bold">{d.hIndex}</td>
                      <td className="px-3 py-2 text-right">{d.avgFwci !== null ? (+d.avgFwci).toFixed(2) : '-'}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{d.q1Count}</td>
                      <td className="px-3 py-2 text-right">%{d.openAccessRatio}</td>
                      <td className="px-3 py-2 text-xs">{d.topResearcher?.name || '-'}{d.topResearcher ? ` · h=${d.topResearcher.hIndex}` : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.note && <p className="text-xs text-muted px-1">{data.note}</p>}
        </>
      )}
      {!loading && data?.departments?.length === 0 && (
        <div className="card py-12 text-center text-sm text-muted">Bu fakültede kimliği tanımlı araştırmacı yok.</div>
      )}
    </div>
  );
}

/**
 * Drilldown Modal - KPI/chart bileşenine tıklandığında açılır,
 * filtreli proje listesini modal içinde gösterir.
 */
function DrilldownModal({ filter, title, onClose }: {
  filter: Record<string, string>;
  title: string;
  onClose: () => void;
}) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params: any = { limit: 100 };
    // Backend projects/findAll bazı anahtarları anlıyor
    if (filter.type) params.type = filter.type;
    if (filter.status) params.status = filter.status;
    if (filter.faculty) params.faculty = filter.faculty;
    // fundingSource için search'e düşeceğiz - projects endpoint'inde direkt filtre yok
    api.get('/projects', { params }).then(r => {
      let data = r.data?.data || [];
      // fundingSource filtresi client-side normalleştir
      if (filter.fundingSource && filter.fundingSource !== 'Belirtilmemiş') {
        const want = filter.fundingSource.toLowerCase();
        data = data.filter((p: any) => (p.fundingSource || '').toLowerCase().includes(want.split('/')[0].trim().toLowerCase()));
      } else if (filter.fundingSource === 'Belirtilmemiş') {
        data = data.filter((p: any) => !p.fundingSource || p.fundingSource.trim() === '');
      }
      setProjects(data);
      setTotal(data.length);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#e8e4dc' }}>
          <div>
            <p className="text-[10px] tracking-widest uppercase font-bold mb-1" style={{ color: '#8a7a52' }}>Drill-down</p>
            <h3 className="font-display text-lg font-bold text-navy">{title}</h3>
            <p className="text-xs text-muted mt-1">{loading ? 'Yükleniyor…' : `${total} proje bulundu`}</p>
          </div>
          <button onClick={onClose} className="text-2xl text-muted hover:text-navy leading-none" aria-label="Kapat">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16"><div className="spinner" /></div>
          ) : projects.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted italic">Bu kritere uygun proje bulunamadı.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#f0ede8' }}>
              {projects.map(p => (
                <a key={p.id} href={`/projects/${p.id}`}
                  className="block px-5 py-3 hover:bg-[#faf8f4] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-navy line-clamp-1">{p.title}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted mt-1">
                        <span>{p.type}</span>
                        {p.faculty && <span>· {p.faculty}</span>}
                        {p.fundingSource && <span>· {p.fundingSource}</span>}
                        {p.startDate && <span>· {p.startDate}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.budget && (
                        <span className="text-xs font-semibold tabular-nums text-navy">{formatCurrency(p.budget)}</span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: p.status === 'active' ? '#dcfce7' : p.status === 'completed' ? '#dbeafe' : p.status === 'cancelled' ? '#fee2e2' : '#fef3c7',
                          color: p.status === 'active' ? '#15803d' : p.status === 'completed' ? '#1d4ed8' : p.status === 'cancelled' ? '#b91c1c' : '#92400e',
                        }}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex items-center justify-between text-xs" style={{ borderColor: '#e8e4dc', background: '#faf8f4' }}>
          <span className="text-muted">Proje adına tıklayarak detay sayfasına gidin</span>
          <button onClick={onClose} className="btn-secondary text-xs px-3 py-1.5">Kapat</button>
        </div>
      </div>
    </div>
  );
}
