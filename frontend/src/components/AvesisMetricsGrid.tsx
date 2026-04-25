'use client';
import { useState } from 'react';

export type SourceKey = 'openalex' | 'scopus' | 'wos' | 'trdizin' | 'scholar' | 'sobiad';

interface MetricSource {
  key: SourceKey;
  name: string;
  docs?: number | null;
  citations?: number | null;
  hIndex?: number | null;
  /** Kullanıcı bu kaynak için ID/bilgi tanımlamış mı? (tanımlıysa veri 0 olsa bile kart göster) */
  configured?: boolean;
  lastSync?: string | null;
  /** En son sync denemesindeki hata (varsa) */
  syncError?: string | null;
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
 * Her kaynağın kendi logosu var - gerçek marka tanınırlığı.
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
  const fmt = (n?: number | null) => (typeof n === 'number' && n > 0) ? n.toLocaleString('tr-TR') : '-';

  const activeSources = sources.filter(s =>
    s.configured ||
    (s.docs && s.docs > 0) || (s.citations && s.citations > 0) || (s.hIndex && s.hIndex > 0)
  );

  return (
    <div className="space-y-4">
      {/* Kurum toplamı / kısa özet */}
      {(totalPublications || projects || thesisAdvising || openAccess) ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-l rounded overflow-hidden" style={{ borderColor: '#e8e4dc' }}>
          <SummaryCell label="Toplam Yayın" value={fmt(totalPublications)} />
          <SummaryCell label="Proje" value={fmt(projects)} />
          <SummaryCell label="Tez Danışmanlığı" value={fmt(thesisAdvising)} />
          <SummaryCell label="Açık Erişim" value={fmt(openAccess)} />
        </div>
      ) : null}

      {activeSources.length === 0 ? (
        <div className="border rounded-lg py-10 text-center" style={{ borderColor: '#e8e4dc', background: '#fafaf9' }}>
          <p className="text-sm text-muted italic">
            Henüz hiçbir kaynaktan metrik yok. ORCID/Scopus/WoS ID'lerinizi profil düzenlemeden ekleyin ve "Otomatik Senkronize Et" butonuna basın.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeSources.map(s => <SourceCard key={s.key} source={s} fmt={fmt} />)}
        </div>
      )}

      {typeof otherCitations === 'number' && otherCitations > 0 ? (
        <p className="text-xs text-muted flex items-center gap-2 pt-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#c8a45a' }} />
          Diğer kaynaklardan toplam <strong className="text-navy">{fmt(otherCitations)}</strong> atıf daha kaydedilmiştir.
        </p>
      ) : null}
    </div>
  );
}

