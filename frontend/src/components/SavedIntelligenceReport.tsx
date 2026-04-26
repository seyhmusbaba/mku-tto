'use client';
/**
 * Kaydedilmis Proje Zekasi Raporu - read-only goruntu
 * Proje olusturma aninda hesaplanan synthesis sonucu burada gorunur.
 * Edit, detay ve PDF sayfalarinda ayni veri ile renderlanir.
 */

interface Props {
  report: any | null;
  reportAt?: string | Date | null;
  /** Compact mode = daha kucuk, detay sayfasi icin */
  compact?: boolean;
}

export function SavedIntelligenceReport({ report, reportAt, compact = false }: Props) {
  if (!report || typeof report !== 'object') {
    return (
      <div className="text-xs p-4 rounded-xl text-center"
        style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e' }}>
        <p className="font-semibold mb-1">Proje Zekası raporu bulunamadı</p>
        <p className="text-[11px] opacity-90">
          Bu projeyi oluşturulurken Proje Zekası hesaplanmamış olabilir (eski bir proje).
          Yeni projelerde rapor otomatik kayıt altına alınır.
        </p>
      </div>
    );
  }

  const aiBadge = report.source === 'ai'
    ? { label: 'Claude AI', color: '#7c3aed' }
    : { label: 'Kural tabanlı', color: '#6b7280' };

  const dims = [
    { k: 'originalityScore',   label: 'Özgünlük' },
    { k: 'competitionScore',   label: 'Rekabet' },
    { k: 'fitScore',           label: 'Dergi Uyumu' },
    { k: 'successProbability', label: 'Başarı' },
  ];

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Ust bilgi - kaynak + tarih */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] text-muted">
          {reportAt && (
            <>Hesaplama: {new Date(reportAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</>
          )}
        </p>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full"
          style={{ background: aiBadge.color + '20', color: aiBadge.color }}>
          {aiBadge.label}
        </span>
      </div>

      {/* Skor satiri */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-5'}`}>
        <div className="col-span-2 md:col-span-1 flex flex-col items-center justify-center p-4 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)', color: 'white' }}>
          <p className="text-[10px] uppercase tracking-wider opacity-70">Genel Skor</p>
          <p className="font-display text-4xl font-bold my-1">{report.overallScore}</p>
          <p className="text-[10px] opacity-70">/ 100</p>
        </div>
        {dims.map(d => {
          const v = report[d.k] || 0;
          const color = v >= 70 ? '#059669' : v >= 50 ? '#c8a45a' : v >= 30 ? '#d97706' : '#dc2626';
          return (
            <div key={d.k} className="p-3 rounded-xl border" style={{ borderColor: '#e8e4dc', background: 'white' }}>
              <p className="text-xs font-semibold text-navy">{d.label}</p>
              <p className="font-display text-2xl font-bold mt-1" style={{ color }}>%{v}</p>
              <div className="h-1.5 rounded-full mt-1.5" style={{ background: '#f0ede8' }}>
                <div className="h-1.5 rounded-full" style={{ width: `${v}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Anlatim */}
      {report.narrative && (
        <div className="p-4 rounded-xl text-sm leading-relaxed text-navy"
          style={{ background: 'white', border: '1px solid #e8e4dc' }}>
          {String(report.narrative).split('\n').map((p: string, i: number) => (
            <p key={i} className={i > 0 ? 'mt-2' : ''}>{p}</p>
          ))}
        </div>
      )}

      {/* Highlights / Risks / Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {report.highlights?.length > 0 && (
          <div className="p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
            <p className="text-xs font-bold text-green-700 mb-2">GÜÇLÜ YÖNLER</p>
            <ul className="space-y-1">
              {report.highlights.map((h: string, i: number) => (
                <li key={i} className="text-xs text-green-900 flex gap-1.5">
                  <span>•</span><span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.risks?.length > 0 && (
          <div className="p-3 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
            <p className="text-xs font-bold text-red-700 mb-2">RİSKLER</p>
            <ul className="space-y-1">
              {report.risks.map((r: string, i: number) => (
                <li key={i} className="text-xs text-red-900 flex gap-1.5">
                  <span>•</span><span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.recommendations?.length > 0 && (
          <div className="p-3 rounded-xl" style={{ background: '#eff6ff', border: '1px solid #93c5fd' }}>
            <p className="text-xs font-bold text-blue-700 mb-2">ÖNERİLER</p>
            <ul className="space-y-1">
              {report.recommendations.map((r: string, i: number) => (
                <li key={i} className="text-xs text-blue-900 flex gap-1.5">
                  <span>•</span><span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
