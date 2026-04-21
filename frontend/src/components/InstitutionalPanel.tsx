'use client';
import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils';

/**
 * Kurumsal karşılaştırma paneli.
 * 3 bölüm: Fakülte Radar · Cross-Fakülte İşbirlik Matrisi · SDG × Fakülte Heatmap
 */

type IconName = 'radar' | 'link' | 'globe' | 'info' | 'trophy' | 'alert';
const ICONS: Record<IconName, string> = {
  radar:  'M12 3v18m9-9H3m14.657-6.343L6.343 17.657m11.314 0L6.343 6.343',
  link:   'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  globe:  'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  info:   'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  trophy: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  alert:  'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
};

function Icon({ name, className = 'w-4 h-4', strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[name]} />
    </svg>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center cursor-help">
      <Icon name="info" className="w-3.5 h-3.5 text-muted" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 rounded-lg text-xs font-normal leading-relaxed
        opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 shadow-lg"
        style={{ background: '#0f2444', color: 'white' }}>
        {text}
      </span>
    </span>
  );
}

// Renk paleti — fakülte başına
const FACULTY_COLORS = ['#0f2444', '#1a3a6b', '#c8a45a', '#7c3aed', '#059669', '#dc2626', '#0891b2', '#ea580c', '#94a3b8', '#92651a'];

// UN SDG resmi renkleri
const SDG_COLORS = ['#e5243b', '#dda63a', '#4c9f38', '#c5192d', '#ff3a21', '#26bde2', '#fcc30b', '#a21942', '#fd6925', '#dd1367', '#fd9d24', '#bf8b2e', '#3f7e44', '#0a97d9', '#56c02b', '#00689d', '#19486a'];