function SourceCard({ source: s, fmt }: { source: MetricSource; fmt: (n?: number | null) => string }) {
  const noData = !(s.docs || s.citations || s.hIndex);

  return (
    <div className="border rounded-lg p-4 bg-white" style={{ borderColor: '#e8e4dc' }}>
      <div className="flex items-center gap-3 mb-3 pb-3 border-b" style={{ borderColor: '#f0ede8' }}>
        <SourceLogo source={s.key} />
        <p className="text-sm font-semibold text-navy leading-tight">{s.name}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MetricCell label="Yayın" value={fmt(s.docs)} />
        <MetricCell label="Atıf" value={fmt(s.citations)} />
        <MetricCell label="h-index" value={fmt(s.hIndex)} />
      </div>
      {s.syncError && (
        <p className="text-[10px] mt-2 pt-2 border-t leading-relaxed" style={{ borderColor: '#fee2e2', color: '#b91c1c' }}>
          <span className="font-semibold">Sync hatası:</span> {s.syncError}
        </p>
      )}
      {!s.syncError && noData && s.configured && (
        <p className="text-[10px] text-muted italic mt-2 pt-2 border-t" style={{ borderColor: '#f0ede8' }}>
          Henüz senkronize edilmedi.
        </p>
      )}
      {s.lastSync && !s.syncError && (
        <p className="text-[10px] text-muted mt-2 flex items-center gap-1">
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {new Date(s.lastSync).toLocaleDateString('tr-TR')}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Gerçek marka logoları - favicon servisinden çekiliyor, başarısız
// olursa SVG fallback devreye giriyor.
// ─────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<SourceKey, { domain: string; fallbackBg: string }> = {
  openalex: { domain: 'openalex.org',            fallbackBg: '#ee3f3f' },
  scopus:   { domain: 'scopus.com',              fallbackBg: '#e9711c' },
  wos:      { domain: 'webofscience.com',        fallbackBg: '#5e33bf' },
  scholar:  { domain: 'scholar.google.com',      fallbackBg: '#4285f4' },
  trdizin:  { domain: 'trdizin.gov.tr',          fallbackBg: '#c8a45a' },
  sobiad:   { domain: 'sobiad.com',              fallbackBg: '#0f2444' },
};

export function SourceLogo({ source, size = 40 }: { source: SourceKey; size?: number }) {
  const [attempt, setAttempt] = useState(0);
  const config = SOURCE_CONFIG[source];

  // 3 denemeli strateji: DuckDuckGo → Google → SVG fallback
  // DuckDuckGo genelde daha yüksek kaliteli favicon verir
  const urls = [
    `https://icons.duckduckgo.com/ip3/${config.domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${config.domain}&sz=128`,
  ];

  if (attempt >= urls.length) {
    // Tüm favicon denemeleri başarısız → kendi brand SVG'miz
    return (
      <div
        className="flex items-center justify-center flex-shrink-0 rounded"
        style={{ width: size, height: size, background: config.fallbackBg }}
      >
        <FallbackSvg source={source} />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center flex-shrink-0 rounded bg-white border"
      style={{ width: size, height: size, borderColor: '#e8e4dc' }}
    >
      <img
        src={urls[attempt]}
        alt=""
        width={size - 12}
        height={size - 12}
        onError={() => setAttempt(a => a + 1)}
        className="object-contain"
        style={{ imageRendering: 'crisp-edges' }}
      />
    </div>
  );
}

function FallbackSvg({ source }: { source: SourceKey }) {
  const size = 22;
  const c = '#ffffff';
  switch (source) {
    case 'openalex':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2" />
          <circle cx="12" cy="12" r="3" fill={c} />
          <circle cx="5" cy="9" r="1.5" fill={c} />
          <circle cx="19" cy="9" r="1.5" fill={c} />
          <circle cx="8" cy="18" r="1.5" fill={c} />
          <circle cx="16" cy="18" r="1.5" fill={c} />
          <path d="M5 9 L12 12 L19 9 M8 18 L12 12 L16 18" stroke={c} strokeWidth="1.2" />
        </svg>
      );
    case 'scopus':
      // Scopus - turuncu kutu içinde büyük S (Elsevier brand style)
      return (
        <svg width={24} height={24} viewBox="0 0 24 24">
          <text x="12" y="18" textAnchor="middle" fill={c} fontSize="18" fontWeight="900" fontFamily="Arial Black, sans-serif" fontStyle="italic">S</text>
        </svg>
      );
    case 'wos':
      // Web of Science - mor arka planda "Wos" yazısı (Clarivate brand)
      return (
        <svg width={36} height={24} viewBox="0 0 36 24">
          <text x="18" y="17" textAnchor="middle" fill={c} fontSize="11" fontWeight="800" fontFamily="Arial, sans-serif" letterSpacing="-0.5">WoS</text>
        </svg>
      );
    case 'scholar':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={c}>
          <path d="M12 3L1 9l11 6 9-4.9V17h2V9L12 3z" />
          <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
        </svg>
      );
    case 'trdizin':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4 4.5A2.5 2.5 0 016.5 2h11A2.5 2.5 0 0120 4.5v15a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 19.5v-15z"
            stroke={c} strokeWidth="1.8" fill="none" />
          <text x="12" y="15" textAnchor="middle" fill={c} fontSize="8" fontWeight="bold" fontFamily="sans-serif">TR</text>
        </svg>
      );
    case 'sobiad':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4 6c2-1 5-1 8 0v14c-3-1-6-1-8 0V6z"
            stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round" />
          <path d="M12 6c3-1 6-1 8 0v14c-2-1-5-1-8 0V6z"
            stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round" />
        </svg>
      );
  }
}

function MetricCell({ label, value }: { label: string; value: string }) {
  const isEmpty = value === '-';
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
      <p className={`text-2xl font-bold tabular-nums mt-1 ${value === '-' ? 'text-gray-300' : 'text-navy'}`}>{value}</p>
    </div>
  );
}
