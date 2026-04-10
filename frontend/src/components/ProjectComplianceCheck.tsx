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

const LEVEL_CONFIG = {
  excellent: { label: 'Mükemmel', color: '#059669', bg: '#f0fdf4', border: '#86efac', icon: '✅' },
  good:      { label: 'İyi',       color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd', icon: '👍' },
  warning:   { label: 'Dikkat',   color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '⚠️' },
  critical:  { label: 'Kritik',   color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', icon: '🚨' },
};

const SEVERITY_CONFIG = {
  info:    { color: '#1d4ed8', bg: '#eff6ff', icon: 'ℹ️' },
  warning: { color: '#d97706', bg: '#fffbeb', icon: '⚠️' },
  error:   { color: '#dc2626', bg: '#fef2f2', icon: '❌' },
};

const RISK_CONFIG = {
  low:    { label: 'Düşük',    color: '#059669', icon: '🟢' },
  medium: { label: 'Orta',     color: '#d97706', icon: '🟡' },
  high:   { label: 'Yüksek',   color: '#dc2626', icon: '🔴' },
};

interface Props {
  title: string;
  description: string;
  projectText: string;
  type: string;
  ethicsRequired?: boolean;
  onResult?: (result: ComplianceResult) => void;
}

export function ProjectComplianceCheck({ title, description, projectText, type, ethicsRequired, onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const handleCheck = () => {
    if (!title && !projectText) {
      return;
    }
    // YZ kullanım uyarısı göster
    setShowWarning(true);
  };

  const confirmAndCheck = async () => {
    setShowWarning(false);
    setLoading(true);
    try {
      const r = await api.post('/ai/check-compliance', {
        title, description, projectText, type, ethicsRequired,
      });
      setResult(r.data);
      onResult?.(r.data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const canCheck = !!(title || projectText);

  return (
    <div className="space-y-3">
      {/* Başlık & Buton */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy flex items-center gap-1.5">
            <span>🤖</span> YZ Uygunluk Kontrolü
          </p>
          <p className="text-xs text-muted mt-0.5">
            Proje metnini akademik, etik ve özgünlük açısından analiz eder
          </p>
        </div>
        <button
          type="button"
          onClick={handleCheck}
          disabled={!canCheck || loading}
          className="btn-secondary text-xs px-4 py-2 flex items-center gap-2 flex-shrink-0 disabled:opacity-40"
        >
          {loading ? <span className="spinner w-3.5 h-3.5" /> : '🔍'}
          {loading ? 'Analiz ediliyor...' : 'Analiz Et'}
        </button>
      </div>

      {/* YZ Etik Uyarı Modalı */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowWarning(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" style={{ border: '1px solid #e8e4dc' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7' }}>
                <span className="text-xl">⚠️</span>
              </div>
              <div>
                <h3 className="font-display font-semibold text-navy">Yapay Zeka Kullanım Bildirimi</h3>
                <p className="text-xs text-muted mt-1">Devam etmeden önce lütfen okuyun</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-navy mb-5 p-4 rounded-xl" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
              <p className="font-semibold text-amber-800">Bu araç aşağıdaki amaçlarla kullanılabilir:</p>
              <ul className="space-y-1 text-amber-800 text-xs">
                <li>✓ Proje metninin genel uygunluğunu değerlendirme</li>
                <li>✓ Potansiyel etik sorunları tespit etme</li>
                <li>✓ İyileştirme önerileri alma</li>
              </ul>
              <p className="font-semibold text-amber-800 mt-2">Önemli Uyarılar:</p>
              <ul className="space-y-1 text-amber-800 text-xs">
                <li>⚠️ YZ analizi kesin sonuç vermez, rehber niteliğindedir</li>
                <li>⚠️ Akademik intihal tespiti için resmi araçlar kullanın</li>
                <li>⚠️ Etik kurul kararı sadece yetkili komiteler tarafından verilebilir</li>
                <li>⚠️ Proje metniz YZ işleme için sunucuya gönderilecektir</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button onClick={confirmAndCheck} className="btn-primary flex-1 text-sm">
                Anlıyorum, devam et
              </button>
              <button onClick={() => setShowWarning(false)} className="btn-secondary text-sm">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sonuç */}
      {result && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid ' + LEVEL_CONFIG[result.level].border }}>
          {/* Üst bant — skor */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: LEVEL_CONFIG[result.level].bg }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{LEVEL_CONFIG[result.level].icon}</span>
              <div>
                <p className="text-sm font-bold" style={{ color: LEVEL_CONFIG[result.level].color }}>
                  {LEVEL_CONFIG[result.level].label} — {result.score}/100
                </p>
                <p className="text-xs" style={{ color: LEVEL_CONFIG[result.level].color }}>{result.summary}</p>
              </div>
            </div>
            <div className="flex gap-3 text-center flex-shrink-0">
              <div>
                <p className="text-xs font-bold" style={{ color: LEVEL_CONFIG[result.level].color }}>{result.completenessScore}%</p>
                <p className="text-[10px] text-muted">Tamamlık</p>
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: LEVEL_CONFIG[result.level].color }}>{result.clarityScore}%</p>
                <p className="text-[10px] text-muted">Açıklık</p>
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: RISK_CONFIG[result.plagiarismRisk].color }}>
                  {RISK_CONFIG[result.plagiarismRisk].icon} {RISK_CONFIG[result.plagiarismRisk].label}
                </p>
                <p className="text-[10px] text-muted">İntihal Riski</p>
              </div>
            </div>
          </div>

          {/* İçerik */}
          <div className="p-4 space-y-4 bg-white">
            {/* Etik uyarılar */}
            {result.ethicsFlags.length > 0 && (
              <div className="p-3 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                <p className="text-xs font-bold text-red-700 mb-2">🔴 Etik Değerlendirme Gerekebilir</p>
                {result.ethicsFlags.map((flag, i) => (
                  <p key={i} className="text-xs text-red-600 mb-1">• {flag}</p>
                ))}
              </div>
            )}

            {/* Sorunlar */}
            {result.issues.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-navy mb-2">Tespit Edilen Sorunlar</p>
                <div className="space-y-1.5">
                  {result.issues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg text-xs"
                      style={{ background: SEVERITY_CONFIG[issue.severity].bg }}>
                      <span className="flex-shrink-0">{SEVERITY_CONFIG[issue.severity].icon}</span>
                      <span style={{ color: SEVERITY_CONFIG[issue.severity].color }}>{issue.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Öneriler */}
            {result.suggestions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-navy mb-2">💡 İyileştirme Önerileri</p>
                <div className="space-y-1">
                  {result.suggestions.map((s, i) => (
                    <p key={i} className="text-xs text-navy">• {s}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
