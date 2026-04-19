'use client';
import { useMemo } from 'react';

/**
 * Basit co-author radial network grafi.
 * Merkez: araştırmacı. Çevre: sık ortak yazdığı kişiler (yayın sayısına göre
 * boyut ve mesafe ayarlanır).
 *
 * Yayın listesinden otomatik çıkarılır — OpenAlex/Crossref'in author listeleri
 * üzerinden ortak yazar frekansı hesaplanır.
 */

export interface Collaborator {
  name: string;
  count: number;          // ortak yayın sayısı
  orcid?: string;
  institution?: string;
}

export function CollaborationGraph({
  centerName,
  collaborators,
  size = 520,
}: {
  centerName: string;
  collaborators: Collaborator[];
  size?: number;
}) {
  const maxVisible = 15;
  const display = useMemo(() => collaborators.slice(0, maxVisible), [collaborators]);

  if (display.length === 0) {
    return (
      <div className="card p-5 text-center py-10">
        <p className="text-sm text-muted">Co-author verisi bulunamadı.</p>
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const innerR = 40;                    // merkez düğüm yarıçapı
  const ringR = size / 2 - 70;          // ortak yazarların bulunduğu halka

  const maxCount = Math.max(...display.map(c => c.count));

  // Düğümleri eşit aralıklarla yerleştir
  const nodes = display.map((c, i) => {
    const angle = (i / display.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * ringR;
    const y = cy + Math.sin(angle) * ringR;
    // Boyut ortak yayın sayısıyla artar
    const r = 14 + (c.count / maxCount) * 18;
    return { ...c, x, y, r, angle };
  });

  return (
    <div className="card p-5">
      <h4 className="font-display text-sm font-semibold text-navy mb-1 inline-flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Ortak Yazar Ağı
        <span className="relative group inline-flex items-center cursor-help">
          <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 rounded-lg text-xs font-normal leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 shadow-lg"
            style={{ background: '#0f2444', color: 'white' }}>
            Merkezdeki araştırmacının yayınlarında sık görülen diğer yazarlar.
            Düğüm boyutu = ortak yayın sayısı. Bağın kalınlığı güçlü işbirliğini gösterir.
          </span>
        </span>
      </h4>
      <p className="text-xs text-muted mb-4">En sık ortak yazdığı <strong>{display.length}</strong> yazar — daire boyutu ortak yayın sayısını gösterir</p>

      <div className="flex justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Bağlantılar (merkez → ortak yazar) */}
          {nodes.map(n => (
            <line key={`line-${n.name}`}
              x1={cx} y1={cy} x2={n.x} y2={n.y}
              stroke="#c8a45a"
              strokeWidth={1 + (n.count / maxCount) * 3}
              strokeOpacity={0.3 + (n.count / maxCount) * 0.5}
            />
          ))}

          {/* Merkez düğüm */}
          <circle cx={cx} cy={cy} r={innerR} fill="#0f2444" />
          <circle cx={cx} cy={cy} r={innerR + 4} fill="none" stroke="#c8a45a" strokeWidth={2} />
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize="11" fontWeight="700">
            {truncate(centerName, 14)}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle"
            fill="#c8a45a" fontSize="9">
            Siz
          </text>

          {/* Ortak yazar düğümleri */}
          {nodes.map((n, i) => {
            // Etiketin konumu — merkezden dışa doğru biraz kaydır
            const labelDist = n.r + 8;
            const lx = cx + Math.cos(n.angle) * (ringR + labelDist);
            const ly = cy + Math.sin(n.angle) * (ringR + labelDist);
            // Metin hizalaması — angle'a göre
            const cos = Math.cos(n.angle);
            const anchor = cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';

            return (
              <g key={`node-${n.name}`}>
                <circle cx={n.x} cy={n.y} r={n.r} fill="#1a3a6b" opacity={0.85} />
                <circle cx={n.x} cy={n.y} r={n.r} fill="none" stroke="#c8a45a" strokeWidth={1} opacity={0.6} />
                <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle"
                  fill="white" fontSize="10" fontWeight="700">
                  {n.count}
                </text>
                <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle"
                  fill="#0f2444" fontSize="10" fontWeight="500">
                  {truncate(n.name, 18)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Liste görünümü */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        {collaborators.slice(0, 10).map((c, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ background: '#faf8f4' }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
              style={{ background: '#1a3a6b', color: 'white' }}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy truncate">{c.name}</p>
              {c.institution && <p className="text-muted truncate" style={{ fontSize: 10 }}>{c.institution}</p>}
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0"
              style={{ background: '#c8a45a', color: '#0f2444' }}>
              {c.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

/**
 * Yayın listesinden co-author çıkar ve frekans sırala.
 */
export function extractCollaborators(pubs: any[], selfName: string): Collaborator[] {
  const selfLower = selfName.toLowerCase();
  const map = new Map<string, { name: string; count: number; orcid?: string; institution?: string }>();
  for (const p of pubs) {
    for (const a of p.authors || []) {
      const name = (a.name || '').trim();
      if (!name || name.toLowerCase() === selfLower) continue;
      // Self-match gevşek — kısmi isim eşleşmesi de sayılsın
      const parts = selfLower.split(/\s+/).filter(w => w.length > 2);
      if (parts.some(pt => name.toLowerCase().includes(pt))) continue;

      const cur = map.get(name) || { name, count: 0, orcid: a.orcid, institution: a.affiliation };
      cur.count++;
      if (!cur.orcid && a.orcid) cur.orcid = a.orcid;
      if (!cur.institution && a.affiliation) cur.institution = a.affiliation;
      map.set(name, cur);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
