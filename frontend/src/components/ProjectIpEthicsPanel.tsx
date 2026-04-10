'use client';

const IP_STATUS_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  none:       { label: 'Fikri Mülkiyet Yok',  color: '#6b7280', bg: '#f9fafb', icon: '-' },
  pending:    { label: 'Basvuru Asamas',       color: '#d97706', bg: '#fffbeb', icon: '⏳' },
  registered: { label: 'Tescilli',             color: '#059669', bg: '#f0fdf4', icon: '✅' },
  published:  { label: 'Yayimlandi',           color: '#2563eb', bg: '#eff6ff', icon: '📢' },
};

const IP_TYPE_LABELS: Record<string, string> = {
  patent: '🔬 Patent', faydali_model: '⚙️ Faydali Model',
  marka: 'Marka', tasarim: '🎨 Tasarim',
  telif: '©️ Telif Hakki', ticari_sir: '🔒 Ticari Sir',
};

const COMPLIANCE_LEVEL: Record<string, { label: string; color: string; bg: string }> = {
  excellent: { label: 'Mukemmel', color: '#059669', bg: '#f0fdf4' },
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {hasIp && (() => {
        const c = IP_STATUS_LABELS[project.ipStatus] || IP_STATUS_LABELS.none;
        return (
          <div className="card p-5">
            <h3 className="font-display font-semibold text-navy mb-3">⚖️ Fikri Mulkiyet</h3>
            <div className="flex items-center gap-2 p-2 rounded-lg mb-2" style={{ background: c.bg }}>
              <span>{c.icon}</span>
              <span className="text-sm font-semibold" style={{ color: c.color }}>{c.label}</span>
            </div>
            {project.ipType && <div className="flex justify-between text-xs mb-1"><span className="text-muted">Tur</span><span className="font-medium">{IP_TYPE_LABELS[project.ipType] || project.ipType}</span></div>}
            {project.ipRegistrationNo && <div className="flex justify-between text-xs mb-1"><span className="text-muted">Tescil No</span><span className="font-mono font-medium">{project.ipRegistrationNo}</span></div>}
            {project.ipDate && <div className="flex justify-between text-xs mb-1"><span className="text-muted">Tarih</span><span className="font-medium">{project.ipDate}</span></div>}
            {project.ipNotes && <p className="text-xs text-muted mt-1 p-2 rounded bg-gray-50">{project.ipNotes}</p>}
          </div>
        );
      })()}
      {hasCompliance && cr && (() => {
        const cfg = COMPLIANCE_LEVEL[cr.level] || COMPLIANCE_LEVEL.good;
        return (
          <div className="card p-5">
            <h3 className="font-display font-semibold text-navy mb-3">🤖 YZ Uygunluk</h3>
            <div className="p-3 rounded-xl mb-2" style={{ background: cfg.bg }}>
              <p className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label} — {project.aiComplianceScore}/100</p>
              <p className="text-xs mt-0.5" style={{ color: cfg.color }}>{cr.summary}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-gray-50"><p className="font-bold">{cr.completenessScore}%</p><p className="text-muted">Tamlık</p></div>
              <div className="p-2 rounded-lg bg-gray-50"><p className="font-bold">{cr.clarityScore}%</p><p className="text-muted">Acıklık</p></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
