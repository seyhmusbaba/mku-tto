'use client';

const IP_STATUS_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  none:       { label: 'Fikri Mülkiyet Yok',   color: '#6b7280', bg: '#f9fafb', icon: '-' },
  pending:    { label: 'Başvuru Aşamasında',    color: '#d97706', bg: '#fffbeb', icon: '⏳' },
  registered: { label: 'Tescilli',              color: '#059669', bg: '#f0fdf4', icon: '✅' },
  published:  { label: 'Yayımlandı',            color: '#2563eb', bg: '#eff6ff', icon: '📢' },
};

const IP_TYPE_LABELS: Record<string, string> = {
  patent:        '🔬 Patent',
  faydali_model: '⚙️ Faydalı Model',
  marka:         '™ Marka',
  tasarim:       '🎨 Tasarım Tescili',
  telif:         '© Telif Hakkı',
  ticari_sir:    '🔒 Ticari Sır',
};

const COMPLIANCE_LEVEL: Record<string, { label: string; color: string; bg: string }> = {
  excellent: { label: 'Mükemmel', color: '#059669', bg: '#f0fdf4' },
  good:      { label: 'İyi',      color: '#1d4ed8', bg: '#eff6ff' },
  warning:   { label: 'Dikkat',   color: '#d97706', bg: '#fffbeb' },
  critical:  { label: 'Kritik',   color: '#dc2626', bg: '#fef2f2' },
};

export function ProjectIpEthicsPanel({ project }: { project: any }) {
  const hasIp = project.ipStatus && project.ipStatus !== 'none';
  const hasCompliance = project.aiComplianceScore != null;
  if (!hasIp && !hasCompliance) return null;

  let cr: any = null;
  if (project.aiComplianceResult) { try { cr = JSON.parse(project.aiComplianceResult); } catch {} }

  return (
    <div className="space-y-4">
      <div className={hasIp && hasCompliance ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
        {hasIp && (() => {
          const c = IP_STATUS_LABELS[project.ipStatus] || IP_STATUS_LABELS.none;
          return (
            <div className="card p-5">
              <h3 className="font-display text-sm font-semibold text-navy mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#7c3aed' }} />
                Fikri Mülkiyet (TeDiKon)
              </h3>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: c.bg }}>
                  <span className="text-lg">{c.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: c.color }}>{c.label}</span>
                </div>
                {project.ipType && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Tür</span>
                    <span className="font-medium text-navy">{IP_TYPE_LABELS[project.ipType] || project.ipType}</span>
                  </div>
                )}
                {project.ipRegistrationNo && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Tescil / Başvuru No</span>
                    <span className="font-medium font-mono text-navy">{project.ipRegistrationNo}</span>
                  </div>
                )}
                {project.ipDate && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Tarih</span>
                    <span className="font-medium text-navy">{project.ipDate}</span>
                  </div>
                )}
                {project.ipNotes && (
                  <p className="text-xs text-muted p-2 rounded-lg" style={{ background: '#f9fafb' }}>{project.ipNotes}</p>
                )}
              </div>
            </div>
          );
        })()}

        {hasCompliance && cr && (() => {
          const cfg = COMPLIANCE_LEVEL[cr.level] || COMPLIANCE_LEVEL.good;
          return (
            <div className="card p-5">
              <h3 className="font-display text-sm font-semibold text-navy mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#7c3aed' }} />
                YZ Uygunluk Analizi
              </h3>
              <div className="p-3 rounded-xl mb-3" style={{ background: cfg.bg }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label} - {project.aiComplianceScore}/100</p>
                    <p className="text-xs mt-0.5" style={{ color: cfg.color }}>{cr.summary}</p>
                  </div>
                  <div className="flex gap-3 text-center ml-3">
                    <div>
                      <p className="text-xs font-bold" style={{ color: cfg.color }}>{cr.completenessScore}%</p>
                      <p className="text-[10px] text-muted">Tamlık</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: cfg.color }}>{cr.clarityScore}%</p>
                      <p className="text-[10px] text-muted">Açıklık</p>
                    </div>
                  </div>
                </div>
              </div>
              {cr.suggestions?.slice(0, 2).map((s: string, i: number) => (
                <p key={i} className="text-xs text-muted">• {s}</p>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
