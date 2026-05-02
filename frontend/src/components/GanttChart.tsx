'use client';
import { useMemo, useState } from 'react';

/**
 * Profesyonel Gantt Chart - filtre, sıralama, gruplama, hover detayı, bugün çizgisi,
 * ay/çeyrek/yıl skalası, kritik tarihler (gecikme uyarısı), ekip büyüklüğü.
 */

interface GanttItem {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  type: string;
  progress?: number;
  faculty?: string;
  department?: string;
  owner?: string;
  budget?: number;
  memberCount?: number;
}

interface Props {
  projects: GanttItem[];
}

const STATUS_COLORS: Record<string, string> = {
  application: '#d97706', pending: '#d97706', active: '#059669',
  completed: '#2563eb', suspended: '#6b7280', cancelled: '#dc2626',
};

const STATUS_LABELS: Record<string, string> = {
  application: 'Başvuru', pending: 'Beklemede', active: 'Aktif',
  completed: 'Tamamlandı', suspended: 'Askıda', cancelled: 'İptal',
};

const TYPE_LABELS: Record<string, string> = {
  tubitak: 'TÜBİTAK', bap: 'BAP', eu: 'AB Projesi',
  industry: 'Sanayi', international: 'Uluslararası', other: 'Diğer',
};
const typeTr = (t: string) => TYPE_LABELS[t] || t || 'Belirtilmemiş';

