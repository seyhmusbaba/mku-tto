'use client';
import { useState, useEffect, useRef } from 'react';
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
  { value: 'application', label: 'Başvuru Sürecinde', desc: 'Başvuru devam ediyor', color: '#d97706' },
  { value: 'active',      label: 'Aktif',             desc: 'Kabul belgesi gerekir', color: '#059669' },
  { value: 'completed',   label: 'Tamamlandı',         desc: 'Proje sonuçlandı',     color: '#2563eb' },
];

const IP_STATUS_OPTIONS = [
  { value: 'none',       label: 'Yok',                color: '#6b7280' },
  { value: 'pending',    label: 'Başvuru Aşamasında', color: '#d97706' },
  { value: 'registered', label: 'Tescilli',            color: '#059669' },
  { value: 'published',  label: 'Yayımlandı',          color: '#2563eb' },
];

const IP_TYPES = [
  { value: 'patent',        label: '🔬 Patent' },
  { value: 'faydali_model', label: '⚙️ Faydalı Model' },
  { value: 'marka',         label: '™️ Marka' },
  { value: 'tasarim',       label: '🎨 Tasarım' },
  { value: 'telif',         label: '©️ Telif Hakkı' },
  { value: 'ticari_sir',    label: '🔒 Ticari Sır' },
];

