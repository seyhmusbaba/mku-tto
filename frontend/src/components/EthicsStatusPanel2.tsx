'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

const CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  pending:      { label: 'Etik Kurul İncelemesi Bekliyor',  color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '⏳' },
  approved:     { label: 'Etik Kurul Onayı Alındı',         color: '#059669', bg: '#f0fdf4', border: '#86efac', icon: '✅' },
  rejected:     { label: 'Etik Kurul Başvurusu Reddedildi', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', icon: '❌' },
  not_required: { label: 'Etik Kurul Gerekmiyor',           color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', icon: '—' },
};

export function EthicsStatusPanel2({ projectId, onDecision }: { projectId: string; onDecision?: () => void }) {
  const { user } = useAuth();
  const [review, setReview]           = useState<any>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [showDecide, setShowDecide]   = useState(false);
  const [deciding, setDeciding]       = useState(false);
  const [decideForm, setDecideForm]   = useState({ decision: 'approved', note: '', approvalNumber: '' });

  const canDecide = user?.role?.name === 'Süper Admin' || user?.role?.name === 'Rektör';

  const loadReview = () => {
    api.get('/ethics/project/' + projectId)
      .then(r => { if (r.data) setReview(r.data); })
      .catch(() => {});
  };

  useEffect(() => { loadReview(); }, [projectId]);

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      await api.post('/ethics/reanalyze/' + projectId);
      loadReview();
      toast.success('YZ etik analizi yenilendi');
    } catch { toast.error('Yeniden analiz başarısız'); }
    finally { setReanalyzing(false); }
  };

  const handleDecide = async () => {
    if (!review?.id) return;
    setDeciding(true);
    try {
      await api.post(`/ethics/${review.id}/decide`, {
        decision:       decideForm.decision,
        note:           decideForm.note,
        approvalNumber: decideForm.approvalNumber || null,
      });
      toast.success(decideForm.decision === 'approved' ? 'Etik kurul onaylandı' : 'Reddedildi');
      setShowDecide(false);
      loadReview();
      onDecision?.();
    } catch { toast.error('Karar kaydedilemedi'); }
    finally { setDeciding(false); }
  };

  if (!review) return null;

  const c = CFG[review.status] || CFG.pending;

  return (
    <div className="card p-4" style={{ borderLeft: '3px solid ' + c.color, background: c.bg }}>
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{c.icon}</span>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: c.color }}>{c.label}</p>
          {review.aiEthicsReason && <p className="text-xs text-muted mt-1 leading-relaxed">{review.aiEthicsReason}</p>}
          {review.reviewNote && (
            <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.7)' }}>
              <span className="font-semibold">📋 Kurul Kararı: </span>{review.reviewNote}
            </div>
          )}
          {review.approvalNumber && <p className="text-xs text-muted mt-1">Onay No: <strong>{review.approvalNumber}</strong></p>}
        </div>
        {review.aiRiskScore != null && (
          <div className="text-center flex-shrink-0">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-2"
              style={{
                borderColor: review.aiRiskScore >= 60 ? '#fca5a5' : review.aiRiskScore >= 30 ? '#fde68a' : '#86efac',
                color:       review.aiRiskScore >= 60 ? '#dc2626' : review.aiRiskScore >= 30 ? '#d97706' : '#059669',
                background: 'white',
              }}>
              {review.aiRiskScore}
            </div>
            <p className="text-[10px] text-muted mt-0.5">Risk</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <button type="button" onClick={handleReanalyze} disabled={reanalyzing}
          className="text-xs text-muted hover:text-navy disabled:opacity-50">
          {reanalyzing ? '⏳ Analiz ediliyor...' : '🔄 YZ Analizini Yenile'}
        </button>
        {canDecide && review.status === 'pending' && !showDecide && (
          <button type="button" onClick={() => setShowDecide(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg ml-auto"
            style={{ background: '#1a3a6b', color: 'white' }}>
            ⚖️ Karar Ver
          </button>
        )}
      </div>

      {showDecide && (
        <div className="mt-3 p-3 rounded-xl space-y-3" style={{ background: 'white', border: '1px solid #e8e4dc' }}>
          <p className="text-xs font-semibold text-navy">Etik Kurul Kararı</p>
          <div className="flex gap-2">
            {[{ v: 'approved', l: '✅ Onayla', bg: '#f0fdf4', c: '#059669' }, { v: 'rejected', l: '❌ Reddet', bg: '#fef2f2', c: '#dc2626' }]
              .map(opt => (
                <button key={opt.v} type="button"
                  onClick={() => setDecideForm(f => ({ ...f, decision: opt.v }))}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: decideForm.decision === opt.v ? opt.bg : '#f9fafb',
                    color:      decideForm.decision === opt.v ? opt.c : '#6b7280',
                    border:     `2px solid ${decideForm.decision === opt.v ? opt.c : '#e8e4dc'}`,
                  }}>
                  {opt.l}
                </button>
              ))}
          </div>
          {decideForm.decision === 'approved' && (
            <input className="input text-xs" placeholder="Onay No (opsiyonel)"
              value={decideForm.approvalNumber}
              onChange={e => setDecideForm(f => ({ ...f, approvalNumber: e.target.value }))} />
          )}
          <textarea className="input text-xs" rows={2} placeholder="Karar notu..."
            value={decideForm.note}
            onChange={e => setDecideForm(f => ({ ...f, note: e.target.value }))} />
          <div className="flex gap-2">
            <button type="button" onClick={handleDecide} disabled={deciding}
              className="btn-primary text-xs flex-1">
              {deciding ? '⏳ Kaydediliyor...' : 'Kararı Kaydet'}
            </button>
            <button type="button" onClick={() => setShowDecide(false)} className="btn-secondary text-xs">İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}
