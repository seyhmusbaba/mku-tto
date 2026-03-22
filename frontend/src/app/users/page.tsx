'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { usersApi, rolesApi } from '@/lib/api';
import { User, Role } from '@/types';
import { getInitials, formatDate, ROLE_COLORS } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

type Tab = 'active' | 'pending';

export default function UsersPage() {
  const { user: me } = useAuth();
  const router = useRouter();
  const isAdmin = me?.role?.name === 'Süper Admin';

  // Admin değilse dashboard'a yönlendir
  useEffect(() => {
    if (me && !isAdmin) router.replace('/dashboard');
  }, [me, isAdmin]);

  const [tab, setTab] = useState<Tab>('active');
  const [users, setUsers] = useState<User[]>([]);
  const [pending, setPending] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', title: '', faculty: '', department: '', roleId: '', phone: '', orcidId: '', googleScholarId: '', expertiseArea: '', bio: '' });

  // Onay modal
  const [approveModal, setApproveModal] = useState<User | null>(null);
  const [approveRoleId, setApproveRoleId] = useState('');

  const load = async () => {
    const [u, r] = await Promise.all([usersApi.getAll({ search, limit: 100 }), rolesApi.getAll()]);
    setUsers(u.data.data || []);
    setRoles(r.data);
    if (isAdmin) {
      usersApi.getPending().then(p => setPending(p.data)).catch(() => {});
    }
  };

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [search]);

  const openAdd = () => { setEditUser(null); setForm({ firstName: '', lastName: '', email: '', password: '', title: '', faculty: '', department: '', roleId: roles[0]?.id || '', phone: '', orcidId: '', googleScholarId: '', expertiseArea: '', bio: '' }); setShowModal(true); };
  const openEdit = (u: User) => { setEditUser(u); setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, password: '', title: u.title || '', faculty: u.faculty || '', department: u.department || '', roleId: u.roleId || '', phone: u.phone || '', orcidId: (u as any).orcidId || '', googleScholarId: (u as any).googleScholarId || '', expertiseArea: (u as any).expertiseArea || '', bio: (u as any).bio || '' }); setShowModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...form };
      if (editUser && !payload.password) delete payload.password;
      if (editUser) await usersApi.update(editUser.id, payload);
      else await usersApi.create(payload);
      toast.success(editUser ? 'Kullanıcı güncellendi' : 'Kullanıcı oluşturuldu');
      setShowModal(false); await load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Hata oluştu'); }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`"${u.firstName} ${u.lastName}" kullanıcısını kalıcı olarak silmek istiyor musunuz?\nBu işlem geri alınamaz.`)) return;
    try {
      await usersApi.delete(u.id);
      toast.success('Kullanıcı silindi');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Kullanıcı silinemedi');
    }
  };

  const handleApprove = async () => {
    if (!approveModal) return;
    try {
      await usersApi.approve(approveModal.id, approveRoleId || undefined);
      toast.success(`${approveModal.firstName} ${approveModal.lastName} onaylandı`);
      setApproveModal(null);
      await load();
    } catch { toast.error('Hata oluştu'); }
  };

  const handleReject = async (u: User) => {
    if (!confirm(`${u.firstName} ${u.lastName} adlı kullanıcının başvurusunu reddetmek istiyor musunuz?`)) return;
    await usersApi.reject(u.id);
    toast.success('Başvuru reddedildi'); await load();
  };

  const openApprove = (u: User) => {
    setApproveModal(u);
    const akademisyen = roles.find(r => r.name === 'Akademisyen');
    setApproveRoleId(akademisyen?.id || roles[0]?.id || '');
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <DashboardLayout>
      <Header title="Kullanıcı Yönetimi" subtitle="Sistem kullanıcılarını yönetin"
        actions={isAdmin && <button onClick={openAdd} className="btn-primary">+ Yeni Kullanıcı</button>} />

      <div className="p-8 space-y-6">
        {/* Sekme + Arama */}
        <div className="flex items-center gap-4 flex-wrap">
          {isAdmin && (
            <div className="flex rounded-xl p-1" style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
              <button onClick={() => setTab('active')}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                style={{ background: tab === 'active' ? 'white' : 'transparent', color: tab === 'active' ? '#0f2444' : '#9ca3af', boxShadow: tab === 'active' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                Aktif Kullanıcılar
              </button>
              <button onClick={() => setTab('pending')}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                style={{ background: tab === 'pending' ? 'white' : 'transparent', color: tab === 'pending' ? '#0f2444' : '#9ca3af', boxShadow: tab === 'pending' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                Onay Bekleyenler
                {pending.length > 0 && (
                  <span className="w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center" style={{ background: '#dc2626' }}>{pending.length}</span>
                )}
              </button>
            </div>
          )}
          {tab === 'active' && (
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input className="input pl-9" placeholder="İsim veya e-posta ara..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          )}
          <div className="text-xs text-muted ml-auto">
            {tab === 'active' ? `${users.length} kullanıcı` : `${pending.length} başvuru`}
          </div>
        </div>

        {/* AKTIF KULLANICILAR */}
        {tab === 'active' && (
          <div className="card p-0 overflow-hidden">
            {loading ? <div className="flex justify-center py-20"><div className="spinner" /></div> : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#faf8f4', borderBottom: '1px solid #e8e4dc' }}>
                    {['Kullanıcı', 'Rol', 'Birim', 'Durum', 'Kayıt', ''].map(h => (
                      <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const roleStyle = ROLE_COLORS[u.role?.name || ''] || { bg: '#f0ede8', text: '#6b7280', border: '#e8e4dc' };
                    return (
                      <tr key={u.id} className="table-row-hover border-b" style={{ borderColor: '#f5f2ee' }}>
                        <td className="px-5 py-4">
                          <Link href={`/users/${u.id}`} className="flex items-center gap-3 group">
                            {(u as any).avatar ? (
                              <img src={(u as any).avatar} alt={u.firstName} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg,${roleStyle.text},${roleStyle.text}bb)`, color: 'white' }}>
                                {getInitials(u.firstName, u.lastName)}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-navy group-hover:underline">{u.firstName} {u.lastName}</p>
                              <p className="text-xs text-muted">{u.email}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <span className="badge text-xs" style={{ background: roleStyle.bg, color: roleStyle.text, border: `1px solid ${roleStyle.border}` }}>{u.role?.name}</span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-xs text-muted">{u.title}</p>
                          <p className="text-xs text-muted">{u.department}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`badge text-xs ${u.isActive ? 'badge-green' : 'badge-gray'}`}>{u.isActive ? 'Aktif' : 'Pasif'}</span>
                        </td>
                        <td className="px-5 py-4 text-xs text-muted">{formatDate(u.createdAt)}</td>
                        <td className="px-5 py-4">
                          {isAdmin && (
                            <div className="flex gap-2">
                              <Link href={`/users/${u.id}`} className="btn-ghost text-xs px-3 py-1.5">Profil</Link>
                              <button onClick={() => openEdit(u)} className="btn-secondary text-xs px-3 py-1.5">Düzenle</button>
                              <button onClick={() => handleDelete(u)} className="btn-danger text-xs px-2 py-1.5">Sil</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!users.length && <tr><td colSpan={6}><div className="empty-state"><p className="text-sm">Kullanıcı bulunamadı</p></div></td></tr>}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ONAY BEKLEYENLERi */}
        {tab === 'pending' && isAdmin && (
          <div className="space-y-4">
            {pending.length === 0 ? (
              <div className="empty-state py-20">
                <div className="empty-state-icon">
                  <svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm">Onay bekleyen başvuru bulunmuyor</p>
              </div>
            ) : pending.map(u => (
              <div key={u.id} className="card flex items-start gap-5" style={{ borderLeft: '4px solid #d97706' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)' }}>
                  {getInitials(u.firstName, u.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h3 className="font-display font-semibold text-navy">{u.firstName} {u.lastName}</h3>
                    <span className="badge text-xs" style={{ background: '#fffbeb', color: '#92651a', border: '1px solid #fde68a' }}>⏳ Onay Bekliyor</span>
                  </div>
                  <p className="text-sm text-muted">{u.email}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted">
                    {u.title && <span>🎓 {u.title}</span>}
                    {u.faculty && <span>🏛 {u.faculty}</span>}
                    {u.department && <span>📚 {u.department}</span>}
                    <span>📅 {formatDate(u.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openApprove(u)} className="btn-primary text-sm px-4">
                    ✓ Onayla
                  </button>
                  <button onClick={() => handleReject(u)} className="btn-danger text-sm px-4">
                    ✕ Reddet
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kullanıcı Ekle/Düzenle Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ border: '1px solid #e8e4dc' }}>
            <div className="p-6 border-b sticky top-0 bg-white z-10" style={{ borderColor: '#e8e4dc' }}>
              <h3 className="font-display text-lg font-semibold text-navy">{editUser ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'}</h3>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Ad *</label><input required className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} /></div>
                <div><label className="label">Soyad *</label><input required className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} /></div>
              </div>
              <div><label className="label">E-posta *</label><input required type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} /></div>
              <div><label className="label">{editUser ? 'Şifre (değiştirmek için doldurun)' : 'Şifre *'}</label><input type="password" required={!editUser} className="input" value={form.password} onChange={e => set('password', e.target.value)} placeholder={editUser ? 'Boş bırakırsanız değişmez' : ''} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Unvan</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Prof. Dr." /></div>
                <div><label className="label">Telefon</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
              </div>
              <div><label className="label">Fakülte</label><input className="input" value={form.faculty} onChange={e => set('faculty', e.target.value)} /></div>
              <div><label className="label">Bölüm</label><input className="input" value={form.department} onChange={e => set('department', e.target.value)} /></div>
              <div><label className="label">Rol *</label>
                <select required className="input" value={form.roleId} onChange={e => set('roleId', e.target.value)}>
                  <option value="">Rol seçin</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <div className="col-span-2 border-t pt-3 mt-1" style={{ borderColor: '#f0ede8' }}>
                  <p className="text-xs font-semibold text-muted mb-3">Akademik Profil (isteğe bağlı)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">ORCID ID</label><input className="input" placeholder="0000-0000-0000-0000" value={form.orcidId} onChange={e => set('orcidId', e.target.value)} /></div>
                    <div><label className="label">Google Scholar ID</label><input className="input" placeholder="kullanici_id" value={form.googleScholarId} onChange={e => set('googleScholarId', e.target.value)} /></div>
                    <div className="col-span-2"><label className="label">Uzmanlık Alanı</label><input className="input" placeholder="Makine öğrenmesi, IoT..." value={form.expertiseArea} onChange={e => set('expertiseArea', e.target.value)} /></div>
                  </div>
                </div>
                <button type="submit" className="btn-primary flex-1">{editUser ? 'Güncelle' : 'Oluştur'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Onay Modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" style={{ border: '1px solid #e8e4dc' }}>
            <div className="p-6 border-b" style={{ borderColor: '#e8e4dc' }}>
              <h3 className="font-display text-base font-semibold text-navy">Başvuruyu Onayla</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}>
                  {getInitials(approveModal.firstName, approveModal.lastName)}
                </div>
                <div>
                  <p className="font-semibold text-navy text-sm">{approveModal.firstName} {approveModal.lastName}</p>
                  <p className="text-xs text-muted">{approveModal.email}</p>
                </div>
              </div>
              <div>
                <label className="label">Rol Ata *</label>
                <select className="input" value={approveRoleId} onChange={e => setApproveRoleId(e.target.value)}>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <p className="text-xs text-muted mt-1">Kullanıcının başlangıç rolünü belirleyin.</p>
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={handleApprove} className="btn-primary flex-1">Onayla ve Aktifleştir</button>
              <button onClick={() => setApproveModal(null)} className="btn-secondary flex-1">İptal</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
