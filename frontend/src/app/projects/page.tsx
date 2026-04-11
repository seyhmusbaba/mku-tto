'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { projectsApi, projectTypesApi, facultiesApi } from '@/lib/api';
import { Project, PaginatedResponse, ProjectTypeItem, FacultyItem } from '@/types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, SDG_GOALS, SDG_MAP, getProjectTypeLabel, getProjectTypeColor, formatDate, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

type ViewMode = 'table' | 'card';

const STATUSES = [
  ['', 'Tüm Durumlar'], ['application', 'Başvuru Sürecinde'],
  ['active', 'Aktif'], ['completed', 'Tamamlandı'],
  ['suspended', 'Askıya Alındı'], ['cancelled', 'İptal Edildi'],
];

export default function ProjectsPage() {
  const [result, setResult] = useState<PaginatedResponse<Project> | null>(null);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeItem[]>([]);
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('table');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [faculty, setFaculty] = useState('');
  const [sdg, setSdg] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const canCreate = ['Süper Admin', 'Akademisyen'].includes(user?.role?.name || '');
  const hasFilter = !!(search || status || type || faculty || sdg || budgetMin || budgetMax || dateFrom || dateTo);

  useEffect(() => {
    Promise.all([
      projectTypesApi.getActive().then(r => setProjectTypes(r.data)).catch(() => {}),
      facultiesApi.getActive().then(r => setFaculties(r.data)).catch(() => {}),
    ]);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: any = { search, status, type, faculty, sdg, page, limit: view === 'card' ? 12 : 15 };
    if (budgetMin) params.budgetMin = budgetMin;
    if (budgetMax) params.budgetMax = budgetMax;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    projectsApi.getAll(params).then(r => setResult(r.data)).finally(() => setLoading(false));
  }, [search, status, type, faculty, sdg, budgetMin, budgetMax, dateFrom, dateTo, page, view]);

  const clearAll = () => { setSearch(''); setStatus(''); setType(''); setFaculty(''); setSdg(''); setBudgetMin(''); setBudgetMax(''); setDateFrom(''); setDateTo(''); setPage(1); };

  // Bitiş tarihi yaklaşan proje kontrolü
  const getDaysLeft = (endDate: string) => {
    const diff = (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return Math.round(diff);
  };

  const ProjectCard = ({ p }: { p: Project }) => {
    const typeColor = getProjectTypeColor(p.type, projectTypes);
    const sdgGoals = (p as any).sdgGoals || [];
    const daysLeft = p.endDate ? getDaysLeft(p.endDate) : null;
    const isUrgent = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 && p.status === 'active';
    const ethicsPending = (p as any).ethicsRequired && !(p as any).ethicsApproved;
    return (
      <Link href={`/projects/${p.id}`} className="card-hover block group">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: typeColor + '18', color: typeColor }}>{getProjectTypeLabel(p.type, projectTypes)}</span>
          <div className="flex items-center gap-2">
            {isUrgent && <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>⏰ {daysLeft}g</span>}
            <span className={`badge text-xs ${PROJECT_STATUS_COLORS[(p as any).status] || 'badge-gray'}`}>{PROJECT_STATUS_LABELS[(p as any).status] || p.status}</span>
          </div>
        </div>
        {ethicsPending && (
          <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg mb-2" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
            ⚖️ Etik Kurul Onayı Bekliyor
          </div>
        )}
        <h3 className="font-display font-semibold text-navy text-sm leading-snug mb-1 group-hover:text-blue-700 line-clamp-2">{p.title}</h3>
        <p className="text-xs text-muted mb-3">{p.owner?.firstName} {p.owner?.lastName}</p>
        {sdgGoals.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {sdgGoals.slice(0, 3).map((code: string) => {
              const g = SDG_MAP[code]; if (!g) return null;
              return <span key={code} className="text-white text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: g.color, fontSize: 10 }}>{g.emoji} {g.code}</span>;
            })}
            {sdgGoals.length > 3 && <span className="text-xs text-muted">+{sdgGoals.length - 3}</span>}
          </div>
        )}
        <div className="flex items-center justify-between pt-3 border-t text-xs text-muted" style={{ borderColor: '#f0ede8' }}>
          <span>{formatCurrency(p.budget)}</span>
          <span>{p.faculty?.split(' ')[0] || '—'}</span>
          <span>{formatDate(p.createdAt)}</span>
        </div>
      </Link>
    );
  };

  return (
    <DashboardLayout>
      <Header title="Projeler" subtitle="Akademik proje yönetimi"
        actions={canCreate ? <Link href="/projects/new" className="btn-primary">+ Yeni Proje</Link> : undefined} />
      <div className="p-8 space-y-6">
        {/* Filters row */}
        <div className="card p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-48 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input className="input pl-9" placeholder="Proje ara..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="input w-44" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="input w-40" value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
              <option value="">Tüm Türler</option>
              {projectTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <button onClick={() => setShowAdvanced(a => !a)}
              className={`btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 ${showAdvanced ? 'ring-2 ring-navy/20' : ''}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              Gelişmiş {hasFilter && !showAdvanced && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
            </button>
            {/* View toggle */}
            <div className="flex rounded-xl p-1 ml-auto" style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
              {(['table', 'card'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setView(v)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: view === v ? 'white' : 'transparent', color: view === v ? '#0f2444' : '#9ca3af', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                  {v === 'table' ? '☰ Tablo' : '⊞ Kart'}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced filter panel */}
          {showAdvanced && (
            <div className="pt-4 border-t grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3" style={{ borderColor: '#e8e4dc' }}>
              <div>
                <label className="label text-xs">Fakülte</label>
                <select className="input text-xs" value={faculty} onChange={e => { setFaculty(e.target.value); setPage(1); }}>
                  <option value="">Tüm Fakülteler</option>
                  {faculties.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">SKH Hedefi</label>
                <select className="input text-xs" value={sdg} onChange={e => { setSdg(e.target.value); setPage(1); }}>
                  <option value="">Tüm Hedefler</option>
                  {SDG_GOALS.map(g => <option key={g.code} value={g.code}>{g.emoji} {g.code} – {g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Bütçe (min ₺)</label>
                <input type="number" className="input text-xs" placeholder="0" value={budgetMin} onChange={e => { setBudgetMin(e.target.value); setPage(1); }} />
              </div>
              <div>
                <label className="label text-xs">Bütçe (maks ₺)</label>
                <input type="number" className="input text-xs" placeholder="Sınırsız" value={budgetMax} onChange={e => { setBudgetMax(e.target.value); setPage(1); }} />
              </div>
              <div>
                <label className="label text-xs">Başlangıç (dan)</label>
                <input type="date" className="input text-xs" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
              </div>
              <div>
                <label className="label text-xs">Başlangıç (a)</label>
                <input type="date" className="input text-xs" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
              </div>
              {hasFilter && (
                <div className="flex items-end">
                  <button onClick={clearAll} className="btn-ghost text-xs w-full">✕ Filtreleri Temizle</button>
                </div>
              )}
            </div>
          )}

          {/* Active filter chips */}
          {hasFilter && !showAdvanced && (
            <div className="flex flex-wrap gap-2 pt-1">
              {search && <Chip label={`Arama: "${search}"`} onRemove={() => setSearch('')} />}
              {status && <Chip label={PROJECT_STATUS_LABELS[status] || status} onRemove={() => setStatus('')} />}
              {type && <Chip label={getProjectTypeLabel(type, projectTypes)} onRemove={() => setType('')} />}
              {faculty && <Chip label={faculty.split(' ')[0]} onRemove={() => setFaculty('')} />}
              {sdg && <Chip label={sdg} color={SDG_MAP[sdg]?.color} onRemove={() => setSdg('')} />}
              {budgetMin && <Chip label={`Bütçe ≥ ${Number(budgetMin).toLocaleString('tr-TR')}₺`} onRemove={() => setBudgetMin('')} />}
              {budgetMax && <Chip label={`Bütçe ≤ ${Number(budgetMax).toLocaleString('tr-TR')}₺`} onRemove={() => setBudgetMax('')} />}
              {(dateFrom || dateTo) && <Chip label={`Tarih: ${dateFrom || '…'}→${dateTo || '…'}`} onRemove={() => { setDateFrom(''); setDateTo(''); }} />}
              <button onClick={clearAll} className="text-xs text-muted hover:text-red-500">Hepsini Temizle</button>
            </div>
          )}
        </div>

        {/* Result count */}
        {result && !loading && (
          <p className="text-xs text-muted">{result.total} proje bulundu</p>
        )}

        {/* Table view */}
        {view === 'table' && (
          <div className="card p-0 overflow-hidden">
            {loading ? <div className="flex justify-center py-20"><div className="spinner" /></div> : result?.data?.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#faf8f4', borderBottom: '1px solid #e8e4dc' }}>
                        {['Proje', 'Tür', 'Durum', 'SKH', 'Fakülte', 'Bütçe', 'Tarih', ''].map(h => (
                          <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted px-5 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.map(p => {
                        const typeColor = getProjectTypeColor(p.type, projectTypes);
                        const sdgGoals = (p as any).sdgGoals || [];
                        const daysLeft = p.endDate ? getDaysLeft(p.endDate) : null;
                        const isUrgent = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 && p.status === 'active';
                        const ethicsPending = (p as any).ethicsRequired && !(p as any).ethicsApproved;
                        return (
                          <tr key={p.id} className="table-row-hover border-b" style={{ borderColor: '#f5f2ee' }}>
                            <td className="px-5 py-4">
                              <Link href={`/projects/${p.id}`} className="font-semibold text-navy hover:underline line-clamp-1">{p.title}</Link>
                              {p.owner && <p className="text-xs text-muted mt-0.5">{p.owner.firstName} {p.owner.lastName}</p>}
                              {isUrgent && <span className="text-xs font-bold" style={{ color: '#dc2626' }}>⏰ {daysLeft} gün kaldı</span>}
                              {ethicsPending && <span className="text-xs font-semibold ml-1" style={{ color: '#92400e' }}>⚖️ Etik Onayı Bekliyor</span>}
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: typeColor + '18', color: typeColor }}>{getProjectTypeLabel(p.type, projectTypes)}</span>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`badge ${PROJECT_STATUS_COLORS[(p as any).status] || 'badge-gray'}`}>{PROJECT_STATUS_LABELS[(p as any).status] || p.status}</span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex gap-0.5 flex-wrap">
                                {sdgGoals.slice(0, 3).map((code: string) => {
                                  const g = SDG_MAP[code]; if (!g) return null;
                                  return <span key={code} title={g.label} className="text-base cursor-default">{g.emoji}</span>;
                                })}
                                {sdgGoals.length > 3 && <span className="text-xs text-muted">+{sdgGoals.length - 3}</span>}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-xs text-muted">{p.faculty?.split(' ')[0] || '—'}</td>
                            <td className="px-5 py-4 text-xs font-semibold text-navy">{formatCurrency(p.budget)}</td>
                            <td className="px-5 py-4 text-xs text-muted">{formatDate(p.createdAt)}</td>
                            <td className="px-5 py-4">
                              <Link href={`/projects/${p.id}`} className="btn-ghost text-xs px-3 py-1.5">Detay →</Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination result={result} page={page} setPage={setPage} />
              </>
            ) : <EmptyState canCreate={canCreate} />}
          </div>
        )}

        {/* Card view */}
        {view === 'card' && (
          loading ? <div className="flex justify-center py-20"><div className="spinner" /></div> :
          result?.data?.length ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {result.data.map(p => <ProjectCard key={p.id} p={p} />)}
              </div>
              <Pagination result={result} page={page} setPage={setPage} />
            </>
          ) : <EmptyState canCreate={canCreate} />
        )}
      </div>
    </DashboardLayout>
  );
}

function Chip({ label, onRemove, color }: { label: string; onRemove: () => void; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold text-white"
      style={{ background: color || '#1a3a6b' }}>
      {label}
      <button onClick={onRemove} className="opacity-70 hover:opacity-100">×</button>
    </span>
  );
}

function Pagination({ result, page, setPage }: { result: any; page: number; setPage: (p: number) => void }) {
  if ((result.totalPages || 1) <= 1) return null;
  return (
    <div className="px-6 py-4 flex items-center justify-between border-t" style={{ borderColor: '#f0ede8' }}>
      <span className="text-xs text-muted">{result.total} projeden {(page - 1) * result.limit + 1}–{Math.min(page * result.limit, result.total)} gösteriliyor</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">← Önceki</button>
        <span className="btn-ghost text-xs px-3 py-1.5">{page}/{result.totalPages}</span>
        <button disabled={page >= result.totalPages} onClick={() => setPage(page + 1)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Sonraki →</button>
      </div>
    </div>
  );
}

function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg className="w-8 h-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
      </div>
      <p className="text-sm font-medium text-navy">Proje bulunamadı</p>
      <p className="text-xs text-muted mt-1">Filtrelerinizi değiştirmeyi deneyin</p>
      {canCreate && <Link href="/projects/new" className="btn-primary mt-4 text-sm">+ İlk Projeyi Oluştur</Link>}
    </div>
  );
}
