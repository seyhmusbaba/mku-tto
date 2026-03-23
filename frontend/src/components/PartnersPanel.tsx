'use client';
import { useState, useEffect } from 'react';
import { partnersApi } from '@/lib/api';
import { ProjectPartnerItem } from '@/types';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

const PARTNER_TYPES = [
  { key: 'university', label: 'Üniversite', icon: '🎓' },
  { key: 'industry',   label: 'Sanayi / Firma', icon: '🏭' },
  { key: 'government', label: 'Kamu Kurumu', icon: '🏛' },
  { key: 'ngo',        label: 'STK / Vakıf', icon: '🤝' },
  { key: 'other',      label: 'Diğer', icon: '🌐' },
];
const PARTNER_ROLES = [
  { key: 'coordinator', label: 'Koordinatör' },
  { key: 'partner',     label: 'Ortak' },
  { key: 'associate',   label: 'İlişkili Ortak' },
];
const COUNTRIES = ['TR','DE','US','GB','FR','IT','NL','BE','SE','FI','PL','ES','AT','CH','JP','KR','Diğer'];
const EMPTY = { name: '', type: 'university', country: 'TR', contactName: '', contactEmail: '', contributionBudget: '', role: 'partner', notes: '' };

interface Props { projectId: string; canEdit: boolean; }

