'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api, projectsApi, reportsApi, documentsApi, usersApi, reportTypesApi } from '@/lib/api';
import { Project, ProjectReport, User } from '@/types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, SDG_MAP, getProjectTypeLabel, formatDate, formatCurrency, getInitials, MEMBER_ROLE_LABELS } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ProjectQRCode } from '@/components/ProjectQRCode';
import { PartnersPanel } from '@/components/PartnersPanel';
import { ReportTemplateDownloader } from '@/components/ReportTemplateDownloader';
import { AiSummaryPanel } from '@/components/AiSummaryPanel';

type Tab = 'overview' | 'members' | 'documents' | 'reports' | 'partners' | 'history';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [reports, setReports] = useState<ProjectReport[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [editReport, setEditReport] = useState<ProjectReport | null>(null);
  const [reportForm, setReportForm] = useState<any>({ title: '', content: '', type: 'progress', progressPercent: 0, metadata: {} });
  const [reportTypes, setReportTypes] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [memberModal, setMemberModal] = useState<{ userId: string; role: string; canUpload: boolean } | null>(null);

  const reload = () => projectsApi.getOne(id).then(r => setProject(r.data));
  const daysUntilEnd = project?.endDate && project.status === 'active'
    ? Math.ceil((new Date(project.endDate).getTime() - Date.now()) / 86400000)
    : null;
  const isOwner = project?.ownerId === user?.id;
  const isAdmin = user?.role?.name === 'Süper Admin';
  const canEdit = isAdmin || isOwner;
  const myMembership = project?.members?.find(m => m.userId === user?.id);
  const canUpload = canEdit || !!myMembership?.canUpload;

  useEffect(() => {
    Promise.all([
      projectsApi.getOne(id).then(r => setProject(r.data)),
      reportsApi.getByProject(id).then(r => setReports(r.data)).catch(() => {}),
      usersApi.getAll({ limit: 200 }).then(r => setAllUsers(r.data.data || [])).catch(() => {}),
      reportTypesApi.getActive().then(r => setReportTypes(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...reportForm, metadata: JSON.stringify(reportForm.metadata || {}) };
      if (editReport) {
        const res = await reportsApi.update(editReport.id, payload);
        setReports(rs => rs.map(r => r.id === editReport.id ? res.data : r));
        toast.success('Rapor güncellendi');
      } else {
        const res = await reportsApi.create(id, payload);
        setReports(rs => [res.data, ...rs]);
        toast.success('Rapor eklendi');
      }
      setShowReportModal(false); setEditReport(null);
      setReportForm({ title: '', content: '', type: 'progress', progressPercent: 0, metadata: {} });
    } catch { toast.error('Hata oluştu'); }
  };

  const handleDeleteReport = async (rId: string) => {
    if (!confirm('Bu raporu silmek istiyor musunuz?')) return;
    await reportsApi.delete(rId);
    setReports(rs => rs.filter(r => r.id !== rId));
    toast.success('Rapor silindi');
  };

  const handleAddMember = async () => {
    if (!memberModal) return;
    try {
      await projectsApi.addMember(id, { userId: memberModal.userId, role: memberModal.role, canUpload: memberModal.canUpload });
      await reload();
      setMemberModal(null); setMemberSearch('');
      toast.success('Üye eklendi');
    } catch { toast.error('Hata oluştu'); }
  };

  const handleUpdateMember = async (userId: string, dto: any) => {
    try {
      await projectsApi.updateMember(id, userId, dto);
      await reload();
      toast.success('Üye güncellendi');
    } catch { toast.error('Hata oluştu'); }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Bu üyeyi projeden çıkarmak istiyor musunuz?')) return;
    await projectsApi.removeMember(id, userId);
    await reload();
    toast.success('Üye çıkarıldı');
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('name', uploadName || uploadFile.name);
      await documentsApi.upload(id, fd);
      await reload();
      setUploadFile(null); setUploadName('');
      toast.success('Dosya yüklendi');
    } catch { toast.error('Yükleme başarısız'); }
    finally { setUploading(false); }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Bu belgeyi silmek istiyor musunuz?')) return;
    await documentsApi.delete(id, docId);
    await reload();
    toast.success('Belge silindi');
  };

  const handleDelete = async () => {
    if (!confirm('Bu projeyi kalıcı olarak silmek istiyor musunuz?')) return;
    await projectsApi.delete(id);
    toast.success('Proje silindi');
    router.push('/projects');
  };

  const handlePrint = () => {
    // Print sayfası token gerektiriyor, sessionStorage üzerinden geçir
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('tto_token');
      if (token) sessionStorage.setItem('tto_print_token', token);
    }
    window.open(`/projects/${id}/print`, '_blank');
  };

  const memberIds = new Set(project?.members?.map(m => m.userId) || []);
  const filteredUsers = allUsers.filter(u =>
    !memberIds.has(u.id) && u.id !== project?.ownerId &&
    (u.firstName + ' ' + u.lastName + ' ' + u.email).toLowerCase().includes(memberSearch.toLowerCase())
  ).slice(0, 5);

  const tabs: [Tab, string][] = [['overview', 'Genel Bakış'], ['members', 'Ekip'], ['documents', 'Belgeler'], ['reports', 'Raporlar'], ['partners', 'Ortaklar 🤝'], ['history', 'Geçmiş 📋']];

  // Report chart data
  const reportChartData = [...reports].reverse().map(r => ({ date: new Date(r.createdAt).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }), progress: r.progressPercent, title: r.title }));

  if (loading) return <DashboardLayout><Header title="Proje Detayı" /><div className="flex-1 flex items-center justify-center"><div className="spinner" /></div></DashboardLayout>;
  if (!project) return <DashboardLayout><Header title="Bulunamadı" /><div className="empty-state"><p>Proje bulunamadı.</p></div></DashboardLayout>;

  const latestProgress = reports[0]?.progressPercent || 0;

  return (
    <DashboardLayout>
      <Header title={project.title}
        actions={<>
          <ProjectQRCode projectId={id} projectTitle={project.title} />
          <button onClick={handlePrint} className="btn-secondary text-xs px-3 py-2">
            <svg className="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PDF
          </button>
          {canEdit && <Link href={`/projects/${id}/edit`} className="btn-secondary">Düzenle</Link>}
          {canEdit && <button onClick={handleDelete} className="btn-danger">Sil</button>}
        </>}
      />

      {/* Hero bar */}
      <div className="px-8 py-4 border-b flex items-center gap-3 flex-wrap" style={{ background: 'white', borderColor: '#e8e4dc' }}>
        <span className={`badge ${PROJECT_STATUS_COLORS[project.status]}`} style={{ fontSize: 12, padding: '4px 12px' }}>{PROJECT_STATUS_LABELS[project.status]}</span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#f0ede8', color: '#6b7280' }}>{getProjectTypeLabel(project.type)}</span>
        {project.faculty && <span className="text-xs text-muted">{project.faculty}</span>}
        {project.department && <><span className="text-muted text-xs">›</span><span className="text-xs text-muted">{project.department}</span></>}
        <div className="ml-auto flex items-center gap-6 text-xs text-muted">
          {project.budget && <span className="font-bold text-navy">{formatCurrency(project.budget)}</span>}
          {project.startDate && <span>{formatDate(project.startDate)} → {project.endDate ? formatDate(project.endDate) : 'Devam'}</span>}
          {daysUntilEnd !== null && daysUntilEnd <= 30 && (
            <span className="ml-1 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse"
              style={{ background: daysUntilEnd <= 7 ? '#fef2f2' : '#fffbeb', color: daysUntilEnd <= 7 ? '#dc2626' : '#b45309', border: `1px solid ${daysUntilEnd <= 7 ? '#fecaca' : '#fde68a'}` }}>
              {daysUntilEnd <= 0 ? '⚠️ Süre Doldu!' : `⏰ ${daysUntilEnd} gün kaldı`}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar top */}
      {reports.length > 0 && (
        <div className="px-8 py-2 border-b flex items-center gap-3" style={{ background: '#faf8f4', borderColor: '#e8e4dc' }}>
          <span className="text-xs font-semibold text-muted">İlerleme</span>
          <div className="flex-1 progress-bar h-2"><div className="progress-fill h-2" style={{ width: `${latestProgress}%` }} /></div>
          <span className="text-xs font-bold text-navy">%{latestProgress}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="px-8 border-b flex gap-1" style={{ background: 'white', borderColor: '#e8e4dc' }}>
        {tabs.map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all"
            style={{ borderColor: tab === t ? '#1a3a6b' : 'transparent', color: tab === t ? '#0f2444' : '#9ca3af', marginBottom: -1 }}>
            {label}
            {t === 'documents' && project.documents?.length > 0 && (
              <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#f0ede8', color: '#6b7280' }}>{project.documents.length}</span>
            )}
            {t === 'members' && project.members?.length > 0 && (
              <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#f0ede8', color: '#6b7280' }}>{project.members.length}</span>
            )}
            {t === 'reports' && reports.length > 0 && (
              <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#f0ede8', color: '#6b7280' }}>{reports.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="p-8 space-y-6">

        {/* ===== OVERVIEW ===== */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-5">
              {project.description && (
                <div className="card">
                  <h3 className="font-display text-sm font-semibold text-navy mb-3">Proje Açıklaması</h3>
                  <p className="text-sm leading-relaxed text-muted">{project.description}</p>
                </div>
              )}
              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Ekip Üyesi', value: (project.members?.length || 0) + 1, unit: 'kişi', color: '#1a3a6b' },
                  { label: 'Belge', value: project.documents?.length || 0, unit: 'dosya', color: '#c8a45a' },
                  { label: 'Rapor', value: reports.length, unit: 'adet', color: '#059669' },
                ].map(stat => (
                  <div key={stat.label} className="card py-4 text-center">
                    <p className="font-display text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-xs text-muted">{stat.label}</p>
                    <p className="text-xs font-medium" style={{ color: stat.color }}>{stat.unit}</p>
                  </div>
                ))}
              </div>

              {/* Görev kartları — yürütücü + üyeler */}
              {((project.members?.length || 0) > 0 || project.owner) && (() => {
                const ROLE_STYLES: Record<string, { color: string; bg: string; icon: string }> = {
                  researcher:  { color: '#1a3a6b', bg: '#eff6ff', icon: '🔬' },
                  scholarship: { color: '#7c3aed', bg: '#f5f3ff', icon: '🎓' },
                  advisor:     { color: '#92651a', bg: '#fffbeb', icon: '🧭' },
                  coordinator: { color: '#059669', bg: '#f0fdf4', icon: '📋' },
                  assistant:   { color: '#dc2626', bg: '#fef2f2', icon: '🤝' },
                };
                const ROLE_LABELS: Record<string, string> = {
                  researcher: 'Araştırmacı', scholarship: 'Bursiyer', advisor: 'Danışman',
                  coordinator: 'Koordinatör', assistant: 'Asistan',
                };
                const groupedByRole: Record<string, any[]> = {};
                project.members?.forEach(m => {
                  const r = m.role || 'researcher';
                  if (!groupedByRole[r]) groupedByRole[r] = [];
                  groupedByRole[r].push(m);
                });
                return (
                  <div className="card">
                    <h3 className="font-display text-sm font-semibold text-navy mb-3">Proje Ekibi</h3>
                    {/* Yürütücü */}
                    <div className="flex items-center gap-3 p-3 rounded-xl mb-2" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                      <span className="text-lg">🎓</span>
                      <div>
                        <p className="text-xs font-bold" style={{ color: '#92651a' }}>Yürütücü</p>
                        <p className="text-sm font-semibold text-navy">{project.owner?.title} {project.owner?.firstName} {project.owner?.lastName}</p>
                      </div>
                    </div>
                    {/* Rol grupları */}
                    {Object.entries(groupedByRole).map(([role, members]) => {
                      const rs = ROLE_STYLES[role] || { color: '#6b7280', bg: '#f9fafb', icon: '👤' };
                      return (
                        <div key={role} className="mb-2">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: rs.bg, border: `1px solid ${rs.color}22` }}>
                            <span>{rs.icon}</span>
                            <span className="text-xs font-bold" style={{ color: rs.color }}>{ROLE_LABELS[role] || role}</span>
                            <span className="ml-auto text-xs font-semibold" style={{ color: rs.color }}>{members.length} kişi</span>
                          </div>
                          <div className="pl-3 pt-1 space-y-1">
                            {members.map((m: any) => (
                              <div key={m.id} className="flex items-center gap-2 text-xs text-muted py-0.5">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: rs.color }} />
                                {m.user?.title} {m.user?.firstName} {m.user?.lastName}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {reports.length > 0 && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-sm font-semibold text-navy">Son İlerleme</h3>
                    <span className="text-xs text-muted">{formatDate(reports[0].createdAt)}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-medium text-navy">{reports[0].title}</span>
                    <span className="font-bold text-2xl font-display text-navy">%{reports[0].progressPercent}</span>
                  </div>
                  <div className="progress-bar h-3"><div className="progress-fill h-3" style={{ width: `${reports[0].progressPercent}%` }} /></div>
                  {reports[0].content && <p className="text-xs text-muted mt-3 leading-relaxed">{reports[0].content}</p>}
                </div>
              )}
              {(project as any).sdgGoals?.length > 0 && (
                <div className="card">
                  <h3 className="font-display text-sm font-semibold text-navy mb-3 flex items-center gap-2">
                    🌍 Sürdürülebilir Kalkınma Hedefleri
                    <span className="badge badge-blue text-xs">{(project as any).sdgGoals.length} hedef</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(project as any).sdgGoals.map((code: string) => {
                      const g = SDG_MAP[code];
                      if (!g) return null;
                      return (
                        <span key={code} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold text-white"
                          style={{ background: g.color }}>
                          {g.emoji} {g.code} · {g.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {project.tags?.length > 0 && (
                <div className="card">
                  <h3 className="font-display text-sm font-semibold text-navy mb-3">Etiketler</h3>
                  <div className="flex flex-wrap gap-2">{project.tags.map((t: string) => <span key={t} className="badge badge-gray text-xs">{t}</span>)}</div>
                </div>
              )}
              {project.dynamicFields && Object.keys(project.dynamicFields).length > 0 && (
                <div className="card">
                  <h3 className="font-display text-sm font-semibold text-navy mb-3">Ek Bilgiler</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(project.dynamicFields).map(([k, v]) => (
                      <div key={k} className="text-xs"><span className="text-muted capitalize">{k}: </span><span className="font-medium text-navy">{String(v)}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="card">
                <h3 className="font-display text-sm font-semibold text-navy mb-4">Yürütücü</h3>
                <Link href={`/users/${project.owner?.id}`} className="flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 group-hover:ring-2 ring-navy-600 transition-all" style={{ background: 'linear-gradient(135deg,#0f2444,#1a3a6b)', color: 'white', minWidth: 40 }}>
                    {getInitials(project.owner?.firstName || '', project.owner?.lastName || '')}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-navy group-hover:underline">{project.owner?.firstName} {project.owner?.lastName}</p>
                    <p className="text-xs text-muted">{project.owner?.title}</p>
                    <p className="text-xs text-muted">{project.owner?.email}</p>
                  </div>
                </Link>
              </div>
              <div className="card space-y-2.5">
                <h3 className="font-display text-sm font-semibold text-navy mb-1">Proje Bilgileri</h3>
                {[
                  ['Tür', getProjectTypeLabel(project.type)],
                  ['Fon Kaynağı', project.fundingSource],
                  ['Bütçe', formatCurrency(project.budget)],
                  ['Başlangıç', formatDate(project.startDate)],
                  ['Bitiş', formatDate(project.endDate)],
                  ['Oluşturulma', formatDate(project.createdAt)],
                ].filter(([, v]) => v && v !== '—').map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs border-b pb-2 last:border-0" style={{ borderColor: '#f5f2ee' }}>
                    <span className="text-muted">{k}</span>
                    <span className="font-medium text-navy text-right ml-4">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Kurum Dışı Ortaklar Özeti */}
            {project.partners && project.partners.length > 0 && (
              <div className="card mt-4">
                <h3 className="font-display text-sm font-semibold text-navy mb-3">🏛 Kurum Dışı Ortaklar</h3>
                <div className="space-y-2">
                  {project.partners.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0" style={{ borderColor: '#f5f2ee' }}>
                      <div className="flex items-center gap-2">
                        <span>{p.type === 'university' ? '🎓' : p.type === 'industry' ? '🏭' : p.type === 'government' ? '🏛' : '🌐'}</span>
                        <span className="font-medium text-navy">{p.name}</span>
                        {p.country && p.country !== 'TR' && <span className="text-muted">({p.country})</span>}
                      </div>
                      {p.contributionBudget ? <span className="font-semibold" style={{ color: '#059669' }}>{Number(p.contributionBudget).toLocaleString('tr-TR')} ₺</span> : null}
                    </div>
                  ))}
                </div>
                <button onClick={() => setTab('partners')} className="btn-ghost text-xs mt-2 w-full">
                  Tüm Ortakları Görüntüle →
                </button>
              </div>
            )}

            {/* AI Project Summarizer */}
            {canEdit && (
              <div className="mt-4">
                <AiSummaryPanel
                  title={project.title}
                  description={project.description}
                  type={project.type}
                  faculty={project.faculty}
                  budget={project.budget}
                  sdgGoals={(project as any).sdgGoals || []}
                  mode="summary"
                />
              </div>
            )}
          </div>
        )}

        {/* ===== MEMBERS ===== */}
        {tab === 'members' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card space-y-3">
              <h3 className="font-display text-sm font-semibold text-navy mb-1">Proje Ekibi</h3>
              {/* Owner */}
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg,#c8a45a,#e8c97a)', color: 'white' }}>
                  {getInitials(project.owner?.firstName || '', project.owner?.lastName || '')}
                </div>
                <div className="flex-1">
                  <Link href={`/users/${project.owner?.id}`} className="text-sm font-semibold text-navy hover:underline">{project.owner?.firstName} {project.owner?.lastName}</Link>
                  <p className="text-xs text-muted">{project.owner?.department}</p>
                </div>
                <span className="badge badge-gold text-xs">Yürütücü</span>
              </div>
              {/* Members */}
              {project.members?.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#faf8f4', border: '1px solid #e8e4dc' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#e8e4dc', color: '#6b7280' }}>
                    {getInitials(m.user?.firstName || '', m.user?.lastName || '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/users/${m.userId}`} className="text-sm font-semibold text-navy hover:underline">{m.user?.firstName} {m.user?.lastName}</Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted">{MEMBER_ROLE_LABELS[m.role] || m.role}</p>
                      {m.canUpload ? <span className="badge badge-green text-xs" style={{ fontSize: 9, padding: '1px 6px' }}>Dosya Yükleyebilir</span> : null}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1.5">
                      <select className="text-xs rounded-lg px-2 py-1 border" style={{ border: '1px solid #e8e4dc', background: '#faf8f4' }}
                        value={m.role} onChange={e => handleUpdateMember(m.userId, { role: e.target.value })}>
                        {Object.entries(MEMBER_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <button onClick={() => handleUpdateMember(m.userId, { canUpload: !m.canUpload })}
                        title={m.canUpload ? 'Dosya yükleme yetkisini kaldır' : 'Dosya yükleme yetkisi ver'}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: m.canUpload ? '#d1fae5' : '#f0ede8', color: m.canUpload ? '#059669' : '#9ca3af' }}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </button>
                      <button onClick={() => handleRemoveMember(m.userId)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#fff0f0', color: '#dc2626' }}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!project.members?.length && <p className="text-sm text-muted text-center py-6">Henüz ekip üyesi eklenmemiş</p>}
            </div>

            {canEdit && (
              <div className="card">
                <h3 className="font-display text-sm font-semibold text-navy mb-4">Üye Ekle</h3>
                <input className="input mb-4" placeholder="İsim veya e-posta ile ara..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                <div className="space-y-2">
                  {filteredUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors" style={{ border: '1px solid #e8e4dc' }}
                      onClick={() => setMemberModal({ userId: u.id, role: 'researcher', canUpload: false })}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#f0ede8', color: '#6b7280' }}>
                        {getInitials(u.firstName, u.lastName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy truncate">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-muted truncate">{u.department || u.role?.name}</p>
                      </div>
                      <span className="text-xs text-navy font-semibold">Ekle →</span>
                    </div>
                  ))}
                  {memberSearch && !filteredUsers.length && <p className="text-sm text-muted text-center py-6">Kullanıcı bulunamadı</p>}
                  {!memberSearch && <p className="text-xs text-muted text-center py-4">Aramak için kullanıcı adı yazın</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== DOCUMENTS ===== */}
        {tab === 'documents' && (
          <div className="space-y-5">
            {canUpload && (
              <div className="card">
                <h3 className="font-display text-sm font-semibold text-navy mb-4">Belge Yükle</h3>
                <div className="flex gap-4 flex-wrap items-end">
                  <div className="flex-1 min-w-48">
                    <label className="label">Belge Adı</label>
                    <input className="input" placeholder="İsim (opsiyonel)" value={uploadName} onChange={e => setUploadName(e.target.value)} />
                  </div>
                  <div className="flex-1 min-w-48">
                    <label className="label">Dosya Seç</label>
                    <input type="file" className="input py-2" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                  </div>
                  <button onClick={handleUpload} disabled={!uploadFile || uploading} className="btn-primary disabled:opacity-50">
                    {uploading ? 'Yükleniyor...' : '↑ Yükle'}
                  </button>
                </div>
              </div>
            )}
            <div className="card p-0 overflow-hidden">
              {project.documents?.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#faf8f4', borderBottom: '1px solid #e8e4dc' }}>
                      {['Belge', 'Boyut', 'Yükleyen', 'Tarih', ''].map(h => (
                        <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted px-5 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {project.documents.map(doc => (
                      <tr key={doc.id} className="table-row-hover border-b" style={{ borderColor: '#f5f2ee' }}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f0ede8' }}>
                              <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-navy text-sm">{doc.name}</p>
                              {(doc as any).version > 1 && (
                                <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#eff6ff', color: '#1d4ed8' }}>v{(doc as any).version}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-muted">{(doc.fileSize / 1024).toFixed(1)} KB</td>
                        <td className="px-5 py-3">
                          {doc.uploadedBy ? (
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#f0ede8', color: '#6b7280', fontSize: 8 }}>
                                {getInitials(doc.uploadedBy.firstName || '', doc.uploadedBy.lastName || '')}
                              </div>
                              <span className="text-xs text-muted">{doc.uploadedBy.firstName} {doc.uploadedBy.lastName}</span>
                            </div>
                          ) : <span className="text-xs text-muted">—</span>}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted">{formatDate(doc.createdAt)}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2">
                            <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace("/api","") || "http://localhost:3001"}/uploads/${doc.fileName}`} target="_blank" rel="noreferrer" className="btn-secondary text-xs px-3 py-1.5">İndir</a>
                            {canEdit && <button onClick={() => handleDeleteDoc(doc.id)} className="btn-danger text-xs px-2 py-1.5">Sil</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon"><svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></div>
                  <p className="text-sm">Henüz belge yüklenmemiş</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== REPORTS ===== */}
        {tab === 'reports' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted">{reports.length} rapor · Son güncelleme: {reports[0] ? formatDate(reports[0].createdAt) : '—'}</div>
              <div className="flex items-center gap-2">
                <ReportTemplateDownloader projectTitle={project.title} />
                {(canEdit || myMembership) && (
                  <button onClick={() => { setEditReport(null); setReportForm({ title: '', content: '', type: 'progress', progressPercent: 0 }); setShowReportModal(true); }} className="btn-primary text-sm">
                    + Rapor Ekle
                  </button>
                )}
              </div>
            </div>

            {/* Progress chart */}
            {reportChartData.length > 1 && (
              <div className="card">
                <h3 className="font-display text-sm font-semibold text-navy mb-4">İlerleme Trendi</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={reportChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 12 }} formatter={(v: any) => [`%${v}`, 'İlerleme']} />
                    <Line type="monotone" dataKey="progress" stroke="#1a3a6b" strokeWidth={2.5} dot={{ fill: '#1a3a6b', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Bar chart by type */}
            {reports.length > 0 && (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                  { label: 'Toplam Rapor', value: reports.length, color: '#1a3a6b' },
                  { label: 'Son İlerleme', value: `%${latestProgress}`, color: latestProgress >= 75 ? '#059669' : latestProgress >= 50 ? '#d97706' : '#1a3a6b' },
                  { label: 'Raporlayan', value: [...new Set(reports.map(r => r.author?.id))].length, color: '#c8a45a' },
                  { label: 'İlk Rapor', value: reports.length > 0 ? new Date(reports[reports.length - 1].createdAt).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }) : '—', color: '#7c3aed' },
                ].map(s => (
                  <div key={s.label} className="card py-4 text-center">
                    <p className="font-display text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-muted mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Report list — zengin görüntüleme */}
            <div className="space-y-4">
              {reports.map((r, idx) => {
                const rt = reportTypes.find(x => x.key === r.type);
                const rtColor = rt?.color || '#1a3a6b';
                const rtLabel = rt?.label || r.type;
                const meta = (() => { try { return JSON.parse(r.metadata || '{}'); } catch { return {}; } })();
                const PROB_LABELS: Record<string,string> = { low:'Düşük', medium:'Orta', high:'Yüksek', very_high:'Çok Yüksek' };
                const IMPACT_LABELS: Record<string,string> = { low:'Düşük', medium:'Orta', high:'Yüksek', critical:'Kritik' };
                const RISK_STATUS: Record<string,string> = { open:'🔴 Açık', monitoring:'🟡 İzleniyor', mitigated:'🟢 Azaltıldı', closed:'⚫ Kapatıldı' };
                const MILE_STATUS: Record<string,{label:string,color:string}> = {
                  achieved:{label:'✅ Başarıldı',color:'#059669'}, planned:{label:'📅 Planlandı',color:'#1a3a6b'},
                  delayed:{label:'⚠️ Ertelendi',color:'#d97706'}, cancelled:{label:'❌ İptal',color:'#dc2626'}
                };
                const EVAL: Record<string,string> = { excellent:'Mükemmel 🌟', good:'İyi 👍', average:'Orta', below:'Beklentinin Altı' };

                return (
                <div key={r.id} className="card overflow-hidden" style={{ borderLeft: `4px solid ${rtColor}` }}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ background: rtColor + '18', color: rtColor }}>{reports.length - idx}</div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-display font-semibold text-navy">{r.title}</h4>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: rtColor + '18', color: rtColor }}>{rtLabel}</span>
                        </div>
                        <p className="text-xs text-muted mt-1">
                          {r.author?.firstName} {r.author?.lastName} · {formatDate(r.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {r.progressPercent > 0 && (
                        <span className="font-display text-2xl font-bold" style={{ color: r.progressPercent >= 75 ? '#059669' : r.progressPercent >= 50 ? '#d97706' : '#1a3a6b' }}>
                          %{r.progressPercent}
                        </span>
                      )}
                      {canEdit && (
                        <div className="flex gap-1">
                          <button onClick={() => {
                            setEditReport(r);
                            setReportForm({ title: r.title, content: r.content, type: r.type, progressPercent: r.progressPercent, metadata: meta });
                            setShowReportModal(true);
                          }} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#f0ede8', color: '#6b7280' }}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button onClick={() => handleDeleteReport(r.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#fff0f0', color: '#dc2626' }}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar (varsa) */}
                  {r.progressPercent > 0 && (
                    <div className="progress-bar h-2 mb-4"><div className="progress-fill h-2" style={{ width:`${r.progressPercent}%`, background: rtColor }} /></div>
                  )}

                  {/* Ana içerik */}
                  {r.content && <p className="text-sm text-muted leading-relaxed mb-4">{r.content}</p>}

                  {/* ─── Tür bazlı detaylar ─── */}
                  {Object.keys(meta).length > 0 && (
                    <div className="border-t pt-4 space-y-3" style={{ borderColor: '#f5f2ee' }}>

                      {/* İlerleme */}
                      {r.type === 'progress' && (
                        <div className="grid grid-cols-2 gap-3">
                          {meta.nextSteps && <div className="p-3 rounded-xl" style={{background:'#f0fdf4',border:'1px solid #bbf7d0'}}>
                            <p className="text-xs font-bold text-green-700 mb-1">📋 Sonraki Adımlar</p>
                            <p className="text-xs text-green-800">{meta.nextSteps}</p>
                          </div>}
                          {meta.challenges && <div className="p-3 rounded-xl" style={{background:'#fffbeb',border:'1px solid #fde68a'}}>
                            <p className="text-xs font-bold text-amber-700 mb-1">⚠️ Zorluklar</p>
                            <p className="text-xs text-amber-800">{meta.challenges}</p>
                          </div>}
                        </div>
                      )}

                      {/* Kilometre Taşı */}
                      {r.type === 'milestone' && (
                        <div className="flex flex-wrap gap-3">
                          {meta.status && <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: (MILE_STATUS[meta.status]?.color||'#6b7280')+'18', color: MILE_STATUS[meta.status]?.color||'#6b7280' }}>{MILE_STATUS[meta.status]?.label||meta.status}</span>}
                          {meta.plannedDate && <span className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-700">📅 Planlanan: {new Date(meta.plannedDate).toLocaleDateString('tr-TR')}</span>}
                          {meta.actualDate && <span className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700">✅ Gerçekleşen: {new Date(meta.actualDate).toLocaleDateString('tr-TR')}</span>}
                          {meta.impact && <span className="text-xs px-3 py-1.5 rounded-full bg-purple-50 text-purple-700">Etki: {IMPACT_LABELS[meta.impact]||meta.impact}</span>}
                          {meta.responsible && <span className="text-xs px-3 py-1.5 rounded-full" style={{background:'#faf8f4',border:'1px solid #e8e4dc',color:'#6b7280'}}>👤 {meta.responsible}</span>}
                        </div>
                      )}

                      {/* Finansal */}
                      {r.type === 'financial' && (
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                          {meta.totalBudget && <div className="p-3 rounded-xl text-center" style={{background:'#eff6ff',border:'1px solid #bfdbfe'}}>
                            <p className="text-xs text-blue-500 font-semibold mb-0.5">Toplam Bütçe</p>
                            <p className="font-display font-bold text-blue-700 text-sm">{formatCurrency(+meta.totalBudget)}</p>
                          </div>}
                          {meta.spent && <div className="p-3 rounded-xl text-center" style={{background:'#fef3c7',border:'1px solid #fde68a'}}>
                            <p className="text-xs text-amber-600 font-semibold mb-0.5">Bu Dönem</p>
                            <p className="font-display font-bold text-amber-700 text-sm">{formatCurrency(+meta.spent)}</p>
                          </div>}
                          {meta.cumulativeSpent && <div className="p-3 rounded-xl text-center" style={{background:'#fff1f2',border:'1px solid #fecaca'}}>
                            <p className="text-xs text-red-500 font-semibold mb-0.5">Kümülatif</p>
                            <p className="font-display font-bold text-red-600 text-sm">{formatCurrency(+meta.cumulativeSpent)}</p>
                          </div>}
                          {meta.remaining && <div className="p-3 rounded-xl text-center" style={{background:'#f0fdf4',border:'1px solid #bbf7d0'}}>
                            <p className="text-xs text-green-600 font-semibold mb-0.5">Kalan</p>
                            <p className="font-display font-bold text-green-700 text-sm">{formatCurrency(+meta.remaining)}</p>
                          </div>}
                          {meta.period && <div className="col-span-2 xl:col-span-4 text-xs text-muted">📆 Dönem: <span className="font-semibold text-navy">{meta.period}</span></div>}
                        </div>
                      )}

                      {/* Teknik */}
                      {r.type === 'technical' && (
                        <div className="space-y-2">
                          {meta.topic && <p className="text-xs"><span className="font-bold text-navy">🔬 Konu:</span> <span className="text-muted">{meta.topic}</span></p>}
                          {meta.methodology && <p className="text-xs"><span className="font-bold text-navy">🛠 Yöntem:</span> <span className="text-muted">{meta.methodology}</span></p>}
                          {meta.conclusions && <div className="p-3 rounded-xl" style={{background:'#faf5ff',border:'1px solid #ede9fe'}}><p className="text-xs font-bold text-purple-700 mb-1">💡 Sonuçlar</p><p className="text-xs text-purple-900">{meta.conclusions}</p></div>}
                          {meta.recommendations && <p className="text-xs"><span className="font-bold text-navy">📌 Öneriler:</span> <span className="text-muted">{meta.recommendations}</span></p>}
                          {meta.references && <p className="text-xs text-muted border-t pt-2" style={{borderColor:'#f5f2ee'}}>📚 {meta.references}</p>}
                        </div>
                      )}

                      {/* Risk */}
                      {r.type === 'risk' && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {meta.probability && <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{background:'#fff1f2',color:'#dc2626',border:'1px solid #fecaca'}}>🎲 Olasılık: {PROB_LABELS[meta.probability]||meta.probability}</span>}
                            {meta.impact && <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{background:'#fff7ed',color:'#ea580c',border:'1px solid #fed7aa'}}>💥 Etki: {IMPACT_LABELS[meta.impact]||meta.impact}</span>}
                            {meta.category && <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{meta.category}</span>}
                            {meta.riskStatus && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-700">{RISK_STATUS[meta.riskStatus]||meta.riskStatus}</span>}
                          </div>
                          {meta.mitigation && <div className="p-3 rounded-xl" style={{background:'#f0fdf4',border:'1px solid #bbf7d0'}}><p className="text-xs font-bold text-green-700 mb-1">🛡 Önlem</p><p className="text-xs text-green-800">{meta.mitigation}</p></div>}
                          {meta.contingency && <div className="p-3 rounded-xl" style={{background:'#fffbeb',border:'1px solid #fde68a'}}><p className="text-xs font-bold text-amber-700 mb-1">🚨 Acil Plan</p><p className="text-xs text-amber-800">{meta.contingency}</p></div>}
                          {meta.owner && <p className="text-xs text-muted">👤 Sorumlu: <span className="font-semibold text-navy">{meta.owner}</span></p>}
                        </div>
                      )}

                      {/* Final */}
                      {r.type === 'final' && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {meta.evaluation && <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{background:'#c8a45a18',color:'#92651a',border:'1px solid #f5d78e'}}>{EVAL[meta.evaluation]||meta.evaluation}</span>}
                            {meta.publications && meta.publications !== 'no' && <span className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700">📄 Yayın: {meta.publications}</span>}
                            {meta.sustainability && <span className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700">♻️ Sürdürülebilirlik: {meta.sustainability}</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {meta.achievements && <div className="p-3 rounded-xl" style={{background:'#f0fdf4',border:'1px solid #bbf7d0'}}><p className="text-xs font-bold text-green-700 mb-1">🏆 Başarılar</p><p className="text-xs text-green-800">{meta.achievements}</p></div>}
                            {meta.lessons && <div className="p-3 rounded-xl" style={{background:'#eff6ff',border:'1px solid #bfdbfe'}}><p className="text-xs font-bold text-blue-700 mb-1">📖 Öğrenilen Dersler</p><p className="text-xs text-blue-800">{meta.lessons}</p></div>}
                            {meta.recommendations && <div className="p-3 rounded-xl" style={{background:'#faf5ff',border:'1px solid #ede9fe'}}><p className="text-xs font-bold text-purple-700 mb-1">💡 Öneriler</p><p className="text-xs text-purple-800">{meta.recommendations}</p></div>}
                            {meta.openItems && <div className="p-3 rounded-xl" style={{background:'#fffbeb',border:'1px solid #fde68a'}}><p className="text-xs font-bold text-amber-700 mb-1">📋 Açık Maddeler</p><p className="text-xs text-amber-800">{meta.openItems}</p></div>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
              {!reports.length && (
                <div className="empty-state">
                  <div className="empty-state-icon"><svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                  <p className="text-sm">Henüz rapor eklenmemiş</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {memberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" style={{ border: '1px solid #e8e4dc' }}>
            <div className="p-5 border-b" style={{ borderColor: '#e8e4dc' }}>
              <h3 className="font-display text-base font-semibold text-navy">Üye Ekle</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Proje Rolü</label>
                <select className="input" value={memberModal.role} onChange={e => setMemberModal(m => m ? { ...m, role: e.target.value } : null)}>
                  {Object.entries(MEMBER_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-colors" style={{ background: '#faf8f4', border: '1px solid #e8e4dc' }}>
                <input type="checkbox" checked={memberModal.canUpload} onChange={e => setMemberModal(m => m ? { ...m, canUpload: e.target.checked } : null)} className="w-4 h-4" />
                <div>
                  <p className="text-sm font-semibold text-navy">Dosya Yükleme Yetkisi</p>
                  <p className="text-xs text-muted">Bu üye projeye belge yükleyebilir</p>
                </div>
              </label>
            </div>
            <div className="p-5 pt-0 flex gap-3">
              <button onClick={handleAddMember} className="btn-primary flex-1">Ekle ve Bildir</button>
              <button onClick={() => { setMemberModal(null); setMemberSearch(''); }} className="btn-secondary flex-1">İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RAPOR MODAL ===== */}
      {showReportModal && (() => {
        const meta = reportForm.metadata || {};
        const setMeta = (key: string, val: any) => setReportForm((f: any) => ({ ...f, metadata: { ...(f.metadata||{}), [key]: val } }));
        const rtype = reportForm.type;

        const REPORT_TYPES = reportTypes.length > 0 ? reportTypes : [
          {key:'progress',  label:'İlerleme',   color:'#1a3a6b', icon:'📈'},
          {key:'milestone', label:'Km. Taşı',   color:'#c8a45a', icon:'🏁'},
          {key:'financial', label:'Finansal',   color:'#059669', icon:'💰'},
          {key:'technical', label:'Teknik',     color:'#7c3aed', icon:'🔬'},
          {key:'risk',      label:'Risk',       color:'#dc2626', icon:'⚠️'},
          {key:'final',     label:'Final',      color:'#0891b2', icon:'📋'},
        ];
        const selectedType = REPORT_TYPES.find(rt => rt.key === rtype);
        const color = (selectedType as any)?.color || '#1a3a6b';

        // İlerleme barı sadece ilerleme, milestone ve final raporlarında
        const showProgress = ['progress','milestone','final'].includes(rtype);

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ border:'1px solid #e8e4dc' }}>
            {/* Header */}
            <div className="p-5 border-b flex items-center justify-between flex-shrink-0 rounded-t-2xl" style={{ borderColor:'#e8e4dc' }}>
              <div>
                <h3 className="font-display text-base font-semibold text-navy">{editReport ? 'Raporu Düzenle' : 'Yeni Rapor Ekle'}</h3>
                <p className="text-xs text-muted mt-0.5">{selectedType ? `${(selectedType as any).icon || ''} ${selectedType.label} raporu` : 'Rapor türü seçin'}</p>
              </div>
              <button type="button" onClick={() => { setShowReportModal(false); setEditReport(null); }}
                className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-cream text-muted transition-colors">✕</button>
            </div>

            <form onSubmit={handleSaveReport} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Tür seçimi */}
              <div className="grid grid-cols-3 gap-2">
                {REPORT_TYPES.map((rt: any) => (
                  <button key={rt.key} type="button"
                    onClick={() => setReportForm((f: any) => ({ ...f, type: rt.key, metadata: {}, progressPercent: 0 }))}
                    className="p-3 rounded-xl text-left transition-all"
                    style={{ border: rtype === rt.key ? `2px solid ${rt.color}` : '2px solid #e8e4dc', background: rtype === rt.key ? rt.color + '12' : 'white' }}>
                    <p className="text-base mb-1">{rt.icon || '📄'}</p>
                    <p className="text-xs font-bold" style={{ color: rtype === rt.key ? rt.color : '#6b7280' }}>{rt.label}</p>
                  </button>
                ))}
              </div>

              {/* Başlık — her türde */}
              <div>
                <label className="label">Başlık *</label>
                <input required className="input" placeholder={
                  rtype === 'financial' ? 'Örn: Q2 2025 Bütçe Raporu' :
                  rtype === 'milestone' ? 'Örn: Veri Toplama Aşaması Tamamlandı' :
                  rtype === 'risk'      ? 'Örn: Tedarik Zinciri Riski' :
                  rtype === 'technical' ? 'Örn: Prototip Test Bulguları' :
                  rtype === 'final'     ? 'Proje Final Raporu' :
                  'İlerleme raporu başlığı...'
                } value={reportForm.title} onChange={e => setReportForm((f: any) => ({ ...f, title: e.target.value }))} />
              </div>

              {/* ─── İLERLEME RAPORU ─── */}
              {rtype === 'progress' && (<>
                <div>
                  <label className="label">Raporlama Dönemi</label>
                  <input className="input" placeholder="Örn: Ocak – Mart 2025" value={meta.period||''} onChange={e => setMeta('period', e.target.value)} />
                </div>
                <div>
                  <label className="label">Bu Dönem Gerçekleştirilen Faaliyetler *</label>
                  <textarea required className="input" rows={4} placeholder="Bu dönemde yürütülen çalışmalar, toplantılar, analizler..." value={reportForm.content} onChange={e => setReportForm((f: any) => ({ ...f, content: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Karşılaşılan Güçlükler</label>
                    <textarea className="input" rows={3} placeholder="Yaşanan sorunlar, darboğazlar..." value={meta.challenges||''} onChange={e => setMeta('challenges', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Sonraki Dönem Planı</label>
                    <textarea className="input" rows={3} placeholder="Planlanayan faaliyetler..." value={meta.nextSteps||''} onChange={e => setMeta('nextSteps', e.target.value)} />
                  </div>
                </div>
              </>)}

              {/* ─── KİLOMETRE TAŞI ─── */}
              {rtype === 'milestone' && (<>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Planlanan Tarih</label>
                    <input type="date" className="input" value={meta.plannedDate||''} onChange={e => setMeta('plannedDate', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Gerçekleşme Tarihi</label>
                    <input type="date" className="input" value={meta.actualDate||''} onChange={e => setMeta('actualDate', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Durum</label>
                    <select className="input" value={meta.status||''} onChange={e => setMeta('status', e.target.value)}>
                      <option value="">Seçiniz...</option>
                      <option value="onTime">Zamanında Tamamlandı</option>
                      <option value="late">Gecikmeli Tamamlandı</option>
                      <option value="inProgress">Devam Ediyor</option>
                      <option value="cancelled">İptal Edildi</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Sorumlu Kişi / Birim</label>
                    <input className="input" placeholder="Ad Soyad" value={meta.responsible||''} onChange={e => setMeta('responsible', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Açıklama ve Etkisi</label>
                  <textarea className="input" rows={3} placeholder="Kilometre taşının önemi, projeye katkısı..." value={reportForm.content} onChange={e => setReportForm((f: any) => ({ ...f, content: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Bir Sonraki Adım</label>
                  <textarea className="input" rows={2} placeholder="Bu aşamadan sonra ne planlanıyor?" value={meta.impact||''} onChange={e => setMeta('impact', e.target.value)} />
                </div>
              </>)}

              {/* ─── FİNANSAL RAPOR ─── */}
              {rtype === 'financial' && (<>
                <div>
                  <label className="label">Raporlama Dönemi</label>
                  <input className="input" placeholder="Örn: Q1 2025 (Ocak – Mart)" value={meta.period||''} onChange={e => setMeta('period', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Toplam Proje Bütçesi (₺)</label>
                    <input type="number" className="input" placeholder="0" value={meta.totalBudget||''} onChange={e => setMeta('totalBudget', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Bu Dönem Harcaması (₺)</label>
                    <input type="number" className="input" placeholder="0" value={meta.spent||''} onChange={e => setMeta('spent', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Kümülatif Harcama (₺)</label>
                    <input type="number" className="input" placeholder="0" value={meta.cumulativeSpent||''} onChange={e => setMeta('cumulativeSpent', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Kalan Bütçe (₺)</label>
                    <input type="number" className="input" placeholder="0" value={meta.remaining||''} onChange={e => setMeta('remaining', e.target.value)} />
                  </div>
                </div>
                {/* Kullanım oranı otomatik */}
                {meta.totalBudget && meta.cumulativeSpent && (
                  <div className="p-3 rounded-xl" style={{ background: '#f8f6f2', border: '1px solid #e8e4dc' }}>
                    <p className="text-xs text-muted mb-1">Bütçe Kullanım Oranı</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: '#e8e4dc' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.round((+meta.cumulativeSpent / +meta.totalBudget) * 100))}%`,
                                   background: +meta.cumulativeSpent / +meta.totalBudget > 0.9 ? '#dc2626' : '#059669' }} />
                      </div>
                      <span className="text-sm font-bold text-navy flex-shrink-0">
                        %{Math.min(100, Math.round((+meta.cumulativeSpent / +meta.totalBudget) * 100))}
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <label className="label">Sapma Açıklaması / Notlar</label>
                  <textarea className="input" rows={3} placeholder="Bütçe sapması varsa nedenleri, dikkat çekilmesi gereken hususlar..." value={reportForm.content} onChange={e => setReportForm((f: any) => ({ ...f, content: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Sapma Nedeni (varsa)</label>
                  <input className="input" placeholder="Örn: Ekipman fiyat artışı, personel değişikliği..." value={meta.varianceReason||''} onChange={e => setMeta('varianceReason', e.target.value)} />
                </div>
              </>)}

              {/* ─── TEKNİK RAPOR ─── */}
              {rtype === 'technical' && (<>
                <div>
                  <label className="label">Araştırma Konusu / Kapsam</label>
                  <input className="input" placeholder="İncelenen konu, teknik alan..." value={meta.topic||''} onChange={e => setMeta('topic', e.target.value)} />
                </div>
                <div>
                  <label className="label">Kullanılan Yöntem ve Araçlar</label>
                  <textarea className="input" rows={3} placeholder="Araştırma metodolojisi, yazılım, ekipman..." value={meta.methodology||''} onChange={e => setMeta('methodology', e.target.value)} />
                </div>
                <div>
                  <label className="label">Bulgular ve Sonuçlar *</label>
                  <textarea required className="input" rows={4} placeholder="Elde edilen teknik bulgular, ölçümler, gözlemler..." value={reportForm.content} onChange={e => setReportForm((f: any) => ({ ...f, content: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Değerlendirme ve Öneriler</label>
                    <textarea className="input" rows={3} placeholder="Bulgulara dayalı öneriler..." value={meta.recommendations||''} onChange={e => setMeta('recommendations', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Kaynakça / Referanslar</label>
                    <textarea className="input" rows={3} placeholder="Kullanılan kaynaklar, atıflar..." value={meta.references||''} onChange={e => setMeta('references', e.target.value)} />
                  </div>
                </div>
              </>)}

              {/* ─── RİSK RAPORU ─── */}
              {rtype === 'risk' && (<>
                <div>
                  <label className="label">Risk Tanımı *</label>
                  <textarea required className="input" rows={2} placeholder="Tespit edilen risk, muhtemel senaryo..." value={reportForm.content} onChange={e => setReportForm((f: any) => ({ ...f, content: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Risk Kategorisi</label>
                    <select className="input" value={meta.category||''} onChange={e => setMeta('category', e.target.value)}>
                      <option value="">Seçiniz...</option>
                      {['Teknik','Finansal','Organizasyonel','Yasal / Mevzuat','Dış Çevre'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Risk Durumu</label>
                    <select className="input" value={meta.riskStatus||''} onChange={e => setMeta('riskStatus', e.target.value)}>
                      <option value="">Seçiniz...</option>
                      <option value="open">Açık</option>
                      <option value="mitigated">Azaltıldı</option>
                      <option value="closed">Kapatıldı</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Olasılık</label>
                    <select className="input" value={meta.probability||''} onChange={e => setMeta('probability', e.target.value)}>
                      <option value="">Seçiniz...</option>
                      {['Çok Düşük','Düşük','Orta','Yüksek','Çok Yüksek'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Etki Derecesi</label>
                    <select className="input" value={meta.impact||''} onChange={e => setMeta('impact', e.target.value)}>
                      <option value="">Seçiniz...</option>
                      {['Çok Düşük','Düşük','Orta','Yüksek','Çok Yüksek'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Azaltma Stratejisi</label>
                    <textarea className="input" rows={3} placeholder="Riski önlemek / azaltmak için alınan tedbirler..." value={meta.mitigation||''} onChange={e => setMeta('mitigation', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Kontenjans Planı</label>
                    <textarea className="input" rows={3} placeholder="Risk gerçekleşirse ne yapılacak..." value={meta.contingency||''} onChange={e => setMeta('contingency', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Sorumlu Kişi</label>
                  <input className="input" placeholder="Ad Soyad" value={meta.owner||''} onChange={e => setMeta('owner', e.target.value)} />
                </div>
              </>)}

              {/* ─── FİNAL RAPOR ─── */}
              {rtype === 'final' && (<>
                <div>
                  <label className="label">Proje Genel Özeti *</label>
                  <textarea required className="input" rows={4} placeholder="Projenin genel amacı, kapsamı ve sürecine dair değerlendirme..." value={reportForm.content} onChange={e => setReportForm((f: any) => ({ ...f, content: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Başarılar ve Çıktılar</label>
                    <textarea className="input" rows={3} placeholder="Elde edilen başarılar, üretilen çıktılar..." value={meta.achievements||''} onChange={e => setMeta('achievements', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Öğrenilen Dersler</label>
                    <textarea className="input" rows={3} placeholder="Neler iyi gitti? Neler farklı yapılabilirdi?" value={meta.lessons||''} onChange={e => setMeta('lessons', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Öneriler</label>
                    <textarea className="input" rows={3} placeholder="Gelecek projeler için tavsiyeler..." value={meta.recommendations||''} onChange={e => setMeta('recommendations', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Açık Kalan Maddeler</label>
                    <textarea className="input" rows={3} placeholder="Tamamlanamayan işler, sonraki adımlar..." value={meta.openItems||''} onChange={e => setMeta('openItems', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Genel Değerlendirme</label>
                    <select className="input" value={meta.evaluation||''} onChange={e => setMeta('evaluation', e.target.value)}>
                      <option value="">Seçiniz...</option>
                      <option value="excellent">Mükemmel</option>
                      <option value="good">İyi</option>
                      <option value="average">Orta</option>
                      <option value="below">Beklentinin Altı</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Yayın / Patent</label>
                    <select className="input" value={meta.publications||'no'} onChange={e => setMeta('publications', e.target.value)}>
                      <option value="no">Yok</option>
                      <option value="submitted">Gönderildi</option>
                      <option value="published">Yayınlandı</option>
                      <option value="patent">Patent Alındı</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Sürdürülebilirlik</label>
                    <select className="input" value={meta.sustainability||''} onChange={e => setMeta('sustainability', e.target.value)}>
                      <option value="">Seçiniz...</option>
                      <option value="high">Yüksek</option>
                      <option value="medium">Orta</option>
                      <option value="low">Düşük</option>
                    </select>
                  </div>
                </div>
              </>)}

              {/* İlerleme barı — sadece progress, milestone, final */}
              {showProgress && (
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="label mb-0">Tamamlanma Oranı</label>
                    <span className="font-display text-xl font-bold text-navy">%{reportForm.progressPercent}</span>
                  </div>
                  <input type="range" min={0} max={100} className="w-full" value={reportForm.progressPercent}
                    onChange={e => setReportForm((f: any) => ({ ...f, progressPercent: +e.target.value }))} />
                  <div className="progress-bar mt-2 h-2.5">
                    <div className="progress-fill h-2.5 transition-all" style={{ width: `${reportForm.progressPercent}%`, background: color }} />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t sticky bottom-0 bg-white pb-1" style={{ borderColor:'#e8e4dc' }}>
                <button type="submit" className="btn-primary flex-1">{editReport ? 'Güncelle' : 'Raporu Kaydet'}</button>
                <button type="button" onClick={() => { setShowReportModal(false); setEditReport(null); }} className="btn-secondary">İptal</button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}


      {tab === 'partners' && (
        <PartnersPanel projectId={id} canEdit={canEdit} />
      )}

      {/* ── GEÇMİŞ / AUDIT LOG ── */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-navy">Proje Geçmişi</h3>
              <p className="text-xs text-muted mt-0.5">Projede gerçekleştirilen tüm değişikliklerin kaydı</p>
            </div>
          </div>

          {auditLoading ? (
            <div className="flex justify-center py-10"><div className="spinner" /></div>
          ) : auditLogs.length === 0 ? (
            <div className="empty-state py-10">
              <div className="empty-state-icon">📋</div>
              <p className="text-sm font-medium text-navy">Henüz kayıt yok</p>
              <p className="text-xs text-muted mt-1">Proje üzerinde yapılan değişiklikler burada görünecek</p>
            </div>
          ) : (
            <div className="space-y-0">
              {auditLogs.map((log, i) => {
                const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
                  created:            { label: 'Oluşturuldu',          icon: '✨', color: '#059669' },
                  updated:            { label: 'Güncellendi',          icon: '✏️', color: '#1a3a6b' },
                  deleted:            { label: 'Silindi',              icon: '🗑️', color: '#dc2626' },
                  status_changed:     { label: 'Durum Değişti',        icon: '🔄', color: '#d97706' },
                  member_added:       { label: 'Üye Eklendi',          icon: '👤', color: '#059669' },
                  member_removed:     { label: 'Üye Çıkarıldı',        icon: '👤', color: '#dc2626' },
                  member_role_changed:{ label: 'Üye Rolü Değişti',     icon: '🔁', color: '#7c3aed' },
                  document_uploaded:  { label: 'Belge Yüklendi',       icon: '📄', color: '#1a3a6b' },
                  document_deleted:   { label: 'Belge Silindi',        icon: '📄', color: '#dc2626' },
                  report_added:       { label: 'Rapor Eklendi',        icon: '📊', color: '#059669' },
                  report_updated:     { label: 'Rapor Güncellendi',    icon: '📊', color: '#1a3a6b' },
                  report_deleted:     { label: 'Rapor Silindi',        icon: '📊', color: '#dc2626' },
                  partner_added:      { label: 'Ortak Eklendi',        icon: '🏛', color: '#059669' },
                  partner_removed:    { label: 'Ortak Kaldırıldı',     icon: '🏛', color: '#dc2626' },
                };
                const meta = ACTION_LABELS[log.action] || { label: log.action, icon: '•', color: '#6b7280' };
                let detail: any = {};
                try { detail = JSON.parse(log.detail || '{}'); } catch {}

                return (
                  <div key={log.id} className="flex gap-4 py-4 border-b last:border-0" style={{ borderColor: '#f5f2ee' }}>
                    {/* Zaman çizelgesi çizgisi */}
                    <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: meta.color + '15', border: `1.5px solid ${meta.color}40` }}>
                        {meta.icon}
                      </div>
                      {i < auditLogs.length - 1 && <div className="flex-1 w-px mt-1" style={{ background: '#f0ede8' }} />}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-sm font-semibold text-navy">{meta.label}</span>
                          {log.user && (
                            <span className="text-xs text-muted ml-2">
                              {log.user.title} {log.user.firstName} {log.user.lastName}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted flex-shrink-0">
                          {new Date(log.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {/* Detay */}
                      {detail.from && detail.to && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#dc2626' }}>{detail.from}</span>
                          <span className="text-xs text-muted">→</span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#059669' }}>{detail.to}</span>
                        </div>
                      )}
                      {detail.name && <p className="text-xs text-muted mt-1">"{detail.name}"</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        @media print {
          aside, .page-header, nav, button, a.btn-secondary, a.btn-danger { display: none !important; }
          body { background: white !important; }
          .card, .card-hover { box-shadow: none !important; border: 1px solid #e8e4dc !important; break-inside: avoid; }
        }
      `}</style>
    </DashboardLayout>
  );
}
