'use client';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api, projectTypesApi, facultiesApi } from '@/lib/api';
import { ProjectTypeItem, FacultyItem } from '@/types';
import { formatCurrency, getProjectTypeLabel, getProjectTypeColor } from '@/lib/utils';
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

type Tab = 'overview' | 'faculty' | 'researcher' | 'funding' | 'timeline';

export default function AnalysisPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [facultyData, setFacultyData] = useState<any[]>([]);
  const [researcherData, setResearcherData] = useState<any[]>([]);
  const [fundingData, setFundingData] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeItem[]>([]);
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [filterYear, setFilterYear] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterType, setFilterType] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      projectTypesApi.getAll().then(r => setProjectTypes(r.data)).catch(() => {}),
      facultiesApi.getAll().then(r => setFaculties(r.data)).catch(() => {}),
      api.get('/analytics/faculty-performance').then(r => setFacultyData(r.data)).catch(() => {}),
      api.get('/analytics/researcher-productivity', { params: { limit: 10 } }).then(r => setResearcherData(r.data)).catch(() => {}),
      api.get('/analytics/funding-success').then(r => setFundingData(r.data)).catch(() => {}),
      api.get('/analytics/timeline').then(r => setTimelineData(r.data)).catch(() => {}),
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
    { key: 'overview',    label: 'Genel Bakış',   icon: '📊' },
    { key: 'faculty',     label: 'Fakülteler',     icon: '🏛' },
    { key: 'researcher',  label: 'Araştırmacılar', icon: '🔬' },
    { key: 'funding',     label: 'Fon Analizi',    icon: '💰' },
    { key: 'timeline',    label: 'Zaman Serisi',   icon: '📅' },
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

        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : (
          <>
            {/* ── GENEL BAKIŞ ── */}
            {tab === 'overview' && overviewLoading && <div className="flex justify-center py-10"><div className="spinner" /></div>}
            {tab === 'overview' && !overviewLoading && !overview && <p className="text-sm text-muted text-center py-10">Veri bulunamadı. Henüz proje eklenmemiş olabilir.</p>}
            {tab === 'overview' && !overviewLoading && overview && (
              <div className="space-y-6">
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
