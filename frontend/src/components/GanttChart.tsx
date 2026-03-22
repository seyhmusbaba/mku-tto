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

const STATUS_LABELS: Record<string, string> = {
  application: 'Başvuru', pending: 'Beklemede', active: 'Aktif',
  completed: 'Tamamlandı', suspended: 'Askıda', cancelled: 'İptal',
};

export function GanttChart({ projects }: Props) {
  const validProjects = projects.filter(p => p.startDate && p.endDate);

  const { minDate, totalDays } = useMemo(() => {
    if (!validProjects.length) return { minDate: new Date(), maxDate: new Date(), totalDays: 365 };
    const starts = validProjects.map(p => new Date(p.startDate).getTime());
    const ends = validProjects.map(p => new Date(p.endDate).getTime());
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    // Biraz boşluk ekle
    min.setMonth(min.getMonth() - 1);
    max.setMonth(max.getMonth() + 1);
    const days = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24));
    return { minDate: min, maxDate: max, totalDays: Math.max(days, 30) };
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

  const getLeft = (dateStr: string) => {
    const d = new Date(dateStr).getTime();
    const diff = (d - minDate.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, (diff / totalDays) * 100);
  };

  const getWidth = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const days = (e - s) / (1000 * 60 * 60 * 24);
    return Math.max(0.5, (days / totalDays) * 100);
  };

  // Ay etiketleri
  const months: { label: string; pos: number }[] = [];
  const cur = new Date(minDate);
  cur.setDate(1);
  const maxD = new Date(minDate.getTime() + totalDays * 24 * 60 * 60 * 1000);
  while (cur <= maxD) {
    const pos = getLeft(cur.toISOString());
    if (pos >= 0 && pos <= 100) {
      months.push({ label: cur.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }), pos });
    }
    cur.setMonth(cur.getMonth() + 1);
  }

  const today = new Date();
  const todayPos = getLeft(today.toISOString());
  const showToday = todayPos > 0 && todayPos < 100;

  return (
    <div className="space-y-1 overflow-x-auto">
      {/* Açıklama */}
      <p className="text-xs text-muted mb-3">
        Her bar projenin başlangıç-bitiş aralığını gösterir. Renkler durumu, içindeki açık alan ise tamamlanma yüzdesini belirtir.
        {showToday && <span className="ml-2 text-red-500">Kırmızı çizgi = bugün</span>}
      </p>

      {/* Ay başlıkları */}
      <div className="relative h-6 ml-52">
        {months.map((m, i) => (
          <div key={i} className="absolute text-xs text-muted whitespace-nowrap"
            style={{ left: `${m.pos}%`, transform: 'translateX(-50%)' }}>
            {m.label}
          </div>
        ))}
      </div>

      {/* Barlar */}
      <div className="space-y-2">
        {validProjects.map(p => {
          const left = getLeft(p.startDate);
          const width = getWidth(p.startDate, p.endDate);
          const color = STATUS_COLORS[p.status] || '#1a3a6b';
          const progress = p.progress || 0;
          const endDate = new Date(p.endDate).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' });

          return (
            <div key={p.id} className="flex items-center gap-2">
              {/* Proje adı */}
              <div className="flex-shrink-0 text-xs font-medium text-navy text-right leading-tight"
                style={{ width: 200, minWidth: 200 }}>
                <span className="line-clamp-1 block">{p.title}</span>
                <span className="text-muted font-normal">{STATUS_LABELS[p.status] || p.status}</span>
              </div>

              {/* Bar alanı */}
              <div className="flex-1 relative rounded-lg overflow-hidden"
                style={{ height: 32, background: '#f0ede8', minWidth: 200 }}>
                {/* Bugün çizgisi */}
                {showToday && (
                  <div className="absolute top-0 bottom-0 w-0.5 z-10"
                    style={{ left: `${todayPos}%`, background: '#dc2626', opacity: 0.6 }} />
                )}

                {/* Ana bar */}
                <div className="absolute top-1 bottom-1 rounded-md overflow-hidden flex items-center"
                  style={{ left: `${left}%`, width: `${width}%`, background: color, minWidth: 4, opacity: 0.85 }}>
                  {/* İlerleme */}
                  {progress > 0 && (
                    <div className="absolute inset-0 rounded-md"
                      style={{ width: `${progress}%`, background: 'rgba(255,255,255,0.35)' }} />
                  )}
                  {width > 8 && (
                    <span className="text-white text-xs font-bold px-2 relative z-10 truncate leading-none">
                      {progress > 0 ? `%${progress}` : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Bitiş tarihi */}
              <div className="flex-shrink-0 text-xs text-muted" style={{ width: 64 }}>
                {endDate}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t flex-wrap" style={{ borderColor: '#e8e4dc' }}>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted">
            <div className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS[key] || '#6b7280' }} />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid #aaa' }} />
          Tamamlanma yüzdesi
        </div>
      </div>
    </div>
  );
}
