'use client';
import { useEffect, useState } from 'react';
import { scopusApi } from '@/lib/api';

interface Props {
  keywords: string[];
  tags: string[];
  projectType: string;
  title: string;
}

const AREA_COLORS: Record<string, string> = {
  COMP: '#6366f1', ENGI: '#0891b2', MEDI: '#dc2626', MATH: '#7c3aed',
  AGRI: '#65a30d', ENVI: '#0d9488', ENER: '#d97706', SOCI: '#c026d3',
  BIOC: '#0284c7', EART: '#92400e', PHYS: '#1d4ed8', CHEM: '#7e22ce',
};

export function FundingMatchPanel({ keywords, tags, projectType, title }: Props) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const [scopusOff, setScopusOff] = useState(false);

  const allKeywords = Array.from(new Set([...keywords, ...tags])).filter(Boolean);

  const load = async () => {
    if (data) { setOpen(o => !o); return; }
    setLoading(true);
    setOpen(true);
    try {
      const r = await scopusApi.getFundingMatch({
        keywords: allKeywords,
        projectType,
        title,
      });
      if (r.data?.error) { setScopusOff(true); return; }
      setData(r.data);
    } catch { setScopusOff(true); }
    finally { setLoading(false); }
  };

  if (scopusOff) return null;

  return (
    <div>
      <button onClick={load} disabled={loading}
        className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl w-full transition-all"
        style={{ background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff' }}>
        {loading
          ? <><span className="spinner w-3 h-3" />Scopus ile analiz ediliyor...</>
          : <><span>💡</span>{open ? 'Hibe Önerilerini Gizle' : 'Scopus ile Hibe Uygunluk Analizi'}</>}
      </button>

      {open && data && !loading && (
        <div className="mt-3 space-y-3">
          {/* Konu alanları */}
          {data.subjectAreas?.length > 0 && (
            <div className="p-3 rounded-xl" style={{ background: '#faf8f4', border: '1px solid #e8e4dc' }}>
              <p className="text-xs font-semibold text-navy mb-2">📊 Scopus Konu Alanları</p>
              <div className="flex flex-wrap gap-1.5">
                {data.subjectAreas.map((a: any) => (
                  <span key={a.code}
                    className="text-xs px-2.5 py-1 rounded-full font-semibold text-white"
                    style={{ background: AREA_COLORS[a.code] || '#6b7280' }}>
                    {a.label} ({a.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hibe önerileri */}
          {data.recommendations?.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-navy">🎯 Uygun Fon Kaynakları</p>
              {data.recommendations.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'white', border: '1px solid #e8e4dc' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">💰</span>
                    <div>
                      <p className="text-xs font-semibold text-navy">{r.name}</p>
                      <p className="text-xs text-muted">{r.areaLabel} alanı</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: r.relevance === 'Çok Yüksek' ? '#f0fdf4' : '#eff6ff',
                      color:      r.relevance === 'Çok Yüksek' ? '#059669' : '#1a3a6b',
                      border:     `1px solid ${r.relevance === 'Çok Yüksek' ? '#86efac' : '#bfdbfe'}`,
                    }}>
                    {r.relevance}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted text-center py-3">
              Konu alanlarına göre spesifik hibe önerisi bulunamadı.
              Anahtar kelime ekleyerek tekrar deneyin.
            </p>
          )}

          <p className="text-xs text-muted text-center">
            Scopus ASJC konu sınıflandırmasına dayalı analiz
          </p>
        </div>
      )}
    </div>
  );
}
