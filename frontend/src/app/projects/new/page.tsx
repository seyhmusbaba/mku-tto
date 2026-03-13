'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { SdgPicker } from '@/components/SdgPicker';
import { SimilarProjectsAlert } from '@/components/SimilarProjectsAlert';
import { BudgetEstimator } from '@/components/BudgetEstimator';
import { AiSummaryPanel } from '@/components/AiSummaryPanel';
import { projectsApi, dynamicFieldsApi, documentsApi, projectTypesApi, facultiesApi } from '@/lib/api';
import { DynamicField, ProjectTypeItem, FacultyItem } from '@/types';
import { getProjectTypeLabel } from '@/lib/utils';
import toast from 'react-hot-toast';

const STATUSES: { value: string; label: string; desc: string; color: string }[] = [
  { value: 'application', label: 'Başvuru Sürecinde', desc: 'Proje başvurusu devam ediyor', color: '#d97706' },
  { value: 'active',      label: 'Aktif',             desc: 'Kabul belgesi zorunlu',         color: '#059669' },
  { value: 'completed',   label: 'Tamamlandı',        desc: 'Proje sonuçlanmış',             color: '#2563eb' },
];

const STEP_LABELS = ['Temel Bilgiler', 'Kurumsal', 'Finansal', 'SKH Etiketleri', 'Onay & Belgeler'];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeItem[]>([]);
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [sdgSelected, setSdgSelected] = useState<string[]>([]);
  const [acceptanceFile, setAcceptanceFile] = useState<File | null>(null);
  const [acceptanceBase64, setAcceptanceBase64] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Record<string, any>>({
    title: '', description: '', type: 'other', status: 'application',
    faculty: '', department: '', budget: '', fundingSource: '',
    startDate: '', endDate: '', tags: '', keywords: '', dynamicFields: {}
  });

  useEffect(() => {
    Promise.all([
      dynamicFieldsApi.getAll().then(r => setDynamicFields(r.data)).catch(() => {}),
      projectTypesApi.getActive().then(r => setProjectTypes(r.data)).catch(() => {}),
      facultiesApi.getActive().then(r => setFaculties(r.data)).catch(() => {}),
    ]);
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setDyn = (k: string, v: any) => setForm(f => ({ ...f, dynamicFields: { ...f.dynamicFields, [k]: v } }));

  const handleFileSelect = (file: File) => {
    setAcceptanceFile(file);
    const reader = new FileReader();
    reader.onload = () => setAcceptanceBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return toast.error('Proje adı zorunludur');
    if (form.status === 'active' && !acceptanceFile) {
      return toast.error('Aktif proje için başvuru kabul belgesi yüklenmelidir');
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        budget: form.budget ? +form.budget : null,
        tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        keywords: form.keywords ? form.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [],
        sdgGoals: sdgSelected,
      };
      const res = await projectsApi.create(payload);
      const projectId = res.data.id;

      // Upload acceptance document if provided
      if (acceptanceFile && acceptanceBase64) {
        try {
          await documentsApi.upload(projectId, {
            name: 'Başvuru Kabul Belgesi',
            fileName: acceptanceFile.name,
            fileData: acceptanceBase64,
            type: 'acceptance',
            size: acceptanceFile.size,
          });
        } catch { /* non-blocking */ }
      }

      toast.success('Proje oluşturuldu!');
      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bir hata oluştu');
    } finally { setLoading(false); }
  };

  const needsAcceptance = form.status === 'active';

  const steps = [
    /* 0: Basic */
    <div key={0} className="space-y-5">
      <div>
        <label className="label">Proje Adı *</label>
        <input className="input text-base" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Projenin tam adını girin" autoFocus />
      </div>
      <SimilarProjectsAlert title={form.title} description={form.description} />
      <div>
        <label className="label">Proje Özeti</label>
        <textarea className="input" style={{ minHeight: 120 }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Projeyi kısaca tanımlayın..." />
        <div className="mt-3">
          <AiSummaryPanel
            title={form.title}
            description={form.description}
            type={form.type}
            faculty={form.faculty}
            mode="create"
            onApply={(text) => set('description', text)}
          />
        </div>
      </div>
      <div>
        <label className="label">Proje Türü</label>
        <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
          {projectTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      <BudgetEstimator type={form.type} faculty={form.faculty} />
      <div>
        <label className="label">Proje Durumu</label>
        <div className="grid grid-cols-3 gap-3 mt-1">
          {STATUSES.map(s => (
            <button key={s.value} type="button" onClick={() => set('status', s.value)}
              className="p-4 rounded-2xl border-2 text-left transition-all"
              style={{
                borderColor: form.status === s.value ? s.color : '#e8e4dc',
                background: form.status === s.value ? s.color + '12' : '#faf8f4',
              }}>
              <div className="w-3 h-3 rounded-full mb-2" style={{ background: s.color }} />
              <p className="text-sm font-bold" style={{ color: form.status === s.value ? s.color : '#374151' }}>{s.label}</p>
              <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{s.desc}</p>
            </button>
          ))}
        </div>
        {needsAcceptance && (
          <div className="mt-3 p-3 rounded-xl flex items-center gap-2 text-sm" style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92651a' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Son adımda başvuru kabul belgesi yüklemeniz gerekecek.
          </div>
        )}
      </div>
    </div>,

    /* 1: Institutional */
    <div key={1} className="space-y-5">
      <div>
        <label className="label">Fakülte</label>
        <select className="input" value={form.faculty} onChange={e => set('faculty', e.target.value)}>
          <option value="">Fakülte seçin</option>
          {faculties.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Bölüm / Birim</label>
        <input className="input" value={form.department} onChange={e => set('department', e.target.value)} placeholder="Örn: Bilgisayar Mühendisliği" />
      </div>
      {dynamicFields.length > 0 && <>
        <div className="divider" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ek Alanlar</p>
        {dynamicFields.map(field => (
          <div key={field.id}>
            <label className="label">{field.label || field.name}{field.required ? ' *' : ''}</label>
            {field.type === 'textarea' ? <textarea className="input" required={!!field.required} value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)} /> :
              field.type === 'select' ? <select className="input" value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)}><option value="">Seçin</option>{field.options?.map(o => <option key={o} value={o}>{o}</option>)}</select> :
              field.type === 'checkbox' ? <div className="flex items-center gap-2 mt-2"><input type="checkbox" checked={!!form.dynamicFields[field.key]} onChange={e => setDyn(field.key, e.target.checked)} /><span className="text-sm">Evet</span></div> :
              <input type={field.type === 'number' ? 'number' : 'text'} className="input" required={!!field.required} value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)} />}
          </div>
        ))}
      </>}
    </div>,

    /* 2: Financial */
    <div key={2} className="space-y-5">
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
    </div>,

    /* 3: SDG Tags */
    <div key={3} className="space-y-5">
      <div>
        <label className="label">Sürdürülebilir Kalkınma Hedefleri</label>
        <p className="text-xs text-muted mb-3">Bu projenin katkı sağladığı SKH hedeflerini işaretleyin. Birden fazla seçebilirsiniz.</p>
        <SdgPicker selected={sdgSelected} onChange={setSdgSelected} />
      </div>
      <div>
        <label className="label">Diğer Etiketler</label>
        <input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="yapay zeka, makine öğrenmesi..." />
        <p className="text-xs text-muted mt-1.5">Virgülle ayırın</p>
      </div>
      <div>
        <label className="label">Anahtar Kelimeler</label>
        <input className="input" value={form.keywords} onChange={e => set('keywords', e.target.value)} placeholder="keyword1, keyword2..." />
      </div>
    </div>,

    /* 4: Summary + Acceptance doc */
    <div key={4} className="space-y-5">
      {/* Summary */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
        <p className="text-xs font-bold uppercase tracking-wider text-navy">Proje Özeti</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted">Proje Adı</span><span className="font-medium text-navy line-clamp-1 ml-4">{form.title || '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted">Tür</span><span className="font-medium text-navy">{projectTypes.find(t => t.key === form.type)?.label || form.type}</span></div>
          <div className="flex justify-between"><span className="text-muted">Durum</span>
            <span className="font-bold" style={{ color: STATUSES.find(s => s.value === form.status)?.color }}>
              {STATUSES.find(s => s.value === form.status)?.label}
            </span>
          </div>
          {form.faculty && <div className="flex justify-between"><span className="text-muted">Fakülte</span><span className="font-medium text-navy text-right ml-4">{form.faculty}</span></div>}
          {form.budget && <div className="flex justify-between"><span className="text-muted">Bütçe</span><span className="font-medium text-navy">{Number(form.budget).toLocaleString('tr-TR')} ₺</span></div>}
          {sdgSelected.length > 0 && <div className="flex justify-between"><span className="text-muted">SKH Hedefleri</span><span className="font-medium text-navy">{sdgSelected.length} hedef seçili</span></div>}
        </div>
      </div>

      {/* Acceptance doc */}
      <div className={`rounded-2xl p-5 ${needsAcceptance ? 'border-2' : 'border'}`}
        style={{ borderColor: needsAcceptance ? '#059669' : '#e8e4dc', background: needsAcceptance ? '#f0fdf4' : '#faf8f4' }}>
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={needsAcceptance ? '#059669' : '#9ca3af'} strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-sm font-bold" style={{ color: needsAcceptance ? '#059669' : '#6b7280' }}>
            Başvuru Kabul Belgesi {needsAcceptance ? '(Zorunlu)' : '(İsteğe Bağlı)'}
          </p>
        </div>
        <p className="text-xs text-muted mb-4">
          {needsAcceptance
            ? 'Aktif proje için kabul belgesi zorunludur. PDF veya görsel yükleyebilirsiniz.'
            : 'Projeye kabul belgesi eklemek istiyorsanız şimdi yükleyebilirsiniz.'}
        </p>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
          onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
        {acceptanceFile ? (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'white', border: '1px solid #d1fae5' }}>
            <svg className="w-8 h-8 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy truncate">{acceptanceFile.name}</p>
              <p className="text-xs text-muted">{(acceptanceFile.size / 1024).toFixed(0)} KB</p>
            </div>
            <button type="button" onClick={() => { setAcceptanceFile(null); setAcceptanceBase64(''); }} className="text-xs text-red-500 hover:underline">Kaldır</button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full py-8 rounded-xl border-2 border-dashed text-sm font-semibold transition-all hover:border-green-400"
            style={{ borderColor: needsAcceptance ? '#6ee7b7' : '#e8e4dc', color: needsAcceptance ? '#059669' : '#9ca3af', background: 'white' }}>
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Dosya Seç veya Sürükle
          </button>
        )}
      </div>
    </div>,
  ];

  return (
    <DashboardLayout>
      <Header title="Yeni Proje" subtitle="Yeni akademik proje kaydı oluştur"
        actions={<button onClick={() => router.back()} className="btn-secondary">← Geri</button>} />

      <div className="p-8 flex gap-8 items-start max-w-5xl">
        {/* Step indicator */}
        <div className="w-52 flex-shrink-0 sticky top-24">
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-4">Adımlar</p>
            <div className="space-y-1">
              {STEP_LABELS.map((label, i) => (
                <button key={i} onClick={() => setStep(i)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left"
                  style={{ background: step === i ? '#0f2444' : step > i ? '#f0fdf4' : 'transparent', color: step === i ? 'white' : step > i ? '#059669' : '#6b7280' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: step === i ? 'rgba(255,255,255,0.2)' : step > i ? '#d1fae5' : '#f0ede8', color: step === i ? 'white' : step > i ? '#059669' : '#9ca3af' }}>
                    {step > i ? '✓' : i + 1}
                  </div>
                  {label}
                  {i === 4 && needsAcceptance && !acceptanceFile && <span className="ml-auto w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 card">
          <h3 className="font-display text-lg font-semibold text-navy mb-6 pb-4 border-b" style={{ borderColor: '#e8e4dc' }}>
            {STEP_LABELS[step]}
          </h3>
          {steps[step]}
          <div className="flex justify-between mt-8 pt-6 border-t" style={{ borderColor: '#e8e4dc' }}>
            <button onClick={() => step > 0 ? setStep(s => s - 1) : router.back()} className="btn-secondary">
              ← {step === 0 ? 'İptal' : 'Önceki'}
            </button>
            {step < STEP_LABELS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)} className="btn-primary">Devam Et →</button>
            ) : (
              <button onClick={handleSubmit} disabled={loading || (needsAcceptance && !acceptanceFile)} className="btn-gold"
                style={{ opacity: (needsAcceptance && !acceptanceFile) ? 0.5 : 1 }}>
                {loading ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block mr-2" />Kaydediliyor...</> : '✓ Projeyi Kaydet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
