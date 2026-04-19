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

/* ─── Icon helper ─────────────────────────────────────── */
type NewProjIconName =
  | 'clipboard' | 'building' | 'users' | 'document' | 'beaker' | 'globe' | 'tag'
  | 'scale' | 'dollar' | 'target' | 'paperclip' | 'rocket' | 'check' | 'x'
  | 'alert' | 'info' | 'sparkles' | 'bolt' | 'robot' | 'arrow-right' | 'arrow-left'
  | 'plus' | 'search' | 'bulb';

const NP_ICONS: Record<NewProjIconName, string> = {
  clipboard:   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  building:    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  users:       'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  document:    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  beaker:      'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  globe:       'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  tag:         'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  scale:       'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
  dollar:      'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  target:      'M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z',
  paperclip:   'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13',
  rocket:      'M13 10V3L4 14h7v7l9-11h-7z',
  check:       'M5 13l4 4L19 7',
  x:           'M6 18L18 6M6 6l12 12',
  alert:       'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  info:        'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  sparkles:    'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  bolt:        'M13 10V3L4 14h7v7l9-11h-7z',
  robot:       'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  'arrow-right':'M17 8l4 4m0 0l-4 4m4-4H3',
  'arrow-left':'M10 19l-7-7m0 0l7-7m-7 7h18',
  plus:        'M12 4v16m8-8H4',
  search:      'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  bulb:        'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
};

function NPIcon({ name, className = 'w-4 h-4', strokeWidth = 1.8, style }: { name: NewProjIconName; className?: string; strokeWidth?: number; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={NP_ICONS[name]} />
    </svg>
  );
}

