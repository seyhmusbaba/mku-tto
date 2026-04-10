'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const CFG: Record<string, any> = {
  pending:      { label: 'Etik Kurul İncelemesi Bekliyor',  color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '⏳' },
  approved:     { label: 'Etik Kurul Onayı Alındı',          color: '#059669', bg: '#f0fdf4', border: '#86efac', icon: '✅' },
  rejected:     { label: 'Etik Kurul Başvurusu Reddedildi',  color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', icon: '❌' },
  not_required: { label: 'Etik Kurul Gerekmiyor',            color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', icon: '—' },
};

export function EthicsStatusPanel2({ projectId }: { projectId: string }) {
  const [review, setReview] = useState<any>(null);

  useEffect(() => {
    api.get('/ethics/project/' + projectId).then(r => { if (r.data) setReview(r.data); }).catch(() => {});
  }, [projectId]);

  if (!review) return null;

  const c = CFG[review.status] || CFG.pending;

  return (
    <div className="card p-4" style={{ border: '1px solid ' + c.border, background: c.bg }}>
      <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: c.color }}>
        🔬 Etik Kurul Durumu
      </h4>
      <div className="flex items-start gap-3">
        <span className="text-xl">{c.icon}</span>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: c.color }}>{c.label}</p>
          {review.aiEthicsReason && (
            <p className="text-xs text-muted mt-1">{review.aiEthicsReason}</p>
          )}
          {review.reviewNote && (
            <p className="text-xs mt-2 p-2 rounded-lg bg-white/70 text-navy">📋 {review.reviewNote}</p>
          )}
          {review.approvalNumber && (
            <p className="text-xs text-muted mt-1">Onay No: <strong>{review.approvalNumber}</strong></p>
          )}
        </div>
        {review.aiRiskScore != null && (
          <div className="text-center flex-shrink-0">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-2"
              style={{
                borderColor: review.aiRiskScore >= 60 ? '#fca5a5' : review.aiRiskScore >= 30 ? '#fde68a' : '#86efac',
                color: review.aiRiskScore >= 60 ? '#dc2626' : review.aiRiskScore >= 30 ? '#d97706' : '#059669',
                background: 'white',
              }}>
              {review.aiRiskScore}
            </div>
            <p className="text-[10px] text-muted mt-0.5">Risk</p>
          </div>
        )}
      </div>
    </div>
  );
}
