'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

const S: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:      { label: 'İnceleme Bekliyor', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  approved:     { label: 'Onaylandı',          color: '#059669', bg: '#f0fdf4', border: '#86efac' },
  rejected:     { label: 'Reddedildi',         color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  not_required: { label: 'Gerekmiyor',         color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

const StatusIcon = ({ status, className }: { status: string; className?: string }) => {
  const common = { className: className || 'w-3.5 h-3.5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2.2 } as const;
  if (status === 'approved')
    return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
  if (status === 'rejected')
    return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
  if (status === 'pending')
    return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>;
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

export default function EthicsPage() {
  const { user } = useAuth();
  const roleName = user?.role?.name || '';
  const isEthicsCommittee = roleName.toLowerCase().includes('etik') || roleName === 'Süper Admin' || roleName.toLowerCase().includes('rektör') || roleName.toLowerCase().includes('rektor') || roleName.toLowerCase().includes('admin');

  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [modal, setModal] = useState<any>(null);
  const [privacyReview, setPrivacyReview] = useState<any>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [form, setForm] = useState({ decision: 'approved', note: '', approvalNumber: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    // FIX #20: Access check before API call
    if (!isEthicsCommittee) {
      setLoading(false);
      setReviews([]);
      return;
    }
    setLoading(true);
    try {
      const r = await api.get(tab === 'pending' ? '/ethics/pending' : '/ethics/all');
      setReviews(r.data || []);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        toast.error('Bu sayfaya erişim yetkiniz yok');
      } else {
        toast.error('Yüklenemedi');
      }
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab, isEthicsCommittee]);

  const submit = async () => {
    if (!form.note.trim()) { toast.error('Karar gerekçesi zorunlu'); return; }
    setSaving(true);
    try {
      await api.put('/ethics/decision/' + modal.id, form);
      toast.success(form.decision === 'approved' ? 'Onaylandı' : 'Reddedildi');
      setModal(null);
      load();
    } catch { toast.error('Karar kaydedilemedi'); }
    finally { setSaving(false); }
  };

  const openDecisionFor = (rev: any) => {
    setPrivacyReview(rev);
    setPrivacyAccepted(false);
  };

  const acceptPrivacyAndOpen = () => {
    setModal(privacyReview);
    setForm({ decision: 'approved', note: '', approvalNumber: '' });
    setPrivacyReview(null);
    setPrivacyAccepted(false);
  };

  // Etik kurul uyesi degilse erisim engelle
  if (!isEthicsCommittee) {
    return (
      <DashboardLayout>
        <Header title="Etik Kurul" />
        <div className="p-8 flex flex-col items-center justify-center py-20">
          <svg className="w-16 h-16 mb-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-lg font-semibold text-navy mb-2">Erişim Kısıtlı</p>
          <p className="text-sm text-muted text-center max-w-sm">
            Bu sayfa yalnızca Etik Kurul üyeleri ve Sistem Yöneticileri tarafından görüntülenebilir.
          </p>
          <p className="text-xs text-muted mt-4">
            Kendi projenizin etik kurul durumunu görmek için proje detay sayfasını ziyaret edin.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const pending = reviews.filter(r => r.status === 'pending');

  return (
    <DashboardLayout>
      <Header title="Etik Kurul Yönetimi" subtitle="YZ tarafından analiz edilen projeler" />
      <div className="p-6 space-y-5">

        {/* Özet istatistikler */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { l: 'Bekleyen',   v: reviews.filter(r => r.status === 'pending').length,   c: '#d97706' },
            { l: 'Onaylanan',  v: reviews.filter(r => r.status === 'approved').length,  c: '#059669' },
            { l: 'Reddedilen', v: reviews.filter(r => r.status === 'rejected').length,  c: '#dc2626' },
            { l: 'Toplam',     v: reviews.length,                                        c: '#1a3a6b' },
          ].map(x => (
            <div key={x.l} className="card py-4 text-center">
              <p className="font-display text-2xl font-bold" style={{ color: x.c }}>{x.v}</p>
              <p className="text-xs text-muted mt-1">{x.l}</p>
            </div>
          ))}
        </div>

        {/* Sekmeler */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#f0ede8' }}>
          {([
            ['pending', 'Bekleyenler', <svg key="p" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>],
            ['all',     'Tümü',       <svg key="a" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>],
          ] as const).map(([k, l, ic]) => (
            <button key={k as string} onClick={() => setTab(k as any)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-1.5"
              style={{ background: tab === k ? 'white' : 'transparent', color: tab === k ? '#0f2444' : '#9ca3af', boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {ic}
              {l}
              {k === 'pending' && pending.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pending.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : reviews.length === 0 ? (
          <div className="empty-state py-16">
            <svg className="empty-state-icon w-10 h-10 mx-auto text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-sm font-medium text-navy mt-2">{tab === 'pending' ? 'Bekleyen inceleme yok' : 'Henüz inceleme kaydı yok'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(rev => {
              const cfg = S[rev.status] || S.pending;
              const p = rev.project;
              return (
                <div key={rev.id} className="card p-5" style={{ borderLeft: '3px solid ' + cfg.color }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Link href={'/projects/' + p?.id}
                          className="font-display font-semibold text-navy hover:underline truncate">
                          {p?.title || 'Proje'}
                        </Link>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1"
                          style={{ background: cfg.bg, color: cfg.color, border: '1px solid ' + cfg.border }}>
                          <StatusIcon status={rev.status} className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-muted flex-wrap items-center">
                        {p?.faculty && (
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            {p.faculty}
                          </span>
                        )}
                        {p?.owner && (
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            {p.owner.title} {p.owner.firstName} {p.owner.lastName}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {new Date(rev.createdAt).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                    </div>
                    {/* Risk skoru */}
                    <div className="text-center flex-shrink-0">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg border-2"
                        style={{
                          borderColor: rev.aiRiskScore >= 60 ? '#fca5a5' : rev.aiRiskScore >= 30 ? '#fde68a' : '#86efac',
                          color: rev.aiRiskScore >= 60 ? '#dc2626' : rev.aiRiskScore >= 30 ? '#d97706' : '#059669',
                          background: 'white',
                        }}>
                        {rev.aiRiskScore || 0}
                      </div>
                      <p className="text-[10px] text-muted mt-1">Risk/100</p>
                    </div>
                  </div>

                  {/* YZ Analizi */}
                  {rev.aiEthicsReason && (
                    <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                      <p className="font-semibold text-amber-800 mb-1 inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        YZ Analiz Sonucu:
                      </p>
                      <p className="text-amber-700">{rev.aiEthicsReason}</p>
                    </div>
                  )}

                  {/* Kurul Kararı */}
                  {rev.reviewNote && (
                    <div className="mt-2 p-3 rounded-xl text-xs"
                      style={{ background: rev.status === 'approved' ? '#f0fdf4' : '#fef2f2', border: '1px solid ' + (rev.status === 'approved' ? '#86efac' : '#fca5a5') }}>
                      <p className="font-semibold mb-1 inline-flex items-center gap-1.5" style={{ color: rev.status === 'approved' ? '#059669' : '#dc2626' }}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        Kurul Kararı {rev.approvalNumber ? '(No: ' + rev.approvalNumber + ')' : ''}:
                      </p>
                      <p style={{ color: rev.status === 'approved' ? '#059669' : '#dc2626' }}>{rev.reviewNote}</p>
                      {rev.reviewer && (
                        <p className="text-muted mt-1">
                          - {rev.reviewer.title} {rev.reviewer.firstName} {rev.reviewer.lastName}
                          {rev.reviewedAt && ' · ' + new Date(rev.reviewedAt).toLocaleDateString('tr-TR')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Karar Butonlari */}
                  {rev.status === 'pending' && (
                    <div className="mt-3 pt-3 border-t flex gap-2" style={{ borderColor: '#f0ede8' }}>
                      <button onClick={() => openDecisionFor(rev)} className="btn-primary text-xs">
                        Karar Ver
                      </button>
                      <Link href={'/projects/' + p?.id} className="btn-secondary text-xs">
                        Projeyi İncele
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gizlilik Sözleşmesi Modali */}
      {privacyReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4" style={{ border: '1px solid #e8e4dc' }}>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h3 className="font-display text-base font-semibold text-navy">Gizlilik ve Tarafsızlık Sözleşmesi</h3>
            </div>
            <div className="p-4 rounded-xl text-xs leading-relaxed whitespace-pre-line overflow-y-auto max-h-64"
              style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#374151', fontFamily: 'monospace' }}>
              {PRIVACY_TEXT}
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={privacyAccepted}
                onChange={e => setPrivacyAccepted(e.target.checked)}
                className="mt-0.5 flex-shrink-0" />
              <span className="text-xs text-navy leading-relaxed">
                Yukarıdaki gizlilik ve tarafsızlık sözleşmesini okudum, anlayıp kabul ediyorum.
              </span>
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={acceptPrivacyAndOpen} disabled={!privacyAccepted}
                className="btn-primary flex-1 text-sm disabled:opacity-40">
                Onayla ve Karar Ekranına Geç
              </button>
              <button type="button" onClick={() => { setPrivacyReview(null); setPrivacyAccepted(false); }}
                className="btn-secondary text-sm">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Karar Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" style={{ border: '1px solid #e8e4dc' }}>
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: '#e8e4dc' }}>
              <h2 className="font-display font-semibold text-navy">Etik Kurul Kararı</h2>
              <button onClick={() => setModal(null)} className="text-muted hover:text-navy p-1 rounded-lg hover:bg-gray-100" aria-label="Kapat">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Proje bilgisi */}
              <div className="p-3 rounded-xl text-xs" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <p className="font-semibold text-amber-800">{modal.project?.title}</p>
                {modal.aiEthicsReason && <p className="text-amber-700 mt-1">{modal.aiEthicsReason}</p>}
                <p className="text-amber-600 mt-1">Risk Skoru: {modal.aiRiskScore}/100</p>
              </div>
              {/* Karar secimi */}
              <div>
                <label className="label">Karar *</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { v: 'approved', l: 'Onayla',  c: '#059669', bg: '#f0fdf4' },
                    { v: 'rejected', l: 'Reddet',  c: '#dc2626', bg: '#fef2f2' },
                  ].map(o => (
                    <button key={o.v} type="button" onClick={() => setForm(f => ({ ...f, decision: o.v }))}
                      className="p-3 rounded-xl border-2 font-semibold text-sm transition-all inline-flex items-center justify-center gap-2"
                      style={{ borderColor: form.decision === o.v ? o.c : '#e8e4dc', background: form.decision === o.v ? o.bg : 'white', color: form.decision === o.v ? o.c : '#374151' }}>
                      <StatusIcon status={o.v} className="w-4 h-4" />
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Onay numarasi */}
              {form.decision === 'approved' && (
                <div>
                  <label className="label">Onay Numarası</label>
                  <input className="input" value={form.approvalNumber}
                    onChange={e => setForm(f => ({ ...f, approvalNumber: e.target.value }))}
                    placeholder="2024/ETK-001" />
                </div>
              )}
              {/* Gecikce */}
              <div>
                <label className="label">Karar Gerekçesi *</label>
                <textarea className="input" rows={4} value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Kararın gerekçesini açıklayın..." />
              </div>
            </div>
            <div className="p-5 border-t flex gap-3" style={{ borderColor: '#e8e4dc' }}>
              <button onClick={submit} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Kaydediliyor...' : 'Kararı Kaydet'}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary">İptal</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
