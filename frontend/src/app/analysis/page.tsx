'use client';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { projectsApi, projectTypesApi, facultiesApi } from '@/lib/api';
import { Project, ProjectTypeItem, FacultyItem } from '@/types';
import { PROJECT_STATUS_LABELS, SDG_GOALS, SDG_MAP, getProjectTypeLabel, getProjectTypeColor, formatCurrency } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  application: '#d97706', pending: '#d97706',
  active: '#059669', completed: '#2563eb',
};
const C = ['#0f2444', '#1a3a6b', '#c8a45a', '#e8c97a', '#2d5aff', '#94a3b8', '#059669', '#dc2626'];

const normalizeStatus = (s: string) => s === 'pending' ? 'application' : s;

export default function AnalysisPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeItem[]>([]);
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterYear, setFilterYear] = useState('');

  useEffect(() => {
    Promise.all([
      projectsApi.getAll({ limit: 1000 }).then(r => setProjects(r.data.data || [])),
      projectTypesApi.getAll().then(r => setProjectTypes(r.data)).catch(() => {}),
      facultiesApi.getAll().then(r => setFaculties(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const availableYears = Array.from(new Set(projects.map(p => p.startDate?.substring(0,4)).filter(Boolean))).sort().reverse() as string[];

  if (loading) return (
    <DashboardLayout><Header title="Analiz" />
      <div className="flex-1 flex items-center justify-center"><div className="spinner" /></div>
    </DashboardLayout>
  );

  // Status — normalize pending→application
  const filteredProjects = projects.filter(p => {
    if (filterType && p.type !== filterType) return false;
    if (filterFaculty && p.faculty !== filterFaculty) return false;
    if (filterYear) {
      const year = p.startDate ? p.startDate.substring(0, 4) : null;
      if (year !== filterYear) return false;
    }
    return true;
  });
  const normalizedProjects = filteredProjects.map(p => ({ ...p, status: normalizeStatus(p.status) }));

  const byStatus = Object.entries(
    normalizedProjects.reduce((a, p) => ({ ...a, [p.status]: (a[p.status] || 0) + 1 }), {} as Record<string, number>)
  )
    .filter(([k]) => ['application', 'active', 'completed'].includes(k))
    .map(([k, v]) => ({ name: PROJECT_STATUS_LABELS[k] || k, value: v, color: STATUS_COLORS[k] || '#64748b' }));

  const byType = Object.entries(
    filteredProjects.reduce((a, p) => ({ ...a, [p.type]: (a[p.type] || 0) + 1 }), {} as Record<string, number>)
  ).map(([k, v]) => ({ name: getProjectTypeLabel(k, projectTypes), value: v, color: getProjectTypeColor(k, projectTypes) }));

  const byFaculty = Object.entries(
    filteredProjects.filter(p => p.faculty).reduce((a, p) => ({ ...a, [p.faculty!]: (a[p.faculty!] || 0) + 1 }), {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ name: k.split(' ')[0], fullName: k, count: v }));


  const byYear = Object.entries(
    projects.filter(p => p.startDate).reduce((a, p) => {
      const y = p.startDate!.substring(0, 4); return { ...a, [y]: (a[y] || 0) + 1 };
    }, {} as Record<string, number>)
  ).sort().map(([k, v]) => ({ year: k, count: v }));

  const byTypeAndStatus = (projectTypes.length ? projectTypes.map(t => t.key) : ['tubitak', 'bap', 'eu', 'industry', 'other']).map(typeKey => {
    const typeProjs = normalizedProjects.filter(p => p.type === typeKey);
    return {
      name: getProjectTypeLabel(typeKey, projectTypes),
      active: typeProjs.filter(p => p.status === 'active').length,
      application: typeProjs.filter(p => p.status === 'application').length,
      completed: typeProjs.filter(p => p.status === 'completed').length,
    };
  }).filter(t => t.active + t.application + t.completed > 0);

  const KPI = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) => (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{label}</p>
      <p className="font-display text-3xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );

  // SDG Distribution (filtrelenmiş projelere göre)
  const sdgCounts: Record<string, number> = {};
  filteredProjects.forEach(p => {
    const goals = (p as any).sdgGoals || [];
    goals.forEach((code: string) => {
      sdgCounts[code] = (sdgCounts[code] || 0) + 1;
    });
  });
  const sdgData = Object.entries(sdgCounts)
    .map(([code, count]) => ({ code, count, goal: SDG_MAP[code] }))
    .filter(x => x.goal)
    .sort((a, b) => b.count - a.count);
  const bySdg = sdgData.map(x => ({ ...x, ...(SDG_MAP[x.code] || { label: x.code, color: '#64748b', emoji: '🎯' }) })).slice(0, 10);
  const projectsWithSdg = filteredProjects.filter(p => (p as any).sdgGoals?.length > 0).length;

  const totalBudget = filteredProjects.reduce((s, p) => s + (p.budget || 0), 0);
  const budgetedProjects = filteredProjects.filter(p => p.budget);
  const avgBudget = budgetedProjects.length ? totalBudget / budgetedProjects.length : 0;

  // Ortaklık istatistikleri
  const projectsWithPartners = filteredProjects.filter(p => (p as any).partners?.length > 0).length;
  const totalPartnerBudget = filteredProjects.reduce((s, p) => {
    return s + ((p as any).partners || []).reduce((ps: number, partner: any) => ps + (partner.contributionBudget || 0), 0);
  }, 0);
  const intlProjects = filteredProjects.filter(p =>
    ((p as any).partners || []).some((partner: any) => partner.country && partner.country !== 'TR')
  ).length;


  return (
    <DashboardLayout>
      <Header title="Analiz & Raporlama" subtitle="Detaylı proje istatistikleri" />
      <div className="p-8 space-y-8">
        {/* Filter Bar */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <p className="text-sm font-semibold text-navy mr-1">🔍 Filtrele:</p>
            <select className="input w-44 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">Tüm Proje Türleri</option>
              {projectTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <select className="input w-52 text-sm" value={filterFaculty} onChange={e => setFilterFaculty(e.target.value)}>
              <option value="">Tüm Fakülteler</option>
              {faculties.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
            </select>
            <select className="input w-32 text-sm" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">Tüm Yıllar</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {(filterType || filterFaculty || filterYear) && (
              <button onClick={() => { setFilterType(''); setFilterFaculty(''); setFilterYear(''); }}
                className="btn-ghost text-xs px-3 py-1.5">✕ Filtreleri Temizle</button>
            )}
            <span className="ml-auto text-xs text-muted font-medium">
              {filteredProjects.length} / {projects.length} proje gösteriliyor
            </span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KPI label="Toplam Proje" value={projects.length.toString()} color="#0f2444" />
          <KPI label="Toplam Bütçe" value={formatCurrency(totalBudget)} sub="tüm projeler" color="#c8a45a" />
          <KPI label="Ortalama Bütçe" value={formatCurrency(avgBudget)} sub="proje başına" color="#1a3a6b" />
          <KPI label="Tamamlanma"
            value={`%${projects.length ? Math.round(normalizedProjects.filter(p => p.status === 'completed').length / projects.length * 100) : 0}`}
            sub={`${normalizedProjects.filter(p => p.status === 'completed').length} proje`} color="#059669" />
        </div>

        {/* Status + Type pie */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-display text-base font-semibold text-navy mb-5">Durum Dağılımı</h3>
            {byStatus.length ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45}
                      label={({ name, percent }) => percent > 0.05 ? `${name} %${(percent * 100).toFixed(0)}` : ''} labelLine={false}>
                      {byStatus.map((e, i) => <Cell key={i} fill={e.color || C[i % C.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {byStatus.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ background: '#faf8f4' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color || C[i % C.length] }} />
                        <span className="text-muted">{s.name}</span>
                      </div>
                      <span className="font-bold text-navy">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="empty-state py-12"><p className="text-sm">Veri yok</p></div>}
          </div>

          <div className="card">
            <h3 className="font-display text-base font-semibold text-navy mb-5">Tür Dağılımı</h3>
            {byType.length ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45}
                      label={({ percent }) => percent > 0.05 ? `%${(percent * 100).toFixed(0)}` : ''} labelLine={false}>
                      {byType.map((e, i) => <Cell key={i} fill={e.color || C[i % C.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {byType.map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ background: '#faf8f4' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: t.color || C[i % C.length] }} />
                        <span className="text-muted">{t.name}</span>
                      </div>
                      <span className="font-bold text-navy">{t.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="empty-state py-12"><p className="text-sm">Veri yok</p></div>}
          </div>
        </div>

        {/* Faculty bar */}
        {byFaculty.length > 0 && (
          <div className="card">
            <h3 className="font-display text-base font-semibold text-navy mb-5">Fakülte Bazlı Proje Sayısı</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byFaculty} barSize={30}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 12 }}
                  formatter={(v: any, _: any, p: any) => [v, p.payload.fullName]} />
                <Bar dataKey="count" name="Proje" radius={[6, 6, 0, 0]}>
                  {byFaculty.map((f, i) => {
                    const fac = faculties.find(x => x.name === f.fullName);
                    return <Cell key={i} fill={fac?.color || C[i % C.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Stacked bar - type x status */}
        {byTypeAndStatus.length > 0 && (
          <div className="card">
            <h3 className="font-display text-base font-semibold text-navy mb-5">Tür × Durum Dağılımı</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byTypeAndStatus} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="active" name="Aktif" stackId="a" fill="#059669" />
                <Bar dataKey="application" name="Başvuru Sürecinde" stackId="a" fill="#d97706" />
                <Bar dataKey="completed" name="Tamamlandı" stackId="a" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── SKH / SDG Analizi ── */}
        {sdgData.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-base font-semibold text-navy flex items-center gap-2">
                🌍 Sürdürülebilir Kalkınma Hedefleri Analizi
              </h3>
              <span className="badge badge-blue text-xs">{projectsWithSdg} / {projects.length} proje etiketli</span>
            </div>
            {/* Coverage bar */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">SKH Kapsama Oranı</span>
                <span className="font-bold text-navy">%{projects.length ? Math.round(projectsWithSdg / projects.length * 100) : 0}</span>
              </div>
              <div className="progress-bar h-2">
                <div className="progress-fill h-2" style={{ width: `${projects.length ? (projectsWithSdg / projects.length * 100) : 0}%` }} />
              </div>
            </div>
            {/* SDG grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {sdgData.map(({ code, count, goal }) => (
                <div key={code} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: goal!.color + '14', border: `1px solid ${goal!.color}30` }}>
                  <span className="text-2xl flex-shrink-0">{goal!.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold" style={{ color: goal!.color }}>{goal!.code}</p>
                    <p className="text-xs text-muted truncate leading-tight">{goal!.label}</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: goal!.color }}>{count} proje</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Horizontal bar chart */}
            <div className="mt-6 space-y-2">
              {sdgData.map(({ code, count, goal }) => {
                const pct = sdgData[0].count ? (count / sdgData[0].count) * 100 : 0;
                return (
                  <div key={code} className="flex items-center gap-3">
                    <span className="text-sm w-6 text-center flex-shrink-0">{goal!.emoji}</span>
                    <span className="text-xs text-muted w-14 flex-shrink-0">{code}</span>
                    <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: '#f0ede8' }}>
                      <div className="h-full rounded-full flex items-center px-2 transition-all"
                        style={{ width: `${Math.max(pct, 8)}%`, background: goal!.color }}>
                        <span className="text-white font-bold text-xs">{count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Year trend */}
        {byYear.length > 1 && (
          <div className="card">
            <h3 className="font-display text-base font-semibold text-navy mb-5">Yıllık Proje Başlangıç Trendi</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={byYear}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 12 }} />
                <Line type="monotone" dataKey="count" name="Proje" stroke="#c8a45a" strokeWidth={3}
                  dot={{ fill: '#c8a45a', r: 5 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Budget top 5 */}
        {projects.filter(p => p.budget).length > 0 && (
          <div className="card">
            <h3 className="font-display text-base font-semibold text-navy mb-4">En Yüksek Bütçeli Projeler</h3>
            <div className="space-y-3">
              {[...projects].filter(p => p.budget).sort((a, b) => (b.budget || 0) - (a.budget || 0)).slice(0, 5).map((p, i) => {
                const maxBudget = projects.reduce((m, x) => Math.max(m, x.budget || 0), 0);
                const pct = maxBudget ? ((p.budget || 0) / maxBudget) * 100 : 0;
                return (
                  <div key={p.id} className="flex items-center gap-4">
                    <span className="text-xs font-bold text-muted w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-navy truncate">{p.title}</span>
                        <span className="font-bold text-navy ml-4 flex-shrink-0">{formatCurrency(p.budget)}</span>
                      </div>
                      <div className="progress-bar h-2">
                        <div className="progress-fill h-2" style={{ width: `${pct}%`, background: getProjectTypeColor(p.type, projectTypes) }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {projects.length === 0 && (
          <div className="empty-state"><p className="text-sm">Analiz için yeterli proje verisi bulunamadı</p></div>
        )}
      </div>
    </DashboardLayout>
  );
}
