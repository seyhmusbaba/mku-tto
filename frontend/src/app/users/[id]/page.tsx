'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { User, Project } from '@/types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, getProjectTypeLabel, formatDate, formatCurrency, getInitials, ROLE_COLORS, MEMBER_ROLE_LABELS } from '@/lib/utils';
import toast from 'react-hot-toast';
import { OrcidPublications } from '@/components/OrcidPublications';
import { ScopusProfileCard } from '@/components/ScopusProfileCard';

const TITLES = ['Prof. Dr.', 'Doç. Dr.', 'Dr. Öğr. Üyesi', 'Arş. Gör. Dr.', 'Arş. Gör.', 'Öğr. Gör.', 'Dr.'];

interface MemberProject extends Project { memberRole: string; }

export default function UserProfilePage() {
  const { id }           = useParams<{ id: string }>();
  const { user: me }     = useAuth();
  const [user, setUser]  = useState<User | null>(null);
  const [projects, setProjects] = useState<{ owned: Project[]; member: MemberProject[] }>({ owned: [], member: [] });
  const [loading, setLoading]   = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [editForm, setEditForm] = useState<any>({});

  const isAdmin = me?.role?.name === 'Süper Admin';
  const isMe    = me?.id === id;
  const canEdit = isMe || isAdmin;

  const set = (k: string, v: any) => setEditForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    Promise.all([
      usersApi.getOne(id).then(r => { setUser(r.data); setEditForm(r.data); }),
      usersApi.getUserProjects(id).then(r => setProjects(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
    if (me?.id === id || isAdmin) {
      api.get(`/users/${id}/visitors`).then(r => setVisitors(r.data || [])).catch(() => {});
    }
  }, [id]);

  const handleAvatarUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error("Dosya 2MB'dan küçük olmalı"); return; }
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        await usersApi.updateAvatar(base64);
        setUser(u => u ? { ...u, avatar: base64 } : u);
        toast.success('Fotoğraf güncellendi');
      } catch { toast.error('Yükleme başarısız'); }
      finally { setAvatarUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        phone: editForm.phone, title: editForm.title,
        faculty: editForm.faculty, department: editForm.department,
        orcidId: editForm.orcidId, googleScholarId: editForm.googleScholarId,
        researchGateUrl: editForm.researchGateUrl,
        expertiseArea: editForm.expertiseArea, bio: editForm.bio,
        scopusAuthorId: editForm.scopusAuthorId,
      };
      if (isAdmin) { payload.firstName = editForm.firstName; payload.lastName = editForm.lastName; payload.email = editForm.email; }
      await usersApi.update(id, payload);
      const r = await usersApi.getOne(id);
      setUser(r.data); setEditMode(false);
      toast.success('Profil güncellendi');
    } catch { toast.error('Güncelleme başarısız'); }
    finally { setSaving(false); }
  };

  if (loading) return <DashboardLayout><Header title="Profil" /><div className="flex-1 flex items-center justify-center"><div className="spinner" /></div></DashboardLayout>;
  if (!user)  return <DashboardLayout><Header title="Bulunamadı" /><div className="empty-state"><p>Kullanıcı bulunamadı.</p></div></DashboardLayout>;

  const roleStyle  = ROLE_COLORS[user.role?.name || ''] || { bg: '#f0ede8', text: '#6b7280', border: '#e8e4dc' };
  const allProjects = [...projects.owned, ...projects.member];
  const activeCount    = allProjects.filter(p => p.status === 'active').length;
  const completedCount = allProjects.filter(p => p.status === 'completed').length;

  const ProjectCard = ({ p, memberRole }: { p: any; memberRole?: string }) => (
    <Link href={`/projects/${p.id}`}
      className="block p-4 rounded-xl border transition-all hover:shadow-sm hover:-translate-y-0.5"
      style={{ borderColor: '#e8e4dc', background: 'white' }}>
      <div className="flex items-start gap-2">
        <p className="font-semibold text-navy text-sm leading-tight flex-1 line-clamp-2">{p.title}</p>
        <span className={`badge text-xs flex-shrink-0 ${PROJECT_STATUS_COLORS[p.status] || 'badge-gray'}`}>
          {PROJECT_STATUS_LABELS[p.status] || p.status}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-muted flex-wrap">
        <span>{getProjectTypeLabel(p.type)}</span>
        {p.budget && <><span>·</span><span>{formatCurrency(p.budget)}</span></>}
        {memberRole && <><span>·</span><span>{MEMBER_ROLE_LABELS[memberRole] || memberRole}</span></>}
      </div>
    </Link>
  );

  /* ────────────────────────────────────────────────────────────── */
  return (
    <DashboardLayout>
      <Header title={`${user.firstName} ${user.lastName}`}
        actions={
          <div className="flex gap-2">
            {canEdit && !editMode && <button onClick={() => setEditMode(true)} className="btn-secondary text-sm">✏️ Düzenle</button>}
            {isAdmin && <Link href="/users" className="btn-ghost text-sm">← Kullanıcılar</Link>}
          </div>
        }
      />

      <div className="p-6 max-w-6xl mx-auto">
        {editMode ? (
          /* ── DÜZENLEME MODU ────────────────────────────────────── */
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Sol: Kimlik */}
            <div className="card p-5 space-y-4">
              <h3 className="font-display text-sm font-semibold text-navy border-b pb-3" style={{ borderColor: '#f0ede8' }}>
                👤 Kimlik
              </h3>
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  {user.avatar
                    ? <img src={user.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                    : <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
                        style={{ background: `linear-gradient(135deg,${roleStyle.text},${roleStyle.text}bb)` }}>
                        {getInitials(user.firstName, user.lastName)}
                      </div>}
                  <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer shadow" style={{ background: '#0f2444' }}>
                    {avatarUploading ? <span className="spinner w-3 h-3" /> : <span className="text-white text-xs">📷</span>}
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
                  </label>
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-muted">{user.email}</p>
                </div>
              </div>
              {isAdmin && (
                <>
                  <div><label className="label">Ad</label><input className="input" value={editForm.firstName||''} onChange={e => set('firstName', e.target.value)} /></div>
                  <div><label className="label">Soyad</label><input className="input" value={editForm.lastName||''} onChange={e => set('lastName', e.target.value)} /></div>
                  <div><label className="label">E-posta</label><input className="input" value={editForm.email||''} onChange={e => set('email', e.target.value)} /></div>
                </>
              )}
              <div>
                <label className="label">Unvan</label>
                <select className="input" value={editForm.title||''} onChange={e => set('title', e.target.value)}>
                  <option value="">Seçiniz</option>
                  {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="label">Telefon</label><input className="input" placeholder="0555 000 00 00" value={editForm.phone||''} onChange={e => set('phone', e.target.value)} /></div>
              <div><label className="label">Fakülte</label><input className="input" value={editForm.faculty||''} onChange={e => set('faculty', e.target.value)} /></div>
              <div><label className="label">Bölüm</label><input className="input" value={editForm.department||''} onChange={e => set('department', e.target.value)} /></div>
            </div>

            {/* Orta: Akademik */}
            <div className="card p-5 space-y-4">
              <h3 className="font-display text-sm font-semibold text-navy border-b pb-3" style={{ borderColor: '#f0ede8' }}>
                🎓 Akademik Profil
              </h3>
              <div>
                <label className="label flex items-center gap-1">
                  <span className="w-4 h-4 rounded text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0" style={{ background: '#a6ce39' }}>iD</span>
                  ORCID ID
                </label>
                <input className="input font-mono text-sm" placeholder="0000-0000-0000-0000" value={editForm.orcidId||''} onChange={e => set('orcidId', e.target.value)} />
              </div>
              <div>
                <label className="label">🎓 Google Scholar ID</label>
                <input className="input" placeholder="Profil URL'sindeki ID" value={editForm.googleScholarId||''} onChange={e => set('googleScholarId', e.target.value)} />
              </div>
              <div>
                <label className="label flex items-center gap-1">
                  <span className="w-4 h-4 rounded text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0" style={{ background: '#e07a2b' }}>SC</span>
                  Scopus Author ID
                </label>
                <input className="input font-mono text-sm" placeholder="57XXXXXXXXX" value={editForm.scopusAuthorId||''} onChange={e => set('scopusAuthorId', e.target.value)} />
                <p className="text-xs text-muted mt-1">scopus.com/authid/… URL'sindeki sayı</p>
              </div>
              <div>
                <label className="label">ResearchGate URL</label>
                <input className="input" placeholder="https://www.researchgate.net/profile/..." value={editForm.researchGateUrl||''} onChange={e => set('researchGateUrl', e.target.value)} />
              </div>
              <div>
                <label className="label">Uzmanlık Alanı</label>
                <input className="input" placeholder="Makine öğrenmesi, IoT, Biyomedikal..." value={editForm.expertiseArea||''} onChange={e => set('expertiseArea', e.target.value)} />
              </div>
            </div>

            {/* Sağ: Biyografi + Kaydet */}
            <div className="card p-5 space-y-4">
              <h3 className="font-display text-sm font-semibold text-navy border-b pb-3" style={{ borderColor: '#f0ede8' }}>
                📝 Hakkında
              </h3>
              <div>
                <label className="label">Kısa Biyografi</label>
                <textarea className="input" rows={8} placeholder="Araştırma ilgi alanlarınız, akademik geçmişiniz, projeleriniz..." value={editForm.bio||''} onChange={e => set('bio', e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? <><span className="spinner w-4 h-4 mr-2" />Kaydediliyor...</> : '✓ Kaydet'}
                </button>
                <button onClick={() => setEditMode(false)} className="btn-secondary">İptal</button>
              </div>
            </div>
          </div>
        ) : (
          /* ── GÖRÜNTÜLEME MODU ──────────────────────────────────── */
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* SOL KOL */}
            <div className="space-y-4">
              {/* Profil Kartı */}
              <div className="card p-5">
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-3">
                    {user.avatar
                      ? <img src={user.avatar} alt={user.firstName} className="w-24 h-24 rounded-2xl object-cover" />
                      : <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold text-white"
                          style={{ background: `linear-gradient(135deg,${roleStyle.text},${roleStyle.text}bb)` }}>
                          {getInitials(user.firstName, user.lastName)}
                        </div>}
                    {isMe && (
                      <label className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shadow-md" style={{ background: '#0f2444' }}>
                        {avatarUploading ? <span className="spinner w-3.5 h-3.5" /> : <span className="text-white text-sm">📷</span>}
                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
                      </label>
                    )}
                  </div>
                  <h2 className="font-display text-xl font-bold text-navy">{user.title && <span className="text-base font-normal text-muted mr-1">{user.title}</span>}{user.firstName} {user.lastName}</h2>
                  <span className="mt-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                    style={{ background: roleStyle.bg, color: roleStyle.text, border: `1px solid ${roleStyle.border}` }}>
                    {user.role?.name}
                  </span>
                  {isMe && <span className="mt-1 badge badge-green text-xs">Benim profilim</span>}
                </div>

                <div className="mt-4 space-y-2 text-sm border-t pt-4" style={{ borderColor: '#f0ede8' }}>
                  <div className="flex items-center gap-2 text-muted"><span>✉️</span><span className="truncate">{user.email}</span></div>
                  {user.phone && <div className="flex items-center gap-2 text-muted"><span>📞</span><span>{user.phone}</span></div>}
                  {(user.faculty || user.department) && (
                    <div className="flex items-start gap-2 text-muted"><span>🏛</span><span>{user.faculty}{user.faculty && user.department ? ' › ' : ''}{user.department}</span></div>
                  )}
                  {(user as any).expertiseArea && (
                    <div className="flex items-start gap-2 text-muted"><span>🔬</span><span>{(user as any).expertiseArea}</span></div>
                  )}
                  <div className="flex items-center gap-2 text-muted text-xs"><span>📅</span><span>Kayıt: {formatDate(user.createdAt)}</span></div>
                </div>

                {/* Akademik profil linkleri */}
                {((user as any).orcidId || (user as any).googleScholarId || (user as any).researchGateUrl || (user as any).scopusAuthorId) && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: '#f0ede8' }}>
                    {(user as any).orcidId && (
                      <a href={`https://orcid.org/${(user as any).orcidId}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80"
                        style={{ background: '#a6ce3915', color: '#5a8a00', border: '1px solid #a6ce3966' }}>
                        <span className="w-4 h-4 rounded text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0" style={{ background: '#a6ce39' }}>iD</span>
                        ORCID
                      </a>
                    )}
                    {(user as any).googleScholarId && (
                      <a href={`https://scholar.google.com/citations?user=${(user as any).googleScholarId}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80"
                        style={{ background: '#4285f415', color: '#1a56c4', border: '1px solid #4285f466' }}>
                        🎓 Scholar
                      </a>
                    )}
                    {(user as any).scopusAuthorId && (
                      <a href={`https://www.scopus.com/authid/detail.uri?authorId=${(user as any).scopusAuthorId}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80"
                        style={{ background: '#e07a2b15', color: '#c2410c', border: '1px solid #e07a2b66' }}>
                        <span className="w-4 h-4 rounded text-white text-[8px] font-bold flex items-center justify-center" style={{ background: '#e07a2b' }}>SC</span>
                        Scopus
                      </a>
                    )}
                    {(user as any).researchGateUrl && (
                      <a href={(user as any).researchGateUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80"
                        style={{ background: '#00ccbb15', color: '#008a7e', border: '1px solid #00ccbb66' }}>
                        🔬 ResearchGate
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Biyografi */}
              {(user as any).bio && (
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-2">Hakkında</h3>
                  <p className="text-sm text-muted leading-relaxed">{(user as any).bio}</p>
                </div>
              )}

              {/* İstatistikler */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Toplam Proje', value: allProjects.length, color: '#1a3a6b' },
                  { label: 'Yürütücü',     value: projects.owned.length, color: '#c8a45a' },
                  { label: 'Aktif',        value: activeCount,   color: '#059669' },
                  { label: 'Tamamlanan',   value: completedCount, color: '#2563eb' },
                ].map(s => (
                  <div key={s.label} className="card py-4 text-center">
                    <p className="font-display text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-muted mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Ziyaretçiler */}
              {(isMe || isAdmin) && visitors.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-display text-sm font-semibold text-navy mb-3 flex items-center gap-2">
                    👁 Son Ziyaretçiler
                    <span className="text-xs text-muted font-normal">{visitors.length} kişi</span>
                  </h3>
                  <div className="space-y-2">
                    {visitors.slice(0, 6).map((v, i) => {
                      const u = v.visitor; if (!u) return null;
                      const rs = ROLE_COLORS[u.role?.name || ''] || { bg: '#f0ede8', text: '#6b7280', border: '#e8e4dc' };
                      return (
                        <Link key={i} href={`/users/${u.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                          {u.avatar
                            ? <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                            : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: `linear-gradient(135deg,${rs.text},${rs.text}bb)` }}>
                                {getInitials(u.firstName, u.lastName)}
                              </div>}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-navy truncate">{u.firstName} {u.lastName}</p>
                            <p className="text-xs text-muted">{new Date(v.visitedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* SAĞ KOL — 2 sütun */}
            <div className="xl:col-span-2 space-y-6">
              {/* Scopus Metrikleri — en üstte */}
              {(user as any).scopusAuthorId && (
                <ScopusProfileCard user={user} isMe={isMe} />
              )}

              {/* ORCID Yayınları */}
              {(user as any).orcidId && (
                <OrcidPublications orcidId={(user as any).orcidId} />
              )}

              {/* Yürütücü Projeleri */}
              {projects.owned.length > 0 && (
                <div>
                  <h3 className="font-display text-base font-semibold text-navy mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#c8a45a' }} />
                    🎓 Yürütücü Olduğu Projeler
                    <span className="badge badge-yellow text-xs">{projects.owned.length}</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {projects.owned.map(p => <ProjectCard key={p.id} p={p} />)}
                  </div>
                </div>
              )}

              {/* Ekip Üyeliği */}
              {projects.member.length > 0 && (
                <div>
                  <h3 className="font-display text-base font-semibold text-navy mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#1a3a6b' }} />
                    👥 Ekip Üyesi Olduğu Projeler
                    <span className="badge badge-blue text-xs">{projects.member.length}</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {projects.member.map(p => <ProjectCard key={p.id} p={p} memberRole={p.memberRole} />)}
                  </div>
                </div>
              )}

              {allProjects.length === 0 && (
                <div className="empty-state py-16">
                  <div className="empty-state-icon">📂</div>
                  <p className="text-sm font-medium text-navy">Henüz proje yok</p>
                  <p className="text-xs text-muted mt-1">Bu kullanıcı henüz hiçbir projeye dahil olmamış.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