function formatTry(n?: number) {
  if (!n) return '-';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

type SortKey = 'startDate' | 'endDate' | 'duration' | 'budget' | 'progress' | 'title';
type GroupKey = 'none' | 'status' | 'type' | 'faculty';

export function GanttChart({ projects }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('startDate');
  const [groupBy, setGroupBy] = useState<GroupKey>('none');
  const [hovered, setHovered] = useState<string | null>(null);

  // Geçerli projeleri ve filtreleri uygula
  const validProjects = useMemo(() => {
    return projects
      .filter(p => p.startDate && p.endDate)
      .filter(p => statusFilter === 'all' || p.status === statusFilter)
      .filter(p => typeFilter === 'all' || p.type === typeFilter);
  }, [projects, statusFilter, typeFilter]);

  // Sıralama
  const sortedProjects = useMemo(() => {
    const arr = [...validProjects];
    arr.sort((a, b) => {
      if (sortKey === 'title') return (a.title || '').localeCompare(b.title || '', 'tr');
      if (sortKey === 'budget') return (b.budget || 0) - (a.budget || 0);
      if (sortKey === 'progress') return (b.progress || 0) - (a.progress || 0);
      if (sortKey === 'duration') {
        const da = new Date(a.endDate).getTime() - new Date(a.startDate).getTime();
        const db = new Date(b.endDate).getTime() - new Date(b.startDate).getTime();
        return db - da;
      }
      if (sortKey === 'endDate') return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
    return arr;
  }, [validProjects, sortKey]);

  // Gruplama - groupBy != none ise gruplanmış liste döner
  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ groupLabel: '', items: sortedProjects }];
    const groups = new Map<string, GanttItem[]>();
    for (const p of sortedProjects) {
      let key = '';
      if (groupBy === 'status') key = STATUS_LABELS[p.status] || p.status;
      else if (groupBy === 'type') key = typeTr(p.type);
      else if (groupBy === 'faculty') key = p.faculty || 'Belirtilmemiş';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return Array.from(groups.entries())
      .map(([groupLabel, items]) => ({ groupLabel, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [sortedProjects, groupBy]);

  // Tarih aralığı hesapla
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (!sortedProjects.length) {
      const now = new Date();
      const future = new Date(); future.setMonth(future.getMonth() + 6);
      const days = Math.ceil((future.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { minDate: now, maxDate: future, totalDays: days };
    }
    const starts = sortedProjects.map(p => new Date(p.startDate).getTime());
    const ends = sortedProjects.map(p => new Date(p.endDate).getTime());
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    min.setMonth(min.getMonth() - 1);
    max.setMonth(max.getMonth() + 1);
    const days = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24));
    return { minDate: min, maxDate: max, totalDays: Math.max(days, 30) };
  }, [sortedProjects]);

  const getLeft = (dateStr: string) => {
    const d = new Date(dateStr).getTime();
    const diff = (d - minDate.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.min(100, (diff / totalDays) * 100));
  };
  const getWidth = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const days = (e - s) / (1000 * 60 * 60 * 24);
    return Math.max(0.5, (days / totalDays) * 100);
  };

  // Ay / Yıl etiketleri (ölçeğe göre otomatik)
  const showQuarterly = totalDays > 365 * 2;
  const showYearly = totalDays > 365 * 4;
  const labels = useMemo(() => {
    const result: { label: string; pos: number; isMajor: boolean }[] = [];
    const cur = new Date(minDate);
    cur.setDate(1);
    const end = new Date(minDate.getTime() + totalDays * 24 * 60 * 60 * 1000);
    while (cur <= end) {
      const pos = getLeft(cur.toISOString());
      if (pos >= 0 && pos <= 100) {
        if (showYearly) {
          if (cur.getMonth() === 0) {
            result.push({ label: String(cur.getFullYear()), pos, isMajor: true });
          }
        } else if (showQuarterly) {
          if (cur.getMonth() % 3 === 0) {
            const q = Math.floor(cur.getMonth() / 3) + 1;
            result.push({ label: `${cur.getFullYear()} Ç${q}`, pos, isMajor: true });
          }
        } else {
          result.push({
            label: cur.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }),
            pos, isMajor: cur.getMonth() === 0,
          });
        }
      }
      cur.setMonth(cur.getMonth() + 1);
    }
    return result;
  }, [minDate, totalDays, showYearly, showQuarterly]);

  const today = new Date();
  const todayPos = getLeft(today.toISOString());
  const showToday = todayPos > 0 && todayPos < 100;

  // İstatistikler
  const stats = useMemo(() => {
    const overdue = sortedProjects.filter(p => {
      const end = new Date(p.endDate);
      return end < today && p.status === 'active';
    }).length;
    const completing = sortedProjects.filter(p => {
      const end = new Date(p.endDate);
      const days = (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 30 && p.status === 'active';
    }).length;
    const totalBudget = sortedProjects.reduce((s, p) => s + (p.budget || 0), 0);
    const totalDuration = sortedProjects.reduce((s, p) => {
      const d = (new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
      return s + d;
    }, 0);
    const avgDuration = sortedProjects.length > 0 ? totalDuration / sortedProjects.length : 0;
    return { overdue, completing, totalBudget, avgDuration };
  }, [sortedProjects, today]);

  if (!projects.filter(p => p.startDate && p.endDate).length) {
    return (
      <div className="empty-state py-10 text-center">
        <div className="empty-state-icon" style={{ fontSize: 32 }}>📅</div>
        <p className="text-sm font-medium text-navy mt-2">Gantt için tarih bilgisi gerekli</p>
        <p className="text-xs text-muted mt-1">Başlangıç ve bitiş tarihi girilmiş projeler burada görünür.</p>
      </div>
    );
  }

  // Mevcut filtre değerleri için seçenekler
  const availableStatuses = Array.from(new Set(projects.map(p => p.status)));
  const availableTypes = Array.from(new Set(projects.map(p => p.type)));

  return (
    <div className="space-y-4">
      {/* ÜST BAR: filtre + sırala + grupla + istatistik */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 rounded-xl" style={{ background: '#faf8f4', border: '1px solid #e8e4dc' }}>
        {/* Filtreler */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-navy uppercase tracking-wider">Filtre:</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border bg-white" style={{ borderColor: '#e8e4dc' }}>
            <option value="all">Tüm Durumlar</option>
            {availableStatuses.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border bg-white" style={{ borderColor: '#e8e4dc' }}>
            <option value="all">Tüm Türler</option>
            {availableTypes.map(t => <option key={t} value={t}>{typeTr(t)}</option>)}
          </select>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-xs px-2.5 py-1.5 rounded-lg border bg-white" style={{ borderColor: '#e8e4dc' }}>
            <option value="startDate">Başlangıç tarihine göre</option>
            <option value="endDate">Bitiş tarihine göre</option>
            <option value="duration">Süreye göre (uzun→kısa)</option>
            <option value="budget">Bütçeye göre (yüksek→düşük)</option>
            <option value="progress">İlerlemeye göre</option>
            <option value="title">İsme göre (A→Z)</option>
          </select>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupKey)}
            className="text-xs px-2.5 py-1.5 rounded-lg border bg-white" style={{ borderColor: '#e8e4dc' }}>
            <option value="none">Gruplama yok</option>
            <option value="status">Duruma göre grupla</option>
            <option value="type">Türe göre grupla</option>
            <option value="faculty">Fakülteye göre grupla</option>
          </select>
        </div>

        {/* İstatistik chip'leri */}
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Chip label="Görüntülenen" value={`${sortedProjects.length} proje`} color="#1a3a6b" />
          {stats.overdue > 0 && (
            <Chip label="Gecikmiş" value={`${stats.overdue}`} color="#dc2626" pulse />
          )}
          {stats.completing > 0 && (
            <Chip label="30 gün içinde biten" value={`${stats.completing}`} color="#d97706" />
          )}
          {stats.totalBudget > 0 && (
            <Chip label="Toplam Bütçe" value={formatTry(stats.totalBudget)} color="#c8a45a" />
          )}
          <Chip label="Ort. Süre" value={`${stats.avgDuration.toFixed(0)} ay`} color="#7c3aed" />
        </div>
      </div>

      {/* GANTT GÖVDE */}
      <div className="overflow-x-auto" style={{ minHeight: 400 }}>
        <div style={{ minWidth: 900 }}>
          {/* Üst skala */}
          <div className="flex items-center gap-2 sticky top-0 z-20 pb-2 mb-2 border-b" style={{ background: 'white', borderColor: '#e8e4dc' }}>
            <div style={{ width: 280, minWidth: 280 }} className="text-xs font-bold text-navy uppercase tracking-wider px-2">Proje</div>
            <div className="flex-1 relative" style={{ height: 24 }}>
              {labels.map((m, i) => (
                <div key={i}
                  className="absolute text-xs whitespace-nowrap"
                  style={{
                    left: `${m.pos}%`,
                    transform: 'translateX(-50%)',
                    color: m.isMajor ? '#0f2444' : '#9ca3af',
                    fontWeight: m.isMajor ? 700 : 400,
                  }}>
                  {m.label}
                </div>
              ))}
              {/* Yıl çizgileri */}
              {labels.filter(l => l.isMajor).map((m, i) => (
                <div key={`v${i}`} className="absolute top-6"
                  style={{ left: `${m.pos}%`, width: 1, height: 8, background: '#0f2444', opacity: 0.4 }} />
              ))}
            </div>
            <div style={{ width: 88 }} className="text-xs font-bold text-navy uppercase tracking-wider text-right px-2">Bitiş</div>
          </div>

          {/* Gruplar ve barlar */}
          {grouped.map((g) => (
            <div key={g.groupLabel || 'flat'} className="space-y-1 mb-3">
              {g.groupLabel && (
                <div className="flex items-center gap-2 sticky left-0 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider"
                  style={{ background: '#f0ede8', color: '#0f2444' }}>
                  <span>{g.groupLabel}</span>
                  <span className="opacity-60">· {g.items.length}</span>
                </div>
              )}
              {g.items.map(p => {
                const left = getLeft(p.startDate);
                const width = getWidth(p.startDate, p.endDate);
                const color = STATUS_COLORS[p.status] || '#1a3a6b';
                const progress = p.progress || 0;
                const endDate = new Date(p.endDate);
                const isOverdue = endDate < today && p.status === 'active';
                const daysLeft = (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
                const isUrgent = daysLeft >= 0 && daysLeft <= 30 && p.status === 'active';
                const isHovered = hovered === p.id;
                const start = new Date(p.startDate);
                const durationMonths = Math.round((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));

                return (
                  <div key={p.id}
                    className="flex items-start gap-2 group transition-colors"
                    style={{ background: isHovered ? '#fffbeb' : 'transparent', padding: '2px 0', borderRadius: 4 }}
                    onMouseEnter={() => setHovered(p.id)}
                    onMouseLeave={() => setHovered(null)}>
                    {/* Sol etiket - proje adı + meta */}
                    <div style={{ width: 280, minWidth: 280 }} className="text-xs leading-tight px-2 pt-1">
                      <p className="font-semibold text-navy line-clamp-2">{p.title}</p>
                      <p className="text-muted mt-0.5" style={{ fontSize: 10 }}>
                        {p.owner ? <><span>{p.owner}</span> · </> : null}
                        {p.faculty || 'Fakülte yok'}
                        {p.type && <> · {typeTr(p.type)}</>}
                      </p>
                    </div>

                    {/* Bar alanı */}
                    <div className="flex-1 relative rounded-lg"
                      style={{ height: 36, background: '#f7f5f0', border: '1px solid #f0ede8', minWidth: 200 }}>
                      {/* Yıl şeritleri (haftalık çizgiler) */}
                      {labels.filter(l => l.isMajor).map((m, i) => (
                        <div key={`gl${i}`} className="absolute top-0 bottom-0"
                          style={{ left: `${m.pos}%`, width: 1, background: '#e8e4dc' }} />
                      ))}

                      {/* Bugün çizgisi */}
                      {showToday && (
                        <div className="absolute top-0 bottom-0 z-10"
                          style={{ left: `${todayPos}%`, width: 2, background: '#dc2626', opacity: 0.7 }} />
                      )}

                      {/* Ana bar */}
                      <div
                        className="absolute rounded-md flex items-center overflow-hidden transition-all"
                        style={{
                          top: 4, bottom: 4,
                          left: `${left}%`, width: `${width}%`,
                          background: color,
                          minWidth: 6,
                          opacity: isHovered ? 1 : 0.92,
                          boxShadow: isHovered ? '0 4px 12px rgba(15,36,68,0.25)' : (isOverdue ? '0 0 0 2px #dc2626' : 'none'),
                          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                          transformOrigin: 'left center',
                        }}>
                        {/* İlerleme overlay */}
                        {progress > 0 && (
                          <div className="absolute inset-0"
                            style={{
                              width: `${progress}%`,
                              background: 'linear-gradient(90deg, rgba(255,255,255,0.45), rgba(255,255,255,0.25))',
                            }} />
                        )}
                        {/* Bar içi metin */}
                        {width > 5 && (
                          <span className="text-white text-xs font-bold px-2 relative z-10 truncate" style={{ fontSize: 10 }}>
                            {progress > 0 ? `%${progress}` : (durationMonths > 0 ? `${durationMonths} ay` : '')}
                          </span>
                        )}
                      </div>

                      {/* Hover detay tooltip */}
                      {isHovered && (
                        <div className="absolute z-30 p-2.5 rounded-lg shadow-xl text-xs"
                          style={{
                            background: '#0f2444', color: 'white',
                            left: `${Math.min(left + width / 2, 70)}%`,
                            top: -12, transform: 'translate(-50%, -100%)',
                            minWidth: 220, maxWidth: 320,
                            border: '1px solid #c8a45a',
                          }}>
                          <p className="font-bold mb-1">{p.title}</p>
                          <div className="space-y-0.5 opacity-90" style={{ fontSize: 10 }}>
                            <div>📅 {start.toLocaleDateString('tr-TR')} → {endDate.toLocaleDateString('tr-TR')}</div>
                            <div>⏱ {durationMonths} ay</div>
                            <div>🎯 Durum: <strong>{STATUS_LABELS[p.status] || p.status}</strong></div>
                            {p.owner && <div>👤 {p.owner}</div>}
                            {p.faculty && <div>🏛 {p.faculty}{p.department && ` · ${p.department}`}</div>}
                            {p.type && <div>📋 {typeTr(p.type)}</div>}
                            {p.budget && <div>💰 {formatTry(p.budget)}</div>}
                            {(p.memberCount ?? 0) > 0 && <div>👥 {p.memberCount} üye</div>}
                            {progress > 0 && <div>📊 İlerleme: %{progress}</div>}
                            {isOverdue && <div style={{ color: '#fca5a5' }}>⚠ {Math.abs(daysLeft).toFixed(0)} gün gecikti</div>}
                            {isUrgent && <div style={{ color: '#fde68a' }}>⏰ {daysLeft.toFixed(0)} gün kaldı</div>}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sağ - bitiş bilgisi + uyarılar */}
                    <div style={{ width: 88 }} className="text-xs text-right pt-1 px-2 leading-tight">
                      <span className={isOverdue ? 'font-bold' : ''}
                        style={{ color: isOverdue ? '#dc2626' : isUrgent ? '#d97706' : '#6b7280' }}>
                        {endDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </span>
                      {isOverdue && <p style={{ fontSize: 9, color: '#dc2626' }}>⚠ Gecikme</p>}
                      {isUrgent && <p style={{ fontSize: 9, color: '#d97706' }}>⏰ Yakın</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {sortedProjects.length === 0 && (
            <div className="text-center py-10 text-sm text-muted">
              Filtreyle eşleşen proje yok. Farklı filtre kombinasyonu deneyin.
            </div>
          )}
        </div>
      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap items-center gap-3 pt-3 border-t text-xs text-muted" style={{ borderColor: '#e8e4dc' }}>
        <span className="font-bold text-navy uppercase tracking-wider">Açıklama:</span>
        {Object.entries(STATUS_LABELS).filter(([k]) => availableStatuses.includes(k)).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS[key] || '#6b7280' }} />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.45), rgba(255,255,255,0.25))', border: '1px solid #c8a45a' }} />
          Tamamlanma
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3" style={{ background: '#dc2626' }} />
          Bugün
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ border: '2px solid #dc2626', background: 'transparent' }} />
          Gecikmiş
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, color, pulse = false }: { label: string; value: string; color: string; pulse?: boolean }) {
  return (
    <div className="text-xs px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5"
      style={{ background: 'white', border: `1px solid ${color}33`, color }}>
      <span className={pulse ? 'inline-block w-1.5 h-1.5 rounded-full animate-pulse' : 'inline-block w-1.5 h-1.5 rounded-full'}
        style={{ background: color }} />
      <span className="text-muted">{label}:</span>
      <strong>{value}</strong>
    </div>
  );
}
