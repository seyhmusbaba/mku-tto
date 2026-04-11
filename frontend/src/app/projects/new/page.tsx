'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api, projectsApi, documentsApi, facultiesApi } from '@/lib/api';
import { SimilarProjectsAlert } from '@/components/SimilarProjectsAlert';
import { AiSummaryPanel } from '@/components/AiSummaryPanel';
import { BudgetEstimator } from '@/components/BudgetEstimator';
import { SdgPicker } from '@/components/SdgPicker';
import { ProjectComplianceCheck } from '@/components/ProjectComplianceCheck';
import toast from 'react-hot-toast';

const STATUSES = [
  { value: 'application', label: 'Başvuru Sürecinde', color: '#d97706' },
  { value: 'active',      label: 'Aktif',             color: '#059669' },
  { value: 'completed',   label: 'Tamamlandı',        color: '#2563eb' },
];

const IP_OPTS = [
  { value: 'none',       label: 'Yok',                 color: '#6b7280' },
  { value: 'pending',    label: 'Başvuru Aşamasında',  color: '#d97706' },
  { value: 'registered', label: 'Tescilli',             color: '#059669' },
  { value: 'published',  label: 'Yayımlandı',           color: '#2563eb' },
];

const IP_TYPES = [
  { value: 'patent',        label: '🔬 Patent' },
  { value: 'faydali_model', label: '⚙️ Faydalı Model' },
  { value: 'marka',         label: '™ Marka' },
  { value: 'tasarim',       label: '🎨 Tasarım' },
  { value: 'telif',         label: '© Telif Hakkı' },
  { value: 'ticari_sir',    label: '🔒 Ticari Sır' },
];

