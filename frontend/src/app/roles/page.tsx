'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { rolesApi } from '@/lib/api';
import { Role, Permission } from '@/types';
import { ROLE_COLORS } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

/* ─── Icon helper ───────────────────────────────────── */
type IconName = 'plus' | 'x' | 'edit' | 'trash' | 'shield' | 'lock' | 'alert-circle' | 'refresh' | 'check' | 'search';
const I: Record<IconName, string> = {
  plus:   'M12 4v16m8-8H4',
  x:      'M6 18L18 6M6 6l12 12',
  edit:   'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  lock:   'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  'alert-circle':'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  refresh:'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  check:  'M5 13l4 4L19 7',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
};
function Icon({ name, className = 'w-4 h-4', strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={I[name]} />
    </svg>
  );
}

export default function RolesPage() {
  const { user: me } = useAuth();
  const router = useRouter();
  const isAdmin = me?.role?.name === 'Süper Admin';

  useEffect(() => {
    if (me && !isAdmin) router.replace('/dashboard');
  }, [me, isAdmin, router]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: '', description: '', permissionIds: [] as string[] });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const [r, p] = await Promise.all([rolesApi.getAll(), rolesApi.getPermissions()]);
      setRoles(r.data || []);
      setPermissions(p.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Roller yüklenemedi');
    }
  };

  useEffect(() => {
    if (!me || !isAdmin) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [me, isAdmin]);

  const openAdd = () => {
    setEditRole(null);
    setForm({ name: '', description: '', permissionIds: [] });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (r: Role) => {
    setEditRole(r);
    setForm({ name: r.name, description: r.description || '', permissionIds: r.permissions?.map(p => p.id) || [] });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Rol adı zorunlu'); return; }
    if (form.name.length > 40) { setFormError('Rol adı en fazla 40 karakter olabilir'); return; }
    setSaving(true);
    setFormError(null);
    try {
      if (editRole) {
        await rolesApi.update(editRole.id, form);
        toast.success('Rol güncellendi');
      } else {
        await rolesApi.create(form);
        toast.success('Rol oluşturuldu');
      }
      setShowModal(false);
      await load();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: Role) => {
    if (r.isSystem) { toast.error('Sistem rolleri silinemez'); return; }
    if (!confirm(`"${r.name}" rolünü silmek istiyor musunuz?\nBu role atanmış kullanıcı varsa işlem başarısız olur.`)) return;
    try {
      await rolesApi.delete(r.id);
      toast.success('Rol silindi');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Bu rol kullanımda olduğundan silinemiyor');
    }
  };

  const togglePerm = (id: string) => setForm(f => ({
    ...f,
    permissionIds: f.permissionIds.includes(id) ? f.permissionIds.filter(p => p !== id) : [...f.permissionIds, id],
  }));

  const modules = useMemo(() => Array.from(new Set(permissions.map(p => p.module))), [permissions]);

  const filteredRoles = useMemo(() => {
    if (!search.trim()) return roles;
    const s = search.trim().toLowerCase();
    return roles.filter(r =>
      r.name.toLowerCase().includes(s) ||
      (r.description || '').toLowerCase().includes(s)
    );
  }, [roles, search]);

  if (!me || !isAdmin) {
    return <DashboardLayout><Header title="Roller & Yetkiler" /><div className="p-8 text-sm text-muted">Yönlendiriliyorsunuz...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <Header title="Roller & Yetkiler" subtitle="Kullanıcı rollerini ve erişim yetkilerini yönetin"
        actions={
          <button onClick={openAdd} className="btn-primary inline-flex items-center gap-1.5">
            <Icon name="plus" className="w-4 h-4" />
            Yeni Rol
          </button>
        } />

      <div className="p-6 xl:p-8 space-y-5">
        {/* Üst bar - özet + arama */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-3">
            <div className="card px-5 py-3 inline-flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#1a3a6b18', color: '#1a3a6b' }}>
                <Icon name="shield" className="w-4 h-4" />
              </span>
              <div>
                <p className="font-display text-xl font-bold text-navy leading-none">{roles.length}</p>
                <p className="text-xs text-muted mt-0.5">Toplam rol</p>
              </div>
            </div>
            <div className="card px-5 py-3 inline-flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#c8a45a18', color: '#c8a45a' }}>
                <Icon name="lock" className="w-4 h-4" />
              </span>
              <div>
                <p className="font-display text-xl font-bold text-navy leading-none">{permissions.length}</p>
                <p className="text-xs text-muted mt-0.5">Yetki</p>
              </div>
            </div>
          </div>
          <div className="relative flex-1 max-w-sm">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input className="input pl-9 pr-9" placeholder="Rol ara..."
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Aramayı temizle"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-navy">
                <Icon name="x" className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* İçerik */}
        {error ? (
          <div className="card py-16 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <Icon name="alert-circle" className="w-7 h-7" strokeWidth={1.6} />
            </div>
            <p className="text-sm font-semibold text-navy">Roller yüklenemedi</p>
            <p className="text-xs text-muted mt-1 max-w-md mx-auto">{error}</p>
            <button onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }} className="btn-primary text-sm mt-4 inline-flex items-center gap-1.5">
              <Icon name="refresh" className="w-4 h-4" />
              Yeniden Dene
            </button>
          </div>
        ) : loading ? (
          <div className="card flex justify-center py-20"><div className="spinner" /></div>
        ) : !filteredRoles.length ? (
          <div className="card py-20 text-center">
            <Icon name="shield" className="w-10 h-10 mx-auto text-muted" strokeWidth={1.4} />
            <p className="text-sm font-medium text-navy mt-3">{search ? 'Aramaya uygun rol yok' : 'Henüz rol yok'}</p>
            {search && (
              <button onClick={() => setSearch('')} className="btn-secondary text-sm mt-3 inline-flex items-center gap-1.5">
                <Icon name="x" className="w-4 h-4" /> Aramayı Temizle
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRoles.map(role => {
              const roleStyle = ROLE_COLORS[role.name] || { bg: '#f0ede8', text: '#6b7280', border: '#e8e4dc' };
              const permCount = role.permissions?.length || 0;
              return (
                <div key={role.id} className="card-hover flex flex-col p-5"
                  style={{ borderLeft: `3px solid ${roleStyle.text}` }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${roleStyle.text}, ${roleStyle.text}cc)` }}>
                      {role.name[0]}
                    </div>
                    <div className="flex gap-1.5 items-center">
                      {role.isSystem && (
                        <span className="badge badge-gold text-[10px] inline-flex items-center gap-1">
                          <Icon name="lock" className="w-3 h-3" />
                          Sistem
                        </span>
                      )}
                      <button onClick={() => openEdit(role)} aria-label="Düzenle" title="Düzenle"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-muted hover:text-navy">
                        <Icon name="edit" className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(role)} aria-label="Sil" title={role.isSystem ? 'Sistem rolü silinemez' : 'Sil'}
                        disabled={!!role.isSystem}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed">
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-display font-semibold text-base mb-1" style={{ color: roleStyle.text }}>{role.name}</h3>
                  {role.description && <p className="text-xs text-muted mb-3 leading-relaxed">{role.description}</p>}

                  <div className="mt-auto pt-3 border-t" style={{ borderColor: '#f0ede8' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 inline-flex items-center gap-1.5">
                      <Icon name="shield" className="w-3 h-3" />
                      {permCount} yetki
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions?.slice(0, 4).map(p => (
                        <span key={p.id} className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: roleStyle.bg, color: roleStyle.text, border: `1px solid ${roleStyle.border}` }}>
                          {p.description || p.action}
                        </span>
                      ))}
                      {permCount > 4 && <span className="text-xs px-2 py-0.5 rounded-full text-muted" style={{ background: '#f0ede8' }}>+{permCount - 4}</span>}
                      {!permCount && <span className="text-xs text-muted">Yetki tanımlanmamış</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ border: '1px solid #e8e4dc' }}>
            <div className="p-5 border-b sticky top-0 bg-white z-10 flex items-center justify-between" style={{ borderColor: '#e8e4dc' }}>
              <h3 className="font-display text-base font-semibold text-navy inline-flex items-center gap-2">
                <Icon name={editRole ? 'edit' : 'plus'} className="w-4 h-4 text-navy" />
                {editRole ? 'Rolü Düzenle' : 'Yeni Rol'}
              </h3>
              <button onClick={() => setShowModal(false)} aria-label="Kapat"
                className="p-1.5 rounded-lg text-muted hover:bg-slate-100 hover:text-navy">
                <Icon name="x" className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-5 mt-4 p-3 rounded-xl text-xs flex items-start gap-2" style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b' }}>
                <Icon name="alert-circle" className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="p-5 space-y-5">
              <div>
                <label className="label">Rol Adı *</label>
                <input required maxLength={40} className="input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Örn. Teknik Danışman" />
              </div>
              <div>
                <label className="label">Açıklama</label>
                <input className="input" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Rolün kısa açıklaması" />
              </div>

              {permissions.length > 0 && (
                <div>
                  <label className="label inline-flex items-center justify-between w-full">
                    <span>Yetkiler</span>
                    <span className="text-xs text-muted font-normal">
                      {form.permissionIds.length} / {permissions.length} seçili
                    </span>
                  </label>
                  <div className="space-y-3 mt-2">
                    {modules.map(mod => {
                      const modPerms = permissions.filter(p => p.module === mod);
                      const modPermIds = modPerms.map(p => p.id);
                      const selectedCount = modPermIds.filter(id => form.permissionIds.includes(id)).length;
                      const allSelected = modPerms.length > 0 && selectedCount === modPerms.length;
                      return (
                        <div key={mod} className="rounded-xl p-4" style={{ background: '#faf8f4', border: '1px solid #e8e4dc' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-navy">
                              {mod}
                              <span className="ml-2 text-muted font-normal">({selectedCount}/{modPerms.length})</span>
                            </p>
                            <button type="button" className="text-xs font-semibold hover:underline"
                              style={{ color: allSelected ? '#dc2626' : '#1a3a6b' }}
                              onClick={() => {
                                setForm(f => ({
                                  ...f,
                                  permissionIds: allSelected
                                    ? f.permissionIds.filter(id => !modPermIds.includes(id))
                                    : Array.from(new Set([...f.permissionIds, ...modPermIds])),
                                }));
                              }}>
                              {allSelected ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {modPerms.map(p => (
                              <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded-lg p-1.5 transition-colors">
                                <input type="checkbox" checked={form.permissionIds.includes(p.id)} onChange={() => togglePerm(p.id)} className="w-3.5 h-3.5 accent-navy" />
                                <span className="text-xs text-navy">{p.description || p.action}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t" style={{ borderColor: '#f0ede8' }}>
                <button type="submit" disabled={saving} className="btn-primary flex-1 inline-flex items-center justify-center gap-1.5">
                  {saving ? <><span className="spinner w-4 h-4" /> Kaydediliyor...</> : (editRole ? <><Icon name="check" className="w-4 h-4" />Güncelle</> : <><Icon name="plus" className="w-4 h-4" />Oluştur</>)}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