export function PartnersPanel({ projectId, canEdit }: Props) {
  const [partners, setPartners] = useState<ProjectPartnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    partnersApi.getByProject(projectId)
      .then(r => setPartners(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [projectId]);

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (p: ProjectPartnerItem) => {
    setForm({ ...p, contributionBudget: p.contributionBudget?.toString() || '' });
    setEditId(p.id); setModal(true);
  };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name?.trim()) { toast.error('Kurum adı zorunlu'); return; }
    setSaving(true);
    const payload = { ...form, contributionBudget: form.contributionBudget ? +form.contributionBudget : null };
    try {
      if (editId) { await partnersApi.update(projectId, editId, payload); toast.success('Ortak güncellendi'); }
      else         { await partnersApi.create(projectId, payload);         toast.success('Ortak eklendi'); }
      setModal(false); load();
    } catch { toast.error('Hata oluştu'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`"${name}" ortağını kaldırmak istiyor musunuz?`)) return;
    try { await partnersApi.delete(projectId, id); setPartners(ps => ps.filter(p => p.id !== id)); toast.success('Ortak kaldırıldı'); }
    catch { toast.error('Hata'); }
  };

  const typeInfo = (key: string) => PARTNER_TYPES.find(t => t.key === key) || { icon: '🌐', label: key };
  const totalBudget = partners.reduce((s, p) => s + (p.contributionBudget || 0), 0);
  const countries   = Array.from(new Set(partners.map(p => p.country).filter(Boolean)));

  return (
    <div className="space-y-4">
      {/* Bölüm başlığı */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-navy">Kurum Dışı Ortaklar</h3>
          <p className="text-xs text-muted mt-0.5">Ortak üniversiteler, sanayi kuruluşları ve uluslararası iş birlikleri</p>
        </div>
        {canEdit && <button onClick={openAdd} className="btn-primary text-sm">+ Ortak Ekle</button>}
      </div>

      {/* Özet */}
      {partners.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Toplam Ortak',     val: partners.length.toString(), color: '#1a3a6b' },
            { label: 'Katkı Bütçesi',    val: totalBudget ? formatCurrency(totalBudget) : '—', color: '#059669' },
            { label: 'Ülke Sayısı',      val: countries.length ? countries.length.toString() : '—', color: '#d97706' },
          ].map(item => (
            <div key={item.label} className="card p-3 text-center">
              <p className="font-display text-xl font-bold" style={{ color: item.color }}>{item.val}</p>
              <p className="text-xs text-muted mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-10"><div className="spinner" /></div>
      ) : partners.length === 0 ? (
        <div className="empty-state py-10">
          <div className="empty-state-icon"><span className="text-3xl">🏛</span></div>
          <p className="text-sm font-medium text-navy">Henüz kurum dışı ortak yok</p>
          <p className="text-xs text-muted mt-1">AB projeleri, sanayi ortaklıkları ve uluslararası iş birliklerini buraya ekleyebilirsiniz</p>
          {canEdit && <button onClick={openAdd} className="btn-primary mt-4 text-sm">+ Ortak Ekle</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {partners.map(p => {
            const ti = typeInfo(p.type || 'other');
            const roleLabel = PARTNER_ROLES.find(r => r.key === p.role)?.label || p.role || '—';
            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
                    {ti.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-navy truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f0ede8', color: '#6b7280' }}>{ti.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{roleLabel}</span>
                          {p.country && <span className="text-xs text-muted">🌍 {p.country}</span>}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openEdit(p)} className="btn-ghost text-xs px-2 py-1">Düzenle</button>
                          <button onClick={() => remove(p.id, p.name)} className="btn-ghost text-xs px-2 py-1 text-red-500">Kaldır</button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {p.contactName  && <div><p className="text-xs text-muted">İrtibat</p><p className="text-sm font-medium text-navy">{p.contactName}</p></div>}
                      {p.contactEmail && <div><p className="text-xs text-muted">E-posta</p><a href={`mailto:${p.contactEmail}`} className="text-sm font-medium text-navy hover:underline truncate block">{p.contactEmail}</a></div>}
                      {p.contributionBudget ? <div><p className="text-xs text-muted">Katkı</p><p className="text-sm font-bold" style={{ color: '#059669' }}>{formatCurrency(p.contributionBudget)}</p></div> : null}
                    </div>
                    {p.notes && <p className="text-xs text-muted mt-2 px-3 py-2 rounded-lg bg-cream">{p.notes}</p>}
                  </div>
                </div>
              </div>
            );
          })}
          {canEdit && <button onClick={openAdd} className="btn-secondary w-full text-sm">+ Yeni Ortak Ekle</button>}
        </div>
      )}

      {/* MODAL — fixed overlay, ortalanmış */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,36,68,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-navy w-full max-w-xl max-h-[90vh] overflow-y-auto"
            style={{ border: '1px solid #e8e4dc' }}>
            <div className="sticky top-0 bg-white flex items-center justify-between px-6 pt-5 pb-4 border-b z-10"
              style={{ borderColor: '#e8e4dc' }}>
              <div>
                <h3 className="font-display font-semibold text-navy">{editId ? 'Ortağı Düzenle' : 'Kurum Dışı Ortak Ekle'}</h3>
                <p className="text-xs text-muted mt-0.5">Ortak kurum bilgilerini girin</p>
              </div>
              <button onClick={() => setModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-navy hover:bg-cream transition-colors">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Kurum Adı *</label>
                  <input className="input" placeholder="Örn: Boğaziçi Üniversitesi, Siemens AG..." value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <label className="label">Kurum Türü</label>
                  <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                    {PARTNER_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Ortaklık Rolü</label>
                  <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                    {PARTNER_ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Ülke</label>
                  <select className="input" value={form.country} onChange={e => set('country', e.target.value)}>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Katkı Bütçesi (₺)</label>
                  <input type="number" className="input" placeholder="0" value={form.contributionBudget} onChange={e => set('contributionBudget', e.target.value)} />
                </div>
                <div>
                  <label className="label">İrtibat Kişisi</label>
                  <input className="input" placeholder="Ad Soyad" value={form.contactName} onChange={e => set('contactName', e.target.value)} />
                </div>
                <div>
                  <label className="label">İrtibat E-postası</label>
                  <input type="email" className="input" placeholder="kisi@kurum.com" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Notlar</label>
                  <textarea className="input" rows={2} placeholder="Ortaklık kapsamı, katkı alanı..." value={form.notes} onChange={e => set('notes', e.target.value)} />
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t" style={{ borderColor: '#e8e4dc' }}>
                <button onClick={save} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Kaydediliyor...' : editId ? 'Güncelle' : 'Ortağı Ekle'}
                </button>
                <button onClick={() => setModal(false)} className="btn-secondary">İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
