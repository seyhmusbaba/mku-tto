'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  type: string;
  faculty: string;
}

export function BudgetEstimator({ type, faculty }: Props) {
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // type veya faculty DEĞİŞTİĞİNDE sıfırla — otomatik açılma yok
  useEffect(() => {
    setData(null);
    setOpen(false);
  }, [type, faculty]);

  const handleLoad = async () => {
    if (!type) return;
    setLoading(true);
    try {
      const r = await api.get('/projects/budget-stats', { params: { type, faculty } });
      const d = r.data;
      if (d && (d.avg || d.min || d.max)) {
        setData(d);
        setOpen(true);
      } else {
        setData(null);
        setOpen(false);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Yeterli veri yoksa hiç gösterme
  if (!type || type === 'other') return null;

  return (
    <div>
      {!open && !data && (
        <button
          type="button"
          onClick={handleLoad}
          disabled={loading}
          className="btn-ghost text-xs flex items-center gap-1.5 mt-1"
        >
          {loading
            ? <><span className="spinner w-3 h-3" /> Yükleniyor...</>
            : <>💰 Bu proje türü için bütçe istatistiklerini gör</>
          }
        </button>
      )}

      {open && data && (
        <div className="mt-2 p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-green-800">
              💰 {data.type || type} — Geçmiş Bütçe İstatistikleri
              {faculty ? ` (${faculty})` : ''}
            </p>
            <button type="button" onClick={() => setOpen(false)} className="text-green-600 text-xs">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Minimum', value: data.min },
              { label: 'Ortalama', value: data.avg },
              { label: 'Maksimum', value: data.max },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-lg p-2">
                <p className="text-xs font-bold text-green-700">
                  {value ? Number(value).toLocaleString('tr-TR') + ' ₺' : '—'}
                </p>
                <p className="text-[10px] text-muted">{label}</p>
              </div>
            ))}
          </div>
          {data.count > 0 && (
            <p className="text-[10px] text-green-600 mt-1.5 text-center">{data.count} projeye dayalı</p>
          )}
        </div>
      )}
    </div>
  );
}
