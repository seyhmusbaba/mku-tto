'use client';
import { useEffect, useState } from 'react';
import { aiApi } from '@/lib/api';
import { BudgetStat } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface Props {
  type: string;
  faculty?: string;
}

export function BudgetEstimator({ type, faculty }: Props) {
  const [stats, setStats] = useState<BudgetStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!type || type === 'other') { setStats([]); return; }
    setLoading(true);
    aiApi.getBudgetStats(type, faculty || undefined)
      .then(r => { setStats(r.data || []); setOpen(true); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [type, faculty]);

  if (!loading && stats.length === 0) return null;
  if (!open) return null;

  const relevant = faculty ? stats.find(s => s.faculty === faculty) || stats[0] : stats[0];

  if (!relevant && !loading) return null;

  return (
    <div className="rounded-2xl border p-4" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">💡</span>
          <span className="font-semibold text-sm" style={{ color: '#14532d' }}>Bütçe Tahmini</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-navy text-xs">✕</button>
      </div>
      {loading ? (
        <p className="text-xs text-muted mt-2">İstatistikler yükleniyor...</p>
      ) : relevant && (
        <div className="mt-3">
          <p className="text-xs text-muted mb-2">
            Sistemdeki <strong>{relevant.projectCount}</strong> benzer proje baz alınarak hesaplandı:
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Önerilen Ortalama', val: formatCurrency(+relevant.avgBudget), color: '#059669' },
              { label: 'Min – Maks Aralığı', val: `${formatCurrency(+relevant.minBudget)} – ${formatCurrency(+relevant.maxBudget)}`, color: '#6b7280' },
              { label: 'Ort. Süre', val: relevant.avgDurationYears ? `${(+relevant.avgDurationYears).toFixed(1)} yıl` : '—', color: '#1a3a6b' },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid #bbf7d0' }}>
                <p className="text-xs text-muted mb-1">{item.label}</p>
                <p className="text-sm font-bold" style={{ color: item.color }}>{item.val}</p>
              </div>
            ))}
          </div>
          {+relevant.avgDurationYears > 0 && (
            <p className="text-xs text-muted mt-2 text-center">
              💬 Bu tür projeler ortalama <strong>{(+relevant.avgDurationYears).toFixed(1)} yıl</strong> sürmektedir.
              Bütçenizi bu verilere göre kalibre edebilirsiniz.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
