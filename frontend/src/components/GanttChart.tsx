'use client';
import { useMemo } from 'react';

interface GanttItem {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  type: string;
  progress?: number;
}

interface Props {
  projects: GanttItem[];
}

const STATUS_COLORS: Record<string, string> = {
  application: '#d97706', pending: '#d97706', active: '#059669',
  completed: '#2563eb', suspended: '#6b7280', cancelled: '#dc2626',
};

export function GanttChart({ projects }: Props) {
  const validProjects = projects.filter(p => p.startDate && p.endDate);

  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (!validProjects.length) return { minDate: new Date(), maxDate: new Date(), totalDays: 365 };
    const starts = validProjects.map(p => new Date(p.startDate).getTime());
    const ends = validProjects.map(p => new Date(p.endDate).getTime());
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    // En az 30 gün göster
    const days = Math.max(30, Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24)) + 30);
    return { minDate: min, maxDate: max, totalDays: days };
  }, [validProjects]);

  if (!validProjects.length) {
    return (
      <div className="empty-state py-8">
        <div className="empty-state-icon">📅</div>
        <p className="text-sm font-medium text-navy">Gantt için tarih bilgisi gerekli</p>
        <p className="text-xs text-muted mt-1">Başlangıç ve bitiş tarihi girilmiş projeler burada görünür</p>
      </div>
    );
  }

  const getPos = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = (date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, (diff / totalDays) * 100);
  };

  const getWidth = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const days = (e - s) / (1000 * 60 * 60 * 24);
    return Math.max(0.5, (days / totalDays) * 100);
  };

  // Ay etiketleri üret
  const months: { label: string; pos: number }[] = [];
  const cur = new Date(minDate);
  cur.setDate(1);
  while (cur <= maxDate) {
    const pos = getPos(cur.toISOString());
    months.push({ label: cur.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }), pos });
    cur.setMonth(cur.getMonth() + 1);
  }

  const today = new Date();
  const todayPos = getPos(today.toISOString());
  const showToday = todayPos >= 0 && todayPos <= 100;

  return (
    <div className="space-y-3">
      {/* Ay başlıkları */}
      <div className="relative h-6 ml-48" style={{ overflowX: 'hidden' }}>
        {months.map((m, i) => (
          <div key={i} className="absolute text-xs text-muted font-medium"
            style={{ left: `${m.pos}%`, transform: 'translateX(-50%)' }}>
            {m.label}
          </div>
        ))}
        {showToday && (
          <div className="absolute top-0 bottom-0 w-px" style={{ left: `${todayPos}%`, background: '#dc2626' }} />
        )}
      </div>

      {/* Gantt barlar */}
      <div className="space-y-2">
        {validProjects.map(p => {
          const left = getPos(p.startDate);
          const width = getWidth(p.startDate, p.endDate);
          const color = STATUS_COLORS[p.status] || '#1a3a6b';

          return (
            <div key={p.id} className="flex items-center gap-3" style={{ minHeight: 36 }}>
              {/* Proje adı */}
              <div className="flex-shrink-0 text-xs font-medium text-navy truncate text-right" style={{ width: 180 }}>
                {p.title}
              </div>

              {/* Bar alanı */}
              <div className="flex-1 relative h-8 rounded-lg overflow-hidden" style={{ background: '#f8f6f2' }}>
                {/* Bugün çizgisi */}
                {showToday && (
                  <div className="absolute top-0 bottom-0 w-px z-10" style={{ left: `${todayPos}%`, background: '#dc262650' }} />
                )}

                {/* Gantt bar */}
                <div className="absolute top-1 bottom-1 rounded-lg flex items-center px-2 overflow-hidden"
                  style={{ left: `${left}%`, width: `${width}%`, background: color + 'cc', minWidth: 4 }}>
                  {width > 5 && (
                    <>
                      {/* İlerleme overlay */}
                      {p.progress !== undefined && p.progress > 0 && (
                        <div className="absolute inset-0 rounded-lg opacity-40"
                          style={{ width: `${p.progress}%`, background: 'white' }} />
                      )}
                      <span className="text-white text-xs font-semibold truncate z-10 relative leading-none">
                        {width > 15 ? p.title : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Tarih */}
              <div className="flex-shrink-0 text-xs text-muted" style={{ width: 80 }}>
                {new Date(p.endDate).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bugün göstergesi */}
      {showToday && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <div className="w-3 h-0.5" style={{ background: '#dc2626' }} />
          Bugün: {today.toLocaleDateString('tr-TR')}
        </div>
      )}
    </div>
  );
}