/* ── Scopus Wizard Paneli ────────────────────────────────────────── */
function ScopusWizardPanel({ title, description, projectText, keywords }: {
  title: string; description?: string; projectText?: string; keywords: string[]
}) {
  const [result, setResult]     = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!title.trim()) { toast.error('Önce proje başlığı girin'); return; }
    setLoading(true);
    setSearched(true);
    try {
      const r = await scopusApi.findSimilarResearch({ title, description, projectText, keywords });
      setResult(r.data);
    } catch { setResult(null); }
    finally { setLoading(false); }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-navy">Scopus Veritabanı Taraması</h3>
          <p className="text-xs text-muted mt-0.5">Proje basligi ve anahtar kelimelere gore dunya literatürü taranır</p>
        </div>
        <button type="button" onClick={search} disabled={loading}
          className="btn-primary text-sm px-4">
          {loading ? <><span className="spinner w-4 h-4 mr-2" />Taranıyor...</> : 'Tara'}
        </button>
      </div>

      {!searched && (
        <div className="py-8 text-center text-sm text-muted">
          "Tara" butonuna basarak dünyadaki benzer akademik çalışmaları görün.
        </div>
      )}

      {searched && !loading && !result && (
        <div className="py-6 text-center text-sm text-muted">
          Scopus bağlantısı kurulamadı veya sonuç bulunamadı.
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: result.total > 50 ? '#fef3c7' : result.total > 0 ? '#f0fdf4' : '#faf8f4', border: '1px solid #e8e4dc' }}>
            <div>
              <p className="text-sm font-semibold text-navy">Scopus'ta {result.total?.toLocaleString('tr-TR')} benzer çalışma bulundu</p>
              <p className="text-xs text-muted mt-0.5">
                {result.total > 100 ? 'Bu alan çok aktif — literatür taraması kritik önem taşıyor.' :
                 result.total > 20  ? 'Orta yoğunlukta çalışma var — özgünlük vurgulayın.' :
                 result.total > 0   ? 'Nispeten az çalışma — niş bir alan olabilir.' :
                 'Henüz yayın bulunamadı — potansiyel olarak yeni bir alan.'}
              </p>
            </div>
            {result.total > 100 && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full ml-auto flex-shrink-0"
                style={{ background: '#fde68a', color: '#92400e' }}>
                Yüksek Rekabet
              </span>
            )}
            {result.total > 0 && result.total <= 20 && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full ml-auto flex-shrink-0"
                style={{ background: '#d1fae5', color: '#065f46' }}>
                Niş Alan
              </span>
            )}
          </div>

          {(result.results || []).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">En Çok Atıf Alan Çalışmalar</p>
              {result.results.slice(0, 6).map((p: any, i: number) => (
                <div key={i} className="p-3 rounded-xl text-xs space-y-1"
                  style={{ background: '#faf8f4', border: '1px solid #e8e4dc' }}>
                  <p className="font-semibold text-navy leading-snug">{p.title}</p>
                  <div className="flex items-center gap-3 text-muted flex-wrap">
                    {p.firstAuthor && <span>{p.firstAuthor}</span>}
                    {p.journal && <span>{p.journal}</span>}
                    {p.year && <span>{p.year}</span>}
                    {p.citedBy > 0 && <span className="font-semibold" style={{ color: '#059669' }}>{p.citedBy} atıf</span>}
                    {p.doi && (
                      <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer"
                        className="font-medium hover:underline" style={{ color: '#1a3a6b' }}>
                        DOI
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Sabitler ──────────────────────────────────────────────────────── */
function ScopusLiteraturePhase({ title, description, projectText, keywords, tags, projectType }: any) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-navy mb-1">Literatür Taraması</h2>
        <p className="text-sm text-muted">Projenizi kaydetmeden önce dünya literatüründe benzer çalışmaları inceleyin ve uygun hibe kaynaklarını görün</p>
      </div>
      <div className="p-3 rounded-xl text-xs" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
        Bu adım isteğe bağlıdır. Benzer çalışmalar projenizin özgünlüğünü belirlemenize, hibe önerileri ise fon hedeflemenize yardımcı olur.
      </div>
      <ScopusWizardPanel title={title} description={description} projectText={projectText} keywords={[...keywords, ...tags]} />
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold text-navy mb-3">Hibe Uygunluk Analizi</h3>
        <p className="text-xs text-muted mb-3">Proje konunuza göre uygun fon kaynaklarını Scopus konu sınıflandırmasıyla analiz edin</p>
        <FundingMatchPanel keywords={keywords} tags={tags} projectType={projectType} title={title} />
      </div>
    </div>
  );
}

const STATUSES = [
  { value: 'application', label: 'Başvuru Sürecinde', color: '#d97706', desc: 'Henüz başvuru aşamasında' },
  { value: 'active',      label: 'Aktif',             color: '#059669', desc: 'Proje yürütülüyor' },
];

const TYPE_CARDS_DEFAULT = [
  { key: 'tubitak',  label: 'TÜBİTAK',    color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', desc: 'Temel ve uygulamalı araştırma', budget: '200K – 2M TL', duration: '1-3 yıl' },
  { key: 'bap',      label: 'BAP',         color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', desc: 'Üniversite iç araştırma fonu',  budget: '10K – 200K TL', duration: '6 ay – 2 yıl' },
  { key: 'eu',       label: 'AB Projesi',  color: '#d97706', bg: '#fffbeb', border: '#fde68a', desc: 'Horizon Europe ve AB destekleri', budget: '500K – 5M EUR', duration: '2-5 yıl' },
  { key: 'industry', label: 'Sanayi',      color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', desc: 'Sanayi-üniversite iş birligi',  budget: '100K – 5M TL', duration: '1-3 yıl' },
  { key: 'other',    label: 'Diger',       color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', desc: 'Diger fon kaynakları',          budget: '—', duration: '—' },
];

const IP_OPTS = [
  { value: 'none',       label: 'Yok',                color: '#6b7280' },
  { value: 'pending',    label: 'Başvuru Aşamasında', color: '#d97706' },
  { value: 'registered', label: 'Tescilli',            color: '#059669' },
  { value: 'published',  label: 'Yayımlandı',          color: '#2563eb' },
];

const IP_TYPES = [
  { value: 'patent',        label: 'Patent' },
  { value: 'faydali_model', label: 'Faydalı Model' },
  { value: 'marka',         label: 'Marka' },
  { value: 'tasarim',       label: 'Tasarım' },
  { value: 'telif',         label: 'Telif Hakkı' },
  { value: 'ticari_sir',    label: 'Ticari Sır' },
];

const PHASES = [
  { key: 'type',     label: 'Proje Türü',      desc: 'Ne tür bir proje?' },
  { key: 'basic',    label: 'Temel ve Ekip',   desc: 'Başlık, ekip, kurum' },
  { key: 'content',  label: 'İçerik ve Uyum',  desc: 'Metin ve YZ analizi' },
  { key: 'classify', label: 'Sınıflandırma',   desc: 'SKH, etiketler, IP' },
  { key: 'scopus',   label: 'Literatür Tarama', desc: 'Benzer çalışmalar' },
  { key: 'finalize', label: 'Finansal ve Onay', desc: 'Bütçe ve kayıt' },
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

  // Form düzeyinde doğrulama
  const validateBeforeSubmit = (): string | null => {
    if (!form.title.trim()) return 'Proje adı zorunlu';
    if (!complianceDone) return 'YZ Uygunluk Kontrolü zorunludur';
    if (form.budget) {
      const b = Number(form.budget);
      if (!Number.isFinite(b) || b < 0) return 'Bütçe negatif olamaz';
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      return 'Bitiş tarihi başlangıçtan önce olamaz';
    }
    if (['registered', 'published'].includes(form.ipStatus) && !ipFile && !form.ipRegistrationNo) {
      return 'Tescilli/Yayımlı IP için belge veya başvuru numarası gerekli';
    }
    return null;
  };

  // Kaydet
  const handleSubmit = async () => {
    const err = validateBeforeSubmit();
    if (err) { toast.error(err); return; }
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

      // Üyeleri ekle — hataları say, tam sessiz kalma
      let memberFailures = 0;
      for (const m of members) {
        try {
          await projectsApi.addMember(pid, { userId: m.id, role: 'researcher', canUpload: false });
        } catch { memberFailures++; }
      }
      if (memberFailures > 0) toast.error(`${memberFailures} üye eklenemedi — proje detayından tekrar deneyin.`);

      // Belge yüklemeleri — başarısızlığı kullanıcıya bildir
      if (acceptanceFile) {
        try { await uploadFile(pid, acceptanceFile, 'Başvuru Kabul Belgesi', 'acceptance'); }
        catch { toast.error('Başvuru kabul belgesi yüklenemedi — detay sayfasından elle yükleyin.'); }
      }
      if (ipFile) {
        try { await uploadFile(pid, ipFile, 'Fikri Mülkiyet Belgesi', 'ip'); }
        catch { toast.error('IP belgesi yüklenemedi — detay sayfasından elle yükleyin.'); }
      }
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
          {file && <NPIcon name="check" className="w-4 h-4 flex-shrink-0" style={{ color: '#059669' }} strokeWidth={2.4} />}
          <span className="text-sm truncate" style={{ color: file ? '#059669' : '#9ca3af' }}>
            {file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : 'Dosya seçin (PDF, Word)'}
          </span>
          {file && (
            <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(null); }}
              aria-label="Dosyayı kaldır"
              className="ml-auto text-red-400 hover:text-red-600">
              <NPIcon name="x" className="w-3.5 h-3.5" strokeWidth={2.2} />
            </button>
          )}
        </div>
        <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
      </label>
    </div>
  );

  /* ─── Faz İçerikleri ──────────────────────────────────────────── */
  const renderPhase = () => {
    // DB'den gelen + default türleri birleştir
    const allTypeCards = (() => {
      const defaults = [...TYPE_CARDS_DEFAULT];
      // DB'de olup TYPE_CARDS_DEFAULT'ta olmayan türler
      projectTypes.forEach(dt => {
        if (!defaults.find(d => d.key === dt.key)) {
          defaults.push({
            key: dt.key, label: dt.label,
            color: dt.color || '#64748b', bg: '#f8fafc', border: '#e2e8f0',
            desc: 'Proje türü', budget: '—', duration: '—',
          });
        } else {
          // DB label'ını güncelle
          const idx = defaults.findIndex(d => d.key === dt.key);
          if (idx !== -1) defaults[idx] = { ...defaults[idx], label: dt.label, color: dt.color || defaults[idx].color };
        }
      });
      return defaults;
    })();

    switch (PHASES[phase].key) {

      /* FAZ 1 — TÜR SEÇİMİ */
      case 'type': return (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-navy mb-1">Proje türünü seçin</h2>
            <p className="text-sm text-muted">Seçtiğiniz türe göre form ve gereksinimler otomatik uyarlanır</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allTypeCards.map(tc => {
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
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0"
                      style={{ background: tc.color }}>
                      {tc.label.charAt(0)}
                    </span>
                    {active && (
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                        style={{ background: tc.color }}>
                        <NPIcon name="check" className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                  <p className="font-display font-semibold text-base mb-0.5" style={{ color: active ? tc.color : '#0f2444' }}>{tc.label}</p>
                  <p className="text-xs text-muted mb-3 leading-relaxed">{tc.desc}</p>
                  <div className="flex gap-3 text-xs font-medium" style={{ color: tc.color }}>
                    <span>{tc.budget}</span>
                    <span>{tc.duration}</span>
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
            <h3 className="font-display text-sm font-semibold text-navy inline-flex items-center gap-2">
              <NPIcon name="clipboard" className="w-4 h-4 text-navy" />
              Proje Kimliği
            </h3>
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
            <h3 className="font-display text-sm font-semibold text-navy inline-flex items-center gap-2">
              <NPIcon name="building" className="w-4 h-4 text-navy" />
              Kurumsal Bilgiler
            </h3>
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
            <h3 className="font-display text-sm font-semibold text-navy inline-flex items-center gap-2">
              <NPIcon name="users" className="w-4 h-4 text-navy" />
              Proje Ekibi
            </h3>
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
                  aria-label="Üyeyi çıkar"
                  className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#fff0f0', color: '#dc2626' }}>
                  <NPIcon name="x" className="w-3.5 h-3.5" strokeWidth={2.2} />
                </button>
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
              <h3 className="font-display text-sm font-semibold text-navy inline-flex items-center gap-2">
                <NPIcon name="document" className="w-4 h-4 text-navy" />
                Proje Metni
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{form.projectText.length} karakter</span>
                <label className="cursor-pointer flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
                  style={{ background: extracting ? '#f0ede8' : '#f5f3ff', color: extracting ? '#9ca3af' : '#7c3aed', border: '1px solid #ddd6fe' }}>
                  {extracting ? <><span className="spinner w-3 h-3" /> Çekiliyor...</> : <><NPIcon name="paperclip" className="w-3.5 h-3.5" /> Belgeden Çek</>}
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

            <div className="p-3 rounded-xl text-xs flex items-start gap-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
              <NPIcon name="info" className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Proje metni, özetten farklı olarak projenin tüm detaylarını içerir. <strong>YZ Uygunluk Kontrolü zorunludur</strong> — devam etmek için yapın.</span>
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
                ? <p className="text-xs font-semibold text-green-700 mb-2 inline-flex items-center gap-1.5"><NPIcon name="check" className="w-3.5 h-3.5" strokeWidth={2.2} />YZ Uygunluk Kontrolü tamamlandı — bir sonraki adıma geçebilirsiniz</p>
                : <p className="text-xs font-semibold text-amber-700 mb-2 inline-flex items-center gap-1.5"><NPIcon name="alert" className="w-3.5 h-3.5" />Devam etmek için aşağıdaki YZ kontrolünü yapın</p>
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
              <h3 className="font-display text-sm font-semibold text-navy mb-3 inline-flex items-center gap-2">
                <NPIcon name="beaker" className="w-4 h-4 text-navy" />
                Etik Ön Analizi
              </h3>
              {ethicsLoading && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="spinner w-4 h-4" /> YZ etik riski analiz ediliyor...
                </div>
              )}
              {!ethicsLoading && !ethicsAnalysis && (
                <button type="button" onClick={runEthicsAnalysis}
                  className="text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5"
                  style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                  <NPIcon name="beaker" className="w-3.5 h-3.5" />
                  Etik Risk Analizi Yap
                </button>
              )}
              {ethicsAnalysis && !ethicsLoading && (
                <div className="p-3 rounded-xl" style={{
                  border: '1px solid', borderColor: ethicsAnalysis.required ? '#fca5a5' : '#86efac',
                  background: ethicsAnalysis.required ? '#fef2f2' : '#f0fdf4',
                }}>
                  <p className="text-sm font-bold inline-flex items-center gap-1.5" style={{ color: ethicsAnalysis.required ? '#dc2626' : '#059669' }}>
                    <NPIcon name={ethicsAnalysis.required ? 'alert' : 'check'} className="w-4 h-4" strokeWidth={2} />
                    {ethicsAnalysis.required ? 'Etik Kurul Onayı Gerekiyor' : 'Etik Kurul Gerekmiyor'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: ethicsAnalysis.required ? '#dc2626' : '#059669' }}>
                    Risk Skoru: {ethicsAnalysis.riskScore}/100 — {ethicsAnalysis.recommendation}
                  </p>
                  {(ethicsAnalysis.reasons || []).map((r: string, i: number) => (
                    <p key={i} className="text-xs text-muted">• {r}</p>
                  ))}
                  {ethicsAnalysis.required && (
                    <p className="text-xs mt-2 font-semibold text-amber-700 inline-flex items-center gap-1.5">
                      <NPIcon name="bolt" className="w-3.5 h-3.5" />
                      Kaydedilince otomatik etik kurul incelemesine gönderilecektir.
                    </p>
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
              <h3 className="font-display text-sm font-semibold text-navy inline-flex items-center gap-2">
                <NPIcon name="globe" className="w-4 h-4 text-navy" />
                Sürdürülebilir Kalkınma Hedefleri
              </h3>
              {sdgLoading && <span className="text-xs text-muted flex items-center gap-1"><span className="spinner w-3 h-3" /> YZ öneri hazırlıyor...</span>}
            </div>

            {/* YZ Önerileri */}
            {sdgSuggestions.length > 0 && (
              <div className="p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
                <p className="text-xs font-semibold text-green-800 mb-2 inline-flex items-center gap-1.5">
                  <NPIcon name="sparkles" className="w-3.5 h-3.5" />
                  YZ Önerileri — proje içeriğinize göre
                </p>
                <div className="flex flex-wrap gap-2">
                  {sdgSuggestions.map(code => {
                    const already = sdgSelected.includes(code);
                    return (
                      <button key={code} type="button"
                        onClick={() => setSdgSelected(s => already ? s.filter(c => c !== code) : [...s, code])}
                        className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all inline-flex items-center gap-1"
                        style={{ background: already ? '#059669' : 'white', color: already ? 'white' : '#059669', border: '1.5px solid #86efac' }}
                        title={sdgReasons[code]}>
                        <NPIcon name={already ? 'check' : 'plus'} className="w-3 h-3" strokeWidth={2.2} />
                        {code}
                      </button>
                    );
                  })}
                </div>
                {sdgSuggestions.some(s => !sdgSelected.includes(s)) && (
                  <button type="button" onClick={() => setSdgSelected(s => Array.from(new Set([...s, ...sdgSuggestions])))}
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
            <h3 className="font-display text-sm font-semibold text-navy inline-flex items-center gap-2">
              <NPIcon name="tag" className="w-4 h-4 text-navy" />
              Etiketler & Anahtar Kelimeler
            </h3>
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
            <h3 className="font-display text-sm font-semibold text-navy inline-flex items-center gap-2">
              <NPIcon name="scale" className="w-4 h-4 text-navy" />
              Fikri Mülkiyet
            </h3>
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

      /* FAZ 5 — SCOPUS LİTERATÜR TARAMA */
      /* FAZ 5 — SCOPUS LİTERATÜR TARAMA */
      case 'scopus': return (
        <ScopusLiteraturePhase
          title={form.title}
          description={form.description}
          projectText={form.projectText}
          keywords={form.keywords ? form.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : []}
          tags={form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []}
          projectType={selectedType}
        />
      );

      /* FAZ 6 — FİNANSAL & ONAY */
      case 'finalize': return (
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-navy mb-1">Finansal bilgiler ve onay</h2>
            <p className="text-sm text-muted">Bütçe, tarihler, belgeler ve son kontrol</p>
          </div>

          {/* Finansal */}
          <div className="card p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-navy inline-flex items-center gap-2">
              <NPIcon name="dollar" className="w-4 h-4 text-navy" />
              Bütçe & Tarihler
            </h3>
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
            <h3 className="font-display text-sm font-semibold text-navy mb-3 inline-flex items-center gap-2">
              <NPIcon name="target" className="w-4 h-4 text-navy" />
              Hibe Uygunluk Analizi
            </h3>
            <FundingMatchPanel
              keywords={form.keywords ? form.keywords.split(',').map(k => k.trim()).filter(Boolean) : []}
              tags={form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []}
              projectType={selectedType}
              title={form.title}
            />
          </div>

          {/* Belgeler */}
          <div className="card p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-navy inline-flex items-center gap-2">
              <NPIcon name="paperclip" className="w-4 h-4 text-navy" />
              Belgeler
            </h3>
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
                <p className="font-semibold mb-1 inline-flex items-center gap-1.5" style={{ color: docReview.status === 'ok' ? '#059669' : '#d97706' }}>
                  <NPIcon name="robot" className="w-3.5 h-3.5" />
                  {docReview.summary}
                </p>
                {(docReview.issues || []).map((iss: any, i: number) => (
                  <p key={i} className="inline-flex items-start gap-1.5" style={{ color: iss.severity === 'warning' ? '#d97706' : '#6b7280' }}>
                    <NPIcon name={iss.severity === 'warning' ? 'alert' : 'info'} className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {iss.message}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Özet */}
          <div className="card p-5 space-y-2" style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
            <p className="text-xs font-bold uppercase tracking-wider text-navy inline-flex items-center gap-1.5">
              <NPIcon name="clipboard" className="w-3.5 h-3.5" />
              Proje Özeti
            </p>
            {[
              ['Tür',    TYPE_CARDS_DEFAULT.find(t => t.key === selectedType)?.label || selectedType],
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
                    {done ? <NPIcon name="check" className="w-4 h-4" strokeWidth={2.5} /> : String(i + 1)}
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
            className="btn-secondary disabled:opacity-40 inline-flex items-center gap-1.5">
            <NPIcon name="arrow-left" className="w-3.5 h-3.5" />
            Geri
          </button>
          <span className="text-xs text-muted">{phase + 1} / {PHASES.length}</span>
          {isLast
            ? <button type="button" onClick={handleSubmit} disabled={saving}
                className="btn-primary px-8 inline-flex items-center gap-2">
                {saving ? <><span className="spinner w-4 h-4" />Kaydediliyor...</> : <><NPIcon name="rocket" className="w-4 h-4" />Projeyi Oluştur</>}
              </button>
            : <button type="button" onClick={goNext} className="btn-primary inline-flex items-center gap-1.5">
                Devam Et
                <NPIcon name="arrow-right" className="w-3.5 h-3.5" />
              </button>
          }
        </div>
      </div>
    </DashboardLayout>
  );
}
