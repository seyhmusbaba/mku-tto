'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

interface ComplianceResult {
  score: number;
  level: 'excellent' | 'good' | 'warning' | 'critical';
  summary: string;
  issues: Array<{ type: string; severity: 'info' | 'warning' | 'error'; message: string }>;
  suggestions: string[];
  ethicsFlags: string[];
  plagiarismRisk: 'low' | 'medium' | 'high';
  completenessScore: number;
  clarityScore: number;
}

const LEVEL: Record<string, any> = {
  excellent: { label: 'Mukemmel', color: '#059669', bg: '#f0fdf4', border: '#86efac', icon: '✅' },
  good:      { label: 'İyi',      color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd', icon: '👍' },
  warning:   { label: 'Dikkat',   color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '⚠️' },
  critical:  { label: 'Kritik',   color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', icon: '🚨' },
};

const RISK: Record<string, string> = { low: '🟢 Düşük', medium: '🟡 Orta', high: '🔴 Yüksek' };

interface Props {
  title: string;
  description: string;
  projectText: string;
  type: string;
  ethicsRequired?: boolean;
  onResult?: (r: ComplianceResult) => void;
}

export function ProjectComplianceCheck({ title, description, projectText, type, ethicsRequired, onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const handleCheck = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!title && !projectText) return;
    setShowWarning(true);
  };

  const confirmCheck = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowWarning(false);
    setLoading(true);
    try {
      const r = await api.post('/ai/check-compliance', {
        title: title || '',
        description: description || '',
        projectText: projectText || '',
        type: type || 'other',
        ethicsRequired: !!ethicsRequired,
      });
      if (r.data && typeof r.data.score === 'number') {
        setResult(r.data);
        onResult?.(r.data);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const cancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowWarning(false);
  };

  const canCheck = !!(title || projectText);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy flex items-center gap-1.5">
            <span>🤖</span> YZ Uygunluk Kontrolü
          </p>
          <p className="text-xs text-muted mt-0.5">Proje metnini akademik, etik ve özgünlük açısından analiz eder</p>
        </div>
        <button type="button" onClick={handleCheck} disabled={!canCheck || loading}
          className="btn-secondary text-xs px-4 py-2 flex items-center gap-2 flex-shrink-0 disabled:opacity-40">
          {loading ? <span className="spinner w-3.5 h-3.5" /> : '🔍'}
          {loading ? 'Analiz ediliyor...' : 'Analiz Et'}
        </button>
      </div>

      {showWarning && (
        <div className="p-4 rounded-xl space-y-3" style={{ background: '#fffbeb', border: '2px solid #fde68a' }}>
          <div className="flex items-start gap-2">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Yapay Zeka Kullanım Bildirimi</p>
              <div className="text-xs text-amber-700 mt-2 space-y-0.5">
                <p>✓ Proje metninin genel uygunluğunu değerlendirir</p>
                <p>✓ Potansiyel etik sorunları tespit edebilir</p>
                <p>⚠️ YZ analizi kesin sonuç vermez, rehber niteliğindedir</p>
                <p>⚠️ Proje metniniz analiz için sunucuya gönderilecektir</p>
                <p>⚠️ Etik kurul kararı yetkili komiteler tarafından verilir</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={confirmCheck} className="btn-primary flex-1 text-xs py-2">
              Anlıyorum, analiz et
            </button>
            <button type="button" onClick={cancel} className="btn-secondary text-xs py-2 px-4">İptal</button>
          </div>
        </div>
      )}

      {result && !showWarning && (
        <div className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid ' + (LEVEL[result.level]?.border || '#e8e4dc') }}>
          <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2"
            style={{ background: LEVEL[result.level]?.bg || '#faf8f4' }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{LEVEL[result.level]?.icon}</span>
              <div>
                <p className="text-sm font-bold" style={{ color: LEVEL[result.level]?.color }}>
                  {LEVEL[result.level]?.label} — {result.score}/100
                </p>
                <p className="text-xs" style={{ color: LEVEL[result.level]?.color }}>{result.summary}</p>
              </div>
            </div>
            <div className="flex gap-4 text-center">
              <div>
                <p className="text-xs font-bold" style={{ color: LEVEL[result.level]?.color }}>{result.completenessScore}%</p>
                <p className="text-[10px] text-muted">Tamamlık</p>
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: LEVEL[result.level]?.color }}>{result.clarityScore}%</p>
                <p className="text-[10px] text-muted">Açıklık</p>
              </div>
              <div>
                <p className="text-xs font-bold">{RISK[result.plagiarismRisk] || result.plagiarismRisk}</p>
                <p className="text-[10px] text-muted">İntihal</p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-3 bg-white">
            {result.ethicsFlags?.length > 0 && (
              <div className="p-3 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                <p className="text-xs font-bold text-red-700 mb-1">🔴 Etik Değerlendirme Gerekebilir</p>
                {result.ethicsFlags.map((f, i) => <p key={i} className="text-xs text-red-600">• {f}</p>)}
              </div>
            )}
            {result.issues?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-navy mb-2">Tespit Edilen Sorunlar</p>
                {result.issues.map((iss, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg text-xs mb-1"
                    style={{ background: iss.severity === 'error' ? '#fef2f2' : iss.severity === 'warning' ? '#fffbeb' : '#eff6ff' }}>
                    <span>{iss.severity === 'error' ? '❌' : iss.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                    <span style={{ color: iss.severity === 'error' ? '#dc2626' : iss.severity === 'warning' ? '#d97706' : '#1d4ed8' }}>
                      {iss.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {result.suggestions?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-navy mb-1">💡 Öneriler</p>
                {result.suggestions.map((s, i) => <p key={i} className="text-xs text-navy">• {s}</p>)}
              </div>
            )}
            <button type="button" onClick={() => setResult(null)} className="text-xs text-muted hover:text-navy">
              Sonucu kapat ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
