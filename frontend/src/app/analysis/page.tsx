'use client';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api, projectTypesApi, facultiesApi, scopusApi } from '@/lib/api';
import { ProjectTypeItem, FacultyItem } from '@/types';
import { formatCurrency, getProjectTypeLabel, getProjectTypeColor } from '@/lib/utils';
import { GanttChart } from '@/components/GanttChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

const C = ['#0f2444','#1a3a6b','#c8a45a','#e8c97a','#2d5aff','#94a3b8','#059669','#dc2626','#7c3aed','#ea580c'];

const STATUS_LABELS: Record<string,string> = {
  application:'Başvuru', pending:'Beklemede', active:'Aktif',
  completed:'Tamamlandı', suspended:'Askıya Alındı', cancelled:'İptal',
};
const STATUS_COLORS: Record<string,string> = {
  application:'#d97706', pending:'#d97706', active:'#059669', completed:'#2563eb',
  suspended:'#6b7280', cancelled:'#dc2626',
};

type Tab = 'overview' | 'faculty' | 'researcher' | 'funding' | 'timeline' | 'gantt' | 'scopus';

export default function AnalysisPage() {
  const [tab, setTab] = useState<Tab>('overview');
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
    api.get('/analytics/overview', { params: { year: filterYear, faculty: filterFaculty, type: filterType } })
      .then(r => setOverview(r.data))
      .catch(() => {})
      .finally(() => setOverviewLoading(false));
  }, [filterYear, filterFaculty, filterType]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('tto_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/export/projects/csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'projeler.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {} finally { setExporting(false); }
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview',    label: 'Genel Bakış',      icon: '📊' },
    { key: 'faculty',     label: 'Fakülteler',        icon: '🏛' },
    { key: 'researcher',  label: 'Araştırmacılar',    icon: '🔬' },
    { key: 'funding',     label: 'Fon Analizi',       icon: '💰' },
    { key: 'timeline',    label: 'Zaman Serisi',      icon: '📅' },
    { key: 'gantt',       label: 'Gantt',             icon: '📊' },
    { key: 'scopus',      label: 'Scopus Analitik',   icon: '🌍' },
  ];

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
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <button onClick={handleExportCsv} disabled={exporting} className="btn-secondary text-sm flex items-center gap-2">
            {exporting ? <span className="spinner w-3 h-3" /> : '⬇'} CSV İndir
          </button>
        </div>

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

        {dataError && <div className="p-4 rounded-xl text-sm text-red-700 mb-4" style={{background:'#fef2f2',border:'1px solid #fecaca'}}>⚠️ {dataError}</div>}
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
                  <div className="flex items-center gap-2 p-3 rounded-xl text-sm mb-2" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                    <span>🔒</span>
                    <span>Yalnızca yetkili olduğunuz projeler gösteriliyor. Tüm analizlere erişim için yöneticinizle iletişime geçin.</span>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Toplam Proje', val: overview.total, icon: '📁', color: '#1a3a6b' },
                    { label: 'Toplam Bütçe', val: formatCurrency(overview.totalBudget), icon: '💰', color: '#c8a45a' },
                    { label: 'Başarı Oranı', val: `%${overview.successRate}`, icon: '✅', color: '#059669' },
                    { label: 'Ort. Bütçe', val: formatCurrency(overview.avgBudget), icon: '📊', color: '#7c3aed' },
                  ].map(item => (
                    <div key={item.label} className="card p-5 text-center">
                      <div className="text-2xl mb-2">{item.icon}</div>
                      <div className="font-display text-2xl font-bold" style={{ color: item.color }}>{item.val}</div>
                      <div className="text-xs text-muted mt-1">{item.label}</div>
                    </div>
                  ))}
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
            {tab === 'faculty' && (
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
                            { label: 'Aktif', val: f.active, color: '#059669' },
                            { label: 'Tamamlandı', val: f.completed, color: '#2563eb' },
                            { label: 'Başarı', val: `%${f.successRate}`, color: '#c8a45a' },
                            { label: 'Ort. Bütçe', val: formatCurrency(f.avgBudget), color: '#7c3aed' },
                          ].map(item => (
                            <div key={item.label} className="text-center">
                              <div className="font-bold" style={{ color: item.color }}>{item.val}</div>
                              <div className="text-muted">{item.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: '#f0ede8' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${f.successRate}%`, background: '#059669' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ARAŞTIRMACI VERİMLİLİĞİ ── */}
            {tab === 'researcher' && (
              <div className="space-y-4">
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-4">🔬 Araştırmacı Üretkenlik Sıralaması</h3>
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
            {tab === 'funding' && (
              <div className="space-y-6">
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-4">Fon Kaynağı Başarı Oranları</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={fundingData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                      <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#1a3a6b" name="Toplam" />
                      <Bar dataKey="completed" fill="#059669" name="Tamamlandı" />
                      <Bar dataKey="active" fill="#c8a45a" name="Aktif" />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {fundingData.map((f, i) => (
                    <div key={i} className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-navy">{f.type?.toUpperCase()}</span>
                        <span className="text-xs px-2 py-1 rounded-full font-bold"
                          style={{ background: f.successRate >= 50 ? '#d1fae5' : '#fef3c7', color: f.successRate >= 50 ? '#059669' : '#d97706' }}>
                          %{f.successRate} başarı
                        </span>
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
                <h3 className="font-display text-sm font-semibold text-navy mb-4">Aylık Proje Başlangıç Trendi</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#1a3a6b" strokeWidth={2.5} dot={{ r: 4 }} name="Proje Sayısı" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── GANTT CHART ── */}
            {tab === 'gantt' && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-sm font-semibold text-navy">Proje Zaman Çizelgesi</h3>
                  <span className="text-xs text-muted">{allProjects.filter((p: any) => p.startDate && p.endDate).length} proje gösteriliyor</span>
                </div>
                <GanttChart projects={allProjects.map((p: any) => ({
                  id: p.id,
                  title: p.title,
                  startDate: p.startDate,
                  endDate: p.endDate,
                  status: p.status,
                  type: p.type,
                  progress: p.latestProgress,
                }))} />
              </div>
            )}

            {/* ── SCOPUS ANALİTİK ── */}
            {tab === 'scopus' && <ScopusAnalyticsTab />}
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
        <p className="text-3xl mb-3">🔬</p>
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
          🌍 Scopus Fakülte / Bölüm Analitikleri
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
              {loading ? <><span className="spinner w-4 h-4" />Hesaplanıyor...</> : '🔍 Analiz Et'}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted mt-2">
          ℹ️ Yalnızca Scopus Author ID tanımlı akademisyenler hesaba katılır.
          Profil sayfasından Scopus Author ID eklenebilir.
        </p>
      </div>

      {/* Sonuçlar */}
      {searched && !loading && metrics && (
        <>
          {metrics.noScopusIds ? (
            <div className="card p-8 text-center">
              <p className="text-3xl mb-2">📭</p>
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
              {/* Ana metrik kartları */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Toplam Atıf',     value: metrics.totalCitations?.toLocaleString('tr-TR'),  icon: '🔗', color: '#059669' },
                  { label: 'Toplam Yayın',    value: metrics.totalDocuments?.toLocaleString('tr-TR'),  icon: '📄', color: '#1a3a6b' },
                  { label: 'Ort. h-index',    value: metrics.avgHIndex,                                icon: '📊', color: '#7c3aed' },
                  { label: 'Scopus Yazar',    value: metrics.authorCount,                              icon: '👤', color: '#d97706' },
                ].map(m => (
                  <div key={m.label} className="card py-5 text-center">
                    <p className="text-2xl mb-1">{m.icon}</p>
                    <p className="font-display text-2xl font-bold" style={{ color: m.color }}>
                      {m.value ?? '—'}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Konu alanları */}
              {metrics.topSubjects?.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-4">
                    🎯 Öne Çıkan Araştırma Alanları
                    <span className="font-normal text-xs text-muted ml-2">
                      {selected || 'Tüm fakülteler'}
                      {dept ? ` › ${dept}` : ''}
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {metrics.topSubjects.map((s: any, i: number) => {
                      const maxCount = metrics.topSubjects[0]?.count || 1;
                      const pct = Math.round((s.count / maxCount) * 100);
                      return (
                        <div key={s.code} className="flex items-center gap-3">
                          <span className="text-xs font-bold w-5 text-muted text-right flex-shrink-0">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-semibold text-navy">{s.label}</span>
                              <span className="text-muted">{s.count} yazar</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f0ede8' }}>
                              <div className="h-2 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: METRIC_COLORS[i % METRIC_COLORS.length] }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recharts — konu dağılımı */}
              {metrics.topSubjects?.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-4">📊 Alan Dağılımı</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={metrics.topSubjects} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 12 }}
                        formatter={(v: any) => [v + ' yazar', 'Yazar Sayısı']}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {metrics.topSubjects.map((_: any, i: number) => (
                          <Cell key={i} fill={METRIC_COLORS[i % METRIC_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
