'use client';
import { useState } from 'react';
import { scopusApi } from '@/lib/api';

interface Props {
  title: string;
  description?: string;
  keywords?: string[];
}

export function SimilarResearchPanel({ title, description, keywords }: Props) {
  const [result, setResult]   = useState<{ total: number; results: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const [scopusOff, setScopusOff] = useState(false);

  const load = async () => {
    if (result) { setOpen(o => !o); return; }
    if (!title?.trim()) return;
    setLoading(true);
    setOpen(true);
    try {
      const r = await scopusApi.findSimilarResearch({ title, description, keywords });
      if (r.data?.error) { setScopusOff(true); return; }
      setResult(r.data);
    } catch { setScopusOff(true); }
    finally { setLoading(false); }
  };

  if (!title?.trim()) return null;
  if (scopusOff) {
    return (
      <div className="text-xs p-3 rounded-xl flex items-start gap-2"
        style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e' }}>
        <span>⚠</span>
        <div>
          <strong>Scopus entegrasyonu yapılandırılmamış.</strong> Dünya literatürü taraması için Scopus API anahtarı gerekli — admin Railway → Backend → Variables ekranından <code>SCOPUS_API_KEY</code> ekleyince bu özellik aktif olur.
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={load} disabled={loading}
        className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl w-full transition-all"
        style={{ background: '#eff6ff', color: '#1a3a6b', border: '1px solid #bfdbfe' }}>
        {loading
          ? <><span className="spinner w-3 h-3" />Dünya literatürü taranıyor...</>
          : <>🌍 {open ? 'Benzer Çalışmaları Gizle' : 'Dünyada Benzer Çalışmaları Bul (Scopus)'}</>
        }
      </button>

      {open && result && !loading && (
        <div className="mt-3 p-3 rounded-xl space-y-2"
          style={{ background: '#faf8f4', border: '1px solid #e8e4dc' }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-navy">
              🌍 Scopus'ta {result.total?.toLocaleString('tr-TR')} benzer çalışma bulundu
            </p>
            {result.total > 50 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                ⚠️ Alan yoğun rekabetli
              </span>
            )}
            {result.total > 0 && result.total <= 20 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #86efac' }}>
                ✅ Niş alan
              </span>
            )}
          </div>

          {result.results.length === 0 ? (
            <p className="text-xs text-muted text-center py-2">Scopus'ta tam eşleşme bulunamadı.</p>
          ) : (
            result.results.map((p, i) => (
              <div key={p.scopusId || i} className="p-2.5 rounded-lg text-xs space-y-0.5"
                style={{ background: 'white', border: '1px solid #e8e4dc' }}>
                <p className="font-semibold text-navy leading-snug line-clamp-2">{p.title}</p>
                <div className="flex items-center gap-3 text-muted flex-wrap">
                  {p.firstAuthor && <span>{p.firstAuthor}</span>}
                  {p.journal && <span className="truncate max-w-[180px]">📖 {p.journal}</span>}
                  {p.year && <span>📅 {p.year}</span>}
                  {p.citedBy > 0 && (
                    <span className="font-semibold" style={{ color: '#059669' }}>🔗 {p.citedBy} atıf</span>
                  )}
                  {p.doi && (
                    <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer"
                      className="font-medium hover:underline" style={{ color: '#1a3a6b' }}>
                      DOI ↗
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
          <p className="text-[10px] text-muted text-center pt-1">Scopus veritabanı bazlı — en çok atıf alan çalışmalar listelendi</p>
        </div>
      )}
    </div>
  );
}
