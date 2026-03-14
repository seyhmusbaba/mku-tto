'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface BudgetStat {
  type: string;
  faculty: string;
  projectCount: string;
  avgBudget: string;
  minBudget: string;
  maxBudget: string;
  avgDurationYears: string;
}

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
    api.get('/projects/budget-stats', { params: { type, faculty: faculty || undefined } })
      .then(r => { setStats(r.data || []); setOpen(true); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [type, faculty]);

  if (!loading && stats.length === 0) return null;
  if (!open) return null;

  // En ilgili istatistiği seç: önce fakülte+tip eşleşmesi, sonra sadece tip
  const relevant = stats.find(s => s.faculty === faculty && s.type === type)
    || stats.find(s => s.type === type)
    || stats[0];

  if (!relevant && !loading) return null;

  const avg = relevant ? Math.round(+relevant.avgBudget) : 0;
  const min = relevant ? Math.round(+relevant.minBudget) : 0;
  const max = relevant ? Math.round(+relevant.maxBudget) : 0;
  const dur = relevant ? +relevant.avgDurationYears : 0;
  const count = relevant ? +relevant.projectCount : 0;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#bbf7d0' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">💡</span>
          <span className="font-semibold text-sm" style={{ color: '#14532d' }}>Bütçe Tahmini</span>
          {loading && <div className="spinner w-3 h-3" />}
        </div>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-navy text-xs">✕</button>
      </div>

      {loading ? (
        <p className="text-xs text-muted text-center py-4">Veriler yükleniyor...</p>
      ) : relevant ? (
        <div className="p-4">
          <p className="text-xs text-muted mb-3">
            Sistemdeki <strong>{count}</strong> benzer {faculty ? `${faculty} · ` : ''}proje baz alındı:
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Önerilen Ortalama', val: formatCurrency(avg), color: '#059669', icon: '📊' },
              { label: 'Min – Maks', val: `${formatCurrency(min)} – ${formatCurrency(max)}`, color: '#6b7280', icon: '↔️' },
              { label: 'Ort. Süre', val: dur > 0 ? `${dur.toFixed(1)} yıl` : '—', color: '#1a3a6b', icon: '⏱' },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #bbf7d0' }}>
                <p className="text-base mb-1">{item.icon}</p>
                <p className="text-sm font-bold" style={{ color: item.color }}>{item.val}</p>
                <p className="text-xs text-muted mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          {dur > 0 && (
            <p className="text-xs text-muted mt-3 text-center leading-relaxed">
              💬 Bu tür projeler ortalama <strong>{dur.toFixed(1)} yıl</strong> sürmektedir.
              Bütçenizi bu verilere göre kalibre edebilirsiniz.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
