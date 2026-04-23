'use client';
import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { projectsApi, projectTypesApi, facultiesApi } from '@/lib/api';
import { Project, PaginatedResponse, ProjectTypeItem, FacultyItem } from '@/types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, SDG_GOALS, SDG_MAP, getProjectTypeLabel, getProjectTypeColor, formatDate, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

type ViewMode = 'table' | 'card';
type SortKey = 'createdAt' | 'title' | 'budget' | 'startDate' | 'endDate' | 'status';
type SortDir = 'ASC' | 'DESC';

const STATUSES = [
  ['', 'Tüm Durumlar'], ['application', 'Başvuru Sürecinde'],
  ['active', 'Aktif'], ['completed', 'Tamamlandı'],
  ['suspended', 'Askıya Alındı'], ['cancelled', 'İptal Edildi'],
];

const SORT_OPTIONS: Array<{ key: SortKey; dir: SortDir; label: string }> = [
  { key: 'createdAt', dir: 'DESC', label: 'En Yeni' },
  { key: 'createdAt', dir: 'ASC',  label: 'En Eski' },
  { key: 'title',     dir: 'ASC',  label: 'Başlık (A–Z)' },
  { key: 'title',     dir: 'DESC', label: 'Başlık (Z–A)' },
  { key: 'budget',    dir: 'DESC', label: 'Bütçe (Yüksek→Düşük)' },
  { key: 'budget',    dir: 'ASC',  label: 'Bütçe (Düşük→Yüksek)' },
  { key: 'endDate',   dir: 'ASC',  label: 'Bitiş Tarihi (Yakın)' },
];

// Proje oluşturabilen roller — backend ile tutarlı olmalı
const CAN_CREATE_ROLES = ['Süper Admin', 'Akademisyen', 'Rektör', 'Dekan', 'Bölüm Başkanı'];

/* ─── Icon seti ─────────────────────────────────────────── */
type IconName =
  | 'search' | 'filter' | 'table' | 'grid' | 'x' | 'close' | 'clock' | 'plus'
  | 'sort' | 'briefcase' | 'alert' | 'arrow-left' | 'arrow-right' | 'alert-circle' | 'check' | 'refresh';

const I: Record<IconName, string> = {
  search:      'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  filter:      'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z',
  table:       'M3 10h18M3 14h18m-9-11v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
  grid:        'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  x:           'M6 18L18 6M6 6l12 12',
  close:       'M6 18L18 6M6 6l12 12',
  clock:       'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  plus:        'M12 4v16m8-8H4',
  sort:        'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12',
  briefcase:   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  alert:       'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  'arrow-left':'M10 19l-7-7m0 0l7-7m-7 7h18',
  'arrow-right':'M17 8l4 4m0 0l-4 4m4-4H3',
  'alert-circle':'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  check:       'M5 13l4 4L19 7',
  refresh:     'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
};

function Icon({ name, className = 'w-4 h-4', strokeWidth = 1.8, style }: { name: IconName; className?: string; strokeWidth?: number; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={I[name]} />
    </svg>
  );
}

/* ─── Debounce hook ─────────────────────────────────────── */
function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ─── Ana sayfa ─────────────────────────────────────────── */
export default function ProjectsPage() {
  return (
    <Suspense fallback={<DashboardLayout><Header title="Projeler" /><div className="flex-1 flex items-center justify-center"><div className="spinner" /></div></DashboardLayout>}>
      <ProjectsPageInner />
    </Suspense>
  );
}

function ProjectsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const canCreate = CAN_CREATE_ROLES.includes(user?.role?.name || '');

  // URL'den initial state'i çek
  const [search, setSearch]         = useState(() => searchParams.get('q') || '');
  const [status, setStatus]         = useState(() => searchParams.get('status') || '');
  const [type, setType]             = useState(() => searchParams.get('type') || '');
  const [faculty, setFaculty]       = useState(() => searchParams.get('faculty') || '');
  const [sdg, setSdg]               = useState(() => searchParams.get('sdg') || '');
  const [ownership, setOwnership]   = useState(() => searchParams.get('ownership') || '');
  const [budgetMin, setBudgetMin]   = useState(() => searchParams.get('budgetMin') || '');
  const [budgetMax, setBudgetMax]   = useState(() => searchParams.get('budgetMax') || '');
  const [dateFrom, setDateFrom]     = useState(() => searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo]         = useState(() => searchParams.get('dateTo') || '');
  const [page, setPage]             = useState(() => Number(searchParams.get('page')) || 1);
  const [view, setView]             = useState<ViewMode>(() => (searchParams.get('view') as ViewMode) || 'table');
  const [sortKey, setSortKey]       = useState<SortKey>(() => (searchParams.get('sortBy') as SortKey) || 'createdAt');
  const [sortDir, setSortDir]       = useState<SortDir>(() => (searchParams.get('sortDir') as SortDir) || 'DESC');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Debounced arama — 350ms
  const searchDebounced = useDebounced(search, 350);

  const [result, setResult]   = useState<PaginatedResponse<Project> | null>(null);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeItem[]>([]);
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const hasFilter = !!(search || status || type || faculty || sdg || ownership || budgetMin || budgetMax || dateFrom || dateTo);

  // Meta verileri (type, faculty listesi)
  useEffect(() => {
    Promise.all([
      projectTypesApi.getActive().then(r => setProjectTypes(r.data)).catch(() => {}),
      facultiesApi.getActive().then(r => setFaculties(r.data)).catch(() => {}),
    ]);
  }, []);

  // Filtre değişince URL'e yaz (replace) — paylaşılabilir, F5 korunur
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchDebounced) params.set('q', searchDebounced);
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (faculty) params.set('faculty', faculty);
    if (sdg) params.set('sdg', sdg);
    if (ownership) params.set('ownership', ownership);
    if (budgetMin) params.set('budgetMin', budgetMin);
    if (budgetMax) params.set('budgetMax', budgetMax);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (page > 1) params.set('page', String(page));
    if (view !== 'table') params.set('view', view);
    if (sortKey !== 'createdAt') params.set('sortBy', sortKey);
    if (sortDir !== 'DESC') params.set('sortDir', sortDir);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchDebounced, status, type, faculty, sdg, ownership, budgetMin, budgetMax, dateFrom, dateTo, page, view, sortKey, sortDir, pathname, router]);

  // Veriyi çek
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params: any = {
      search: searchDebounced, status, type, faculty, sdg,
      page, limit: 15, sortBy: sortKey, sortDir,
    };
    if (ownership) params.ownership = ownership;
    if (budgetMin) params.budgetMin = budgetMin;
    if (budgetMax) params.budgetMax = budgetMax;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    projectsApi.getAll(params)
      .then(r => setResult(r.data))
      .catch(e => setError(e?.response?.data?.message || 'Projeler yüklenemedi'))
      .finally(() => setLoading(false));
  }, [searchDebounced, status, type, faculty, sdg, ownership, budgetMin, budgetMax, dateFrom, dateTo, page, sortKey, sortDir]);

  const clearAll = () => {
    setSearch(''); setStatus(''); setType(''); setFaculty(''); setSdg(''); setOwnership('');
    setBudgetMin(''); setBudgetMax(''); setDateFrom(''); setDateTo('');
    setPage(1);
  };

  const getDaysLeft = (endDate: string) => {
    return Math.round((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const ethicsBadge = (p: any) => {
    const s = p.ethicsReviewStatus;
    if (s === 'approved') return { label: 'Etik Onaylı', bg: '#f0fdf4', color: '#14532d', border: '#86efac' };
    if (s === 'rejected') return { label: 'Etik Reddedildi', bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' };
    if (s === 'pending' || (p.ethicsRequired && !s)) return { label: 'Etik Onayı Bekliyor', bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
    return null;
  };

  /* ─── KART ─── */
  const ProjectCard = ({ p }: { p: any }) => {
    const typeColor = getProjectTypeColor(p.type, projectTypes);
    const sdgGoals = p.sdgGoals || [];
    const daysLeft = p.endDate ? getDaysLeft(p.endDate) : null;
    const isUrgent = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 && p.status === 'active';
    const ethics = ethicsBadge(p);
    return (
      <Link href={`/projects/${p.id}`} className="card-hover block group p-5">
        <div className="flex items-start justify-between mb-3 gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ background: typeColor + '18', color: typeColor }}>
            {getProjectTypeLabel(p.type, projectTypes)}
          </span>
          <span className={`badge text-xs flex-shrink-0 ${PROJECT_STATUS_COLORS[p.status] || 'badge-gray'}`}>
            {PROJECT_STATUS_LABELS[p.status] || p.status}
          </span>
        </div>
        <h3 className="font-display font-semibold text-navy text-sm leading-snug mb-1 group-hover:underline line-clamp-2">{p.title}</h3>
        <p className="text-xs text-muted mb-3 truncate">{p.owner?.firstName} {p.owner?.lastName}</p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {isUrgent && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              <Icon name="clock" className="w-3 h-3" />
              {daysLeft} gün kaldı
            </span>
          )}
          {ethics && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: ethics.bg, color: ethics.color, border: `1px solid ${ethics.border}` }}>
              {ethics.label}
            </span>
          )}
        </div>

        {sdgGoals.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {sdgGoals.slice(0, 4).map((code: string) => {
              const g = SDG_MAP[code]; if (!g) return null;
              return (
                <span key={code} title={g.label}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold text-white"
                  style={{ background: g.color }}>
                  {g.code.replace('SKH-', '')}
                </span>
              );
            })}
            {sdgGoals.length > 4 && <span className="text-xs text-muted self-center">+{sdgGoals.length - 4}</span>}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t text-xs" style={{ borderColor: '#f0ede8' }}>
          <span className="font-bold text-navy">{formatCurrency(p.budget)}</span>
          <span className="text-muted truncate ml-2">{p.faculty?.split(' ')[0] || '—'}</span>
          <span className="text-muted ml-2">{formatDate(p.createdAt)}</span>
        </div>
      </Link>
    );
  };

  /* ─── Sıralama sonucu label ─── */
  const currentSortLabel = useMemo(() => {
    const o = SORT_OPTIONS.find(s => s.key === sortKey && s.dir === sortDir);
    return o?.label || 'En Yeni';
  }, [sortKey, sortDir]);

  return (
    <DashboardLayout>
      <Header title="Projeler" subtitle="Akademik proje yönetimi"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => exportCurrentToCsv(result?.data || [], projectTypes)}
              disabled={!result?.data?.length}
              className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-40"
              title="Görünen sonuçları CSV olarak indir">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </button>
            {canCreate && (
              <Link href="/projects/new" className="btn-primary inline-flex items-center gap-1.5">
                <Icon name="plus" className="w-4 h-4" />
                Yeni Proje
              </Link>
            )}
          </div>
        } />

      <div className="p-6 xl:p-8 space-y-5">
        {/* Filtre barı */}
        <div className="card p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-48 relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input className="input pl-9 pr-9" placeholder="Proje ara..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }} aria-label="Aramayı temizle"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-navy">
                  <Icon name="x" className="w-4 h-4" />
                </button>
              )}
            </div>
            <select className="input w-44" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="input w-40" value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
              <option value="">Tüm Türler</option>
              {projectTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>

            {/* Sıralama */}
            <div className="relative">
              <select
                className="input appearance-none pl-9 pr-8 w-52"
                value={`${sortKey}|${sortDir}`}
                onChange={e => {
                  const [k, d] = e.target.value.split('|') as [SortKey, SortDir];
                  setSortKey(k); setSortDir(d); setPage(1);
                }}
              >
                {SORT_OPTIONS.map(o => (
                  <option key={`${o.key}|${o.dir}`} value={`${o.key}|${o.dir}`}>{o.label}</option>
                ))}
              </select>
              <Icon name="sort" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            </div>

            <button onClick={() => setShowAdvanced(a => !a)}
              className={`btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 ${showAdvanced ? 'ring-2 ring-navy/30' : ''}`}>
              <Icon name="filter" className="w-3.5 h-3.5" />
              Gelişmiş {hasFilter && !showAdvanced && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
            </button>

            {/* View toggle */}
            <div className="flex rounded-xl p-1 ml-auto" style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
              {(['table', 'card'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setView(v)} aria-label={v === 'table' ? 'Tablo görünümü' : 'Kart görünümü'}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                  style={{ background: view === v ? 'white' : 'transparent', color: view === v ? '#0f2444' : '#9ca3af', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                  <Icon name={v === 'table' ? 'table' : 'grid'} className="w-3.5 h-3.5" />
                  {v === 'table' ? 'Tablo' : 'Kart'}
                </button>
              ))}
            </div>
          </div>

          {/* Gelişmiş filtre paneli */}
          {showAdvanced && (
            <div className="pt-4 border-t grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3" style={{ borderColor: '#e8e4dc' }}>
              <div>
                <label className="label text-xs">Katılım</label>
                <select className="input text-xs" value={ownership} onChange={e => { setOwnership(e.target.value); setPage(1); }}>
                  <option value="">Tümü</option>
                  <option value="owned">Yürütücüsü olduğum</option>
                  <option value="member">Sadece üyesi olduğum</option>
                  <option value="participating">Katıldığım (yürütücü veya üye)</option>
                </select>
              </div>
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
                  {SDG_GOALS.map(g => <option key={g.code} value={g.code}>{g.code} – {g.label}</option>)}
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
                  <button onClick={clearAll} className="btn-ghost text-xs w-full inline-flex items-center justify-center gap-1">
                    <Icon name="x" className="w-3 h-3" />
                    Filtreleri Temizle
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Aktif filtre chip'leri */}
          {hasFilter && !showAdvanced && (
            <div className="flex flex-wrap gap-2 pt-1">
              {search && <Chip label={`Arama: "${search}"`} onRemove={() => setSearch('')} />}
              {status && <Chip label={PROJECT_STATUS_LABELS[status] || status} onRemove={() => setStatus('')} />}
              {type && <Chip label={getProjectTypeLabel(type, projectTypes)} onRemove={() => setType('')} />}
              {faculty && <Chip label={faculty.split(' ')[0]} onRemove={() => setFaculty('')} />}
              {ownership && <Chip label={ownership === 'owned' ? 'Yürütücüsü olduğum' : ownership === 'member' ? 'Üyesi olduğum' : 'Katıldığım'} onRemove={() => setOwnership('')} />}
              {sdg && <Chip label={sdg} color={SDG_MAP[sdg]?.color} onRemove={() => setSdg('')} />}
              {budgetMin && <Chip label={`Bütçe ≥ ${Number(budgetMin).toLocaleString('tr-TR')}₺`} onRemove={() => setBudgetMin('')} />}
              {budgetMax && <Chip label={`Bütçe ≤ ${Number(budgetMax).toLocaleString('tr-TR')}₺`} onRemove={() => setBudgetMax('')} />}
              {(dateFrom || dateTo) && <Chip label={`Tarih: ${dateFrom || '…'}→${dateTo || '…'}`} onRemove={() => { setDateFrom(''); setDateTo(''); }} />}
              <button onClick={clearAll} className="text-xs text-muted hover:text-red-500">Hepsini Temizle</button>
            </div>
          )}
        </div>

        {/* Özet + sıralama göstergesi */}
        <div className="flex items-center justify-between text-xs text-muted">
          {result && !loading ? (
            <p>
              <span className="font-semibold text-navy">{result.total}</span> proje bulundu
              {hasFilter && <span className="ml-1">· filtre uygulanıyor</span>}
            </p>
          ) : <span />}
          <p className="inline-flex items-center gap-1.5">
            <Icon name="sort" className="w-3 h-3" />
            {currentSortLabel}
          </p>
        </div>

        {/* İçerik */}
        {error ? (
          <div className="card py-16 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <Icon name="alert-circle" className="w-7 h-7" strokeWidth={1.6} />
            </div>
            <p className="text-sm font-semibold text-navy">Projeler yüklenemedi</p>
            <p className="text-xs text-muted mt-1 max-w-md mx-auto">{error}</p>
            <button onClick={() => location.reload()} className="btn-primary text-sm mt-4 inline-flex items-center gap-1.5">
              <Icon name="refresh" className="w-4 h-4" />
              Yeniden Dene
            </button>
          </div>
        ) : loading ? (
          <div className="card flex justify-center py-20"><div className="spinner" /></div>
        ) : !result?.data?.length ? (
          <EmptyState canCreate={canCreate} hasFilter={hasFilter} onClear={clearAll} />
        ) : view === 'table' ? (
          <div className="card p-0 overflow-hidden">
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
                  {result.data.map((p: any) => {
                    const typeColor = getProjectTypeColor(p.type, projectTypes);
                    const sdgGoals = p.sdgGoals || [];
                    const daysLeft = p.endDate ? getDaysLeft(p.endDate) : null;
                    const isUrgent = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 && p.status === 'active';
                    const ethics = ethicsBadge(p);
                    return (
                      <tr key={p.id} className="table-row-hover border-b" style={{ borderColor: '#f5f2ee' }}>
                        <td className="px-5 py-4 max-w-md">
                          <Link href={`/projects/${p.id}`} className="font-semibold text-navy hover:underline line-clamp-1">{p.title}</Link>
                          {p.owner && <p className="text-xs text-muted mt-0.5">{p.owner.firstName} {p.owner.lastName}</p>}
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {isUrgent && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: '#fef2f2', color: '#dc2626' }}>
                                <Icon name="clock" className="w-2.5 h-2.5" />
                                {daysLeft} gün
                              </span>
                            )}
                            {ethics && (
                              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ background: ethics.bg, color: ethics.color, border: `1px solid ${ethics.border}` }}>
                                {ethics.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: typeColor + '18', color: typeColor }}>
                            {getProjectTypeLabel(p.type, projectTypes)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`badge ${PROJECT_STATUS_COLORS[p.status] || 'badge-gray'}`}>
                            {PROJECT_STATUS_LABELS[p.status] || p.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-0.5 flex-wrap">
                            {sdgGoals.slice(0, 3).map((code: string) => {
                              const g = SDG_MAP[code]; if (!g) return null;
                              return (
                                <span key={code} title={g.label}
                                  className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white"
                                  style={{ background: g.color }}>
                                  {code.replace('SKH-', '')}
                                </span>
                              );
                            })}
                            {sdgGoals.length > 3 && <span className="text-xs text-muted self-center">+{sdgGoals.length - 3}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-muted whitespace-nowrap">{p.faculty?.split(' ')[0] || '—'}</td>
                        <td className="px-5 py-4 text-xs font-semibold text-navy whitespace-nowrap">{formatCurrency(p.budget)}</td>
                        <td className="px-5 py-4 text-xs text-muted whitespace-nowrap">{formatDate(p.createdAt)}</td>
                        <td className="px-5 py-4">
                          <Link href={`/projects/${p.id}`} className="btn-ghost text-xs px-3 py-1.5 inline-flex items-center gap-1 whitespace-nowrap">
                            Detay <Icon name="arrow-right" className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination result={result} page={page} setPage={setPage} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {result.data.map((p: any) => <ProjectCard key={p.id} p={p} />)}
            </div>
            <div className="card p-0">
              <Pagination result={result} page={page} setPage={setPage} />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

/* ─── Yardımcı bileşenler ───────────────────────────────── */
function Chip({ label, onRemove, color }: { label: string; onRemove: () => void; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold text-white"
      style={{ background: color || '#1a3a6b' }}>
      {label}
      <button onClick={onRemove} aria-label="Filtreyi kaldır" className="opacity-80 hover:opacity-100">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

/** Görünen sonuçları CSV olarak indir — tarayıcıda oluşturulur, backend'e gitmez */
function exportCurrentToCsv(projects: any[], projectTypes: any[]) {
  if (!projects.length) return;
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[;"\n]/.test(s) ? `"${s}"` : s;
  };
  const typeLabel = (k: string) => projectTypes.find((t: any) => t.key === k)?.label || k;
  const headers = ['ID', 'Başlık', 'Tür', 'Durum', 'Fakülte', 'Bölüm', 'Bütçe (₺)', 'Fon Kaynağı', 'Başlangıç', 'Bitiş', 'Yürütücü', 'Oluşturma'];
  const rows = projects.map(p => [
    p.id, p.title, typeLabel(p.type), p.status || '', p.faculty || '', p.department || '',
    p.budget || '', p.fundingSource || '', p.startDate || '', p.endDate || '',
    p.owner ? `${p.owner.firstName || ''} ${p.owner.lastName || ''}`.trim() : '',
    p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(escape).join(';')).join('\r\n');
  // UTF-8 BOM — Excel'de Türkçe düzgün açılır
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `projeler-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Pagination({ result, page, setPage }: { result: any; page: number; setPage: (p: number) => void }) {
  if ((result.totalPages || 1) <= 1) return null;
  return (
    <div className="px-6 py-4 flex items-center justify-between border-t flex-wrap gap-3" style={{ borderColor: '#f0ede8' }}>
      <span className="text-xs text-muted">
        {result.total} projeden <strong className="text-navy">{(page - 1) * result.limit + 1}–{Math.min(page * result.limit, result.total)}</strong> gösteriliyor
      </span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}
          className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 inline-flex items-center gap-1">
          <Icon name="arrow-left" className="w-3 h-3" />
          Önceki
        </button>
        <span className="btn-ghost text-xs px-3 py-1.5 pointer-events-none">{page} / {result.totalPages}</span>
        <button disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}
          className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 inline-flex items-center gap-1">
          Sonraki
          <Icon name="arrow-right" className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ canCreate, hasFilter, onClear }: { canCreate: boolean; hasFilter: boolean; onClear: () => void }) {
  return (
    <div className="card py-20 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0ede8', color: '#6b7280' }}>
        <Icon name="briefcase" className="w-7 h-7" strokeWidth={1.5} />
      </div>
      {hasFilter ? (
        <>
          <p className="text-sm font-medium text-navy">Filtrelere uygun proje bulunamadı</p>
          <p className="text-xs text-muted mt-1">Filtreleri değiştirin veya temizleyin.</p>
          <button onClick={onClear} className="btn-secondary text-sm mt-4 inline-flex items-center gap-1.5">
            <Icon name="x" className="w-4 h-4" />
            Filtreleri Temizle
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-navy">Henüz proje yok</p>
          <p className="text-xs text-muted mt-1">{canCreate ? 'Yeni bir proje oluşturarak başlayın.' : 'Bu kullanıcının görüntüleyebileceği proje yok.'}</p>
          {canCreate && (
            <Link href="/projects/new" className="btn-primary text-sm mt-4 inline-flex items-center gap-1.5">
              <Icon name="plus" className="w-4 h-4" />
              İlk Projeyi Oluştur
            </Link>
          )}
        </>
      )}
    </div>
  );
}
