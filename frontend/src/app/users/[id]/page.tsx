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

const MEMBER_ROLE_STYLES: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  researcher:  { color: '#1a3a6b', bg: '#eff6ff', icon: '🔬', label: 'Araştırmacı' },
  scholarship: { color: '#7c3aed', bg: '#f5f3ff', icon: '🎓', label: 'Bursiyer' },
  advisor:     { color: '#92651a', bg: '#fffbeb', icon: '🧭', label: 'Danışman' },
  coordinator: { color: '#059669', bg: '#f0fdf4', icon: '📋', label: 'Koordinatör' },
  assistant:   { color: '#dc2626', bg: '#fef2f2', icon: '🤝', label: 'Asistan' },
};

interface MemberProject extends Project { memberRole: string; }

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<{ owned: Project[]; member: MemberProject[] }>({ owned: [], member: [] });
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role?.name === 'Süper Admin';
  const isMe = currentUser?.id === id;

  const handleAvatarUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { alert("Dosya 2MB'dan küçük olmalı"); return; }
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        await usersApi.updateAvatar(base64);
        setUser(u => u ? { ...u, avatar: base64 } : u);
      } catch { alert('Yükleme başarısız'); }
      finally { setAvatarUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    Promise.all([
      usersApi.getOne(id).then(r => setUser(r.data)),
      usersApi.getUserProjects(id).then(r => setProjects(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <DashboardLayout><Header title="Profil" /><div className="flex-1 flex items-center justify-center"><div className="spinner" /></div></DashboardLayout>;
  if (!user) return <DashboardLayout><Header title="Bulunamadı" /><div className="empty-state"><p>Kullanıcı bulunamadı.</p></div></DashboardLayout>;

  const roleStyle = ROLE_COLORS[user.role?.name || ''] || { bg: '#f0ede8', text: '#6b7280', border: '#e8e4dc' };
  const allProjects = [...projects.owned, ...projects.member];
  const activeCount = allProjects.filter(p => p.status === 'active').length;
  const completedCount = allProjects.filter(p => p.status === 'completed').length;

  // Group member projects by role
  const byRole: Record<string, MemberProject[]> = {};
  projects.member.forEach(p => {
    const role = p.memberRole || 'researcher';
    if (!byRole[role]) byRole[role] = [];
    byRole[role].push(p);
  });

  const roleOrder = ['researcher', 'scholarship', 'advisor', 'coordinator', 'assistant'];

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
      {/* SDG badges */}
      {(p as any).sdgGoals?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {(p as any).sdgGoals.slice(0, 4).map((code: string) => {
            const g = SDG_MAP[code];
            if (!g) return null;
            return (
              <span key={code} className="text-white text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: g.color, fontSize: 10 }}>{g.emoji} {g.code}</span>
            );
          })}
          {(p as any).sdgGoals.length > 4 && (
            <span className="text-xs text-muted">+{(p as any).sdgGoals.length - 4}</span>
          )}
        </div>
      )}
    </Link>
  );

  return (
    <DashboardLayout>
      <Header title="Kullanıcı Profili" actions={isAdmin ? <Link href="/users" className="btn-secondary">← Kullanıcılar</Link> : undefined} />
      <div className="p-8 space-y-6 max-w-5xl">
        {/* Profile card */}
        <div className="card">
          <div className="flex items-start gap-6">
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
                <label className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer shadow-md"
                  style={{ background: '#0f2444' }}>
                  {avatarUploading
                    ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
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
              <p className="text-sm text-muted mt-1">{user.email}</p>
              {user.phone && <p className="text-sm text-muted mt-0.5">📞 {user.phone}</p>}
              {(user.faculty || user.department) && (
                <p className="text-sm text-muted mt-1">🏛 {user.faculty}{user.faculty && user.department && ' › '}{user.department}</p>
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

        {/* ── Yürütücü Projeleri ── */}
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

        {/* ── Rol Bazlı Üyelik Kartları ── */}
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
                  {/* Role card */}
                  <div className="rounded-2xl p-5 mb-3" style={{ background: rs.bg, border: `1px solid ${rs.color}22` }}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{rs.icon}</span>
                      <div>
                        <p className="font-bold text-sm" style={{ color: rs.color }}>{rs.label} Rolü</p>
                        <p className="text-xs text-muted">{roleProjects.length} projede {rs.label.toLowerCase()} olarak görev yapıyor</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {roleProjects.map(p => <ProjectMiniCard key={p.id} p={p} memberRole={p.memberRole} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {allProjects.length === 0 && (
          <div className="empty-state"><p className="text-sm">Bu kullanıcının henüz projesi yok</p></div>
        )}
      </div>
    </DashboardLayout>
  );
}
