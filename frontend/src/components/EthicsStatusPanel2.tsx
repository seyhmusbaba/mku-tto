'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

const CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:      { label: 'Etik Kurul İncelemesi Bekliyor',  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  approved:     { label: 'Etik Kurul Onayi Alindi',         color: '#059669', bg: '#f0fdf4', border: '#86efac' },
  rejected:     { label: 'Etik Kurul Basvurusu Reddedildi', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  not_required: { label: 'Etik Kurul Gerektirmiyor',        color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

const ICON: Record<string, string> = {
  pending: '⏳', approved: '✓', rejected: '✗', not_required: '—',
};

const PRIVACY_TEXT = `GİZLİLİK VE TARAFSIZLIK SÖZLEŞMESİ

Bu inceleme kapsamında tarafıma sunulan tüm proje bilgileri, araştırma verileri ve ilgili dökümanlar gizli nitelik taşımaktadır.

YÜKÜMLÜLÜKLER:
1. İnceleme sürecinde edinilen bilgileri üçüncü şahıslarla paylaşmayacağımı beyan ederim.
2. Değerlendirmeyi tarafsız, bilimsel etik ilkelere ve kurumsal yönetmeliklere uygun olarak yapacağımı taahhüt ederim.
3. Proje yürütücüsü veya ekibiyle çıkar çatışmam bulunmadığını beyan ederim.
4. Kararımın yalnızca bilimsel ve etik kriterlere dayandığını taahhüt ederim.
5. Bu taahhütlere aykırı davranışın disiplin sürecini başlatacağını kabul ederim.

Bu sözleşmeyi onaylayarak yukarıdaki yükümlülükleri eksiksiz kabul ettiğinizi beyan edersiniz.`;

export function EthicsStatusPanel2({ projectId, onDecision }: { projectId: string; onDecision?: () => void }) {
  const { user } = useAuth();
  const [review, setReview]           = useState<any>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [showDecide, setShowDecide]   = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
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
    } catch { toast.error('Yeniden analiz basarisiz'); }
    finally { setReanalyzing(false); }
  };

  const handlePrivacyAccept = () => {
    setPrivacyAccepted(true);
    setShowPrivacy(false);
    setShowDecide(true);
  };

  const handleDecide = async () => {
    if (!review?.id) return;
    setDeciding(true);
    try {
      await api.put(`/ethics/decision/${review.id}`, {
        decision:       decideForm.decision,
        note:           decideForm.note,
        approvalNumber: decideForm.approvalNumber || null,
      });
      toast.success(decideForm.decision === 'approved' ? 'Etik kurul onayi kaydedildi' : 'Red karari kaydedildi');
      setShowDecide(false);
      setPrivacyAccepted(false);
      loadReview();
      setTimeout(() => onDecision?.(), 600);
    } catch { toast.error('Karar kaydedilemedi'); }
    finally { setDeciding(false); }
  };

  if (!review) return null;

  const c = CFG[review.status] || CFG.pending;
  const icon = ICON[review.status] || '—';

  return (
    <>
      {/* Gizlilik Sozlesmesi Modali */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-navy">Gizlilik ve Tarafsizlik Sozlesmesi</h3>
            <div className="p-4 rounded-xl text-xs leading-relaxed whitespace-pre-line overflow-y-auto max-h-64"
              style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#374151', fontFamily: 'monospace' }}>
              {PRIVACY_TEXT}
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={privacyAccepted}
                onChange={e => setPrivacyAccepted(e.target.checked)}
                className="mt-0.5 flex-shrink-0" />
              <span className="text-xs text-navy leading-relaxed">
                Yukardaki gizlilik ve tarafsizlik sozlesmesini okudum, anlayip kabul ediyorum.
              </span>
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={handlePrivacyAccept} disabled={!privacyAccepted}
                className="btn-primary flex-1 text-sm disabled:opacity-40">
                Onayla ve Devam Et
              </button>
              <button type="button" onClick={() => { setShowPrivacy(false); setPrivacyAccepted(false); }}
                className="btn-secondary text-sm">
                Iptal
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card p-4" style={{ borderLeft: '3px solid ' + c.color, background: c.bg }}>
        <div className="flex items-start gap-3">
          <span className="text-lg font-bold flex-shrink-0" style={{ color: c.color }}>{icon}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: c.color }}>{c.label}</p>
            {review.aiEthicsReason && <p className="text-xs text-muted mt-1 leading-relaxed">{review.aiEthicsReason}</p>}
            {review.reviewNote && (
              <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.7)' }}>
                <span className="font-semibold">Kurul Karari: </span>{review.reviewNote}
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
            {reanalyzing ? 'Analiz ediliyor...' : 'YZ Analizini Yenile'}
          </button>
          {canDecide && review.status === 'pending' && !showDecide && (
            <button type="button" onClick={() => setShowPrivacy(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg ml-auto"
              style={{ background: '#1a3a6b', color: 'white' }}>
              Karar Ver
            </button>
          )}
        </div>

        {showDecide && (
          <div className="mt-3 p-4 rounded-xl space-y-3" style={{ background: 'white', border: '1px solid #e8e4dc' }}>
            <p className="text-xs font-semibold text-navy">Etik Kurul Karari</p>
            <div className="flex gap-2">
              {[{ v: 'approved', l: 'Onayla', bg: '#f0fdf4', c: '#059669' }, { v: 'rejected', l: 'Reddet', bg: '#fef2f2', c: '#dc2626' }]
                .map(opt => (
                  <button key={opt.v} type="button"
                    onClick={() => setDecideForm(f => ({ ...f, decision: opt.v }))}
                    className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all"
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
              <input className="input text-xs" placeholder="Onay No (opsiyonel — orn. ETK-2025-001)"
                value={decideForm.approvalNumber}
                onChange={e => setDecideForm(f => ({ ...f, approvalNumber: e.target.value }))} />
            )}
            <textarea className="input text-xs" rows={3} placeholder="Karar notu ve gerekce..."
              value={decideForm.note}
              onChange={e => setDecideForm(f => ({ ...f, note: e.target.value }))} />
            <div className="flex gap-2">
              <button type="button" onClick={handleDecide} disabled={deciding}
                className="btn-primary text-xs flex-1">
                {deciding ? 'Kaydediliyor...' : 'Karari Kaydet'}
              </button>
              <button type="button" onClick={() => { setShowDecide(false); setPrivacyAccepted(false); }}
                className="btn-secondary text-xs">
                Iptal
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
