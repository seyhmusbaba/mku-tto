'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
  tcNo: string;
  onSync?: (data: any) => void;
}

export function YoksisSync({ tcNo, onSync }: Props) {
  const [loading, setLoading] = useState(false);
  const [showTcInput, setShowTcInput] = useState(false);
  const [tc, setTc] = useState(tcNo || '');
  const [status, setStatus] = useState<any>(null);

  const handleSync = async () => {
    if (!tc || tc.length !== 11) {
      toast.error('11 haneli TC Kimlik Numarası girin');
      return;
    }
    setLoading(true);
    try {
      // Önce YÖKSİS yapılandırılmış mı kontrol et
      const statusRes = await api.get('/ai/yoksis/status');
      if (!statusRes.data.configured) {
        toast.error('YÖKSİS entegrasyonu henüz yapılandırılmamış. Sistem yöneticisiyle iletişime geçin.');
        return;
      }

      const r = await api.post('/ai/yoksis/sync', { tcNo: tc });
      if (r.data.success) {
        toast.success(r.data.message || 'YÖKSİS verileri senkronize edildi');
        onSync?.(r.data.data);
        setShowTcInput(false);
      } else {
        toast.error(r.data.message || 'Senkronizasyon başarısız');
      }
    } catch {
      toast.error('YÖKSİS bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  if (!showTcInput) {
    return (
      <button
        type="button"
        onClick={() => setShowTcInput(true)}
        className="btn-secondary text-xs px-3 flex items-center gap-1.5"
      >
        <span className="w-4 h-4 rounded text-white text-[8px] font-bold flex items-center justify-center" style={{ background: '#2563eb' }}>Y</span>
        YÖKSİS Senkronize Et
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
      <div className="flex-1 space-y-1.5">
        <p className="text-xs font-semibold text-blue-800">YÖKSİS TC Kimlik No ile Senkronizasyon</p>
        <p className="text-[11px] text-blue-600">TC numaranız ile YÖKSİS'ten fakülte, bölüm, unvan ve uzmanlık bilgileriniz çekilir.</p>
        <div className="flex gap-2">
          <input
            className="input text-xs flex-1"
            style={{ height: 32 }}
            type="text"
            maxLength={11}
            value={tc}
            onChange={e => setTc(e.target.value.replace(/\D/g, ''))}
            placeholder="11 haneli TC Kimlik No"
          />
          <button
            type="button"
            onClick={handleSync}
            disabled={loading || tc.length !== 11}
            className="btn-primary text-xs px-3 flex-shrink-0 disabled:opacity-40"
            style={{ height: 32 }}
          >
            {loading ? <span className="spinner w-3 h-3" /> : 'Senkronize Et'}
          </button>
          <button
            type="button"
            onClick={() => setShowTcInput(false)}
            className="text-muted text-xs px-2"
          >
            İptal
          </button>
        </div>
        <p className="text-[10px] text-blue-500">⚠️ TC numaranız sadece YÖKSİS sorgusunda kullanılır, sistemde saklanmaz.</p>
      </div>
    </div>
  );
}