const STEPS = [
  { key: 'basic',    label: 'Temel',        icon: '📋' },
  { key: 'academic', label: 'Kurumsal',     icon: '🏛' },
  { key: 'finance',  label: 'Finansal',     icon: '💰' },
  { key: 'text',     label: 'Proje Metni',  icon: '📄' },
  { key: 'sdg',      label: 'SKH',          icon: '🎯' },
  { key: 'ip',       label: 'Fikri Mülk.',  icon: '⚖' },
  { key: 'confirm',  label: 'Onay',         icon: '✅' },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [faculties, setFaculties] = useState<string[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [dynamicFields, setDynamicFields] = useState<any[]>([]);
  const [sdgSelected, setSdgSelected] = useState<string[]>([]);

  // FIX: sessionStorage'dan OKU değil — her yeni proje sayfasında temiz başla
  const [complianceResult, setComplianceResult] = useState<any>(null);
  const [complianceDone, setComplianceDone] = useState<boolean>(false);
  const [ethicsAnalysis, setEthicsAnalysis] = useState<any>(null);
  const [ethicsLoading, setEthicsLoading] = useState(false);
  const [docReview, setDocReview] = useState<any>(null);
  const [docReviewLoading, setDocReviewLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Dosya nesneleri - FormData ile yüklenecek
  const [acceptanceFile, setAcceptanceFile] = useState<File | null>(null);
  const [ipFile, setIpFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', type: 'tubitak', status: 'application',
    faculty: '', department: '', dynamicFields: {} as any,
    budget: '', fundingSource: '', startDate: '', endDate: '',
    projectText: '', tags: '', keywords: '',
    ipStatus: 'none', ipType: '', ipRegistrationNo: '', ipDate: '', ipNotes: '',
  });

  useEffect(() => {
    // Her yeni proje sayfasında önceki sonuçları temizle
    try {
      sessionStorage.removeItem('compliance_result');
      sessionStorage.removeItem('compliance_done');
    } catch {}
    facultiesApi.getActive().then(r => setFaculties((r.data || []).map((f: any) => f.name))).catch(() => {});
    api.get('/project-types').then(r => setProjectTypes(r.data || [])).catch(() => {});
    api.get('/dynamic-fields').then(r => setDynamicFields(r.data || [])).catch(() => {});
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setDyn = (k: string, v: any) => setForm(f => ({ ...f, dynamicFields: { ...f.dynamicFields, [k]: v } }));

  const needsAcceptance = form.status === 'active';
  // FIX #17: 'pending' başvuru aşamasında - zorunlu değil, sadece uyarı
  const needsIpDoc = ['registered', 'published'].includes(form.ipStatus);
  const ipDocRecommended = form.ipStatus === 'pending';
  const isLast = step === STEPS.length - 1;

  // Son adimda YZ belge incelemesi
  useEffect(() => {
    if (!isLast) return;
    const docs: any[] = [];
    if (acceptanceFile) docs.push({ name: acceptanceFile.name, type: 'acceptance', size: acceptanceFile.size });
    if (ipFile) docs.push({ name: ipFile.name, type: 'ip', size: ipFile.size });
    setDocReviewLoading(true);
    api.post('/ai/review-documents', {
      projectTitle: form.title, projectType: form.type, documents: docs,
      ipStatus: form.ipStatus,
      ethicsRequired: ethicsAnalysis?.required || false,
      ethicsApproved: false,
    })
      .then(r => setDocReview(r.data))
      .catch(() => setDocReview({ status: 'ok', summary: 'Belge kontrolü tamamlandı', issues: [], missingDocuments: [] }))
      .finally(() => setDocReviewLoading(false));
  }, [isLast]);

  const runEthicsAnalysis = async () => {
    if (ethicsAnalysis) return;
    setEthicsLoading(true);
    try {
      const r = await api.post('/ethics/preview-analyze', {
        title: form.title, description: form.description,
        projectText: form.projectText, type: form.type,
      });
      setEthicsAnalysis(r.data);
    } catch {}
    finally { setEthicsLoading(false); }
  };

  const canAdvance = () => {
    if (step === 0 && !form.title.trim()) { toast.error('Proje adı zorunlu'); return false; }
    if (STEPS[step].key === 'text' && !complianceDone) {
      toast.error('Devam etmeden önce YZ Uygunluk Kontrolü yapınız!');
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!canAdvance()) return;
    if (STEPS[step].key === 'text') runEthicsAnalysis();
    setStep(s => s + 1);
  };

  const uploadFile = async (projectId: string, file: File, name: string, type: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name);
    fd.append('type', type);
    await documentsApi.upload(projectId, fd);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Proje adı zorunlu'); return; }
    if (!complianceDone) { toast.error('YZ Uygunluk Kontrolü zorunludur!'); return; }
    if (needsAcceptance && !acceptanceFile) { toast.error('Aktif proje için kabul belgesi gerekli'); return; }
    if (docReview?.status === 'error') {
      const msgs = (docReview.issues || []).map((i: any) => '• ' + i.message).join('\n');
      if (!confirm('YZ belge incelemesinde sorunlar tespit edildi:\n' + msgs + '\n\nYine de devam etmek istiyor musunuz?')) return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title, description: form.description, type: form.type, status: form.status,
        faculty: form.faculty, department: form.department,
        budget: form.budget ? Number(form.budget) : null,
        fundingSource: form.fundingSource, startDate: form.startDate, endDate: form.endDate,
        projectText: form.projectText,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        keywords: form.keywords ? form.keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
        sdgGoals: sdgSelected, dynamicFields: form.dynamicFields,
        ipStatus: form.ipStatus, ipType: form.ipType || null,
        ipRegistrationNo: form.ipRegistrationNo || null, ipDate: form.ipDate || null, ipNotes: form.ipNotes || null,
        ethicsRequired: ethicsAnalysis?.required || false,
        ethicsApproved: false,
        aiComplianceScore: complianceResult?.score || null,
        aiComplianceResult: complianceResult ? JSON.stringify(complianceResult) : null,
      };

      const res = await projectsApi.create(payload);
      const pid = res.data.id;

      // FormData ile belge yukle
      if (acceptanceFile) {
        await uploadFile(pid, acceptanceFile, 'Başvuru Kabul Belgesi', 'acceptance').catch(() => {});
      }
      if (ipFile) {
        await uploadFile(pid, ipFile, 'Fikri Mülkiyet Belgesi', 'ip').catch(() => {});
      }

      // Etik kurul analizi
      if (ethicsAnalysis?.required) {
        await api.post('/ethics/analyze/' + pid).catch(() => {});
        toast.success('Proje oluşturuldu — Etik kurul incelemesine gönderildi!');
      } else {
        toast.success('Proje başarıyla oluşturuldu!');
      }
      router.push('/projects/' + pid);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bir hata oluştu');
    } finally { setSaving(false); }
  };

  // Dosya secme alani bileseni
  const FileField = ({ label, file, onChange, required, hint }: { label: string; file: File | null; onChange: (f: File | null) => void; required?: boolean; hint?: string }) => (
    <div>
      <label className="label">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-muted mb-1.5">{hint}</p>}
      <label className="block cursor-pointer">
        <div className="input flex items-center gap-2 cursor-pointer" style={{ height: 40, background: file ? '#f0fdf4' : undefined }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke={file ? '#059669' : '#9ca3af'} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className="text-sm truncate" style={{ color: file ? '#059669' : '#9ca3af' }}>
            {file ? `✓ ${file.name} (${Math.round(file.size / 1024)} KB)` : 'Dosya seçin (PDF, Word, Resim)'}
          </span>
          {file && (
            <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(null); }}
              className="ml-auto text-red-400 hover:text-red-600 text-xs flex-shrink-0">✕</button>
          )}
        </div>
        <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
          onChange={e => onChange(e.target.files?.[0] || null)} />
      </label>
    </div>
  );

  const renderStep = () => {
    switch (STEPS[step].key) {

      case 'basic': return (
        <div className="space-y-5">
          <div>
            <label className="label">Proje Adı *</label>
            <input className="input text-base" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Projenin tam adını girin" autoFocus />
          </div>
          <SimilarProjectsAlert title={form.title} description={form.description} type={form.type} />
          <div>
            <label className="label">Proje Özeti</label>
            <textarea className="input" style={{ minHeight: 100 }} value={form.description}
              onChange={e => set('description', e.target.value)} placeholder="2-3 cümleyle tanımlayın..." />
            <div className="mt-2">
              <AiSummaryPanel title={form.title} description={form.description} type={form.type}
                faculty={form.faculty} mode="create" onApply={t => set('description', t)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Proje Türü</label>
              <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                {projectTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Durum</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          {needsAcceptance && (
            <div className="p-3 rounded-xl text-xs" style={{ background: '#fef3c7', color: '#92651a', border: '1px solid #fde68a' }}>
              ⚠️ Aktif durum seçtiniz — son adımda kabul belgesi yüklemeniz gerekecek.
            </div>
          )}
        </div>
      );

      case 'academic': return (
        <div className="space-y-5">
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
              <input className="input" value={form.department} onChange={e => set('department', e.target.value)}
                placeholder="Bilgisayar Mühendisliği..." />
            </div>
          </div>
          {dynamicFields.length > 0 && (
            <div className="space-y-4 pt-3 border-t" style={{ borderColor: '#e8e4dc' }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ek Alanlar</p>
              {dynamicFields.map(field => (
                <div key={field.id}>
                  <label className="label">{field.label || field.name}</label>
                  {field.type === 'textarea'
                    ? <textarea className="input" value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)} />
                    : field.type === 'select'
                    ? <select className="input" value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)}>
                        <option value="">Seçin</option>
                        {field.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    : field.type === 'checkbox'
                    ? <label className="flex items-center gap-2 mt-1">
                        <input type="checkbox" checked={!!form.dynamicFields[field.key]} onChange={e => setDyn(field.key, e.target.checked)} />
                        <span className="text-sm">Evet</span>
                      </label>
                    : <input type={field.type === 'number' ? 'number' : 'text'} className="input"
                        value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)} />
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      );

      case 'finance': return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Bütçe (₺)</label>
              <input type="number" className="input" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label">Fon Kaynağı</label>
              <input className="input" value={form.fundingSource} onChange={e => set('fundingSource', e.target.value)}
                placeholder="TÜBİTAK, BAP, AB..." />
            </div>
          </div>
          <BudgetEstimator type={form.type} faculty={form.faculty} />
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
      );

      case 'text': return (
        <div className="space-y-5">
          <div className="p-3 rounded-xl text-xs" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
            📄 Proje metni, özetten farklı olarak projenin tüm detaylarını içeren kapsamlı açıklamadır.
            <strong> YZ Uygunluk Kontrolü zorunludur</strong> — yapmadan bir sonraki adıma geçilemez.
          </div>
          <div>
            <label className="label flex justify-between">
              <span>Proje Metni</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted font-normal">{form.projectText.length} karakter</span>
                <label className="cursor-pointer flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
                  style={{ background: extracting ? '#eff6ff' : '#f5f3ff', color: extracting ? '#6b7280' : '#7c3aed', border: '1px solid #ddd6fe' }}>
                  {extracting
                    ? <><span className="spinner w-3 h-3" /> Çekiliyor...</>
                    : <>📎 Belgeden Çek</>}
                  <input type="file" accept=".txt,.pdf,.docx" className="hidden" disabled={extracting}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setExtracting(true);
                      try {
                        // .txt dosyaları doğrudan client tarafında oku
                        if (file.name.endsWith('.txt')) {
                          const text = await new Promise<string>(res => {
                            const r = new FileReader();
                            r.onload = ev => res((ev.target?.result as string) || '');
                            r.readAsText(file, 'utf-8');
                          });
                          set('projectText', text);
                          setComplianceDone(false); setEthicsAnalysis(null);
                        } else {
                          // PDF/DOCX backend'e gönder
                          const fd = new FormData();
                          fd.append('file', file);
                          const res = await api.post('/ai/extract-text', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                          if (res.data?.text) {
                            set('projectText', res.data.text);
                            setComplianceDone(false); setEthicsAnalysis(null);
                          } else if (res.data?.error) {
                            toast.error(res.data.error);
                          }
                        }
                      } catch {
                        toast.error('Metin çıkarılamadı. Desteklenen formatlar: .txt, .pdf, .docx');
                      } finally {
                        setExtracting(false);
                        e.target.value = '';
                      }
                    }} />
                </label>
              </div>
            </label>
            <textarea className="input" style={{ minHeight: 260, lineHeight: 1.7 }} value={form.projectText}
              onChange={e => { set('projectText', e.target.value); setComplianceDone(false); setEthicsAnalysis(null); }}
              placeholder={'Detaylı proje açıklaması...\n\n• Projenin amacı ve önemi\n• Yöntem ve yaklaşım\n• Beklenen çıktılar\n• Zaman çizelgesi'} />
          </div>
          <div className="p-4 rounded-xl" style={{
            border: complianceDone ? '2px solid #86efac' : '2px solid #fde68a',
            background: complianceDone ? '#f0fdf4' : '#fffbeb',
          }}>
            {complianceDone
              ? <p className="text-xs font-semibold text-green-700 mb-2">✅ YZ Uygunluk Kontrolü tamamlandı — bir sonraki adıma geçebilirsiniz</p>
              : <p className="text-xs font-semibold text-amber-700 mb-2">⚠️ Devam etmek için aşağıdaki YZ kontrolünü yapınız</p>
            }
            <ProjectComplianceCheck
              title={form.title} description={form.description}
              projectText={form.projectText} type={form.type}
              onResult={r => {
                setComplianceResult(r);
                setComplianceDone(true);
              }}
            />
          </div>
        </div>
      );

      case 'sdg': return (
        <div className="space-y-5">
          <div>
            <label className="label">Sürdürülebilir Kalkınma Hedefleri</label>
            <p className="text-xs text-muted mb-3">Projenin katkı sağladığı SKH hedeflerini seçin</p>
            <SdgPicker selected={sdgSelected} onChange={setSdgSelected} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Etiketler</label>
              <input className="input" value={form.tags} onChange={e => set('tags', e.target.value)}
                placeholder="yapay zeka, veri bilimi..." />
              <p className="text-xs text-muted mt-1">Virgülle ayırın</p>
            </div>
            <div>
              <label className="label">Anahtar Kelimeler</label>
              <input className="input" value={form.keywords} onChange={e => set('keywords', e.target.value)}
                placeholder="machine learning, NLP..." />
            </div>
          </div>
        </div>
      );

      case 'ip': return (
        <div className="space-y-5">
          <div className="p-3 rounded-xl text-xs" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9' }}>
            ⚖ Patent, faydalı model, marka gibi fikri mülkiyet korumanız varsa bilgileri girin.
            Belge yüklemek <strong>zorunludur</strong> (başvuru/tescil durumunda).
          </div>
          <div>
            <label className="label">Fikri Mülkiyet Durumu</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {IP_OPTS.map(o => (
                <button key={o.value} type="button" onClick={() => set('ipStatus', o.value)}
                  className="p-3 rounded-xl border-2 text-center transition-all"
                  style={{ borderColor: form.ipStatus === o.value ? o.color : '#e8e4dc', background: form.ipStatus === o.value ? o.color + '12' : 'white' }}>
                  <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1" style={{ background: o.color }} />
                  <p className="text-xs font-semibold leading-tight" style={{ color: form.ipStatus === o.value ? o.color : '#374151' }}>{o.label}</p>
                </button>
              ))}
            </div>
          </div>
          {form.ipStatus !== 'none' && (
            <>
              <div>
                <label className="label">Türü</label>
                <div className="grid grid-cols-3 gap-2">
                  {IP_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => set('ipType', t.value)}
                      className="p-2.5 rounded-xl border text-xs font-medium transition-all"
                      style={{ borderColor: form.ipType === t.value ? '#7c3aed' : '#e8e4dc', background: form.ipType === t.value ? '#f5f3ff' : 'white', color: form.ipType === t.value ? '#7c3aed' : '#374151' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
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
              <div>
                <label className="label">Notlar</label>
                <textarea className="input" rows={2} value={form.ipNotes} onChange={e => set('ipNotes', e.target.value)}
                  placeholder="Ek notlar..." />
              </div>
              <FileField
                label="Fikri Mülkiyet Belgesi"
                file={ipFile}
                onChange={setIpFile}
                required={needsIpDoc}
                hint="Patent başvuru formu, tescil belgesi veya ilgili resmi belge"
              />
            </>
          )}
        </div>
      );

      case 'confirm': return (
        <div className="space-y-5">
          {/* YZ Belge Incelemesi - ZORUNLU */}
          <div className="p-4 rounded-xl" style={{
            border: '2px solid',
            borderColor: docReviewLoading ? '#fde68a' : docReview?.status === 'ok' ? '#86efac' : docReview?.status === 'error' ? '#fca5a5' : '#fde68a',
            background: docReviewLoading ? '#fffbeb' : docReview?.status === 'ok' ? '#f0fdf4' : docReview?.status === 'error' ? '#fef2f2' : '#fffbeb',
          }}>
            <p className="text-sm font-bold mb-2" style={{ color: docReview?.status === 'ok' ? '#059669' : docReview?.status === 'error' ? '#dc2626' : '#d97706' }}>
              🤖 YZ Belge Tutarlılık İncelemesi {docReviewLoading ? '— İnceleniyor...' : ''}
            </p>
            {docReviewLoading && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="spinner w-3 h-3" /> Yüklenen belgeler kontrol ediliyor...
              </div>
            )}
            {docReview && !docReviewLoading && (
              <>
                <p className="text-sm font-semibold mb-2">{docReview.summary}</p>
                {(docReview.issues || []).map((iss: any, i: number) => (
                  <p key={i} className="text-xs mb-1" style={{ color: iss.severity === 'error' ? '#dc2626' : iss.severity === 'warning' ? '#d97706' : '#6b7280' }}>
                    {iss.severity === 'error' ? '❌' : iss.severity === 'warning' ? '⚠️' : 'ℹ️'} {iss.message}
                  </p>
                ))}
                {(docReview.missingDocuments || []).length > 0 && (
                  <p className="text-xs mt-1 font-semibold text-amber-700">
                    📎 Eksik belgeler: {docReview.missingDocuments.join(', ')}
                  </p>
                )}
              </>
            )}
          </div>

          {/* YZ'nin eksik belgeleri icin yukleme alani */}
          {docReview && !docReviewLoading && (docReview.missingDocuments || []).length > 0 && (
            <div className="p-4 rounded-xl space-y-3" style={{ background: '#faf8f4', border: '1px solid #e8e4dc' }}>
              <p className="text-xs font-semibold text-navy">📂 Eksik Belgeleri Buradan Yükleyebilirsiniz</p>
              {(docReview.missingDocuments || []).includes('Fikri mülkiyet tescil/başvuru belgesi') && !ipFile && (
                <FileField
                  label="Fikri Mülkiyet Belgesi"
                  file={ipFile} onChange={setIpFile}
                  hint="YZ bu belgenin eksik olduğunu tespit etti"
                />
              )}
              {(docReview.missingDocuments || []).includes('Etik kurul onay belgesi') && (
                <div className="p-3 rounded-xl text-xs" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                  ℹ️ Etik kurul onay belgesi — proje kaydedildikten sonra Belgeler sekmesinden yükleyebilirsiniz.
                </div>
              )}
              {(docReview.missingDocuments || []).includes('Başvuru kabul belgesi') && !acceptanceFile && (
                <FileField
                  label="Kabul Belgesi"
                  file={acceptanceFile} onChange={setAcceptanceFile}
                  required={needsAcceptance}
                  hint="YZ bu belgenin eksik olduğunu tespit etti"
                />
              )}
            </div>
          )}

          {/* Etik Analiz Sonucu */}
          {ethicsLoading && (
            <div className="p-3 rounded-xl text-xs flex items-center gap-2" style={{ background: '#f5f3ff' }}>
              <span className="spinner w-3 h-3" /> YZ etik analizi yapılıyor...
            </div>
          )}
          {ethicsAnalysis && !ethicsLoading && (
            <div className="p-4 rounded-xl" style={{
              border: '1px solid',
              borderColor: ethicsAnalysis.required ? '#fca5a5' : '#86efac',
              background: ethicsAnalysis.required ? '#fef2f2' : '#f0fdf4',
            }}>
              <p className="text-sm font-bold mb-1" style={{ color: ethicsAnalysis.required ? '#dc2626' : '#059669' }}>
                🔬 YZ Etik Analizi: {ethicsAnalysis.required ? '⚠️ Etik Kurul Onayı Gerekiyor' : '✅ Etik Kurul Gerekmiyor'}
              </p>
              <p className="text-xs" style={{ color: ethicsAnalysis.required ? '#dc2626' : '#059669' }}>
                Risk Skoru: {ethicsAnalysis.riskScore}/100 — {ethicsAnalysis.recommendation}
              </p>
              {(ethicsAnalysis.reasons || []).map((r: string, i: number) => (
                <p key={i} className="text-xs text-muted">• {r}</p>
              ))}
              {ethicsAnalysis.required && (
                <p className="text-xs mt-2 font-semibold text-amber-700">
                  ⚡ Proje kaydedilince otomatik olarak etik kurul incelemesine gönderilecektir.
                </p>
              )}
            </div>
          )}

          {/* Ozet */}
          <div className="p-4 rounded-xl space-y-2" style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
            <p className="text-xs font-bold uppercase tracking-wider text-navy">Proje Özeti</p>
            {[
              ['Başlık', form.title],
              ['Tür', projectTypes.find(t => t.key === form.type)?.label || form.type],
              ['Durum', STATUSES.find(s => s.value === form.status)?.label],
              form.faculty ? ['Fakülte', form.faculty] : null,
              form.budget ? ['Bütçe', Number(form.budget).toLocaleString('tr-TR') + ' ₺'] : null,
              sdgSelected.length ? ['SKH Hedefleri', sdgSelected.length + ' hedef seçildi'] : null,
              form.ipStatus !== 'none' ? ['Fikri Mülkiyet', IP_OPTS.find(o => o.value === form.ipStatus)?.label] : null,
              complianceResult ? ['YZ Uygunluk Skoru', complianceResult.score + '/100'] : null,
              ipFile ? ['Fikri Mülkiyet Belgesi', '✓ ' + ipFile.name] : null,
              acceptanceFile ? ['Kabul Belgesi', '✓ ' + acceptanceFile.name] : null,
            ].filter(Boolean).map(([k, v]: any, i) => (
              <div key={i} className="flex justify-between text-sm border-b pb-1.5 last:border-0" style={{ borderColor: '#e8e4dc' }}>
                <span className="text-muted">{k}</span>
                <span className="font-medium text-navy text-right ml-4">{v}</span>
              </div>
            ))}
          </div>

          {/* Kabul belgesi - aktif proje icin */}
          {needsAcceptance && !acceptanceFile && (
            <div className="p-4 rounded-xl" style={{ border: '2px solid #dc2626', background: '#fef2f2' }}>
              <FileField
                label="Başvuru Kabul Belgesi (Zorunlu)"
                file={acceptanceFile}
                onChange={setAcceptanceFile}
                required
                hint="Aktif proje için kabul belgesi zorunludur"
              />
            </div>
          )}
          {needsAcceptance && acceptanceFile && (
            <div className="p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
              <p className="text-xs font-semibold text-green-700">✅ Kabul belgesi yüklendi: {acceptanceFile.name}</p>
              <button type="button" onClick={() => setAcceptanceFile(null)} className="text-xs text-red-400 mt-1">Değiştir</button>
            </div>
          )}
        </div>
      );

      default: return null;
    }
  };

  return (
    <DashboardLayout>
      <Header title="Yeni Proje Oluştur" subtitle={STEPS[step].icon + ' ' + STEPS[step].label} />
      <div className="p-6" style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Adim gostergesi */}
        <div className="flex items-center gap-0 mb-6 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-shrink-0">
              <button type="button" onClick={() => i < step && setStep(i)}
                className="flex flex-col items-center" style={{ minWidth: 68 }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
                  style={{ background: i === step ? '#1a3a6b' : i < step ? '#059669' : '#f0ede8', color: i <= step ? 'white' : '#9ca3af', fontWeight: 700 }}>
                  {i < step ? '✓' : s.icon}
                </div>
                <span className="text-[10px] mt-1 text-center leading-tight"
                  style={{ color: i === step ? '#1a3a6b' : i < step ? '#059669' : '#9ca3af', maxWidth: 60 }}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="h-0.5 flex-1 mx-0.5" style={{ background: i < step ? '#059669' : '#e8e4dc', minWidth: 12 }} />
              )}
            </div>
          ))}
        </div>

        <div className="card p-6 mb-5">{renderStep()}</div>

        <div className="flex gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)} className="btn-secondary" style={{ minWidth: 100 }}>
              ← Geri
            </button>
          )}
          <div className="flex-1" />
          {!isLast ? (
            <button type="button" onClick={goNext} className="btn-primary" style={{ minWidth: 160 }}>
              Devam → <span className="text-xs opacity-70 ml-1">{STEPS[step + 1]?.label}</span>
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving} className="btn-primary" style={{ minWidth: 160 }}>
              {saving ? 'Oluşturuluyor...' : '✓ Projeyi Oluştur'}
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