// Adımlar — mantıklı sıra
const STEPS = [
  { key: 'basic',      label: 'Temel',        icon: '📋' },
  { key: 'academic',   label: 'Kurumsal',     icon: '🏛️' },
  { key: 'financial',  label: 'Finansal',     icon: '💰' },
  { key: 'text',       label: 'Proje Metni',  icon: '📄' },
  { key: 'sdg',        label: 'SKH & Etiket', icon: '🎯' },
  { key: 'ip',         label: 'Fikri Mülk.',  icon: '⚖️' },
  { key: 'ethics',     label: 'Etik Kurul',   icon: '🔬' },
  { key: 'confirm',    label: 'Onay',         icon: '✅' },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [faculties, setFaculties] = useState<string[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [dynamicFields, setDynamicFields] = useState<any[]>([]);
  const [sdgSelected, setSdgSelected] = useState<string[]>([]);
  const [complianceResult, setComplianceResult] = useState<any>(null);
  const [docReview, setDocReview] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Belge dosyaları
  const [acceptanceFile, setAcceptanceFile] = useState<File | null>(null);
  const [acceptanceBase64, setAcceptanceBase64] = useState<string | null>(null);
  const [ipFile, setIpFile] = useState<File | null>(null);
  const [ipBase64, setIpBase64] = useState<string | null>(null);
  const [ethicsFile, setEthicsFile] = useState<File | null>(null);
  const [ethicsBase64, setEthicsBase64] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', type: 'tubitak', status: 'application',
    faculty: '', department: '', dynamicFields: {} as Record<string, any>,
    budget: '', fundingSource: '', startDate: '', endDate: '',
    projectText: '',
    tags: '', keywords: '',
    ipStatus: 'none', ipType: '', ipRegistrationNo: '', ipDate: '', ipNotes: '',
    ethicsRequired: false, ethicsApproved: false, ethicsCommittee: '',
    ethicsApprovalNo: '', ethicsApprovalDate: '',
  });

  useEffect(() => {
    facultiesApi.getActive().then(r => setFaculties((r.data || []).map((f: any) => f.name))).catch(() => {});
    api.get('/project-types').then(r => setProjectTypes(r.data || [])).catch(() => {});
    api.get('/dynamic-fields').then(r => setDynamicFields(r.data || [])).catch(() => {});
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setDyn = (k: string, v: any) => setForm(f => ({ ...f, dynamicFields: { ...f.dynamicFields, [k]: v } }));

  const toBase64 = (file: File): Promise<string> =>
    new Promise(res => { const r = new FileReader(); r.onload = e => res((e.target?.result as string).split(',')[1]); r.readAsDataURL(file); });

  const handleFileChange = async (file: File | null, setter: any, base64Setter: any) => {
    setter(file);
    if (file) { const b64 = await toBase64(file); base64Setter(b64); }
    else base64Setter(null);
  };

  const needsAcceptance = form.status === 'active';
  const needsIpDoc = form.ipStatus === 'pending' || form.ipStatus === 'registered' || form.ipStatus === 'published';
  const needsEthicsDoc = form.ethicsRequired && form.ethicsApproved;
  const isLastStep = step === STEPS.length - 1;

  // Son adımda YZ belge incelemesi
  useEffect(() => {
    if (step === STEPS.length - 1) {
      const docs: any[] = [];
      if (acceptanceFile) docs.push({ name: acceptanceFile.name, type: 'acceptance', size: acceptanceFile.size });
      if (ipFile) docs.push({ name: ipFile.name, type: 'ip', size: ipFile.size });
      if (ethicsFile) docs.push({ name: ethicsFile.name, type: 'ethics', size: ethicsFile.size });

      if (docs.length > 0 || needsIpDoc || needsEthicsDoc) {
        setReviewLoading(true);
        api.post('/ai/review-documents', {
          projectTitle: form.title,
          projectType: form.type,
          documents: docs,
          ipStatus: form.ipStatus,
          ethicsRequired: form.ethicsRequired,
          ethicsApproved: form.ethicsApproved,
        }).then(r => setDocReview(r.data)).catch(() => {}).finally(() => setReviewLoading(false));
      }
    }
  }, [step]);

  const handleSubmit = async () => {
    if (!form.title) { toast.error('Proje adı zorunlu'); return; }
    if (needsAcceptance && !acceptanceFile) { toast.error('Aktif proje için kabul belgesi gerekli'); return; }
    if (needsIpDoc && !ipFile) {
      if (!confirm('Fikri mülkiyet belgesi yüklenmedi. Yine de devam etmek istiyor musunuz?')) return;
    }
    if (needsEthicsDoc && !ethicsFile) {
      if (!confirm('Etik kurul onay belgesi yüklenmedi. Yine de devam etmek istiyor musunuz?')) return;
    }

    setLoading(true);
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
        ethicsRequired: form.ethicsRequired, ethicsApproved: form.ethicsApproved,
        ethicsCommittee: form.ethicsCommittee || null,
        ethicsApprovalNo: form.ethicsApprovalNo || null, ethicsApprovalDate: form.ethicsApprovalDate || null,
        aiComplianceScore: complianceResult?.score || null,
        aiComplianceResult: complianceResult ? JSON.stringify(complianceResult) : null,
      };

      const res = await projectsApi.create(payload);
      const pid = res.data.id;

      // Belgeleri yükle
      const uploads = [
        acceptanceFile && acceptanceBase64 ? { file: acceptanceFile, b64: acceptanceBase64, name: 'Başvuru Kabul Belgesi', type: 'acceptance' } : null,
        ipFile && ipBase64 ? { file: ipFile, b64: ipBase64, name: 'Fikri Mülkiyet Belgesi', type: 'ip' } : null,
        ethicsFile && ethicsBase64 ? { file: ethicsFile, b64: ethicsBase64, name: 'Etik Kurul Onay Belgesi', type: 'ethics' } : null,
      ].filter(Boolean);

      for (const u of uploads as any[]) {
        try {
          await documentsApi.upload(pid, { name: u.name, fileName: u.file.name, fileData: u.b64, type: u.type, size: u.file.size });
        } catch {}
      }

      toast.success('Proje oluşturuldu!');
      router.push('/projects/' + pid);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Adım geçerlilik kontrolü
  const canAdvance = () => {
    if (step === 0 && !form.title) { toast.error('Proje adı zorunlu'); return false; }
    return true;
  };

  const FileUploadField = ({ label, file, onChange, required, hint }: any) => (
    <div>
      <label className="label flex items-center gap-1">
        {label}
        {required && <span className="text-red-500 text-xs">*</span>}
      </label>
      {hint && <p className="text-xs text-muted mb-1.5">{hint}</p>}
      <div className="flex items-center gap-3">
        <label className="flex-1 cursor-pointer">
          <div className="input flex items-center gap-2 cursor-pointer" style={{ height: 40 }}>
            <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            <span className="text-sm text-muted truncate">{file ? file.name : 'Dosya seçin (PDF, Word, JPG)'}</span>
          </div>
          <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
            onChange={e => onChange(e.target.files?.[0] || null)} />
        </label>
        {file && (
          <button type="button" onClick={() => onChange(null)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
        )}
      </div>
      {file && <p className="text-xs text-green-600 mt-1">✓ {file.name} ({Math.round(file.size / 1024)}KB)</p>}
    </div>
  );

  const renderStep = () => {
    switch (STEPS[step].key) {

      case 'basic': return (
        <div className="space-y-5">
          <div>
            <label className="label">Proje Adı *</label>
            <input className="input text-base" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Projenin tam adını girin" autoFocus />
          </div>
          <SimilarProjectsAlert title={form.title} description={form.description} type={form.type} />
          <div>
            <label className="label">Proje Özeti</label>
            <textarea className="input" style={{ minHeight: 100 }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Projeyi 2-3 cümleyle tanımlayın..." />
            <div className="mt-2">
              <AiSummaryPanel title={form.title} description={form.description} type={form.type} faculty={form.faculty} mode="create" onApply={t => set('description', t)} />
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
            <div className="p-3 rounded-xl text-xs flex gap-2 items-start" style={{ background: '#fef3c7', color: '#92651a' }}>
              ⚠️ Aktif durumu için son adımda kabul belgesi yüklemeniz gerekecek.
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
              <input className="input" value={form.department} onChange={e => set('department', e.target.value)} placeholder="Bilgisayar Mühendisliği..." />
            </div>
          </div>
          {dynamicFields.length > 0 && (
            <div className="space-y-4 pt-2 border-t" style={{ borderColor: '#e8e4dc' }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ek Kurumsal Alanlar</p>
              {dynamicFields.map(field => (
                <div key={field.id}>
                  <label className="label">{field.label || field.name}{field.required ? ' *' : ''}</label>
                  {field.type === 'textarea' ? <textarea className="input" value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)} />
                    : field.type === 'select' ? <select className="input" value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)}><option value="">Seçin</option>{field.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>
                    : field.type === 'checkbox' ? <label className="flex items-center gap-2 mt-1"><input type="checkbox" checked={!!form.dynamicFields[field.key]} onChange={e => setDyn(field.key, e.target.checked)} /><span className="text-sm">Evet</span></label>
                    : <input type={field.type === 'number' ? 'number' : 'text'} className="input" value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)} />}
                </div>
              ))}
            </div>
          )}
        </div>
      );

      case 'financial': return (
        <div className="space-y-5">
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
            📄 Proje metni, özetten farklı olarak projenin tüm detaylarını, yöntemini ve hedeflerini içeren kapsamlı açıklamadır.
          </div>
          <div>
            <label className="label flex justify-between">
              <span>Proje Metni</span>
              <span className="text-xs text-muted font-normal">{form.projectText.length} karakter</span>
            </label>
            <textarea className="input" style={{ minHeight: 260, lineHeight: 1.7 }} value={form.projectText}
              onChange={e => set('projectText', e.target.value)}
              placeholder={'Projenizin detaylı açıklaması...\n\nÖnerilen başlıklar:\n• Projenin amacı ve önemi\n• Araştırma sorusu / hipotezi\n• Yöntem ve yaklaşım\n• Beklenen çıktılar\n• Zaman çizelgesi'} />
          </div>
          <div className="p-4 rounded-xl" style={{ border: '1px solid #e8e4dc', background: '#faf8f4' }}>
            <ProjectComplianceCheck
              title={form.title} description={form.description}
              projectText={form.projectText} type={form.type}
              ethicsRequired={form.ethicsRequired}
              onResult={r => { setComplianceResult(r); if (r?.ethicsFlags?.length > 0) set('ethicsRequired', true); }}
            />
          </div>
        </div>
      );

      case 'sdg': return (
        <div className="space-y-5">
          <div>
            <label className="label">Sürdürülebilir Kalkınma Hedefleri</label>
            <p className="text-xs text-muted mb-3">Birden fazla seçebilirsiniz.</p>
            <SdgPicker selected={sdgSelected} onChange={setSdgSelected} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Etiketler</label>
              <input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="yapay zeka, makine öğrenmesi..." />
              <p className="text-xs text-muted mt-1">Virgülle ayırın</p>
            </div>
            <div>
              <label className="label">Anahtar Kelimeler</label>
              <input className="input" value={form.keywords} onChange={e => set('keywords', e.target.value)} placeholder="keyword1, keyword2..." />
            </div>
          </div>
        </div>
      );

      case 'ip': return (
        <div className="space-y-5">
          <div className="p-3 rounded-xl text-xs" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9' }}>
            ⚖️ Patent, faydalı model, marka gibi fikri mülkiyet korumanız varsa bilgileri girin. Belge yüklemeniz önerilir.
          </div>
          <div>
            <label className="label">Fikri Mülkiyet Durumu</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {IP_STATUS_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => set('ipStatus', opt.value)}
                  className="p-3 rounded-xl border-2 text-center transition-all"
                  style={{ borderColor: form.ipStatus === opt.value ? opt.color : '#e8e4dc', background: form.ipStatus === opt.value ? opt.color + '10' : 'white' }}>
                  <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1" style={{ background: opt.color }} />
                  <p className="text-xs font-semibold" style={{ color: form.ipStatus === opt.value ? opt.color : '#374151' }}>{opt.label}</p>
                </button>
              ))}
            </div>
          </div>

          {form.ipStatus !== 'none' && (
            <>
              <div>
                <label className="label">Tür</label>
                <div className="grid grid-cols-3 gap-2">
                  {IP_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => set('ipType', t.value)}
                      className="p-2 rounded-xl border text-xs font-medium transition-all"
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
                <textarea className="input" rows={2} value={form.ipNotes} onChange={e => set('ipNotes', e.target.value)} placeholder="Ek notlar..." />
              </div>
              <FileUploadField
                label="Fikri Mülkiyet Belgesi"
                file={ipFile}
                onChange={(f: File | null) => handleFileChange(f, setIpFile, setIpBase64)}
                required={needsIpDoc}
                hint="Patent başvuru formu, tescil belgesi veya ilgili resmi belge"
              />
            </>
          )}
        </div>
      );

      case 'ethics': return (
        <div className="space-y-5">
          <div className="p-3 rounded-xl text-xs" style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92651a' }}>
            🔬 İnsan/hayvan deneyi, kişisel veri kullanımı veya hassas gruplarla yapılan araştırmalar için etik kurul onayı gereklidir.
          </div>

          {complianceResult?.ethicsFlags?.length > 0 && (
            <div className="p-3 rounded-xl text-xs" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
              <p className="font-semibold text-red-700 mb-1">🤖 YZ Analizi Uyarıyor:</p>
              {complianceResult.ethicsFlags.map((f: string, i: number) => <p key={i} className="text-red-600">• {f}</p>)}
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 transition-all"
            style={{ borderColor: form.ethicsRequired ? '#d97706' : '#e8e4dc', background: form.ethicsRequired ? '#fffbeb' : 'white' }}>
            <input type="checkbox" className="w-5 h-5 accent-amber-500" checked={form.ethicsRequired} onChange={e => set('ethicsRequired', e.target.checked)} />
            <div>
              <p className="text-sm font-semibold text-navy">Bu proje etik kurul onayı gerektiriyor</p>
              <p className="text-xs text-muted mt-0.5">İnsan/hayvan deneği, kişisel veri veya hassas grup araştırması</p>
            </div>
          </label>

          {form.ethicsRequired && (
            <div className="space-y-4 p-4 rounded-xl" style={{ border: '1px solid #fde68a', background: '#fffbeb' }}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-green-500" checked={form.ethicsApproved} onChange={e => set('ethicsApproved', e.target.checked)} />
                <p className="text-sm font-semibold text-navy">Etik kurul onayı alındı ✓</p>
              </label>
              {form.ethicsApproved && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Etik Kurul Adı</label>
                      <input className="input" value={form.ethicsCommittee} onChange={e => set('ethicsCommittee', e.target.value)} placeholder="MKÜ Etik Kurulu..." />
                    </div>
                    <div>
                      <label className="label">Onay No</label>
                      <input className="input" value={form.ethicsApprovalNo} onChange={e => set('ethicsApprovalNo', e.target.value)} placeholder="2024/ETK-001" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Onay Tarihi</label>
                    <input type="date" className="input" value={form.ethicsApprovalDate} onChange={e => set('ethicsApprovalDate', e.target.value)} />
                  </div>
                  <FileUploadField
                    label="Etik Kurul Onay Belgesi"
                    file={ethicsFile}
                    onChange={(f: File | null) => handleFileChange(f, setEthicsFile, setEthicsBase64)}
                    required={needsEthicsDoc}
                    hint="Etik kuruldan alınan resmi onay yazısı"
                  />
                </>
              )}
            </div>
          )}
        </div>
      );

      case 'confirm': return (
        <div className="space-y-5">
          {/* YZ Belge İncelemesi */}
          {reviewLoading && (
            <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
              <span className="spinner w-4 h-4" />
              <p className="text-sm text-purple-700">🤖 YZ belgelerinizi inceliyor...</p>
            </div>
          )}
          {docReview && !reviewLoading && (
            <div className="p-4 rounded-xl" style={{
              background: docReview.status === 'ok' ? '#f0fdf4' : docReview.status === 'warning' ? '#fffbeb' : '#fef2f2',
              border: '1px solid ' + (docReview.status === 'ok' ? '#86efac' : docReview.status === 'warning' ? '#fde68a' : '#fca5a5'),
            }}>
              <p className="text-sm font-semibold mb-1" style={{ color: docReview.status === 'ok' ? '#059669' : docReview.status === 'warning' ? '#d97706' : '#dc2626' }}>
                🤖 YZ Belge İncelemesi: {docReview.summary}
              </p>
              {docReview.issues?.map((iss: any, i: number) => (
                <p key={i} className="text-xs mt-1" style={{ color: iss.severity === 'error' ? '#dc2626' : iss.severity === 'warning' ? '#d97706' : '#6b7280' }}>
                  {iss.severity === 'error' ? '❌' : iss.severity === 'warning' ? '⚠️' : 'ℹ️'} {iss.message}
                </p>
              ))}
              {docReview.missingDocuments?.length > 0 && (
                <p className="text-xs mt-1 text-amber-700">📎 Eksik: {docReview.missingDocuments.join(', ')}</p>
              )}
            </div>
          )}

          {/* Özet */}
          <div className="p-4 rounded-xl space-y-2" style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
            <p className="text-xs font-bold uppercase tracking-wider text-navy">Proje Özeti</p>
            {[
              ['Başlık', form.title],
              ['Tür', projectTypes.find(t => t.key === form.type)?.label || form.type],
              ['Durum', STATUSES.find(s => s.value === form.status)?.label],
              form.faculty ? ['Fakülte', form.faculty] : null,
              form.budget ? ['Bütçe', Number(form.budget).toLocaleString('tr-TR') + ' ₺'] : null,
              sdgSelected.length ? ['SKH', sdgSelected.length + ' hedef'] : null,
              form.ipStatus !== 'none' ? ['Fikri Mülkiyet', IP_STATUS_OPTIONS.find(o => o.value === form.ipStatus)?.label] : null,
              form.ethicsRequired ? ['Etik Kurul', form.ethicsApproved ? '✅ Onaylandı' : '⏳ Bekleniyor'] : null,
              complianceResult ? ['YZ Skoru', complianceResult.score + '/100'] : null,
            ].filter(Boolean).map(([k, v]: any, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted">{k}</span>
                <span className="font-medium text-navy">{v}</span>
              </div>
            ))}
          </div>

          {/* Belgeler durumu */}
          <div className="p-4 rounded-xl space-y-2" style={{ border: '1px solid #e8e4dc' }}>
            <p className="text-xs font-bold uppercase tracking-wider text-navy">Yüklenecek Belgeler</p>
            {[
              { label: 'Kabul Belgesi', file: acceptanceFile, required: needsAcceptance },
              { label: 'Fikri Mülkiyet Belgesi', file: ipFile, required: needsIpDoc },
              { label: 'Etik Kurul Belgesi', file: ethicsFile, required: needsEthicsDoc },
            ].filter(d => d.required || d.file).map(({ label, file, required }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-muted">{label} {required && <span className="text-red-500">*</span>}</span>
                {file
                  ? <span className="text-green-600 font-semibold">✓ {file.name}</span>
                  : <span className="text-red-500">Yüklenmedi</span>}
              </div>
            ))}
            {needsAcceptance && (
              <div className="mt-2">
                <FileUploadField
                  label="Başvuru Kabul Belgesi *"
                  file={acceptanceFile}
                  onChange={(f: File | null) => handleFileChange(f, setAcceptanceFile, setAcceptanceBase64)}
                  required={true}
                />
              </div>
            )}
          </div>
        </div>
      );

      default: return null;
    }
  };

  return (
    <DashboardLayout>
      <Header title="Yeni Proje Oluştur" subtitle={STEPS[step].icon + ' ' + STEPS[step].label} />
      <div className="p-6" style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Adım Göstergesi */}
        <div className="flex items-center gap-0 mb-6 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-shrink-0">
              <button type="button" onClick={() => i < step && setStep(i)}
                className="flex flex-col items-center" style={{ minWidth: 64 }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
                  style={{ background: i === step ? '#1a3a6b' : i < step ? '#059669' : '#f0ede8', color: i <= step ? 'white' : '#9ca3af', fontWeight: 700 }}>
                  {i < step ? '✓' : s.icon}
                </div>
                <span className="text-[10px] mt-1 text-center leading-tight" style={{ color: i === step ? '#1a3a6b' : i < step ? '#059669' : '#9ca3af', maxWidth: 56 }}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="h-0.5 flex-1 mx-0.5" style={{ background: i < step ? '#059669' : '#e8e4dc', minWidth: 12 }} />
              )}
            </div>
          ))}
        </div>

        {/* Form İçeriği */}
        <div className="card p-6 mb-5">
          {renderStep()}
        </div>

        {/* Navigasyon */}
        <div className="flex gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)} className="btn-secondary" style={{ minWidth: 100 }}>← Geri</button>
          )}
          <div className="flex-1" />
          {!isLastStep ? (
            <button type="button" onClick={() => { if (canAdvance()) setStep(s => s + 1); }} className="btn-primary" style={{ minWidth: 160 }}>
              Devam → <span className="text-xs opacity-70 ml-1">{STEPS[step + 1].label}</span>
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ minWidth: 160 }}>
              {loading ? 'Oluşturuluyor...' : '✓ Projeyi Oluştur'}
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