export function InstitutionalPanel({ highlightFaculty }: { highlightFaculty?: string } = {}) {
  const [radar, setRadar] = useState<any[]>([]);
  const [collab, setCollab] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);
  const [collabCell, setCollabCell] = useState<{ facultyA: string; facultyB: string; projects: any[] } | null>(null);
  const [heatCell, setHeatCell] = useState<{ faculty: string; sdgCode: string; projects: any[] } | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/analytics/institutional/faculty-radar').then(r => r.data).catch(() => []),
      api.get('/analytics/institutional/collaboration-matrix').then(r => r.data).catch(() => null),
      api.get('/analytics/institutional/sdg-heatmap').then(r => r.data).catch(() => null),
    ])
      .then(([r, c, h]) => {
        setRadar(r);
        setCollab(c);
        setHeatmap(h);
        // Default seçim: Dekan'ın fakültesi varsa onu + ilk 3; yoksa ilk 4
        const allFaculties = (r || []).map((f: any) => f.faculty);
        let defaults: string[] = [];
        if (highlightFaculty && allFaculties.includes(highlightFaculty)) {
          defaults = [highlightFaculty, ...allFaculties.filter((f: string) => f !== highlightFaculty).slice(0, 3)];
        } else {
          defaults = allFaculties.slice(0, 4);
        }
        setSelectedFaculties(defaults);
      })
      .catch(e => setError('Veri yüklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  // Radar chart verisini seçili fakültelere göre hazırla
  const radarChartData = useMemo(() => {
    const dims: Array<{ key: keyof NonNullable<(typeof radar)[number]['normalized']>; label: string }> = [
      { key: 'projectScale', label: 'Proje Ölçeği' },
      { key: 'budgetScale',  label: 'Bütçe' },
      { key: 'successScore', label: 'Başarı' },
      { key: 'sdgScore',     label: 'SDG Kapsamı' },
      { key: 'ipScore',      label: 'Fikri Mülkiyet' },
      { key: 'ethicsScore',  label: 'Etik Uyum' },
    ];
    return dims.map(d => {
      const row: any = { dimension: d.label };
      for (const f of radar) {
        if (selectedFaculties.includes(f.faculty)) {
          row[f.faculty] = f.normalized?.[d.key] || 0;
        }
      }
      return row;
    });
  }, [radar, selectedFaculties]);

  // Matrix için max değer (renk yoğunluğu için)
  const maxCollab = useMemo(() => {
    return collab?.cells?.length ? Math.max(...collab.cells.map((c: any) => c.sharedProjects)) : 1;
  }, [collab]);

  const collabLookup = useMemo(() => {
    const map = new Map<string, { count: number; projects: any[] }>();
    for (const c of collab?.cells || []) {
      const [a, b] = [c.facultyA, c.facultyB].sort();
      map.set(`${a}||${b}`, { count: c.sharedProjects, projects: c.projects || [] });
    }
    return map;
  }, [collab]);

  // Heatmap max
  const maxHeat = useMemo(() => {
    return heatmap?.cells?.length ? Math.max(...heatmap.cells.map((c: any) => c.count)) : 1;
  }, [heatmap]);

  const heatLookup = useMemo(() => {
    const map = new Map<string, { count: number; projects: any[] }>();
    for (const c of heatmap?.cells || []) {
      map.set(`${c.faculty}||${c.sdgCode}`, { count: c.count, projects: c.projects || [] });
    }
    return map;
  }, [heatmap]);

  if (loading) return <div className="card flex justify-center py-20"><div className="spinner" /></div>;
  if (error) return (
    <div className="card py-12 text-center">
      <Icon name="alert" className="w-10 h-10 mx-auto text-red-500" />
      <p className="text-sm font-semibold text-navy mt-3">{error}</p>
    </div>
  );
  if (radar.length === 0) return (
    <div className="card py-12 text-center">
      <p className="text-sm text-muted">Henüz fakülte verisi yok. Projelere fakülte atanınca bu panel aktifleşir.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Açıklama */}
      <div className="p-4 rounded-2xl flex items-start gap-3 text-xs" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
        <Icon name="info" className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="leading-relaxed">
          <strong className="font-semibold">Kurumsal karşılaştırma — rektörlük ve dekanlık için tasarlanmıştır.</strong>{' '}
          Fakültelerin güçlü yanlarını 6 boyutta kıyaslar, hangi fakültelerin aynı projelerde buluştuğunu matris olarak
          gösterir ve Sürdürülebilir Kalkınma Hedefleri'ne kurumsal katkıyı ısı haritasıyla serer.
        </div>
      </div>

      {/* ═══ FAKÜLTE RADAR ═══ */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h3 className="font-display text-base font-semibold text-navy inline-flex items-center gap-2">
            <Icon name="radar" className="w-4 h-4" />
            Fakülte Karşılaştırma Radarı
            <InfoTip text="Her fakülte 6 boyutta değerlendirilir: Proje Ölçeği (kaç proje), Bütçe, Başarı (tamamlanma oranı), SDG Kapsamı (farklı hedeflere değen), Fikri Mülkiyet (patent/tescil), Etik Uyum (onaylanan etik dosya sayısı). Değerler en yüksek fakülteye göre 0-100 normalize edilir." />
          </h3>
          <span className="text-xs text-muted">{radar.length} fakülte</span>
        </div>
        <p className="text-xs text-muted mb-4">6 boyutlu karşılaştırma — 0-100 arasına normalize edilmiş değerler</p>

        {/* Fakülte seçici */}
        <div className="flex flex-wrap gap-2 mb-4">
          {radar.map((f: any, i: number) => {
            const active = selectedFaculties.includes(f.faculty);
            const color = FACULTY_COLORS[i % FACULTY_COLORS.length];
            return (
              <button key={f.faculty}
                onClick={() => setSelectedFaculties(prev =>
                  active ? prev.filter(x => x !== f.faculty) : [...prev, f.faculty]
                )}
                className="text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
                style={{
                  background: active ? color : 'white',
                  color: active ? 'white' : '#6b7280',
                  border: `1.5px solid ${color}`,
                  opacity: active ? 1 : 0.5,
                }}>
                {f.faculty.split(' ')[0]}
              </button>
            );
          })}
        </div>

        {selectedFaculties.length > 0 ? (
          <ResponsiveContainer width="100%" height={380}>
            <RadarChart data={radarChartData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: '#374151' }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
              {selectedFaculties.map((f, i) => {
                const origIndex = radar.findIndex((r: any) => r.faculty === f);
                const color = FACULTY_COLORS[origIndex % FACULTY_COLORS.length];
                return (
                  <Radar key={f} dataKey={f} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
                );
              })}
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-sm text-muted">
            Yukarıdan karşılaştırmak istediğiniz fakülteleri seçin
          </div>
        )}

        {/* Ham sayılar tablosu */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#faf8f4', borderBottom: '1px solid #e8e4dc' }}>
                <th className="text-left px-3 py-2 font-semibold text-muted">Fakülte</th>
                <th className="text-right px-3 py-2 font-semibold text-muted">Proje</th>
                <th className="text-right px-3 py-2 font-semibold text-muted">Aktif</th>
                <th className="text-right px-3 py-2 font-semibold text-muted">Tamamlanan</th>
                <th className="text-right px-3 py-2 font-semibold text-muted">Başarı</th>
                <th className="text-right px-3 py-2 font-semibold text-muted">Toplam Bütçe</th>
                <th className="text-right px-3 py-2 font-semibold text-muted">SDG</th>
                <th className="text-right px-3 py-2 font-semibold text-muted">IP</th>
                <th className="text-right px-3 py-2 font-semibold text-muted">Etik</th>
                <th className="text-right px-3 py-2 font-semibold text-muted">Üye</th>
              </tr>
            </thead>
            <tbody>
              {radar.map((f: any, i: number) => {
                const color = FACULTY_COLORS[i % FACULTY_COLORS.length];
                const isOwn = highlightFaculty && f.faculty === highlightFaculty;
                return (
                  <tr key={f.faculty} className="border-b" style={{ borderColor: '#f5f2ee', background: isOwn ? '#fef3c7' : undefined, fontWeight: isOwn ? 700 : undefined }}>
                    <td className="px-3 py-2 font-semibold text-navy inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      {f.faculty}
                      {isOwn && <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#c8a45a', color: 'white' }}>SİZİN</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-navy">{f.totalProjects}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{f.activeProjects}</td>
                    <td className="px-3 py-2 text-right text-blue-600">{f.completedProjects}</td>
                    <td className="px-3 py-2 text-right font-bold">%{f.successRate}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(f.totalBudget)}</td>
                    <td className="px-3 py-2 text-right">{f.sdgCoverage} / 17</td>
                    <td className="px-3 py-2 text-right">{f.ipCount}</td>
                    <td className="px-3 py-2 text-right">{f.ethicsApprovedCount}</td>
                    <td className="px-3 py-2 text-right text-muted">{f.memberTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ CROSS-FAKÜLTE İŞBİRLİK MATRİSİ ═══ */}
      {collab && collab.faculties?.length > 1 && (
        <div className="card p-5">
          <h3 className="font-display text-base font-semibold text-navy mb-1 inline-flex items-center gap-2">
            <Icon name="link" className="w-4 h-4" />
            Cross-Fakülte İşbirlik Matrisi
            <InfoTip text="Aynı projede farklı fakültelerden üyeler varsa, o fakülte çifti için +1 sayılır. Hücre rengi ne kadar koyuysa o kadar çok ortak proje var. Başarılı kurumsal işbirliklerini ortaya çıkarır." />
          </h3>
          <p className="text-xs text-muted mb-4">Hangi fakülteler birlikte proje yapıyor — hücredeki sayı ortak proje sayısı</p>

          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left font-semibold text-muted sticky left-0" style={{ background: 'white' }}></th>
                  {collab.faculties.map((f: string) => (
                    <th key={f} className="p-2 text-center font-semibold text-muted" style={{ minWidth: 60, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                      {f.split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {collab.faculties.map((fa: string) => (
                  <tr key={fa}>
                    <td className="p-2 font-semibold text-navy whitespace-nowrap sticky left-0" style={{ background: 'white' }}>
                      {fa}
                    </td>
                    {collab.faculties.map((fb: string) => {
                      if (fa === fb) return <td key={fb} className="p-0" style={{ background: '#f0ede8' }}></td>;
                      const [a, b] = [fa, fb].sort();
                      const entry = collabLookup.get(`${a}||${b}`);
                      const count = entry?.count || 0;
                      const intensity = maxCollab > 0 ? count / maxCollab : 0;
                      return (
                        <td key={fb} className="p-0 text-center" style={{ minWidth: 50, height: 50 }}>
                          <button
                            onClick={() => {
                              if (count > 0 && entry) setCollabCell({ facultyA: a, facultyB: b, projects: entry.projects });
                            }}
                            disabled={count === 0}
                            title={count > 0 ? `${a} ↔ ${b} ortak proje listesini görmek için tıklayın` : undefined}
                            className="w-full h-full flex items-center justify-center font-bold transition-all"
                            style={{
                              background: count > 0 ? `rgba(26, 58, 107, ${0.1 + intensity * 0.75})` : 'white',
                              color: intensity > 0.5 ? 'white' : '#0f2444',
                              border: '1px solid #f0ede8',
                              cursor: count > 0 ? 'pointer' : 'default',
                            }}>
                            {count > 0 ? count : ''}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top işbirlikleri */}
          {collab.cells.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted mb-2 inline-flex items-center gap-1.5">
                <Icon name="trophy" className="w-3.5 h-3.5" />
                En Güçlü İşbirlikleri
              </p>
              <div className="space-y-1.5">
                {collab.cells.slice(0, 5).map((c: any) => (
                  <button key={`${c.facultyA}||${c.facultyB}`}
                    onClick={() => setCollabCell({ facultyA: c.facultyA, facultyB: c.facultyB, projects: c.projects || [] })}
                    className="w-full flex items-center justify-between text-xs p-2 rounded-lg transition-all hover:brightness-95" style={{ background: '#faf8f4', border: '1px solid transparent' }}>
                    <span className="text-navy text-left">
                      <strong>{c.facultyA}</strong> ↔ <strong>{c.facultyB}</strong>
                    </span>
                    <span className="font-bold px-2 py-0.5 rounded-full" style={{ background: '#1a3a6b', color: 'white' }}>
                      {c.sharedProjects} ortak proje
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proje drilldown modal — işbirliği hücresi */}
      {collabCell && (
        <ProjectListModal
          title={`${collabCell.facultyA} ↔ ${collabCell.facultyB} — Ortak Projeler`}
          projects={collabCell.projects}
          onClose={() => setCollabCell(null)}
        />
      )}

      {/* Proje drilldown modal — SDG hücresi */}
      {heatCell && (
        <ProjectListModal
          title={`${heatCell.faculty} — ${heatCell.sdgCode} Projeleri`}
          projects={heatCell.projects}
          onClose={() => setHeatCell(null)}
        />
      )}

      {/* ═══ SDG × FAKÜLTE HEATMAP ═══ */}
      {heatmap && heatmap.sdgs?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display text-base font-semibold text-navy mb-1 inline-flex items-center gap-2">
            <Icon name="globe" className="w-4 h-4" />
            SDG × Fakülte Isı Haritası
            <InfoTip text="Hangi fakülte hangi Sürdürülebilir Kalkınma Hedefi'ne kaç projeyle katkı sağlıyor. Koyu renkli hücreler güçlü odak alanlarını, açık renkler gelişim fırsatlarını gösterir." />
          </h3>
          <p className="text-xs text-muted mb-4">Hücre rengi koyulaştıkça katkı artar — kurumsal odak alanlarını ortaya çıkarır</p>

          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left font-semibold text-muted sticky left-0" style={{ background: 'white', minWidth: 180 }}>Fakülte</th>
                  {heatmap.sdgs.map((s: string) => {
                    const num = parseInt(s.match(/\d+/)?.[0] || '0');
                    const color = SDG_COLORS[(num - 1) % SDG_COLORS.length] || '#94a3b8';
                    return (
                      <th key={s} className="p-1 text-center" style={{ minWidth: 48 }}>
                        <div className="w-10 h-10 mx-auto rounded-md flex items-center justify-center text-white text-xs font-bold"
                          style={{ background: color }} title={s}>
                          {num}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {heatmap.faculties.map((f: string) => (
                  <tr key={f}>
                    <td className="p-2 font-semibold text-navy whitespace-nowrap sticky left-0" style={{ background: 'white' }}>
                      {f}
                    </td>
                    {heatmap.sdgs.map((s: string) => {
                      const entry = heatLookup.get(`${f}||${s}`);
                      const count = entry?.count || 0;
                      const intensity = maxHeat > 0 ? count / maxHeat : 0;
                      const num = parseInt(s.match(/\d+/)?.[0] || '0');
                      const color = SDG_COLORS[(num - 1) % SDG_COLORS.length] || '#94a3b8';
                      return (
                        <td key={s} className="p-0 text-center" style={{ minWidth: 48, height: 44 }}>
                          <button
                            onClick={() => {
                              if (count > 0 && entry) setHeatCell({ faculty: f, sdgCode: s, projects: entry.projects });
                            }}
                            disabled={count === 0}
                            title={count > 0 ? `${f} · SDG ${num} projelerini görmek için tıklayın` : undefined}
                            className="w-full h-full flex items-center justify-center font-bold text-xs transition-all"
                            style={{
                              background: count > 0 ? `${color}${Math.round(25 + intensity * 70).toString(16)}` : 'white',
                              color: intensity > 0.5 ? 'white' : '#0f2444',
                              border: '1px solid #f0ede8',
                              cursor: count > 0 ? 'pointer' : 'default',
                            }}>
                            {count > 0 ? count : ''}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Proje listesi modal ─── */
const STATUS_LABELS_MAP: Record<string, string> = {
  application: 'Başvuru', pending: 'Beklemede', active: 'Aktif',
  completed: 'Tamamlandı', suspended: 'Askıda', cancelled: 'İptal',
};
const STATUS_COLOR_MAP: Record<string, string> = {
  application: '#d97706', pending: '#d97706', active: '#059669',
  completed: '#2563eb', suspended: '#6b7280', cancelled: '#dc2626',
};

function ProjectListModal({ title, projects, onClose }: {
  title: string;
  projects: Array<{ id: string; name: string; status?: string }>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 36, 68, 0.6)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        style={{ border: '1px solid #c8a45a' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#e8e4dc' }}>
          <h3 className="font-display text-base font-bold text-navy">{title}</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream transition-colors"
            style={{ border: '1px solid #e8e4dc' }}>
            <svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {!projects || projects.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">Bu eşleşmede proje bilgisi bulunamadı.</p>
          ) : (
            <div className="space-y-2">
              {projects.map((p, i) => (
                <a key={p.id} href={`/projects/${p.id}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl transition-all hover:bg-cream"
                  style={{ border: '1px solid #e8e4dc' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted w-5 text-right font-semibold">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy line-clamp-1">{p.name}</p>
                    </div>
                  </div>
                  {p.status && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: (STATUS_COLOR_MAP[p.status] || '#6b7280') + '22', color: STATUS_COLOR_MAP[p.status] || '#6b7280' }}>
                      {STATUS_LABELS_MAP[p.status] || p.status}
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t text-xs text-muted" style={{ borderColor: '#e8e4dc' }}>
          {projects.length} proje · Tıklayınca yeni sekmede proje detayı açılır
        </div>
      </div>
    </div>
  );
}
