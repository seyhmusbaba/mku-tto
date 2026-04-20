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

type IconName =
  | 'user' | 'graduation' | 'notebook' | 'camera' | 'mail' | 'phone' | 'building'
  | 'beaker' | 'calendar' | 'eye' | 'folder' | 'check' | 'pencil' | 'arrow-left'
  | 'users' | 'book-open' | 'external-link' | 'tag' | 'sparkles';

const ICON_PATH: Record<IconName, string> = {
  user:         'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  graduation:   'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222',
  notebook:     'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  camera:       'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zm9 8a4 4 0 100-8 4 4 0 000 8z',
  mail:         'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  phone:        'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  building:     'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  beaker:       'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  calendar:     'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  eye:          'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  folder:       'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  check:        'M5 13l4 4L19 7',
  pencil:       'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  'arrow-left': 'M10 19l-7-7m0 0l7-7m-7 7h18',
  users:        'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  'book-open':  'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  'external-link':'M14 5l7 7m0 0l-7 7m7-7H3',
  tag:          'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  sparkles:     'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
};

function Icon({ name, className = 'w-4 h-4', strokeWidth = 2, style }: { name: IconName; className?: string; strokeWidth?: number; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATH[name]} />
    </svg>
  );
}

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
        yoksisAkademikUrl: editForm.yoksisAkademikUrl,
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
      className="block p-4 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5"
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

  const InfoRow = ({ icon, label, value, href }: { icon: IconName; label: string; value: React.ReactNode; href?: string }) => {
    if (value === null || value === undefined || value === '') return null;
    const content = (
      <div className="flex items-start gap-3 py-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: '#f0ede8', color: '#6b7280' }}>
          <Icon name={icon} className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">{label}</p>
          <p className="text-sm text-navy break-words">{value}</p>
        </div>
      </div>
    );
    return href ? <a href={href} className="block hover:bg-slate-50 rounded-lg px-1 -mx-1 transition-colors">{content}</a> : content;
  };

  const SectionTitle = ({ icon, children, badge }: { icon: IconName; children: React.ReactNode; badge?: React.ReactNode }) => (
    <h3 className="font-display text-sm font-semibold text-navy mb-3 flex items-center gap-2">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#0f244412', color: '#0f2444' }}>
        <Icon name={icon} className="w-3.5 h-3.5" />
      </span>
      <span>{children}</span>
      {badge}
    </h3>
  );

  /* ────────────────────────────────────────────────────────────── */
  return (
    <DashboardLayout>
      <Header title={`${user.firstName} ${user.lastName}`}
        actions={
          <div className="flex gap-2">
            {(user as any).orcidId && !editMode && (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const token = localStorage.getItem('tto_token');
                    if (token) sessionStorage.setItem('tto_print_token', token);
                  }
                  window.open(`/users/${id}/scorecard`, '_blank');
                }}
                className="btn-secondary text-sm inline-flex items-center gap-1.5"
                title="Çok kaynaklı bibliyometrik CV — PDF olarak yazdırılabilir"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Akademik Scorecard
              </button>
            )}
            {canEdit && !editMode && (
              <button onClick={() => setEditMode(true)} className="btn-secondary text-sm inline-flex items-center gap-1.5">
                <Icon name="pencil" className="w-3.5 h-3.5" />
                Düzenle
              </button>
            )}
            {isAdmin && (
              <Link href="/users" className="btn-ghost text-sm inline-flex items-center gap-1.5">
                <Icon name="arrow-left" className="w-3.5 h-3.5" />
                Kullanıcılar
              </Link>
            )}
          </div>
        }
      />

      <div className="p-6 max-w-6xl mx-auto">
        {editMode ? (
          /* ── DÜZENLEME MODU ────────────────────────────────────── */
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Sol: Kimlik */}
            <div className="card p-5 space-y-4">
              <SectionTitle icon="user">Kimlik</SectionTitle>
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  {user.avatar
                    ? <img src={user.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                    : <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
                        style={{ background: `linear-gradient(135deg,${roleStyle.text},${roleStyle.text}bb)` }}>
                        {getInitials(user.firstName, user.lastName)}
                      </div>}
                  <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer shadow-md" style={{ background: '#0f2444' }} aria-label="Fotoğraf yükle">
                    {avatarUploading ? <span className="spinner w-3 h-3" /> : <Icon name="camera" className="w-3.5 h-3.5 text-white" />}
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
              <SectionTitle icon="graduation">Akademik Profil</SectionTitle>
              <div>
                <label className="label flex items-center gap-1">
                  <span className="w-4 h-4 rounded text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0" style={{ background: '#a6ce39' }}>iD</span>
                  ORCID ID
                </label>
                <input className="input font-mono text-sm" placeholder="0000-0000-0000-0000" value={editForm.orcidId||''} onChange={e => set('orcidId', e.target.value)} />
              </div>
              <div>
                <label className="label inline-flex items-center gap-1.5">
                  <Icon name="graduation" className="w-3.5 h-3.5 text-blue-600" />
                  Google Scholar ID
                </label>
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
                <label className="label flex items-center gap-1">
                  <span className="w-4 h-4 rounded text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0" style={{ background: '#0b5ed7' }}>YÖK</span>
                  YÖK Akademik Profili
                </label>
                <input className="input" placeholder="https://akademik.yok.gov.tr/AkademikArama/AkademisyenArama?islem=..."
                  value={editForm.yoksisAkademikUrl||''} onChange={e => set('yoksisAkademikUrl', e.target.value)} />
                <p className="text-xs text-muted mt-1">
                  <a href={`https://akademik.yok.gov.tr/AkademikArama/AkademisyenArama?aramaTuru=akademisyenArama&aramaKelime=${encodeURIComponent(((editForm.firstName||user?.firstName||'') + ' ' + (editForm.lastName||user?.lastName||'')).trim())}`}
                     target="_blank" rel="noopener noreferrer" className="text-navy-mid hover:underline">
                    YÖK Akademik'te ara &rarr;
                  </a> sonra bulduğunuz profil URL'ini buraya yapıştırın.
                </p>
              </div>
              <div>
                <label className="label">Uzmanlık Alanı</label>
                <input className="input" placeholder="Makine öğrenmesi, IoT, Biyomedikal..." value={editForm.expertiseArea||''} onChange={e => set('expertiseArea', e.target.value)} />
              </div>
            </div>

            {/* Sağ: Biyografi + Kaydet */}
            <div className="card p-5 space-y-4">
              <SectionTitle icon="notebook">Hakkında</SectionTitle>
              <div>
                <label className="label">Kısa Biyografi</label>
                <textarea className="input" rows={8} placeholder="Araştırma ilgi alanlarınız, akademik geçmişiniz, projeleriniz..." value={editForm.bio||''} onChange={e => set('bio', e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 inline-flex items-center justify-center gap-2">
                  {saving ? <><span className="spinner w-4 h-4" />Kaydediliyor...</> : <><Icon name="check" className="w-4 h-4" />Kaydet</>}
                </button>
                <button onClick={() => setEditMode(false)} className="btn-secondary">İptal</button>
              </div>
            </div>
          </div>
        ) : (
          /* ── GÖRÜNTÜLEME MODU ──────────────────────────────────── */
          <>
            {/* Hero başlık */}
            <div className="card p-6 mb-6 overflow-hidden relative"
              style={{ background: 'linear-gradient(135deg,#0f2444 0%,#1a3a6b 100%)', color: 'white' }}>
              <div className="absolute inset-0 opacity-10"
                style={{ background: 'radial-gradient(circle at 20% 20%, white 0%, transparent 40%), radial-gradient(circle at 80% 80%, white 0%, transparent 40%)' }} />
              <div className="relative flex items-center gap-5 flex-wrap">
                <div className="relative flex-shrink-0">
                  {user.avatar
                    ? <img src={user.avatar} alt={user.firstName} className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white/30" />
                    : <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold ring-4 ring-white/30"
                        style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
                        {getInitials(user.firstName, user.lastName)}
                      </div>}
                  {isMe && (
                    <label className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shadow-lg" style={{ background: '#c8a45a' }} aria-label="Fotoğraf yükle">
                      {avatarUploading ? <span className="spinner w-4 h-4" /> : <Icon name="camera" className="w-4 h-4 text-white" />}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
                    </label>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {user.title && <p className="text-sm opacity-80 mb-0.5">{user.title}</p>}
                  <h1 className="font-display text-2xl md:text-3xl font-bold leading-tight">{user.firstName} {user.lastName}</h1>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs font-semibold px-3 py-1 rounded-full backdrop-blur"
                      style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
                      {user.role?.name}
                    </span>
                    {isMe && (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1"
                        style={{ background: '#c8a45a', color: '#0f2444' }}>
                        <Icon name="check" className="w-3 h-3" />
                        Benim profilim
                      </span>
                    )}
                  </div>
                </div>
                {/* Hızlı stats */}
                <div className="grid grid-cols-3 gap-4 flex-shrink-0">
                  {[
                    { v: allProjects.length, l: 'Proje' },
                    { v: activeCount,        l: 'Aktif' },
                    { v: completedCount,     l: 'Tamam.' },
                  ].map(s => (
                    <div key={s.l} className="text-center min-w-[56px]">
                      <p className="font-display text-2xl font-bold">{s.v}</p>
                      <p className="text-[11px] opacity-80">{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* SOL KOL */}
              <div className="space-y-5">
                {/* İletişim & Kurumsal */}
                <div className="card p-5">
                  <SectionTitle icon="user">İletişim</SectionTitle>
                  <div className="divide-y" style={{ borderColor: '#f5f2ee' }}>
                    <InfoRow icon="mail" label="E-posta" value={user.email} href={`mailto:${user.email}`} />
                    {user.phone && <InfoRow icon="phone" label="Telefon" value={user.phone} href={`tel:${user.phone}`} />}
                    {(user.faculty || user.department) && (
                      <InfoRow icon="building" label="Birim" value={`${user.faculty || ''}${user.faculty && user.department ? ' · ' : ''}${user.department || ''}`} />
                    )}
                    {(user as any).expertiseArea && (
                      <InfoRow icon="beaker" label="Uzmanlık" value={(user as any).expertiseArea} />
                    )}
                    <InfoRow icon="calendar" label="Kayıt" value={formatDate(user.createdAt)} />
                  </div>
                </div>

                {/* Akademik profil linkleri */}
                <div className="card p-5">
                  <SectionTitle icon="external-link">Akademik Profiller</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {(user as any).orcidId && (
                      <a href={`https://orcid.org/${(user as any).orcidId}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:shadow-sm transition-all"
                        style={{ background: '#a6ce3915', color: '#5a8a00', border: '1px solid #a6ce3966' }}>
                        <span className="w-4 h-4 rounded text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0" style={{ background: '#a6ce39' }}>iD</span>
                        ORCID
                      </a>
                    )}
                    {(user as any).googleScholarId && (
                      <a href={`https://scholar.google.com/citations?user=${(user as any).googleScholarId}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:shadow-sm transition-all"
                        style={{ background: '#4285f415', color: '#1a56c4', border: '1px solid #4285f466' }}>
                        <Icon name="graduation" className="w-3.5 h-3.5" />
                        Scholar
                      </a>
                    )}
                    {(user as any).scopusAuthorId && (
                      <a href={`https://www.scopus.com/authid/detail.uri?authorId=${(user as any).scopusAuthorId}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:shadow-sm transition-all"
                        style={{ background: '#e07a2b15', color: '#c2410c', border: '1px solid #e07a2b66' }}>
                        <span className="w-4 h-4 rounded text-white text-[8px] font-bold flex items-center justify-center" style={{ background: '#e07a2b' }}>SC</span>
                        Scopus
                      </a>
                    )}
                    {(user as any).researchGateUrl && (
                      <a href={(user as any).researchGateUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:shadow-sm transition-all"
                        style={{ background: '#00ccbb15', color: '#008a7e', border: '1px solid #00ccbb66' }}>
                        <Icon name="beaker" className="w-3.5 h-3.5" />
                        ResearchGate
                      </a>
                    )}
                    {(user as any).yoksisAkademikUrl ? (
                      <a href={(user as any).yoksisAkademikUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:shadow-sm transition-all"
                        style={{ background: '#0b5ed715', color: '#0b5ed7', border: '1px solid #0b5ed766' }}>
                        <span className="w-4 h-4 rounded text-white text-[8px] font-bold flex items-center justify-center" style={{ background: '#0b5ed7' }}>YÖK</span>
                        YÖK Akademik
                      </a>
                    ) : (
                      <a href={`https://akademik.yok.gov.tr/AkademikArama/AkademisyenArama?aramaTuru=akademisyenArama&aramaKelime=${encodeURIComponent((user.firstName + ' ' + user.lastName).trim())}`}
                        target="_blank" rel="noopener noreferrer"
                        title="YÖK Akademik'te ismi ara"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:shadow-sm transition-all"
                        style={{ background: '#f3f4f6', color: '#6b7280', border: '1px dashed #9ca3af' }}>
                        <span className="w-4 h-4 rounded text-white text-[8px] font-bold flex items-center justify-center" style={{ background: '#9ca3af' }}>YÖK</span>
                        YÖK'te Ara
                      </a>
                    )}
                    {/* Tez Merkezi danışmanlık araması */}
                    <a href={`https://tez.yok.gov.tr/UlusalTezMerkezi/tarama.jsp`}
                      target="_blank" rel="noopener noreferrer"
                      title="Tez Merkezi'nde bu kişinin danışmanlık yaptığı tezleri ara"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:shadow-sm transition-all"
                      style={{ background: '#6d28d915', color: '#6d28d9', border: '1px solid #6d28d966' }}>
                      <Icon name="document" className="w-3.5 h-3.5" />
                      Tez Merkezi
                    </a>
                  </div>
                </div>

                {/* Biyografi */}
                {(user as any).bio && (
                  <div className="card p-5">
                    <SectionTitle icon="notebook">Hakkında</SectionTitle>
                    <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{(user as any).bio}</p>
                  </div>
                )}

                {/* İstatistikler detay */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Yürütücü',   value: projects.owned.length,  color: '#c8a45a', icon: 'sparkles' as IconName },
                    { label: 'Ekip Üyesi', value: projects.member.length, color: '#1a3a6b', icon: 'users'    as IconName },
                  ].map(s => (
                    <div key={s.label} className="card py-4 px-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg mb-1.5"
                        style={{ background: s.color + '18', color: s.color }}>
                        <Icon name={s.icon} className="w-4 h-4" />
                      </span>
                      <p className="font-display text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-xs text-muted mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Ziyaretçiler */}
                {(isMe || isAdmin) && visitors.length > 0 && (
                  <div className="card p-5">
                    <SectionTitle icon="eye" badge={<span className="text-xs text-muted font-normal ml-auto">{visitors.length} kişi</span>}>
                      Son Ziyaretçiler
                    </SectionTitle>
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
                      <Icon name="sparkles" className="w-4 h-4" style={{ color: '#c8a45a' }} />
                      Yürütücü Olduğu Projeler
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
                      <Icon name="users" className="w-4 h-4" style={{ color: '#1a3a6b' }} />
                      Ekip Üyesi Olduğu Projeler
                      <span className="badge badge-blue text-xs">{projects.member.length}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {projects.member.map(p => <ProjectCard key={p.id} p={p} memberRole={p.memberRole} />)}
                    </div>
                  </div>
                )}

                {allProjects.length === 0 && (
                  <div className="empty-state py-16">
                    <Icon name="folder" className="w-12 h-12 mx-auto text-muted" strokeWidth={1.4} />
                    <p className="text-sm font-medium text-navy mt-3">Henüz proje yok</p>
                    <p className="text-xs text-muted mt-1">Bu kullanıcı henüz hiçbir projeye dahil olmamış.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
