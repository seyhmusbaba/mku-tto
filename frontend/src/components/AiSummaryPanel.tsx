'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  title: string;
  description?: string;
  type?: string;
  faculty?: string;
  budget?: number | string;
  sdgGoals?: string[];
  mode?: 'create' | 'summary';
  onApply?: (text: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  tubitak: 'TÜBİTAK', bap: 'BAP', eu: 'AB Projesi', industry: 'Sanayi Projesi', other: 'Diğer',
};

export function AiSummaryPanel({ title, description, type, faculty, budget, sdgGoals, mode = 'create', onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const generate = async () => {
    if (!title && !description) return;
    setLoading(true); setError(''); setResult('');

    const systemPrompt = mode === 'create'
      ? `Sen bir akademik TTO (Teknoloji Transfer Ofisi) uzmanısın. Kullanıcının verdiği proje bilgilerini kullanarak profesyonel, açık ve akıcı bir Türkçe proje özeti yaz. Özet maksimum 3 paragraf olsun: (1) projenin amacı ve kapsamı, (2) yöntemi ve özgün katkısı, (3) beklenen çıktılar ve etkisi. Sadece özeti yaz, başlık veya açıklama ekleme.`
      : `Sen bir akademik TTO uzmanısın. Sana verilen projeyi Türkçe olarak kısa ve net özetle. Madde madde değil paragraf biçiminde. Maksimum 200 kelime.`;

    const userContent = [
      `Proje Başlığı: ${title}`,
      description ? `Açıklama: ${description}` : null,
      type ? `Proje Türü: ${TYPE_LABELS[type] || type}` : null,
      faculty ? `Fakülte: ${faculty}` : null,
      budget ? `Bütçe: ${Number(budget).toLocaleString('tr-TR')} ₺` : null,
      sdgGoals?.length ? `SKH Hedefleri: ${sdgGoals.join(', ')}` : null,
    ].filter(Boolean).join('\n');

    try {
      const res = await api.post('/ai/generate', { system: systemPrompt, userContent, maxTokens: 1000 });
      if (res.data?.error) setError(res.data.error);
      else setResult(res.data?.text || '');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Bağlantı hatası. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#e8e4dc' }}>
      {/* Başlık — sadece aç/kapat, üretme tetiklemiyor */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-cream"
        style={{ background: open ? '#f8f6f2' : 'transparent' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <span className="font-semibold text-sm text-navy">
            {mode === 'create' ? 'YZ ile Özet Taslağı Oluştur' : 'YZ ile Özetle'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#1a3a6b18', color: '#1a3a6b' }}>Beta</span>
        </div>
        <svg className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: '1px solid #f0ede8' }}>

          {/* Henüz üretilmedi — sadece "Oluştur" butonu */}
          {!result && !loading && !error && (
            <div className="text-center py-4">
              <p className="text-xs text-muted mb-3">
                {mode === 'create'
                  ? 'Girdiğiniz proje bilgilerinden TTO formatında profesyonel bir özet oluşturulacak.'
                  : 'Proje bilgileri analiz edilerek kısa bir özet hazırlanacak.'}
              </p>
              <button type="button" onClick={generate}
                className="btn-primary text-sm px-6 py-2.5 inline-flex items-center gap-2">
                <span>✨</span> Özet Oluştur
              </button>
            </div>
          )}

          {/* Yükleniyor */}
          {loading && (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="spinner" />
              <p className="text-xs text-muted">YZ özet hazırlıyor...</p>
            </div>
          )}

          {/* Hata */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <span className="flex-shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-red-700">{error}</p>
                {error.includes('ANTHROPIC_API_KEY') && (
                  <p className="text-xs text-red-600 mt-1 font-mono">backend/.env → ANTHROPIC_API_KEY=sk-ant-...</p>
                )}
              </div>
              <button type="button" onClick={generate} className="text-xs font-medium text-red-700 underline flex-shrink-0">Tekrar</button>
            </div>
          )}

          {/* Sonuç */}
          {result && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
                style={{ background: '#f8f6f2', border: '1px solid #e8e4dc', color: '#374151' }}>
                {result}
              </div>
              <div className="flex gap-2 flex-wrap">
                {onApply && (
                  <button type="button" onClick={() => onApply(result)} className="btn-primary text-xs px-4 py-2 flex-1">
                    ✓ Forma Uygula
                  </button>
                )}
                <button type="button" onClick={generate} className="btn-secondary text-xs px-4 py-2">
                  🔄 Yeniden Üret
                </button>
                <button type="button" onClick={() => navigator.clipboard.writeText(result)} className="btn-ghost text-xs px-4 py-2">
                  📋 Kopyala
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
