'use client';
import { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { usersApi, rolesApi } from '@/lib/api';
import { User, Role } from '@/types';
import { getInitials, formatDate, ROLE_COLORS } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

type Tab = 'active' | 'pending';

/* ─── Icon helper ────────────────────────────────────── */
type IconName =
  | 'search' | 'plus' | 'x' | 'edit' | 'trash' | 'profile' | 'check' | 'clock'
  | 'alert' | 'shield' | 'mail' | 'phone' | 'building' | 'book' | 'graduation' | 'calendar'
  | 'users' | 'refresh' | 'alert-circle';

const I: Record<IconName, string> = {
  search:    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  plus:      'M12 4v16m8-8H4',
  x:         'M6 18L18 6M6 6l12 12',
  edit:      'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:     'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  profile:   'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  check:     'M5 13l4 4L19 7',
  clock:     'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  alert:     'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  shield:    'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  mail:      'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  phone:     'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  building:  'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  book:      'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  graduation:'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222',
  calendar:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  users:     'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  refresh:   'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  'alert-circle':'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

function Icon({ name, className = 'w-4 h-4', strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={I[name]} />
    </svg>
  );
}

/* ─── Debounce ───────────────────────────────────────── */
function useDebounced<T>(value: T, delay = 350): T {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return d;
}

export default function UsersPage() {
  return (
    <Suspense fallback={<DashboardLayout><Header title="Kullanıcı Yönetimi" /><div className="flex-1 flex items-center justify-center"><div className="spinner" /></div></DashboardLayout>}>
      <UsersPageInner />
    </Suspense>
  );
}

function UsersPageInner() {
  const { user: me } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = me?.role?.name === 'Süper Admin';

  useEffect(() => {
    if (me && !isAdmin) router.replace('/dashboard');
  }, [me, isAdmin, router]);

  const [tab, setTab]         = useState<Tab>(() => (searchParams.get('tab') as Tab) || 'active');
  const [search, setSearch]   = useState(() => searchParams.get('q') || '');
  const searchDebounced       = useDebounced(search, 350);

  const [users, setUsers]     = useState<User[]>([]);
  const [pending, setPending] = useState<User[]>([]);
  const [roles, setRoles]     = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser]   = useState<User | null>(null);
  const emptyForm = { firstName: '', lastName: '', email: '', password: '', title: '', faculty: '', department: '', roleId: '', phone: '', orcidId: '', googleScholarId: '', expertiseArea: '', bio: '' };
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [approveModal, setApproveModal] = useState<User | null>(null);
  const [approveRoleId, setApproveRoleId] = useState('');
  const [approveSaving, setApproveSaving] = useState(false);

  // URL'yi tab/search ile senkronize et
  useEffect(() => {
    const p = new URLSearchParams();
    if (tab !== 'active') p.set('tab', tab);
    if (searchDebounced) p.set('q', searchDebounced);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [tab, searchDebounced, pathname, router]);

  const load = async () => {
    setError(null);
    try {
      const [u, r] = await Promise.all([
        usersApi.getAll({ search: searchDebounced, limit: 100 }),
        rolesApi.getAll(),
      ]);
      setUsers(u.data.data || []);
      setRoles(r.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Kullanıcılar yüklenemedi');
      return;
    }
    if (isAdmin) {
      usersApi.getPending().then(p => setPending(p.data)).catch(() => setPending([]));
    }
  };

  useEffect(() => {
    if (!me || !isAdmin) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [searchDebounced, me, isAdmin]);

  const openAdd = () => {
    setEditUser(null);
    setForm({ ...emptyForm, roleId: roles.find(r => r.name === 'Akademisyen')?.id || roles[0]?.id || '' });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({
      firstName: u.firstName, lastName: u.lastName, email: u.email, password: '',
      title: u.title || '', faculty: u.faculty || '', department: u.department || '',
      roleId: u.roleId || '', phone: u.phone || '',
      orcidId: (u as any).orcidId || '', googleScholarId: (u as any).googleScholarId || '',
      expertiseArea: (u as any).expertiseArea || '', bio: (u as any).bio || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const validateForm = (): string | null => {
    if (!form.firstName.trim()) return 'Ad zorunlu';
    if (!form.lastName.trim()) return 'Soyad zorunlu';
    if (!form.email.trim()) return 'E-posta zorunlu';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Geçersiz e-posta adresi';
    if (!form.roleId) return 'Rol seçiniz';
    if (!editUser && form.password.length < 8) return 'Şifre en az 8 karakter olmalı';
    if (editUser && form.password && form.password.length < 8) return 'Yeni şifre en az 8 karakter olmalı';
    if (form.phone && !/^[\d\s+\-()]{7,}$/.test(form.phone)) return 'Geçersiz telefon numarası';
    return null;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) { setFormError(err); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload: any = { ...form };
      if (editUser && !payload.password) delete payload.password;
      if (editUser) await usersApi.update(editUser.id, payload);
      else await usersApi.create(payload);
      toast.success(editUser ? 'Kullanıcı güncellendi' : 'Kullanıcı oluşturuldu');
      setShowModal(false);
      await load();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (u.id === me?.id) { toast.error('Kendi hesabınızı silemezsiniz'); return; }
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
    if (!approveModal || !approveRoleId) return;
    setApproveSaving(true);
    try {
      await usersApi.approve(approveModal.id, approveRoleId);
      toast.success(`${approveModal.firstName} ${approveModal.lastName} onaylandı`);
      setApproveModal(null);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Hata oluştu');
    } finally {
      setApproveSaving(false);
    }
  };

  const handleReject = async (u: User) => {
    if (!confirm(`${u.firstName} ${u.lastName} adlı kullanıcının başvurusunu reddetmek istiyor musunuz?`)) return;
    try {
      await usersApi.reject(u.id);
      toast.success('Başvuru reddedildi');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Reddetme başarısız');
    }
  };

  const openApprove = (u: User) => {
    setApproveModal(u);
    const akademisyen = roles.find(r => r.name === 'Akademisyen');
    setApproveRoleId(akademisyen?.id || roles[0]?.id || '');
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Özet istatistikler
  const stats = useMemo(() => {
    const activeCount = users.filter(u => u.isActive).length;
    const inactive = users.length - activeCount;
    const byRole: Record<string, number> = {};
    users.forEach(u => {
      const n = u.role?.name || 'Bilinmiyor';
      byRole[n] = (byRole[n] || 0) + 1;
    });
    return { activeCount, inactive, byRole };
  }, [users]);

  if (!me || !isAdmin) {
    return <DashboardLayout><Header title="Kullanıcı Yönetimi" /><div className="p-8 text-sm text-muted">Yönlendiriliyorsunuz...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <Header title="Kullanıcı Yönetimi" subtitle="Sistem kullanıcılarını yönetin, başvuruları onaylayın"
        actions={
          <button onClick={openAdd} className="btn-primary inline-flex items-center gap-1.5">
            <Icon name="plus" className="w-4 h-4" />
            Yeni Kullanıcı
          </button>
        } />

      <div className="p-6 xl:p-8 space-y-6">
        {/* Özet kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Toplam',         value: users.length,      color: '#1a3a6b', icon: 'users' as IconName },
            { label: 'Aktif',          value: stats.activeCount, color: '#059669', icon: 'check' as IconName },
            { label: 'Pasif',          value: stats.inactive,    color: '#6b7280', icon: 'clock' as IconName },
            { label: 'Onay Bekleyen',  value: pending.length,    color: '#d97706', icon: 'alert' as IconName },
          ].map(s => (
            <div key={s.label} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.color + '18', color: s.color }}>
                  <Icon name={s.icon} className="w-5 h-5" />
                </span>
                <div>
                  <p className="font-display text-2xl font-bold text-navy leading-none">{s.value}</p>
                  <p className="text-xs text-muted mt-1">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sekme + Arama */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex rounded-xl p-1" style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
            <button onClick={() => setTab('active')}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-1.5"
              style={{ background: tab === 'active' ? 'white' : 'transparent', color: tab === 'active' ? '#0f2444' : '#9ca3af', boxShadow: tab === 'active' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              <Icon name="users" className="w-3.5 h-3.5" />
              Aktif
            </button>
            <button onClick={() => setTab('pending')}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-2"
              style={{ background: tab === 'pending' ? 'white' : 'transparent', color: tab === 'pending' ? '#0f2444' : '#9ca3af', boxShadow: tab === 'pending' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              <Icon name="clock" className="w-3.5 h-3.5" />
              Onay Bekleyenler
              {pending.length > 0 && (
                <span className="w-5 h-5 rounded-full text-[11px] font-bold text-white flex items-center justify-center" style={{ background: '#dc2626' }}>{pending.length}</span>
              )}
            </button>
          </div>
          {tab === 'active' && (
            <div className="relative flex-1 max-w-sm">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input className="input pl-9 pr-9" placeholder="İsim veya e-posta ara..."
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Aramayı temizle"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-navy">
                  <Icon name="x" className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* İçerik */}
        {error ? (
          <div className="card py-16 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <Icon name="alert-circle" className="w-7 h-7" strokeWidth={1.6} />
            </div>
            <p className="text-sm font-semibold text-navy">Kullanıcılar yüklenemedi</p>
            <p className="text-xs text-muted mt-1 max-w-md mx-auto">{error}</p>
            <button onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }} className="btn-primary text-sm mt-4 inline-flex items-center gap-1.5">
              <Icon name="refresh" className="w-4 h-4" />
              Yeniden Dene
            </button>
          </div>
        ) : loading ? (
          <div className="card flex justify-center py-20"><div className="spinner" /></div>
        ) : tab === 'active' ? (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
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
                          <span className="badge text-xs" style={{ background: roleStyle.bg, color: roleStyle.text, border: `1px solid ${roleStyle.border}` }}>{u.role?.name || '—'}</span>
                        </td>
                        <td className="px-5 py-4">
                          {u.title && <p className="text-xs text-muted">{u.title}</p>}
                          <p className="text-xs text-muted">{u.department || u.faculty || '—'}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`badge text-xs ${u.isActive ? 'badge-green' : 'badge-gray'}`}>{u.isActive ? 'Aktif' : 'Pasif'}</span>
                        </td>
                        <td className="px-5 py-4 text-xs text-muted whitespace-nowrap">{formatDate(u.createdAt)}</td>
                        <td className="px-5 py-4">
                          <div className="flex gap-1.5 justify-end">
                            <Link href={`/users/${u.id}`}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-muted hover:text-navy"
                              title="Profili görüntüle" aria-label="Profil">
                              <Icon name="profile" className="w-4 h-4" />
                            </Link>
                            <button onClick={() => openEdit(u)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-muted hover:text-navy"
                              title="Düzenle" aria-label="Düzenle">
                              <Icon name="edit" className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(u)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              disabled={u.id === me?.id}
                              title={u.id === me?.id ? 'Kendinizi silemezsiniz' : 'Sil'}
                              aria-label="Sil">
                              <Icon name="trash" className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!users.length && (
                    <tr><td colSpan={6}>
                      <div className="empty-state py-14">
                        <Icon name="users" className="w-10 h-10 mx-auto text-muted" strokeWidth={1.4} />
                        <p className="text-sm font-medium text-navy mt-3">
                          {search ? 'Aramaya uygun kullanıcı bulunamadı' : 'Henüz kullanıcı yok'}
                        </p>
                        {search && (
                          <button onClick={() => setSearch('')} className="btn-secondary text-sm mt-3 inline-flex items-center gap-1.5">
                            <Icon name="x" className="w-4 h-4" /> Aramayı Temizle
                          </button>
                        )}
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.length === 0 ? (
              <div className="card py-20 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4', color: '#059669' }}>
                  <Icon name="check" className="w-7 h-7" strokeWidth={1.8} />
                </div>
                <p className="text-sm font-medium text-navy">Onay bekleyen başvuru yok</p>
                <p className="text-xs text-muted mt-1">Tüm başvurular sonuçlandırılmış.</p>
              </div>
            ) : pending.map(u => (
              <div key={u.id} className="card flex items-start gap-5 flex-wrap" style={{ borderLeft: '4px solid #d97706' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)' }}>
                  {getInitials(u.firstName, u.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h3 className="font-display font-semibold text-navy">{u.firstName} {u.lastName}</h3>
                    <span className="badge text-xs inline-flex items-center gap-1" style={{ background: '#fffbeb', color: '#92651a', border: '1px solid #fde68a' }}>
                      <Icon name="clock" className="w-3 h-3" />
                      Onay Bekliyor
                    </span>
                  </div>
                  <p className="text-sm text-muted inline-flex items-center gap-1.5">
                    <Icon name="mail" className="w-3.5 h-3.5" />
                    {u.email}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted">
                    {u.title && <span className="inline-flex items-center gap-1"><Icon name="graduation" className="w-3 h-3" />{u.title}</span>}
                    {u.faculty && <span className="inline-flex items-center gap-1"><Icon name="building" className="w-3 h-3" />{u.faculty}</span>}
                    {u.department && <span className="inline-flex items-center gap-1"><Icon name="book" className="w-3 h-3" />{u.department}</span>}
                    <span className="inline-flex items-center gap-1"><Icon name="calendar" className="w-3 h-3" />{formatDate(u.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openApprove(u)} className="btn-primary text-sm px-4 inline-flex items-center gap-1.5">
                    <Icon name="check" className="w-4 h-4" />
                    Onayla
                  </button>
                  <button onClick={() => handleReject(u)} className="btn-danger text-sm px-4 inline-flex items-center gap-1.5">
                    <Icon name="x" className="w-4 h-4" />
                    Reddet
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
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10" style={{ borderColor: '#e8e4dc' }}>
              <h3 className="font-display text-base font-semibold text-navy inline-flex items-center gap-2">
                <Icon name={editUser ? 'edit' : 'plus'} className="w-4 h-4 text-navy" />
                {editUser ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'}
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

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Ad *</label><input required className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} /></div>
                <div><label className="label">Soyad *</label><input required className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} /></div>
              </div>
              <div>
                <label className="label">E-posta *</label>
                <input required type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="label">
                  {editUser ? 'Şifre (değiştirmek için doldurun)' : 'Şifre *'}
                  <span className="text-xs text-muted font-normal ml-1">(min 8 karakter)</span>
                </label>
                <input type="password" required={!editUser} minLength={editUser ? 0 : 8} className="input"
                  value={form.password} onChange={e => set('password', e.target.value)}
                  placeholder={editUser ? 'Boş bırakırsanız değişmez' : ''} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Unvan</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Prof. Dr." /></div>
                <div><label className="label">Telefon</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Fakülte</label><input className="input" value={form.faculty} onChange={e => set('faculty', e.target.value)} /></div>
                <div><label className="label">Bölüm</label><input className="input" value={form.department} onChange={e => set('department', e.target.value)} /></div>
              </div>
              <div>
                <label className="label">Rol *</label>
                <select required className="input" value={form.roleId} onChange={e => set('roleId', e.target.value)}>
                  <option value="">Rol seçin</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <details className="border-t pt-3" style={{ borderColor: '#f0ede8' }}>
                <summary className="text-xs font-semibold text-muted cursor-pointer inline-flex items-center gap-1">
                  <Icon name="graduation" className="w-3.5 h-3.5" />
                  Akademik Profil (isteğe bağlı)
                </summary>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div><label className="label">ORCID ID</label><input className="input" placeholder="0000-0000-0000-0000" value={form.orcidId} onChange={e => set('orcidId', e.target.value)} /></div>
                  <div><label className="label">Google Scholar ID</label><input className="input" placeholder="kullanici_id" value={form.googleScholarId} onChange={e => set('googleScholarId', e.target.value)} /></div>
                  <div className="col-span-2"><label className="label">Uzmanlık Alanı</label><input className="input" placeholder="Makine öğrenmesi, IoT..." value={form.expertiseArea} onChange={e => set('expertiseArea', e.target.value)} /></div>
                </div>
              </details>

              <div className="flex gap-3 pt-2 border-t" style={{ borderColor: '#f0ede8' }}>
                <button type="submit" disabled={saving} className="btn-primary flex-1 inline-flex items-center justify-center gap-1.5">
                  {saving ? <><span className="spinner w-4 h-4" /> Kaydediliyor...</> : (editUser ? 'Güncelle' : 'Oluştur')}
                </button>
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
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: '#e8e4dc' }}>
              <h3 className="font-display text-base font-semibold text-navy inline-flex items-center gap-2">
                <Icon name="shield" className="w-4 h-4 text-green-600" />
                Başvuruyu Onayla
              </h3>
              <button onClick={() => setApproveModal(null)} aria-label="Kapat"
                className="p-1.5 rounded-lg text-muted hover:bg-slate-100 hover:text-navy">
                <Icon name="x" className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}>
                  {getInitials(approveModal.firstName, approveModal.lastName)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-navy text-sm truncate">{approveModal.firstName} {approveModal.lastName}</p>
                  <p className="text-xs text-muted truncate">{approveModal.email}</p>
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
            <div className="p-5 pt-0 flex gap-3">
              <button onClick={handleApprove} disabled={approveSaving || !approveRoleId}
                className="btn-primary flex-1 inline-flex items-center justify-center gap-1.5">
                {approveSaving ? <><span className="spinner w-4 h-4" />Onaylanıyor...</> : <><Icon name="check" className="w-4 h-4" />Onayla ve Aktifleştir</>}
              </button>
              <button onClick={() => setApproveModal(null)} className="btn-secondary flex-1">İptal</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
