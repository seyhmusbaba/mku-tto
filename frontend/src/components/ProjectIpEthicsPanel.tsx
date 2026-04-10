'use client';

const IP_STATUS_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  none:       { label: 'Fikri Mülkiyet Yok',    color: '#6b7280', bg: '#f9fafb', icon: '—' },
  pending:    { label: 'Başvuru Aşamasında',      color: '#d97706', bg: '#fffbeb', icon: '⏳' },
  registered: { label: 'Tescilli',                color: '#059669', bg: '#f0fdf4', icon: '✅' },
  published:  { label: 'Yayımlandı',              color: '#2563eb', bg: '#eff6ff', icon: '📢' },
};

const IP_TYPE_LABELS: Record<string, string> = {
  patent: '🔬 Patent', faydali_model: '⚙️ Faydalı Model',
  marka: '™️ Marka', tasarim: '🎨 Tasarım Tescili',
  telif: '©️ Telif Hakkı', ticari_sir: '🔒 Ticari Sır',
};

const COMPLIANCE_LEVEL: Record<string, { label: string; color: string; bg: string }> = {
  excellent: { label: 'Mükemmel', color: '#059669', bg: '#f0fdf4' },
  good:      { label: 'İyi',      color: '#1d4ed8', bg: '#eff6ff' },
  warning:   { label: 'Dikkat',  color: '#d97706', bg: '#fffbeb' },
  critical:  { label: 'Kritik',  color: '#dc2626', bg: '#fef2f2' },
};

interface Props {
  project: any;
}

export function ProjectIpEthicsPanel({ project }: Props) {
  const hasIp = project.ipStatus && project.ipStatus !== 'none';
  const hasEthics = project.ethicsRequired;
  const hasCompliance = project.aiComplianceScore != null;
  const hasProjectText = project.projectText;

  if (!hasIp && !hasEthics && !hasCompliance && !hasProjectText) return null;

  let complianceResult: any = null;
  if (project.aiComplianceResult) {
    try { complianceResult = JSON.parse(project.aiComplianceResult); } catch { }
  }

  return (
    <div className="space-y-4">
      {/* Proje Metni */}
      {hasProjectText && (
        <div className="card p-5">
          <h3 className="font-display font-semibold text-navy mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#1a3a6b' }} />
            Proje Metni
          </h3>
          <div className="text-sm text-navy leading-relaxed whitespace-pre-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
            {project.projectText}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fikri Mülkiyet */}
        {hasIp && (
          <div className="card p-5">
            <h3 className="font-display font-semibold text-navy mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#7c3aed' }} />
              Fikri Mülkiyet (TeDiKon)
            </h3>
            {(() => {
              const ipCfg = IP_STATUS_LABELS[project.ipStatus] || IP_STATUS_LABELS.none;
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: ipCfg.bg }}>
                    <span className="text-lg">{ipCfg.icon}</span>
                    <span className="text-sm font-semibold" style={{ color: ipCfg.color }}>{ipCfg.label}</span>
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
                    <p className="text-xs text-muted mt-1 p-2 rounded" style={{ background: '#f9fafb' }}>{project.ipNotes}</p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Etik Kurul */}
        {hasEthics && (
          <div className="card p-5">
            <h3 className="font-display font-semibold text-navy mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#d97706' }} />
              Etik Kurul
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: project.ethicsApproved ? '#f0fdf4' : '#fffbeb' }}>
                <span className="text-lg">{project.ethicsApproved ? '✅' : '⏳'}</span>
                <span className="text-sm font-semibold" style={{ color: project.ethicsApproved ? '#059669' : '#d97706' }}>
                  {project.ethicsApproved ? 'Etik Kurul Onayı Alındı' : 'Etik Kurul Onayı Bekleniyor'}
                </span>
              </div>
              {project.ethicsCommittee && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Kurul</span>
                  <span className="font-medium text-navy">{project.ethicsCommittee}</span>
                </div>
              )}
              {project.ethicsApprovalNo && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Onay No</span>
                  <span className="font-medium font-mono text-navy">{project.ethicsApprovalNo}</span>
                </div>
              )}
              {project.ethicsApprovalDate && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Onay Tarihi</span>
                  <span className="font-medium text-navy">{project.ethicsApprovalDate}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* YZ Uygunluk Skoru */}
      {hasCompliance && complianceResult && (
        <div className="card p-5">
          <h3 className="font-display font-semibold text-navy mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#7c3aed' }} />
            YZ Uygunluk Analizi
          </h3>
          {(() => {
            const cfg = COMPLIANCE_LEVEL[complianceResult.level] || COMPLIANCE_LEVEL.good;
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: cfg.bg }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label} — {project.aiComplianceScore}/100</p>
                    <p className="text-xs" style={{ color: cfg.color }}>{complianceResult.summary}</p>
                  </div>
                  <div className="flex gap-3 text-center">
                    <div>
                      <p className="text-xs font-bold" style={{ color: cfg.color }}>{complianceResult.completenessScore}%</p>
                      <p className="text-[10px] text-muted">Tamamlık</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: cfg.color }}>{complianceResult.clarityScore}%</p>
                      <p className="text-[10px] text-muted">Açıklık</p>
                    </div>
                  </div>
                </div>
                {complianceResult.suggestions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-navy mb-1">💡 Öneriler</p>
                    {complianceResult.suggestions.slice(0, 3).map((s: string, i: number) => (
                      <p key={i} className="text-xs text-muted">• {s}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
