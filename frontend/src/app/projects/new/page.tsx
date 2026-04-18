'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api, projectsApi, documentsApi, facultiesApi, usersApi, scopusApi } from '@/lib/api';
import { SdgPicker } from '@/components/SdgPicker';
import { ProjectComplianceCheck } from '@/components/ProjectComplianceCheck';
import { BudgetEstimator } from '@/components/BudgetEstimator';
import { FundingMatchPanel } from '@/components/FundingMatchPanel';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

/* ─── Sabitler ──────────────────────────────────────────────────────── */
const STATUSES = [
  { value: 'application', label: 'Başvuru Sürecinde', color: '#d97706', desc: 'Henüz başvuru aşamasında' },
  { value: 'active',      label: 'Aktif',             color: '#059669', desc: 'Proje yürütülüyor' },
];

const TYPE_CARDS = [
  { key: 'tubitak',  label: 'TÜBİTAK',       icon: '🔬', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', desc: 'Temel ve uygulamalı araştırma', budget: '200K – 2M ₺', duration: '1-3 yıl' },
  { key: 'bap',      label: 'BAP',            icon: '🏛',  color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', desc: 'Üniversite iç araştırma fonu', budget: '10K – 200K ₺', duration: '6 ay – 2 yıl' },
  { key: 'eu',       label: 'AB Projesi',     icon: '🇪🇺', color: '#d97706', bg: '#fffbeb', border: '#fde68a', desc: 'Horizon Europe ve AB destekleri', budget: '500K – 5M €', duration: '2-5 yıl' },
  { key: 'industry', label: 'Sanayi',         icon: '🏭', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', desc: 'Sanayi-üniversite iş birliği', budget: '100K – 5M ₺', duration: '1-3 yıl' },
  { key: 'other',    label: 'Diğer',          icon: '📁', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', desc: 'Diğer fon kaynakları', budget: '—', duration: '—' },
];

const IP_OPTS = [
  { value: 'none',       label: 'Yok',                color: '#6b7280' },
  { value: 'pending',    label: 'Başvuru Aşamasında', color: '#d97706' },
  { value: 'registered', label: 'Tescilli',            color: '#059669' },
  { value: 'published',  label: 'Yayımlandı',          color: '#2563eb' },
];

const IP_TYPES = [
  { value: 'patent',        label: '🔬 Patent' },
  { value: 'faydali_model', label: '⚙️ Faydalı Model' },
  { value: 'marka',         label: '™ Marka' },
  { value: 'tasarim',       label: '🎨 Tasarım' },
  { value: 'telif',         label: '© Telif Hakkı' },
  { value: 'ticari_sir',    label: '🔒 Ticari Sır' },
];

const PHASES = [
  { key: 'type',    label: 'Proje Türü',      icon: '🎯', desc: 'Ne tür bir proje?' },
  { key: 'basic',   label: 'Temel & Ekip',    icon: '👥', desc: 'Başlık, ekip, kurum' },
  { key: 'content', label: 'İçerik & Uyum',   icon: '📄', desc: 'Metin ve YZ analizi' },
  { key: 'classify',label: 'Sınıflandırma',   icon: '🏷',  desc: 'SKH, etiketler, IP' },
  { key: 'finalize',label: 'Finansal & Onay', icon: '💰', desc: 'Bütçe ve kayıt' },
];

/* ─── Ana Bileşen ───────────────────────────────────────────────────── */
export default function NewProjectPage() {
  const router  = useRouter();
  const { user } = useAuth();
  const [phase, setPhase] = useState(0);
  const [saving, setSaving] = useState(false);

  // Veriler
  const [faculties,     setFaculties]     = useState<string[]>([]);
  const [projectTypes,  setProjectTypes]  = useState<any[]>([]);
  const [dynamicFields, setDynamicFields] = useState<any[]>([]);
  const [allUsers,      setAllUsers]      = useState<any[]>([]);

  // Form state
  const [selectedType, setSelectedType] = useState('');
  const [sdgSelected,  setSdgSelected]  = useState<string[]>([]);
  const [members,      setMembers]      = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', status: 'application',
    faculty: '', department: '', dynamicFields: {} as any,
    budget: '', fundingSource: '', startDate: '', endDate: '',
    projectText: '', tags: '', keywords: '',
    ipStatus: 'none', ipType: '', ipRegistrationNo: '', ipDate: '', ipNotes: '',
  });

  // YZ durumları
  const [complianceResult, setComplianceResult] = useState<any>(null);
  const [complianceDone,   setComplianceDone]   = useState(false);
  const [ethicsAnalysis,   setEthicsAnalysis]   = useState<any>(null);
  const [ethicsLoading,    setEthicsLoading]    = useState(false);
  const [extracting,       setExtracting]       = useState(false);
  const [sdgSuggestions,   setSdgSuggestions]   = useState<string[]>([]);
  const [sdgReasons,       setSdgReasons]       = useState<Record<string,string>>({});
  const [sdgLoading,       setSdgLoading]       = useState(false);
  const [docReview,        setDocReview]        = useState<any>(null);
  const [docReviewLoading, setDocReviewLoading] = useState(false);

  // Belgeler
  const [acceptanceFile, setAcceptanceFile] = useState<File | null>(null);
  const [ipFile,         setIpFile]         = useState<File | null>(null);

  const set  = (k: string, v: any)  => setForm(f => ({ ...f, [k]: v }));
  const setD = (k: string, v: any)  => setForm(f => ({ ...f, dynamicFields: { ...f.dynamicFields, [k]: v } }));

  // Mevcut kullanıcıdan fakülte/bölüm otomatik doldur
  useEffect(() => {
    if (user?.faculty)     set('faculty', user.faculty);
    if (user?.department)  set('department', user.department);
  }, [user]);

  useEffect(() => {
    facultiesApi.getActive().then(r => setFaculties((r.data || []).map((f: any) => f.name))).catch(() => {});
    api.get('/project-types').then(r => setProjectTypes(r.data || [])).catch(() => {});
    api.get('/dynamic-fields').then(r => setDynamicFields(r.data || [])).catch(() => {});
    usersApi.getAll({ limit: 200 }).then(r => setAllUsers(r.data.data || [])).catch(() => {});
  }, []);

  // İçerik adımından SKH adımına geçince SKH öner
  useEffect(() => {
    if (PHASES[phase].key !== 'classify') return;
    if (sdgSuggestions.length || sdgLoading) return;
    if (!form.title && !form.description) return;
    setSdgLoading(true);
    api.post('/ai/suggest-sdg', { title: form.title, description: form.description, projectText: form.projectText })
      .then(r => {
        if (r.data?.suggestions?.length) {
          setSdgSuggestions(r.data.suggestions);
          setSdgReasons(r.data.reasons || {});
        }
      })
      .catch(() => {})
      .finally(() => setSdgLoading(false));
  }, [phase]);

  // Son aşamada belge incelemesi
  useEffect(() => {
    if (PHASES[phase].key !== 'finalize') return;
    const docs: any[] = [];
    if (acceptanceFile) docs.push({ name: acceptanceFile.name, type: 'acceptance', size: acceptanceFile.size });
    if (ipFile) docs.push({ name: ipFile.name, type: 'ip', size: ipFile.size });
    setDocReviewLoading(true);
    api.post('/ai/review-documents', {
      projectTitle: form.title, projectType: selectedType, documents: docs,
      ipStatus: form.ipStatus, ethicsRequired: ethicsAnalysis?.required || false, ethicsApproved: false,
    }).then(r => setDocReview(r.data))
      .catch(() => setDocReview(null))
      .finally(() => setDocReviewLoading(false));
  }, [phase]);

  // Etik analiz — içerik adımından geçince
  const runEthicsAnalysis = useCallback(async () => {
    if (ethicsAnalysis) return;
    setEthicsLoading(true);
    try {
      const r = await api.post('/ethics/preview-analyze', {
        title: form.title, description: form.description,
        projectText: form.projectText, type: selectedType,
      });
      setEthicsAnalysis(r.data);
    } catch {} finally { setEthicsLoading(false); }
  }, [form.title, form.description, form.projectText, selectedType, ethicsAnalysis]);

  // Doğrulama
  const canGoNext = (): boolean => {
    const key = PHASES[phase].key;
    if (key === 'type'    && !selectedType)         { toast.error('Proje türü seçin'); return false; }
    if (key === 'basic'   && !form.title.trim())    { toast.error('Proje adı zorunlu'); return false; }
    if (key === 'content' && !complianceDone)       { toast.error('YZ Uygunluk Kontrolü zorunlu'); return false; }
    return true;
  };

  const goNext = () => {
    if (!canGoNext()) return;
    if (PHASES[phase].key === 'content') runEthicsAnalysis();
    setPhase(p => p + 1);
  };
  const goPrev = () => setPhase(p => p - 1);

  // Belge yükle
  const uploadFile = async (pid: string, file: File, name: string, type: string) => {
    const fd = new FormData();
    fd.append('file', file); fd.append('name', name); fd.append('type', type);
    await documentsApi.upload(pid, fd);
  };

  // Kaydet
  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Proje adı zorunlu'); return; }
    if (!complianceDone) { toast.error('YZ Uygunluk Kontrolü zorunludur'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title, description: form.description,
        type: selectedType, status: form.status,
        faculty: form.faculty, department: form.department,
        budget: form.budget ? Number(form.budget) : null,
        fundingSource: form.fundingSource, startDate: form.startDate, endDate: form.endDate,
        projectText: form.projectText,
        tags:     form.tags     ? form.tags.split(',').map(t => t.trim()).filter(Boolean)     : [],
        keywords: form.keywords ? form.keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
        sdgGoals: sdgSelected, dynamicFields: form.dynamicFields,
        ipStatus: form.ipStatus, ipType: form.ipType || null,
        ipRegistrationNo: form.ipRegistrationNo || null,
        ipDate: form.ipDate || null, ipNotes: form.ipNotes || null,
        ethicsRequired: ethicsAnalysis?.required || false, ethicsApproved: false,
        aiComplianceScore:  complianceResult?.score || null,
        aiComplianceResult: complianceResult ? JSON.stringify(complianceResult) : null,
      };

      const res = await projectsApi.create(payload);
      const pid = res.data.id;

      // Üyeleri ekle
      for (const m of members) {
        await projectsApi.addMember(pid, { userId: m.id, role: 'researcher', canUpload: false }).catch(() => {});
      }
      if (acceptanceFile) await uploadFile(pid, acceptanceFile, 'Başvuru Kabul Belgesi', 'acceptance').catch(() => {});
      if (ipFile)         await uploadFile(pid, ipFile, 'Fikri Mülkiyet Belgesi', 'ip').catch(() => {});
      if (ethicsAnalysis?.required) await api.post('/ethics/analyze/' + pid).catch(() => {});

      toast.success(ethicsAnalysis?.required ? 'Proje oluşturuldu — Etik kurul incelemesine gönderildi!' : 'Proje başarıyla oluşturuldu!');
      router.push('/projects/' + pid);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Bir hata oluştu');
    } finally { setSaving(false); }
  };

  // Üye ekle/çıkar
  const addMember = (u: any) => {
    if (u.id === user?.id) return;
    if (members.find(m => m.id === u.id)) return;
    setMembers(ms => [...ms, u]);
    setMemberSearch('');
  };
  const removeMember = (id: string) => setMembers(ms => ms.filter(m => m.id !== id));

  const filteredUsers = allUsers
    .filter(u => u.id !== user?.id && !members.find(m => m.id === u.id))
    .filter(u => memberSearch && (u.firstName + ' ' + u.lastName + ' ' + u.email).toLowerCase().includes(memberSearch.toLowerCase()))
    .slice(0, 5);

  const FileField = ({ label, file, onChange, hint, required }: any) => (
    <div>
      <label className="label">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      {hint && <p className="text-xs text-muted mb-1">{hint}</p>}
      <label className="block cursor-pointer">
        <div className="input flex items-center gap-2 cursor-pointer h-10" style={{ background: file ? '#f0fdf4' : undefined }}>
          <span className="text-sm truncate" style={{ color: file ? '#059669' : '#9ca3af' }}>
            {file ? `✓ ${file.name} (${Math.round(file.size / 1024)} KB)` : 'Dosya seçin (PDF, Word)'}
          </span>
          {file && <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(null); }} className="ml-auto text-red-400 text-xs">✕</button>}
        </div>
        <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
      </label>
    </div>
  );

  /* ─── Faz İçerikleri ──────────────────────────────────────────── */
  const renderPhase = () => {
    switch (PHASES[phase].key) {

      /* FAZ 1 — TÜR SEÇİMİ */
      case 'type': return (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-navy mb-1">Proje türünü seçin</h2>
            <p className="text-sm text-muted">Seçtiğiniz türe göre form ve gereksinimler otomatik uyarlanır</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TYPE_CARDS.map(tc => {
              // DB'den gelen label varsa kullan
              const dbType = projectTypes.find(t => t.key === tc.key);
              const label  = dbType?.label || tc.label;
              const active = selectedType === tc.key;
              return (
                <button key={tc.key} type="button" onClick={() => setSelectedType(tc.key)}
                  className="p-5 rounded-2xl text-left transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: active ? tc.bg : 'white',
                    border:     `2px solid ${active ? tc.color : '#e8e4dc'}`,
                    boxShadow:  active ? `0 4px 20px ${tc.color}22` : '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl">{tc.icon}</span>
                    {active && <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: tc.color }}>✓</span>}
                  </div>
                  <p className="font-display font-semibold text-base mb-0.5" style={{ color: active ? tc.color : '#0f2444' }}>{label}</p>
                  <p className="text-xs text-muted mb-3 leading-relaxed">{tc.desc}</p>
                  <div className="flex gap-3 text-xs" style={{ color: tc.color }}>
                    <span>💰 {tc.budget}</span>
                    <span>⏱ {tc.duration}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );

      /* FAZ 2 — TEMEL & EKİP */
      case 'basic': return (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-navy mb-1">Temel bilgiler ve ekip</h2>
            <p className="text-sm text-muted">Proje başlığı, kurumsal bilgiler ve ekip üyeleri</p>
          </div>

          {/* Başlık + Özet */}
          <div className="card p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-navy">📋 Proje Kimliği</h3>
            <div>
              <label className="label">Proje Adı *</label>
              <input className="input text-base" value={form.title} autoFocus
                onChange={e => set('title', e.target.value)} placeholder="Projenin tam adını girin..." />
            </div>
            <div>
              <label className="label flex justify-between">
                <span>Proje Özeti</span>
                <span className="text-xs text-muted font-normal">{form.description.length} karakter</span>
              </label>
              <textarea className="input" rows={3} value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="2-3 cümleyle projenizin amacını tanımlayın..." />
            </div>
            <div>
              <label className="label">Durum</label>
              <div className="flex gap-3">
                {STATUSES.map(s => (
                  <button key={s.value} type="button" onClick={() => set('status', s.value)}
                    className="flex-1 p-3 rounded-xl text-left transition-all border-2"
                    style={{
                      borderColor: form.status === s.value ? s.color : '#e8e4dc',
                      background:  form.status === s.value ? s.color + '10' : 'white',
                    }}>
                    <p className="text-xs font-bold" style={{ color: form.status === s.value ? s.color : '#374151' }}>{s.label}</p>
                    <p className="text-xs text-muted">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Kurumsal */}
          <div className="card p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-navy">🏛 Kurumsal Bilgiler</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Fakülte</label>
                <select className="input" value={form.faculty} onChange={e => set('faculty', e.target.value)}>
                  <option value="">Seçin</option>
                  {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Bölüm / Birim</label>
                <input className="input" value={form.department} onChange={e => set('department', e.target.value)} placeholder="Bilgisayar Mühendisliği..." />
              </div>
            </div>
            {dynamicFields.length > 0 && (
              <div className="space-y-3 pt-2 border-t" style={{ borderColor: '#f0ede8' }}>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Ek Alanlar</p>
                {dynamicFields.map(field => (
                  <div key={field.id}>
                    <label className="label">{field.label || field.name}</label>
                    {field.type === 'textarea'
                      ? <textarea className="input" value={form.dynamicFields[field.key] || ''} onChange={e => setD(field.key, e.target.value)} />
                      : field.type === 'select'
                      ? <select className="input" value={form.dynamicFields[field.key] || ''} onChange={e => setD(field.key, e.target.value)}>
                          <option value="">Seçin</option>
                          {field.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      : <input type={field.type === 'number' ? 'number' : 'text'} className="input"
                          value={form.dynamicFields[field.key] || ''} onChange={e => setD(field.key, e.target.value)} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ekip */}
          <div className="card p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-navy">👥 Proje Ekibi</h3>
            {/* Yürütücü (mevcut kullanıcı) */}
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#c8a45a,#e8c97a)' }}>
                {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-navy">{user?.title} {user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted">{user?.department}</p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fde68a', color: '#92400e' }}>Yürütücü</span>
            </div>

            {/* Eklenen üyeler */}
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#faf8f4', border: '1px solid #e8e4dc' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#e8e4dc', color: '#6b7280' }}>
                  {(m.firstName?.[0] || '') + (m.lastName?.[0] || '')}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-navy">{m.title} {m.firstName} {m.lastName}</p>
                  <p className="text-xs text-muted">{m.department}</p>
                </div>
                <button type="button" onClick={() => removeMember(m.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#fff0f0', color: '#dc2626' }}>✕</button>
              </div>
            ))}

            {/* Arama */}
            <div className="relative">
              <input className="input" placeholder="Araştırmacı ekle — isim veya e-posta..."
                value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
              {filteredUsers.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl shadow-lg bg-white border" style={{ borderColor: '#e8e4dc' }}>
                  {filteredUsers.map(u => (
                    <button key={u.id} type="button" onClick={() => addMember(u)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left first:rounded-t-xl last:rounded-b-xl">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#f0ede8', color: '#6b7280' }}>
                        {(u.firstName?.[0] || '') + (u.lastName?.[0] || '')}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-navy">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-muted">{u.department || u.role?.name}</p>
                      </div>
                      <span className="ml-auto text-xs text-navy font-semibold">+ Ekle</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );

      /* FAZ 3 — İÇERİK & UYUM */
      case 'content': return (
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-navy mb-1">Proje içeriği ve uygunluk</h2>
            <p className="text-sm text-muted">Proje metnini yazın veya belgeden çekin, ardından YZ analizi yapın</p>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-navy">📄 Proje Metni</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{form.projectText.length} karakter</span>
                <label className="cursor-pointer flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
                  style={{ background: extracting ? '#f0ede8' : '#f5f3ff', color: extracting ? '#9ca3af' : '#7c3aed', border: '1px solid #ddd6fe' }}>
                  {extracting ? <><span className="spinner w-3 h-3" /> Çekiliyor...</> : <>📎 Belgeden Çek</>}
                  <input type="file" accept=".txt,.pdf,.docx" className="hidden" disabled={extracting}
                    onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setExtracting(true);
                      try {
                        if (file.name.endsWith('.txt')) {
                          const text = await new Promise<string>(res => {
                            const r = new FileReader(); r.onload = ev => res((ev.target?.result as string) || ''); r.readAsText(file, 'utf-8');
                          });
                          set('projectText', text);
                        } else {
                          const fd = new FormData(); fd.append('file', file);
                          const r = await api.post('/ai/extract-text', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                          if (r.data?.text) set('projectText', r.data.text);
                          else if (r.data?.error) toast.error(r.data.error);
                        }
                        setComplianceDone(false); setEthicsAnalysis(null);
                      } catch { toast.error('Metin çıkarılamadı'); }
                      finally { setExtracting(false); e.target.value = ''; }
                    }} />
                </label>
              </div>
            </div>

            <div className="p-3 rounded-xl text-xs" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
              📋 Proje metni, özetten farklı olarak projenin tüm detaylarını içerir. <strong>YZ Uygunluk Kontrolü zorunludur</strong> — devam etmek için yapın.
            </div>

            <textarea className="input" style={{ minHeight: 280, lineHeight: 1.8 }} value={form.projectText}
              onChange={e => { set('projectText', e.target.value); setComplianceDone(false); setEthicsAnalysis(null); }}
              placeholder={'Detaylı proje açıklaması...\n\n• Projenin amacı ve önemi\n• Araştırma sorusu / hipotez\n• Yöntem ve yaklaşım\n• Beklenen çıktılar ve hedefler\n• Zaman çizelgesi'} />

            {/* YZ Uygunluk */}
            <div className="p-4 rounded-xl" style={{
              border: complianceDone ? '2px solid #86efac' : '2px solid #fde68a',
              background: complianceDone ? '#f0fdf4' : '#fffbeb',
            }}>
              {complianceDone
                ? <p className="text-xs font-semibold text-green-700 mb-2">✅ YZ Uygunluk Kontrolü tamamlandı — bir sonraki adıma geçebilirsiniz</p>
                : <p className="text-xs font-semibold text-amber-700 mb-2">⚠️ Devam etmek için aşağıdaki YZ kontrolünü yapın</p>
              }
              <ProjectComplianceCheck
                title={form.title} description={form.description}
                projectText={form.projectText} type={selectedType}
                onResult={r => { setComplianceResult(r); setComplianceDone(true); }}
              />
            </div>
          </div>

          {/* Etik Ön Analizi — metin yazıldıktan sonra çalıştır */}
          {complianceDone && (
            <div className="card p-5">
              <h3 className="font-display text-sm font-semibold text-navy mb-3">🔬 Etik Ön Analizi</h3>
              {ethicsLoading && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="spinner w-4 h-4" /> YZ etik riski analiz ediliyor...
                </div>
              )}
              {!ethicsLoading && !ethicsAnalysis && (
                <button type="button" onClick={runEthicsAnalysis}
                  className="text-xs font-semibold px-3 py-2 rounded-lg"
                  style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                  🔬 Etik Risk Analizi Yap
                </button>
              )}
              {ethicsAnalysis && !ethicsLoading && (
                <div className="p-3 rounded-xl" style={{
                  border: '1px solid', borderColor: ethicsAnalysis.required ? '#fca5a5' : '#86efac',
                  background: ethicsAnalysis.required ? '#fef2f2' : '#f0fdf4',
                }}>
                  <p className="text-sm font-bold" style={{ color: ethicsAnalysis.required ? '#dc2626' : '#059669' }}>
                    {ethicsAnalysis.required ? '⚠️ Etik Kurul Onayı Gerekiyor' : '✅ Etik Kurul Gerekmiyor'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: ethicsAnalysis.required ? '#dc2626' : '#059669' }}>
                    Risk Skoru: {ethicsAnalysis.riskScore}/100 — {ethicsAnalysis.recommendation}
                  </p>
                  {(ethicsAnalysis.reasons || []).map((r: string, i: number) => (
                    <p key={i} className="text-xs text-muted">• {r}</p>
                  ))}
                  {ethicsAnalysis.required && (
                    <p className="text-xs mt-2 font-semibold text-amber-700">⚡ Kaydedilince otomatik etik kurul incelemesine gönderilecektir.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );

      /* FAZ 4 — SINIFLANDIRMA */
      case 'classify': return (
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-navy mb-1">Sınıflandırma ve IP</h2>
            <p className="text-sm text-muted">SKH hedefleri, anahtar kelimeler ve fikri mülkiyet</p>
          </div>

          {/* SKH */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-navy">🌍 Sürdürülebilir Kalkınma Hedefleri</h3>
              {sdgLoading && <span className="text-xs text-muted flex items-center gap-1"><span className="spinner w-3 h-3" /> YZ öneri hazırlıyor...</span>}
            </div>

            {/* YZ Önerileri */}
            {sdgSuggestions.length > 0 && (
              <div className="p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
                <p className="text-xs font-semibold text-green-800 mb-2">✨ YZ Önerileri — proje içeriğinize göre</p>
                <div className="flex flex-wrap gap-2">
                  {sdgSuggestions.map(code => {
                    const already = sdgSelected.includes(code);
                    return (
                      <button key={code} type="button"
                        onClick={() => setSdgSelected(s => already ? s.filter(c => c !== code) : [...s, code])}
                        className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                        style={{ background: already ? '#059669' : 'white', color: already ? 'white' : '#059669', border: '1.5px solid #86efac' }}
                        title={sdgReasons[code]}>
                        {already ? '✓ ' : '+ '}{code}
                      </button>
                    );
                  })}
                </div>
                {sdgSuggestions.some(s => !sdgSelected.includes(s)) && (
                  <button type="button" onClick={() => setSdgSelected(s => [...new Set([...s, ...sdgSuggestions])])}
                    className="mt-2 text-xs text-green-700 font-semibold hover:underline">
                    Tümünü Ekle →
                  </button>
                )}
              </div>
            )}

            <SdgPicker selected={sdgSelected} onChange={setSdgSelected} />
          </div>

          {/* Etiketler + Anahtar kelimeler */}
          <div className="card p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-navy">🏷 Etiketler & Anahtar Kelimeler</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Etiketler</label>
                <input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="yapay zeka, enerji, çevre..." />
                <p className="text-xs text-muted mt-1">Virgülle ayırın</p>
              </div>
              <div>
                <label className="label">Anahtar Kelimeler</label>
                <input className="input" value={form.keywords} onChange={e => set('keywords', e.target.value)} placeholder="machine learning, NLP..." />
              </div>
            </div>
          </div>

          {/* IP */}
          <div className="card p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-navy">⚖️ Fikri Mülkiyet</h3>
            <p className="text-xs text-muted">Patent, faydalı model, marka gibi fikri mülkiyet korumanız varsa belirtin.</p>
            <div className="grid grid-cols-4 gap-2">
              {IP_OPTS.map(o => (
                <button key={o.value} type="button" onClick={() => set('ipStatus', o.value)}
                  className="p-3 rounded-xl border-2 text-center transition-all"
                  style={{ borderColor: form.ipStatus === o.value ? o.color : '#e8e4dc', background: form.ipStatus === o.value ? o.color + '12' : 'white' }}>
                  <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1" style={{ background: o.color }} />
                  <p className="text-xs font-semibold leading-tight" style={{ color: form.ipStatus === o.value ? o.color : '#374151' }}>{o.label}</p>
                </button>
              ))}
            </div>
            {form.ipStatus !== 'none' && (
              <div className="space-y-3 pt-2 border-t" style={{ borderColor: '#f0ede8' }}>
                <div className="grid grid-cols-3 gap-2">
                  {IP_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => set('ipType', t.value)}
                      className="p-2.5 rounded-xl border text-xs font-medium transition-all"
                      style={{ borderColor: form.ipType === t.value ? '#7c3aed' : '#e8e4dc', background: form.ipType === t.value ? '#f5f3ff' : 'white', color: form.ipType === t.value ? '#7c3aed' : '#374151' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Tescil / Başvuru No</label>
                    <input className="input" value={form.ipRegistrationNo} onChange={e => set('ipRegistrationNo', e.target.value)} placeholder="TR2024/001234" />
                  </div>
                  <div>
                    <label className="label">Tarih</label>
                    <input type="date" className="input" value={form.ipDate} onChange={e => set('ipDate', e.target.value)} />
                  </div>
                </div>
                <FileField label="Fikri Mülkiyet Belgesi" file={ipFile} onChange={setIpFile}
                  required={['registered','published'].includes(form.ipStatus)}
                  hint="Patent başvuru formu veya tescil belgesi" />
              </div>
            )}
          </div>
        </div>
      );

      /* FAZ 5 — FİNANSAL & ONAY */
      case 'finalize': return (
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-navy mb-1">Finansal bilgiler ve onay</h2>
            <p className="text-sm text-muted">Bütçe, tarihler, belgeler ve son kontrol</p>
          </div>

          {/* Finansal */}
          <div className="card p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-navy">💰 Bütçe & Tarihler</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Bütçe (₺)</label>
                <input type="number" className="input" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="label">Fon Kaynağı</label>
                <input className="input" value={form.fundingSource} onChange={e => set('fundingSource', e.target.value)} placeholder="TÜBİTAK, BAP, AB..." />
              </div>
            </div>
            <BudgetEstimator type={selectedType} faculty={form.faculty} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Başlangıç Tarihi</label>
                <input type="date" className="input" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
              </div>
              <div>
                <label className="label">Bitiş Tarihi</label>
                <input type="date" className="input" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Scopus Hibe Analizi */}
          <div className="card p-5">
            <h3 className="font-display text-sm font-semibold text-navy mb-3">🎯 Hibe Uygunluk Analizi</h3>
            <FundingMatchPanel
              keywords={form.keywords ? form.keywords.split(',').map(k => k.trim()).filter(Boolean) : []}
              tags={form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []}
              projectType={selectedType}
              title={form.title}
            />
          </div>

          {/* Belgeler */}
          <div className="card p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-navy">📎 Belgeler</h3>
            {form.status === 'active' && (
              <FileField label="Başvuru Kabul Belgesi" file={acceptanceFile} onChange={setAcceptanceFile}
                required={form.status === 'active'} hint="Aktif proje için zorunlu" />
            )}
            {form.ipStatus !== 'none' && !ipFile && (
              <FileField label="Fikri Mülkiyet Belgesi" file={ipFile} onChange={setIpFile}
                hint="Daha önce eklemediyseniz buradan yükleyebilirsiniz" />
            )}
            {form.status !== 'active' && form.ipStatus === 'none' && (
              <p className="text-xs text-muted text-center py-2">Proje kaydedildikten sonra Belgeler sekmesinden dosya yükleyebilirsiniz.</p>
            )}

            {/* YZ Belge İncelemesi */}
            {docReview && !docReviewLoading && (
              <div className="p-3 rounded-xl text-xs" style={{
                background: docReview.status === 'ok' ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${docReview.status === 'ok' ? '#86efac' : '#fde68a'}`,
              }}>
                <p className="font-semibold mb-1" style={{ color: docReview.status === 'ok' ? '#059669' : '#d97706' }}>
                  🤖 {docReview.summary}
                </p>
                {(docReview.issues || []).map((iss: any, i: number) => (
                  <p key={i} style={{ color: iss.severity === 'warning' ? '#d97706' : '#6b7280' }}>
                    {iss.severity === 'warning' ? '⚠️' : 'ℹ️'} {iss.message}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Özet */}
          <div className="card p-5 space-y-2" style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
            <p className="text-xs font-bold uppercase tracking-wider text-navy">📋 Proje Özeti</p>
            {[
              ['Tür',    TYPE_CARDS.find(t => t.key === selectedType)?.label || selectedType],
              ['Başlık', form.title],
              ['Durum',  STATUSES.find(s => s.value === form.status)?.label],
              form.faculty    ? ['Fakülte', form.faculty]    : null,
              form.department ? ['Bölüm',   form.department] : null,
              form.budget     ? ['Bütçe',   Number(form.budget).toLocaleString('tr-TR') + ' ₺'] : null,
              sdgSelected.length ? ['SKH', sdgSelected.length + ' hedef'] : null,
              members.length     ? ['Ekip', members.length + ' üye eklendi'] : null,
              complianceResult   ? ['YZ Uygunluk', complianceResult.score + '/100'] : null,
              ethicsAnalysis     ? ['Etik Risk', ethicsAnalysis.riskScore + '/100 — ' + (ethicsAnalysis.required ? 'Kurul gerekli' : 'Gerekmiyor')] : null,
            ].filter(Boolean).map(([k, v]: any, i) => (
              <div key={i} className="flex justify-between text-sm border-b pb-1.5 last:border-0" style={{ borderColor: '#e8e4dc' }}>
                <span className="text-muted">{k}</span>
                <span className="font-medium text-navy text-right ml-4">{v}</span>
              </div>
            ))}
          </div>
        </div>
      );

      default: return null;
    }
  };

  const isLast = phase === PHASES.length - 1;

  return (
    <DashboardLayout>
      <Header title="Yeni Proje Oluştur" />

      {/* İlerleme çubuğu */}
      <div className="px-6 pt-5 pb-0 bg-white border-b" style={{ borderColor: '#e8e4dc' }}>
        <div className="flex items-center gap-0 max-w-4xl mx-auto">
          {PHASES.map((p, i) => {
            const done   = i < phase;
            const active = i === phase;
            return (
              <div key={p.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1 min-w-[56px]">
                  <button
                    type="button"
                    onClick={() => i < phase && setPhase(i)}
                    disabled={i > phase}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                    style={{
                      background: done ? '#059669' : active ? '#0f2444' : '#f0ede8',
                      color:      done || active ? 'white' : '#9ca3af',
                      cursor:     i < phase ? 'pointer' : 'default',
                    }}>
                    {done ? '✓' : p.icon}
                  </button>
                  <p className="text-xs font-medium leading-tight text-center"
                    style={{ color: active ? '#0f2444' : done ? '#059669' : '#9ca3af', maxWidth: 64 }}>
                    {p.label}
                  </p>
                </div>
                {i < PHASES.length - 1 && (
                  <div className="flex-1 h-0.5 mb-5 mx-1" style={{ background: i < phase ? '#059669' : '#e8e4dc' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6" style={{ maxWidth: 860, margin: '0 auto' }}>
        <div className="mb-6">{renderPhase()}</div>

        {/* Navigasyon */}
        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: '#e8e4dc' }}>
          <button type="button" onClick={goPrev} disabled={phase === 0}
            className="btn-secondary disabled:opacity-40">
            ← Geri
          </button>
          <span className="text-xs text-muted">{phase + 1} / {PHASES.length}</span>
          {isLast
            ? <button type="button" onClick={handleSubmit} disabled={saving}
                className="btn-primary px-8">
                {saving ? <><span className="spinner w-4 h-4 mr-2" />Kaydediliyor...</> : '🚀 Projeyi Oluştur'}
              </button>
            : <button type="button" onClick={goNext} className="btn-primary">
                Devam Et →
              </button>
          }
        </div>
      </div>
    </DashboardLayout>
  );
}
