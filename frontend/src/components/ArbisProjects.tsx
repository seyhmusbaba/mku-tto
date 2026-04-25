'use client';
import { useState } from 'react';

export interface ArbisProject {
  title: string;
  role?: string;        // Yürütücü, Araştırmacı, Bursiyer vs.
  year?: string;        // 2023 veya 2020-2023
  type?: string;        // 1001, 1003, BAP, AB vs.
  budget?: string;      // serbest format
  partner?: string;     // ortak kurum
}

interface BadgeProps {
  href?: string;
}

/**
 * Küçük "ARBİS" rozeti — TÜBİTAK mavisi
 */
export function ArbisBadge({ href }: BadgeProps = {}) {
  const inner = (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
      style={{ background: '#003e7e', color: '#fff' }}
      title="Bu proje TÜBİTAK ARBİS'ten alınmıştır">
      ARBİS
    </span>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity">
        {inner}
      </a>
    );
  }
  return inner;
}

/**
 * ARBİS projelerini gösteren liste — view modu (read-only).
 */
export function ArbisProjectsList({
  projectsJson,
  arbisProfileUrl,
  compact = false,
}: {
  projectsJson?: string | null;
  arbisProfileUrl?: string | null;
  compact?: boolean;
}) {
  const projects = parseProjects(projectsJson);
  if (projects.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-display text-base font-semibold text-navy flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#003e7e' }} />
          TÜBİTAK ARBİS Projeleri
          <ArbisBadge href={arbisProfileUrl || undefined} />
        </h3>
        <span className="text-xs text-muted">{projects.length} proje · ARBİS kayıtlı</span>
      </div>

      <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
        {projects.map((p, i) => (
          <div key={i} className="border rounded-lg p-3 bg-white" style={{ borderColor: '#e8e4dc' }}>
            <div className="flex items-start gap-3">
              <ArbisBadge />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-navy leading-snug">{p.title}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted">
                  {p.role && <span><span className="font-semibold text-[#003e7e]">{p.role}</span></span>}
                  {p.year && <span>📅 {p.year}</span>}
                  {p.type && <span className="px-1.5 py-0.5 rounded bg-[#003e7e]/10 text-[#003e7e] font-semibold">{p.type}</span>}
                  {p.budget && <span>💰 {p.budget}</span>}
                  {p.partner && <span>🤝 {p.partner}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {arbisProfileUrl && (
        <a href={arbisProfileUrl} target="_blank" rel="noreferrer"
          className="text-xs text-muted hover:text-[#003e7e] mt-3 inline-flex items-center gap-1">
          → ARBİS profilinde tümünü gör
        </a>
      )}
    </div>
  );
}

/**
 * ARBİS projelerini düzenleme — edit form içinde kullanılır.
 */
export function ArbisProjectsEditor({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (json: string) => void;
}) {
  const [projects, setProjects] = useState<ArbisProject[]>(parseProjects(value));

  const update = (next: ArbisProject[]) => {
    setProjects(next);
    onChange(JSON.stringify(next));
  };

  const add = () => update([...projects, { title: '', role: 'Yürütücü', year: '', type: '' }]);
  const remove = (i: number) => update(projects.filter((_, idx) => idx !== i));
  const set = (i: number, key: keyof ArbisProject, val: string) =>
    update(projects.map((p, idx) => idx === i ? { ...p, [key]: val } : p));

  return (
    <div className="space-y-2">
      <div className="rounded-lg border p-3 flex items-start gap-2.5"
        style={{ borderColor: '#bfdbfe', background: '#eff6ff' }}>
        <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-blue-900 leading-relaxed">
          ARBİS projelerinizi <strong>arbis.tubitak.gov.tr</strong>'den kopyalayıp buraya elle ekleyin.
          (TÜBİTAK'ın açık API'si yok, otomatik çekim mümkün değil.) Eklediğiniz projeler "ARBİS" rozetiyle profilinizde görünür.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted italic border rounded-lg" style={{ borderColor: '#e8e4dc' }}>
          Henüz ARBİS projesi eklenmemiş.
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2" style={{ borderColor: '#e8e4dc' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-muted">Proje #{i + 1}</span>
                <button type="button" onClick={() => remove(i)}
                  className="text-xs text-red-600 hover:underline">Sil</button>
              </div>
              <input className="input text-sm" placeholder="Proje başlığı *"
                value={p.title} onChange={e => set(i, 'title', e.target.value)} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <select className="input text-xs py-1.5" value={p.role || ''} onChange={e => set(i, 'role', e.target.value)}>
                  <option value="">Rol</option>
                  <option value="Yürütücü">Yürütücü</option>
                  <option value="Araştırmacı">Araştırmacı</option>
                  <option value="Danışman">Danışman</option>
                  <option value="Bursiyer">Bursiyer</option>
                </select>
                <input className="input text-xs py-1.5" placeholder="Yıl (2020-2023)"
                  value={p.year || ''} onChange={e => set(i, 'year', e.target.value)} />
                <input className="input text-xs py-1.5" placeholder="Tür (1001, BAP...)"
                  value={p.type || ''} onChange={e => set(i, 'type', e.target.value)} />
                <input className="input text-xs py-1.5" placeholder="Bütçe (opsiyonel)"
                  value={p.budget || ''} onChange={e => set(i, 'budget', e.target.value)} />
              </div>
              <input className="input text-xs py-1.5" placeholder="Ortak kurum (opsiyonel)"
                value={p.partner || ''} onChange={e => set(i, 'partner', e.target.value)} />
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={add}
        className="btn-secondary text-xs w-full inline-flex items-center justify-center gap-1.5">
        + ARBİS Projesi Ekle
      </button>
    </div>
  );
}

function parseProjects(json?: string | null): ArbisProject[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter(p => p?.title) : [];
  } catch {
    return [];
  }
}
