'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { aiApi, api } from '@/lib/api';
import { Project } from '@/types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/utils';

interface WebResult {
  title: string;
  summary: string;
  source: string;
  year?: string;
  country?: string;
  fundingBody?: string;
  similarity: 'yüksek' | 'orta' | 'düşük';
}

interface AnalysisResult {
  webResults: WebResult[];
  assessment: string;
  recommendation: 'proceed' | 'review' | 'caution';
  noveltyScore: number; // 0-100
}

interface Props {
  title: string;
  description?: string;
  excludeId?: string;
  type?: string;
}

export function SimilarProjectsAlert({ title, description, excludeId, type }: Props) {
  const [localSimilar, setLocalSimilar] = useState<Project[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingWeb, setLoadingWeb] = useState(false);
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<'local' | 'web'>('local');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (title.length < 5) { setLocalSimilar([]); setAnalysis(null); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setAnalysis(null);
      try {
        // 1. Yerel DB araması
        const res = await aiApi.getSimilar(title, description || '', excludeId);
        setLocalSimilar(res.data || []);
        setOpen(true);

        // 2. YZ ile web analizi
        setLoadingWeb(true);
        const typeLabel = type === 'tubitak' ? 'TÜBİTAK' : type === 'bap' ? 'BAP' : type === 'eu' ? 'AB Projesi' : type === 'industry' ? 'Sanayi Projesi' : '';
        const systemPrompt = `Sen bir akademik araştırma analisti ve TTO uzmanısın. Kullanıcının verdiği proje başlığı ve açıklaması için:
1. Bu konuda daha önce yapılmış benzer akademik/araştırma projeleri ara ve listele (Türkiye'den ve dünyadan)
2. Projenin özgünlük değerlendirmesini yap
3. TÜBİTAK, AB Horizon, NSF, ERC gibi fonlardan benzer çalışmalar var mı belirt

SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{
  "webResults": [
    {
      "title": "Proje başlığı",
      "summary": "Kısa özet (1-2 cümle)",
      "source": "Kaynak/Kurum",
      "year": "Yıl",
      "country": "Ülke",
      "fundingBody": "Fon kaynağı",
      "similarity": "yüksek|orta|düşük"
    }
  ],
  "assessment": "Projenin özgünlüğü ve benzer çalışmalarla ilişkisi hakkında 2-3 cümlelik değerlendirme",
  "recommendation": "proceed|review|caution",
  "noveltyScore": 0-100
}`;

        const userContent = `Proje Başlığı: ${title}${description ? `\nAçıklama: ${description}` : ''}${typeLabel ? `\nProje Türü: ${typeLabel}` : ''}`;

        const aiRes = await api.post('/ai/generate', {
          system: systemPrompt,
          userContent,
          maxTokens: 2000,
        });

        if (aiRes.data?.text) {
          try {
            const clean = aiRes.data.text.replace(/```json|```/g, '').trim();
            const parsed: AnalysisResult = JSON.parse(clean);
            setAnalysis(parsed);
            if (parsed.webResults?.length > 0) setTab('web');
          } catch { /* JSON parse hatası — web sonuçları gösterilmez */ }
        }
      } catch {}
      finally { setLoading(false); setLoadingWeb(false); }
    }, 800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [title, description, excludeId, type]);

  const hasLocal = localSimilar.length > 0;
  const hasWeb = analysis && analysis.webResults?.length > 0;

  if (!loading && !loadingWeb && !hasLocal && !hasWeb) return null;
  if (!open) return null;

  const novelty = analysis?.noveltyScore ?? null;
  const noveltyColor = novelty !== null
    ? novelty >= 70 ? '#059669' : novelty >= 40 ? '#d97706' : '#dc2626'
    : '#6b7280';
  const recIcon = analysis?.recommendation === 'proceed' ? '✅' : analysis?.recommendation === 'review' ? '⚠️' : '🔴';

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#e8e4dc' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: '#f8f6f2', borderBottom: '1px solid #e8e4dc' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🔍</span>
          <span className="font-semibold text-sm text-navy">Benzer Proje Analizi</span>
          {(loading || loadingWeb) && <div className="spinner w-3 h-3" />}
          {novelty !== null && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: noveltyColor + '20', color: noveltyColor }}>
              Özgünlük %{novelty}
            </span>
          )}
        </div>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-navy text-xs">✕</button>
      </div>

      {/* YZ Değerlendirme */}
      {analysis && (
        <div className="px-4 py-3 text-sm" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0 text-base">{recIcon}</span>
            <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>{analysis.assessment}</p>
          </div>
        </div>
      )}

      {/* Sekmeler */}
      {(hasLocal || hasWeb) && (
        <div className="flex border-b" style={{ borderColor: '#e8e4dc' }}>
          {hasLocal && (
            <button onClick={() => setTab('local')}
              className="flex-1 py-2.5 text-xs font-semibold transition-colors"
              style={{ borderBottom: tab === 'local' ? '2px solid #1a3a6b' : '2px solid transparent', color: tab === 'local' ? '#1a3a6b' : '#6b7280' }}>
              🏛 Sistemde Bulunanlar ({localSimilar.length})
            </button>
          )}
          {hasWeb && (
            <button onClick={() => setTab('web')}
              className="flex-1 py-2.5 text-xs font-semibold transition-colors"
              style={{ borderBottom: tab === 'web' ? '2px solid #7c3aed' : '2px solid transparent', color: tab === 'web' ? '#7c3aed' : '#6b7280' }}>
              🌐 Dünya Geneli ({analysis.webResults.length})
            </button>
          )}
        </div>
      )}

      <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
        {/* Yüklenme durumu */}
        {loading && !hasLocal && (
          <p className="text-xs text-muted text-center py-3">Sistem veritabanı taranıyor...</p>
        )}
        {loadingWeb && !hasWeb && (
          <p className="text-xs text-muted text-center py-3">✨ YZ ile dünya genelinde benzer projeler aranıyor...</p>
        )}

        {/* Yerel sonuçlar */}
        {tab === 'local' && hasLocal && localSimilar.map(p => (
          <Link key={p.id} href={`/projects/${p.id}`} target="_blank"
            className="flex items-center justify-between p-3 rounded-xl hover:bg-cream transition-colors group"
            style={{ border: '1px solid #e8e4dc' }}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy group-hover:underline line-clamp-1">{p.title}</p>
              <p className="text-xs text-muted mt-0.5">{p.faculty || '—'} · {(p as any).owner?.firstName} {(p as any).owner?.lastName}</p>
            </div>
            <span className={`badge text-xs flex-shrink-0 ml-2 ${PROJECT_STATUS_COLORS[p.status]}`}>
              {PROJECT_STATUS_LABELS[p.status]}
            </span>
          </Link>
        ))}

        {/* Web sonuçları */}
        {tab === 'web' && hasWeb && analysis!.webResults.map((r, i) => {
          const simColor = r.similarity === 'yüksek' ? '#dc2626' : r.similarity === 'orta' ? '#d97706' : '#059669';
          return (
            <div key={i} className="p-3 rounded-xl" style={{ border: '1px solid #e8e4dc' }}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-navy line-clamp-2 flex-1">{r.title}</p>
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                  style={{ background: simColor + '15', color: simColor }}>
                  {r.similarity} benzerlik
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">{r.summary}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {r.source && <span className="text-xs text-navy font-medium">📍 {r.source}</span>}
                {r.year && <span className="text-xs text-muted">{r.year}</span>}
                {r.country && <span className="text-xs text-muted">🌍 {r.country}</span>}
                {r.fundingBody && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{r.fundingBody}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
