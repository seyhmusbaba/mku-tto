'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { User, Project } from '@/types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, SDG_MAP, getProjectTypeLabel, formatDate, formatCurrency, getInitials, ROLE_COLORS, MEMBER_ROLE_LABELS } from '@/lib/utils';
import toast from 'react-hot-toast';

const MEMBER_ROLE_STYLES: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  researcher:  { color: '#1a3a6b', bg: '#eff6ff', icon: '🔬', label: 'Araştırmacı' },
  scholarship: { color: '#7c3aed', bg: '#f5f3ff', icon: '🎓', label: 'Bursiyer' },
  advisor:     { color: '#92651a', bg: '#fffbeb', icon: '🧭', label: 'Danışman' },
  coordinator: { color: '#059669', bg: '#f0fdf4', icon: '📋', label: 'Koordinatör' },
  assistant:   { color: '#dc2626', bg: '#fef2f2', icon: '🤝', label: 'Asistan' },
};

interface MemberProject extends Project { memberRole: string; }

const TITLES = ['Prof. Dr.', 'Doç. Dr.', 'Dr. Öğr. Üyesi', 'Arş. Gör. Dr.', 'Arş. Gör.', 'Öğr. Gör.', 'Dr.'];

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<{ owned: Project[]; member: MemberProject[] }>({ owned: [], member: [] });
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role?.name === 'Süper Admin';
  const isMe = currentUser?.id === id;
  const canEdit = isMe || isAdmin;

  useEffect(() => {
    Promise.all([
      usersApi.getOne(id).then(r => { setUser(r.data); setEditForm(r.data); }),
      usersApi.getUserProjects(id).then(r => setProjects(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  const handleAvatarUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { alert("Dosya 2MB'dan küçük olmalı"); return; }
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        await usersApi.updateAvatar(base64);
        setUser(u => u ? { ...u, avatar: base64 } : u);
        toast.success('Profil fotoğrafı güncellendi');
      } catch { toast.error('Yükleme başarısız'); }
      finally { setAvatarUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        phone: editForm.phone,
        title: editForm.title,
        faculty: editForm.faculty,
        department: editForm.department,
        orcidId: editForm.orcidId,
        googleScholarId: editForm.googleScholarId,
        researchGateUrl: editForm.researchGateUrl,
        expertiseArea: editForm.expertiseArea,
        bio: editForm.bio,
      };
      if (isAdmin) {
        payload.firstName = editForm.firstName;
        payload.lastName = editForm.lastName;
        payload.email = editForm.email;
      }
      await usersApi.update(id, payload);
      const r = await usersApi.getOne(id);
      setUser(r.data);
      setEditMode(false);
      toast.success('Profil güncellendi');
    } catch { toast.error('Güncelleme başarısız'); }
    finally { setSaving(false); }
  };

  if (loading) return <DashboardLayout><Header title="Profil" /><div className="flex-1 flex items-center justify-center"><div className="spinner" /></div></DashboardLayout>;
  if (!user) return <DashboardLayout><Header title="Bulunamadı" /><div className="empty-state"><p>Kullanıcı bulunamadı.</p></div></DashboardLayout>;

  const roleStyle = ROLE_COLORS[user.role?.name || ''] || { bg: '#f0ede8', text: '#6b7280', border: '#e8e4dc' };
  const allProjects = [...projects.owned, ...projects.member];
  const activeCount = allProjects.filter(p => p.status === 'active').length;
  const completedCount = allProjects.filter(p => p.status === 'completed').length;

  const byRole: Record<string, MemberProject[]> = {};
  projects.member.forEach(p => {
    const role = p.memberRole || 'researcher';
    if (!byRole[role]) byRole[role] = [];
    byRole[role].push(p);
  });
  const roleOrder = ['researcher', 'scholarship', 'advisor', 'coordinator', 'assistant'];

  const set = (k: string, v: any) => setEditForm((f: any) => ({ ...f, [k]: v }));

  const ProjectMiniCard = ({ p, memberRole }: { p: Project | MemberProject; memberRole?: string }) => (
    <Link href={`/projects/${p.id}`}
      className="block p-4 rounded-xl border transition-all hover:shadow-sm hover:border-blue-200"
      style={{ borderColor: '#e8e4dc', background: 'white' }}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-navy text-sm leading-tight line-clamp-2 flex-1">{p.title}</p>
        <span className={`badge text-xs flex-shrink-0 ${PROJECT_STATUS_COLORS[p.status] || 'badge-gray'}`}>
          {PROJECT_STATUS_LABELS[p.status] || p.status}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-muted flex-wrap">
        <span>{getProjectTypeLabel(p.type)}</span>
        {(p as any).budget && <span>· {formatCurrency((p as any).budget)}</span>}
        {memberRole && <span>· {MEMBER_ROLE_LABELS[memberRole] || memberRole}</span>}
      </div>
    </Link>
  );

  return (
    <DashboardLayout>
      <Header title="Kullanıcı Profili"
        actions={
          <div className="flex gap-2">
            {canEdit && !editMode && (
              <button onClick={() => setEditMode(true)} className="btn-secondary text-sm">✏️ Düzenle</button>
            )}
            {isAdmin && <Link href="/users" className="btn-ghost text-sm">← Kullanıcılar</Link>}
          </div>
        }
      />
      <div className="p-6 space-y-6 max-w-5xl overflow-y-auto">

        {/* ── DÜZENLEME FORMU ── */}
        {editMode ? (
          <div className="card p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: '#e8e4dc' }}>
              <h2 className="font-display text-lg font-semibold text-navy">Profili Düzenle</h2>
              <button onClick={() => setEditMode(false)} className="text-muted hover:text-navy text-sm">✕ İptal</button>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${roleStyle.text}, ${roleStyle.text}bb)` }}>
                    {getInitials(user.firstName, user.lastName)}
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
                  style={{ background: '#0f2444' }}>
                  {avatarUploading ? <span className="spinner w-3 h-3" /> : <span className="text-white text-xs">📷</span>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
                </label>
              </div>
              <div>
                <p className="text-sm font-semibold text-navy">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-muted">Fotoğrafı değiştirmek için tıkla</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {isAdmin && (<>
                <div><label className="label">Ad</label><input className="input" value={editForm.firstName||''} onChange={e => set('firstName', e.target.value)} /></div>
                <div><label className="label">Soyad</label><input className="input" value={editForm.lastName||''} onChange={e => set('lastName', e.target.value)} /></div>
                <div className="col-span-2"><label className="label">E-posta</label><input type="email" className="input" value={editForm.email||''} onChange={e => set('email', e.target.value)} /></div>
              </>)}
              <div>
                <label className="label">Unvan</label>
                <select className="input" value={editForm.title||''} onChange={e => set('title', e.target.value)}>
                  <option value="">Seçiniz</option>
                  {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="label">Telefon</label><input className="input" placeholder="0555 000 00 00" value={editForm.phone||''} onChange={e => set('phone', e.target.value)} /></div>
              <div><label className="label">Fakülte</label><input className="input" value={editForm.faculty||''} onChange={e => set('faculty', e.target.value)} /></div>
              <div><label className="label">Bölüm / Departman</label><input className="input" value={editForm.department||''} onChange={e => set('department', e.target.value)} /></div>
            </div>

            <div className="border-t pt-4" style={{ borderColor: '#f0ede8' }}>
              <p className="text-xs font-semibold text-muted mb-3">🔬 Akademik Profil</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label flex items-center gap-1">
                    <span className="w-4 h-4 rounded text-white text-[9px] font-bold flex items-center justify-center" style={{ background: '#a6ce39' }}>iD</span>
                    ORCID ID
                  </label>
                  <input className="input" placeholder="0000-0000-0000-0000" value={editForm.orcidId||''} onChange={e => set('orcidId', e.target.value)} />
                </div>
                <div>
                  <label className="label flex items-center gap-1">🎓 Google Scholar ID</label>
                  <input className="input" placeholder="Profil URL'sindeki ID" value={editForm.googleScholarId||''} onChange={e => set('googleScholarId', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">ResearchGate URL</label>
                  <input className="input" placeholder="https://www.researchgate.net/profile/..." value={editForm.researchGateUrl||''} onChange={e => set('researchGateUrl', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Uzmanlık Alanı</label>
                  <input className="input" placeholder="Makine öğrenmesi, IoT, Biyomedikal..." value={editForm.expertiseArea||''} onChange={e => set('expertiseArea', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Kısa Biyografi</label>
                  <textarea className="input" rows={3} placeholder="Araştırma ilgi alanlarınız, akademik geçmişiniz..." value={editForm.bio||''} onChange={e => set('bio', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t" style={{ borderColor: '#e8e4dc' }}>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button onClick={() => setEditMode(false)} className="btn-secondary">İptal</button>
            </div>
          </div>
        ) : (
          <>
            {/* Profile card */}
            <div className="card p-6">
              <div className="flex items-start gap-6 flex-wrap">
                <div className="relative flex-shrink-0">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.firstName} className="w-20 h-20 rounded-2xl object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${roleStyle.text}, ${roleStyle.text}bb)` }}>
                      {getInitials(user.firstName, user.lastName)}
                    </div>
                  )}
                  {isMe && (
                    <label className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer shadow-md" style={{ background: '#0f2444' }}>
                      {avatarUploading ? <span className="spinner w-3 h-3 border-white" /> : <span className="text-white text-xs">📷</span>}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
                    </label>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="font-display text-2xl font-bold text-navy">{user.title} {user.firstName} {user.lastName}</h2>
                    <span className="badge text-xs font-semibold" style={{ background: roleStyle.bg, color: roleStyle.text, border: `1px solid ${roleStyle.border}` }}>
                      {user.role?.name}
                    </span>
                    {isMe && <span className="badge badge-green text-xs">Sen</span>}
                  </div>
                  <p className="text-sm text-muted mt-1">✉️ {user.email}</p>
                  {user.phone && <p className="text-sm text-muted mt-0.5">📞 {user.phone}</p>}
                  {(user.faculty || user.department) && (
                    <p className="text-sm text-muted mt-1">🏛 {user.faculty}{user.faculty && user.department && ' › '}{user.department}</p>
                  )}
                  {(user as any).expertiseArea && (
                    <p className="text-sm text-muted mt-1">🔬 {(user as any).expertiseArea}</p>
                  )}
                  {(user as any).bio && (
                    <p className="text-sm text-navy mt-2 leading-relaxed">{(user as any).bio}</p>
                  )}

                  {/* Akademik profil linkleri */}
                  {((user as any).orcidId || (user as any).googleScholarId || (user as any).researchGateUrl) && (
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      {(user as any).orcidId && (
                        <a href={`https://orcid.org/${(user as any).orcidId}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
                          style={{ background: '#a6ce3920', border: '1px solid #a6ce39' }}>
                          <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAQABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAwb/xAAkEAABAwQCAgIDAAAAAAAAAAABAgMEBQYHERIhABMiMUFhkf/EABUBAQEAAAAAAAAAAAAAAAAAAAQH/8QAHhEAAgAGAwAAAAAAAAAAAAAAAREAEyExQVECA2H/2gAMAwEAAhEDEQA/AKvCuL6ValoIjQ6dDXWXHYrUqouKPs9jiiCBoH4b61saA32ST4WYcXUa9LRedIgSJvEpiT2ElLjLvElKVFSUqKTr6PWt/kAhcIZWo102yw4w6yqqh2M9Mhl0IcbcZUVK0nXaVH6UOgP3sA8v5NtyxbMkR2CluoLHONFckB1950JIQSAkcUDkSTr+nQ8mpnHv41M+ru2ysIjbxbUGq/Y//9k=" alt="ORCID" className="w-4 h-4 object-contain flex-shrink-0" />
                          <span style={{ color: '#5a8a00' }}>ORCID</span>
                        </a>
                      )}
                      {(user as any).googleScholarId && (
                        <a href={`https://scholar.google.com/citations?user=${(user as any).googleScholarId}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
                          style={{ background: '#4285f420', border: '1px solid #4285f4' }}>
                          <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAcABwDASIAAhEBAxEB/8QAGQAAAwADAAAAAAAAAAAAAAAABQcIBAYJ/8QALBAAAQMCBQMCBgMAAAAAAAAAAQIDBAURAAYHEiETMUEUUQgiUmFxkUJUYv/EABcBAAMBAAAAAAAAAAAAAAAAAAMEBQb/xAAlEQABAgUDBAMAAAAAAAAAAAABAgQAAwURQRITIRQxsfFRYXH/2gAMAwEAAhEDEQA/AI/olKqNaqbNNpUR2XLeNkNoHtyST2CQLkqNgACSQBh55Z0volCoLy62wxVqi8gJdJJ6TIJFw3ax3f7/AEPJMaQx8ptZXQ9lVfVccbQKg47b1Ic4JSseEbh8tvlNgbk3sw15bkS4KkOvpYUuxts3W5B55GNrR6I3EkOJ5CiRwMD9+/EZ5/UZu5tSxa3c59eYl3UDIEmhh2p0nqzaQLFZIu7GubDqAfxuQN44uQDYkA6Nis6rR51KmIYcSlwOghtSRdLgtZQIP2PIPg+2EPn+PkJnMTiKc/MSNgMhEFKVsIdudyUKURcdu1xe9iRbEasUxDQhctXBxn1FBi8VPGlQ5GYxtFKw3RdUaBKkylR4bkxtiUrftR01nad/gpFwT+PfF7+gh/10frHNbDRynrtqJl6jt0pipRpkdlG1n1kcOLbHgBXBIHgEnC9Of9NdJvY/EFdNd6xHeHp8XVQh0bTBEWO6I82oTEMtpbVtWpsAqc++zhINvqSOxxHWDuds3ZhzlWDVcxVFcyRbajgJQ2n6UpFgkfgYBYVeOS5mlcGbytpGmP/Z" alt="Google Scholar" className="w-4 h-4 object-contain flex-shrink-0" />
                          <span style={{ color: '#1a56c4' }}>Google Scholar</span>
                        </a>
                      )}
                      {(user as any).researchGateUrl && (
                        <a href={(user as any).researchGateUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
                          style={{ background: '#00ccbb20', border: '1px solid #00ccbb' }}>
                          <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAcABwDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAABgcCAwQI/8QAKBAAAgIBAwQBAwUAAAAAAAAAAQIDBAUABhEHEiExCBMUQRYiUWGR/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AOyYY44YUhhjSONFCoiDhVA8AAD0NS0rflXFInQzcmVqXb9G/jqv3FWxTuSV5I3Dr+UYcgjxweR50OdWsZ+hqe1MzsvM5yruK3mKVSLHSZezaiycbuBNE8MzuvAQsxkADLxz3DxoDht6Z+zui/XxuFxLYXGZWPGWp7eTMFmVzHG8kkSGMoyoJV8FwW7X444XuML2JxV+YTXsZStSBe0PNArsB745I9eT/ul/uPpfby2WyEIzdBdvZTKw5W3Vnxf1rccyCIMsE5kCxq4hXkmNmHc/BHI7WboFT8t71Kn8et3JbtwQNPS+lCsjhTI5deFUH2f6GgrM4rbvSvdeF6xbRxNCztC1QTHbgXHV0l+xjPDR3Ye0EhQT2yKp8qQe0nyHzimiy+Dx169WrySTVo5iDGCqsyAnjnnj3rdDXrwRGKGCKOMkkqiAA8+/A0FGIyWOzGNgyWJv1b9KdQ8NitKskci/yGUkEa16qq169WEQ1oIoIwSQkaBVBPvwNAnUfeuV23nIaNGvSkjesspMyMW5LMPww8ftGg//2Q==" alt="ResearchGate" className="w-4 h-4 object-contain flex-shrink-0" />
                          <span style={{ color: '#008a7e' }}>ResearchGate</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted flex-shrink-0">Kayıt: {formatDate(user.createdAt)}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                { label: 'Toplam Proje', value: allProjects.length, color: '#1a3a6b' },
                { label: 'Yürütücü', value: projects.owned.length, color: '#c8a45a' },
                { label: 'Aktif', value: activeCount, color: '#059669' },
                { label: 'Tamamlanan', value: completedCount, color: '#2563eb' },
              ].map(s => (
                <div key={s.label} className="card py-4 text-center">
                  <p className="font-display text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs text-muted mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Yürütücü Projeleri */}
            {projects.owned.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-navy mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#c8a45a' }} />
                  🎓 Yürütücü Olduğu Projeler
                  <span className="badge badge-yellow text-xs">{projects.owned.length}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {projects.owned.map(p => <ProjectMiniCard key={p.id} p={p} />)}
                </div>
              </div>
            )}

            {/* Rol Bazlı Üyelik */}
            {projects.member.length > 0 && (
              <div className="space-y-5">
                {roleOrder.filter(role => byRole[role]?.length > 0).map(role => {
                  const rs = MEMBER_ROLE_STYLES[role] || { color: '#6b7280', bg: '#f9fafb', icon: '👤', label: role };
                  const roleProjects = byRole[role];
                  return (
                    <div key={role}>
                      <h3 className="font-display font-semibold text-navy mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: rs.bg, border: `1px solid ${rs.color}22` }}>
                          {rs.icon}
                        </span>
                        <span style={{ color: rs.color }}>{rs.label}</span>
                        <span style={{ fontWeight: 400, color: '#9ca3af' }}>Olduğu Projeler</span>
                        <span className="badge text-xs font-semibold text-white" style={{ background: rs.color }}>{roleProjects.length}</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {roleProjects.map(p => <ProjectMiniCard key={p.id} p={p} memberRole={p.memberRole} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {allProjects.length === 0 && (
              <div className="empty-state py-12">
                <div className="empty-state-icon">📂</div>
                <p className="text-sm font-medium text-navy">Henüz proje yok</p>
                <p className="text-xs text-muted mt-1">Bu kullanıcı henüz hiçbir projeye dahil olmamış.</p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
