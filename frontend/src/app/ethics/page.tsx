'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

const S: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  pending:      { label: 'İnceleme Bekliyor', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '⏳' },
  approved:     { label: 'Onaylandı',          color: '#059669', bg: '#f0fdf4', border: '#86efac', icon: '✅' },
  rejected:     { label: 'Reddedildi',         color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', icon: '❌' },
  not_required: { label: 'Gerekmiyor',         color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', icon: '—' },
};

export default function EthicsPage() {
  const { user } = useAuth();
  const roleName = user?.role?.name || '';
  const isEthicsCommittee = roleName.toLowerCase().includes('etik') || roleName === 'Süper Admin';

  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState({ decision: 'approved', note: '', approvalNumber: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!isEthicsCommittee) { setLoading(false); return; }
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

  // Etik kurul uyesi degilse erisim engelle
  if (!isEthicsCommittee) {
    return (
      <DashboardLayout>
        <Header title="Etik Kurul" />
        <div className="p-8 flex flex-col items-center justify-center py-20">
          <div className="text-6xl mb-4">🔒</div>
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
          {[['pending', '⏳ Bekleyenler'], ['all', '📋 Tümü']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k as any)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: tab === k ? 'white' : 'transparent', color: tab === k ? '#0f2444' : '#9ca3af', boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {l}
              {k === 'pending' && pending.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pending.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : reviews.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon">🔬</div>
            <p className="text-sm font-medium text-navy">{tab === 'pending' ? 'Bekleyen inceleme yok' : 'Henüz inceleme kaydı yok'}</p>
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
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: cfg.bg, color: cfg.color, border: '1px solid ' + cfg.border }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-muted flex-wrap">
                        {p?.faculty && <span>🏛 {p.faculty}</span>}
                        {p?.owner && <span>👤 {p.owner.title} {p.owner.firstName} {p.owner.lastName}</span>}
                        <span>📅 {new Date(rev.createdAt).toLocaleDateString('tr-TR')}</span>
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
                      <p className="font-semibold text-amber-800 mb-1">🤖 YZ Analiz Sonucu:</p>
                      <p className="text-amber-700">{rev.aiEthicsReason}</p>
                    </div>
                  )}

                  {/* Kurul Kararı */}
                  {rev.reviewNote && (
                    <div className="mt-2 p-3 rounded-xl text-xs"
                      style={{ background: rev.status === 'approved' ? '#f0fdf4' : '#fef2f2', border: '1px solid ' + (rev.status === 'approved' ? '#86efac' : '#fca5a5') }}>
                      <p className="font-semibold mb-1" style={{ color: rev.status === 'approved' ? '#059669' : '#dc2626' }}>
                        📋 Kurul Kararı {rev.approvalNumber ? '(No: ' + rev.approvalNumber + ')' : ''}:
                      </p>
                      <p style={{ color: rev.status === 'approved' ? '#059669' : '#dc2626' }}>{rev.reviewNote}</p>
                      {rev.reviewer && (
                        <p className="text-muted mt-1">
                          — {rev.reviewer.title} {rev.reviewer.firstName} {rev.reviewer.lastName}
                          {rev.reviewedAt && ' · ' + new Date(rev.reviewedAt).toLocaleDateString('tr-TR')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Karar Butonlari */}
                  {rev.status === 'pending' && (
                    <div className="mt-3 pt-3 border-t flex gap-2" style={{ borderColor: '#f0ede8' }}>
                      <button onClick={() => { setModal(rev); setForm({ decision: 'approved', note: '', approvalNumber: '' }); }}
                        className="btn-primary text-xs">
                        Karar Ver
                      </button>
                      <Link href={'/projects/' + p?.id} className="btn-secondary text-xs">
                        Projeyi İncele →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Karar Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" style={{ border: '1px solid #e8e4dc' }}>
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: '#e8e4dc' }}>
              <h2 className="font-display font-semibold text-navy">Etik Kurul Kararı</h2>
              <button onClick={() => setModal(null)} className="text-muted hover:text-navy text-xl leading-none">✕</button>
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
                    { v: 'approved', l: '✅ Onaylandı',   c: '#059669', bg: '#f0fdf4' },
                    { v: 'rejected', l: '❌ Reddedildi', c: '#dc2626', bg: '#fef2f2' },
                  ].map(o => (
                    <button key={o.v} type="button" onClick={() => setForm(f => ({ ...f, decision: o.v }))}
                      className="p-3 rounded-xl border-2 font-semibold text-sm transition-all"
                      style={{ borderColor: form.decision === o.v ? o.c : '#e8e4dc', background: form.decision === o.v ? o.bg : 'white', color: form.decision === o.v ? o.c : '#374151' }}>
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
