'use client';

interface MetricSource {
  name: string;
  shortName: string;
  color: string;
  docs?: number | null;
  citations?: number | null;
  hIndex?: number | null;
  note?: string;
  /** Kullanıcı bu kaynak için ID/bilgi tanımlamış mı? (tanımlıysa veri 0 olsa bile kart göster) */
  configured?: boolean;
  lastSync?: string | null;
}

interface Props {
  sources: MetricSource[];
  totalPublications?: number | null;
  openAccess?: number | null;
  otherCitations?: number | null;
  projects?: number | null;
  thesisAdvising?: number | null;
  compact?: boolean;
}

/**
 * AVESİS tarzı kaynak-bazlı bibliyometrik metrik grid.
 *
 * Her kaynak ayrı ayrı gösterilir — bir "Toplam" uydurma yapılmaz,
 * çünkü her veritabanı farklı kapsama sahip ve "%100 doğru" tek sayı yoktur.
 * Kaynaklar: Google Scholar, Scopus, Web of Science, TR Dizin, Sobiad.
 */
export function AvesisMetricsGrid({
  sources,
  totalPublications,
  openAccess,
  otherCitations,
  projects,
  thesisAdvising,
  compact = false,
}: Props) {
  const fmt = (n?: number | null) => (typeof n === 'number' && n > 0) ? n.toLocaleString('tr-TR') : '—';

  // Veri olan VEYA yapılandırılmış kaynakları göster — kullanıcı ID eklediyse
  // kart görünmeli (rakam 0 olsa bile "bu kaynak tarandı" mesajı verir).
  const activeSources = sources.filter(s =>
    s.configured ||
    (s.docs && s.docs > 0) || (s.citations && s.citations > 0) || (s.hIndex && s.hIndex > 0)
  );

  return (
    <div className="space-y-4">
      {/* Kurum toplamı / kısa özet — üstte */}
      {(totalPublications || projects || thesisAdvising || openAccess) ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-l rounded overflow-hidden" style={{ borderColor: '#e8e4dc' }}>
          <SummaryCell label="Toplam Yayın" value={fmt(totalPublications)} />
          <SummaryCell label="Proje" value={fmt(projects)} />
          <SummaryCell label="Tez Danışmanlığı" value={fmt(thesisAdvising)} />
          <SummaryCell label="Açık Erişim" value={fmt(openAccess)} />
        </div>
      ) : null}

      {/* Kaynak-bazlı metrikler */}
      {activeSources.length === 0 ? (
        <div className="border rounded-lg py-10 text-center" style={{ borderColor: '#e8e4dc', background: '#fafaf9' }}>
          <p className="text-sm text-muted italic">
            Henüz hiçbir kaynaktan metrik girilmemiş. Profilinizi düzenleyip
            Scopus/WoS/Scholar rakamlarınızı ekleyin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeSources.map(s => <SourceCard key={s.name} source={s} fmt={fmt} />)}
        </div>
      )}

      {/* Alt ek bilgi */}
      {typeof otherCitations === 'number' && otherCitations > 0 ? (
        <p className="text-xs text-muted flex items-center gap-2 pt-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#c8a45a' }} />
          Diğer kaynaklardan toplam <strong className="text-navy">{fmt(otherCitations)}</strong> atıf daha kaydedilmiştir.
        </p>
      ) : null}

      {!compact && (
        <p className="text-[11px] text-muted italic leading-relaxed pt-2 border-t" style={{ borderColor: '#e8e4dc' }}>
          Her veri tabanı farklı kapsamda yayın indeksler: WoS/Scopus sadece uluslararası SCI dergileri,
          Google Scholar gri literatürü dahil eder, TR Dizin Türkçe yayınları kapsar. Bu sebeple
          rakamlar doğal olarak farklıdır — bir "toplam" rakam birleştirmek yanıltıcı olur.
        </p>
      )}
    </div>
  );
}

function SourceCard({ source: s, fmt }: { source: MetricSource; fmt: (n?: number | null) => string }) {
  const noData = !(s.docs || s.citations || s.hIndex);
  return (
    <div className="border rounded-lg p-4 bg-white" style={{ borderColor: '#e8e4dc' }}>
      <div className="flex items-center gap-2 mb-3 pb-3 border-b" style={{ borderColor: '#f0ede8' }}>
        <span
          className="w-7 h-7 rounded flex items-center justify-center text-white text-[10px] font-bold tracking-wider flex-shrink-0"
          style={{ background: s.color }}
        >
          {s.shortName}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-navy leading-tight">{s.name}</p>
          {s.note && <p className="text-[10px] text-muted mt-0.5 truncate">{s.note}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MetricCell label="Yayın" value={fmt(s.docs)} />
        <MetricCell label="Atıf" value={fmt(s.citations)} />
        <MetricCell label="h-index" value={fmt(s.hIndex)} />
      </div>
      {noData && s.configured && (
        <p className="text-[10px] text-muted italic mt-2 pt-2 border-t" style={{ borderColor: '#f0ede8' }}>
          Bu kaynak tanımlı ancak henüz senkronizasyon yapılmadı veya sonuç bulunamadı.
        </p>
      )}
      {s.lastSync && (
        <p className="text-[10px] text-muted mt-2 flex items-center gap-1">
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Son sync: {new Date(s.lastSync).toLocaleDateString('tr-TR')}
        </p>
      )}
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  const isEmpty = value === '—';
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-0.5">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${isEmpty ? 'text-gray-300' : 'text-navy'}`}>{value}</p>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-4 bg-white border-r border-b" style={{ borderColor: '#e8e4dc' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${value === '—' ? 'text-gray-300' : 'text-navy'}`}>{value}</p>
    </div>
  );
}
