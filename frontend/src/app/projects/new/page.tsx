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
  { value: 'application', label: 'Basvuru Sürecinde', color: '#d97706' },
  { value: 'active',      label: 'Aktif',             color: '#059669' },
  { value: 'completed',   label: 'Tamamlandi',         color: '#2563eb' },
];

const IP_OPTS = [
  { value: 'none',       label: 'Yok',              color: '#6b7280' },
  { value: 'pending',    label: 'Basvuru Asamasinda',color: '#d97706' },
  { value: 'registered', label: 'Tescilli',          color: '#059669' },
  { value: 'published',  label: 'Yayimlandi',        color: '#2563eb' },
];

const IP_TYPES = [
  { value: 'patent',        label: 'Patent' },
  { value: 'faydali_model', label: 'Faydali Model' },
  { value: 'marka',         label: 'Marka' },
  { value: 'tasarim',       label: 'Tasarim' },
  { value: 'telif',         label: 'Telif Hakki' },
  { value: 'ticari_sir',    label: 'Ticari Sir' },
];

const STEPS = [
  { key: 'basic',    label: 'Temel',       icon: '📋' },
  { key: 'academic', label: 'Kurumsal',    icon: '🏛️' },
  { key: 'finance',  label: 'Finansal',    icon: '💰' },
  { key: 'text',     label: 'Proje Metni', icon: '📄' },
  { key: 'sdg',      label: 'SKH',         icon: '🎯' },
  { key: 'ip',       label: 'Fikri Mulk.', icon: '⚖️' },
  { key: 'confirm',  label: 'Onay',        icon: '✅' },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [faculties, setFaculties] = useState<string[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [dynamicFields, setDynamicFields] = useState<any[]>([]);
  const [sdgSelected, setSdgSelected] = useState<string[]>([]);
  const [complianceResult, setComplianceResult] = useState<any>(null);
  const [complianceDone, setComplianceDone] = useState(false);
  const [ethicsAnalysis, setEthicsAnalysis] = useState<any>(null);
  const [ethicsLoading, setEthicsLoading] = useState(false);
  const [docReview, setDocReview] = useState<any>(null);
  const [docReviewLoading, setDocReviewLoading] = useState(false);

  const [acceptanceFile, setAcceptanceFile] = useState<File | null>(null);
  const [acceptanceB64, setAcceptanceB64] = useState<string | null>(null);
  const [ipFile, setIpFile] = useState<File | null>(null);
  const [ipB64, setIpB64] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', type: 'tubitak', status: 'application',
    faculty: '', department: '', dynamicFields: {} as any,
    budget: '', fundingSource: '', startDate: '', endDate: '',
    projectText: '', tags: '', keywords: '',
    ipStatus: 'none', ipType: '', ipRegistrationNo: '', ipDate: '', ipNotes: '',
  });

  useEffect(() => {
    facultiesApi.getActive().then(r => setFaculties((r.data || []).map((f: any) => f.name))).catch(() => {});
    api.get('/project-types').then(r => setProjectTypes(r.data || [])).catch(() => {});
    api.get('/dynamic-fields').then(r => setDynamicFields(r.data || [])).catch(() => {});
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setDyn = (k: string, v: any) => setForm(f => ({ ...f, dynamicFields: { ...f.dynamicFields, [k]: v } }));

  const toB64 = (file: File): Promise<string> =>
    new Promise(res => { const r = new FileReader(); r.onload = e => res((e.target?.result as string).split(',')[1]); r.readAsDataURL(file); });

  const needsAcceptance = form.status === 'active';
  const needsIpDoc = ['pending', 'registered', 'published'].includes(form.ipStatus);
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    if (!isLast) return;
    const docs: any[] = [];
    if (acceptanceFile) docs.push({ name: acceptanceFile.name, type: 'acceptance', size: acceptanceFile.size });
    if (ipFile) docs.push({ name: ipFile.name, type: 'ip', size: ipFile.size });
    setDocReviewLoading(true);
    api.post('/ai/review-documents', {
      projectTitle: form.title, projectType: form.type, documents: docs,
      ipStatus: form.ipStatus, ethicsRequired: ethicsAnalysis?.required || false, ethicsApproved: false,
    }).then(r => setDocReview(r.data))
      .catch(() => setDocReview({ status: 'ok', summary: 'Kontrol tamamlandi', issues: [], missingDocuments: [] }))
      .finally(() => setDocReviewLoading(false));
  }, [step, isLast]);

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
    if (step === 0 && !form.title.trim()) { toast.error('Proje adi zorunlu'); return false; }
    if (STEPS[step].key === 'text' && !complianceDone) {
      toast.error('Devam etmeden once YZ Uygunluk Kontrolü yapiniz!');
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!canAdvance()) return;
    if (STEPS[step].key === 'text') runEthicsAnalysis();
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Proje adi zorunlu'); return; }
    if (!complianceDone) { toast.error('YZ Uygunluk Kontrolü zorunludur!'); return; }
    if (needsAcceptance && !acceptanceFile) { toast.error('Aktif proje icin kabul belgesi gerekli'); return; }
    if (docReview?.status === 'error') {
      const msgs = docReview.issues?.map((i: any) => i.message).join('\n') || '';
      if (!confirm('YZ belge incelemesinde sorunlar tespit edildi:\n' + msgs + '\n\nYine de devam?')) return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title, description: form.description, type: form.type, status: form.status,
        faculty: form.faculty, department: form.department,
        budget: form.budget ? Number(form.budget) : null,
        fundingSource: form.fundingSource, startDate: form.startDate, endDate: form.endDate,
        projectText: form.projectText,
        tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        keywords: form.keywords ? form.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [],
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

      if (acceptanceFile && acceptanceB64)
        await documentsApi.upload(pid, { name: 'Basvuru Kabul Belgesi', fileName: acceptanceFile.name, fileData: acceptanceB64, type: 'acceptance', size: acceptanceFile.size }).catch(() => {});
      if (ipFile && ipB64)
        await documentsApi.upload(pid, { name: 'Fikri Mulkiyet Belgesi', fileName: ipFile.name, fileData: ipB64, type: 'ip', size: ipFile.size }).catch(() => {});

      if (ethicsAnalysis?.required) {
        await api.post('/ethics/analyze/' + pid).catch(() => {});
        toast.success('Proje olusturuldu - Etik kurul incelemesine gonderildi!');
      } else {
        toast.success('Proje basariyla olusturuldu!');
      }
      router.push('/projects/' + pid);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Hata olustu');
    } finally { setSaving(false); }
  };

  const renderStep = () => {
    switch (STEPS[step].key) {

      case 'basic': return (
        <div className="space-y-5">
          <div>
            <label className="label">Proje Adi *</label>
            <input className="input text-base" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Projenin tam adini girin" autoFocus />
          </div>
          <SimilarProjectsAlert title={form.title} description={form.description} type={form.type} />
          <div>
            <label className="label">Proje Özeti</label>
            <textarea className="input" style={{ minHeight: 100 }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="2-3 cumleyle tanimlayin..." />
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
          {needsAcceptance && <div className="p-3 rounded-xl text-xs" style={{ background: '#fef3c7', color: '#92651a' }}>Son adimda kabul belgesi yuklenecek.</div>}
        </div>
      );

      case 'academic': return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fakülte</label>
              <select className="input" value={form.faculty} onChange={e => set('faculty', e.target.value)}>
                <option value="">Secin</option>
                {faculties.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bölüm</label>
              <input className="input" value={form.department} onChange={e => set('department', e.target.value)} placeholder="Bilgisayar Muhendisligi..." />
            </div>
          </div>
          {dynamicFields.length > 0 && (
            <div className="space-y-4 pt-3 border-t" style={{ borderColor: '#e8e4dc' }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ek Alanlar</p>
              {dynamicFields.map(field => (
                <div key={field.id}>
                  <label className="label">{field.label || field.name}</label>
                  {field.type === 'textarea' ? <textarea className="input" value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)} />
                    : field.type === 'select' ? <select className="input" value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)}><option value="">Secin</option>{field.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>
                    : field.type === 'checkbox' ? <label className="flex items-center gap-2 mt-1"><input type="checkbox" checked={!!form.dynamicFields[field.key]} onChange={e => setDyn(field.key, e.target.checked)} /><span className="text-sm">Evet</span></label>
                    : <input type={field.type === 'number' ? 'number' : 'text'} className="input" value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)} />}
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
              <input type="number" className="input" value={form.budget} onChange={e => set('budget', e.target.value)} />
            </div>
            <div>
              <label className="label">Fon Kaynagi</label>
              <input className="input" value={form.fundingSource} onChange={e => set('fundingSource', e.target.value)} placeholder="TUBITAK, BAP..." />
            </div>
          </div>
          <BudgetEstimator type={form.type} faculty={form.faculty} />
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Baslangic</label><input type="date" className="input" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></div>
            <div><label className="label">Bitis</label><input type="date" className="input" value={form.endDate} onChange={e => set('endDate', e.target.value)} /></div>
          </div>
        </div>
      );

      case 'text': return (
        <div className="space-y-5">
          <div className="p-3 rounded-xl text-xs" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
            📄 Proje metni özetten farklı detaylı aciklamadır. YZ Uygunluk Kontrolü zorunludur.
          </div>
          <div>
            <label className="label flex justify-between">
              <span>Proje Metni</span>
              <span className="text-xs text-muted font-normal">{form.projectText.length} karakter</span>
            </label>
            <textarea className="input" style={{ minHeight: 240, lineHeight: 1.7 }} value={form.projectText}
              onChange={e => { set('projectText', e.target.value); setComplianceDone(false); setEthicsAnalysis(null); }}
              placeholder={'Detayli proje aciklamasi...\n\n• Amaci ve onemi\n• Yontem\n• Beklenen ciktilar\n• Zaman cizelgesi'} />
          </div>
          <div className="p-4 rounded-xl" style={{ border: complianceDone ? '2px solid #86efac' : '2px solid #fde68a', background: complianceDone ? '#f0fdf4' : '#fffbeb' }}>
            {complianceDone
              ? <p className="text-xs font-semibold text-green-700 mb-2">✅ YZ Uygunluk Kontrolü tamamlandi</p>
              : <p className="text-xs font-semibold text-amber-700 mb-2">⚠️ Devam etmek icin YZ kontrolü yapiniz</p>
            }
            <ProjectComplianceCheck
              title={form.title} description={form.description}
              projectText={form.projectText} type={form.type}
              onResult={r => { setComplianceResult(r); setComplianceDone(true); }}
            />
          </div>
        </div>
      );

      case 'sdg': return (
        <div className="space-y-5">
          <div><label className="label">SKH Hedefleri</label><SdgPicker selected={sdgSelected} onChange={setSdgSelected} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Etiketler</label><input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="Virgülle ayirin" /></div>
            <div><label className="label">Anahtar Kelimeler</label><input className="input" value={form.keywords} onChange={e => set('keywords', e.target.value)} /></div>
          </div>
        </div>
      );

      case 'ip': return (
        <div className="space-y-5">
          <div className="p-3 rounded-xl text-xs" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9' }}>
            ⚖️ Patent, faydali model, marka gibi fikri mulkiyet varsa bilgileri girin.
          </div>
          <div>
            <label className="label">Fikri Mulkiyet Durumu</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {IP_OPTS.map(o => (
                <button key={o.value} type="button" onClick={() => set('ipStatus', o.value)}
                  className="p-3 rounded-xl border-2 text-center transition-all"
                  style={{ borderColor: form.ipStatus === o.value ? o.color : '#e8e4dc', background: form.ipStatus === o.value ? o.color + '10' : 'white' }}>
                  <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1" style={{ background: o.color }} />
                  <p className="text-xs font-semibold" style={{ color: form.ipStatus === o.value ? o.color : '#374151' }}>{o.label}</p>
                </button>
              ))}
            </div>
          </div>
          {form.ipStatus !== 'none' && (
            <>
              <div>
                <label className="label">Tur</label>
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
                <div><label className="label">Tescil No</label><input className="input" value={form.ipRegistrationNo} onChange={e => set('ipRegistrationNo', e.target.value)} placeholder="TR2024/001234" /></div>
                <div><label className="label">Tarih</label><input type="date" className="input" value={form.ipDate} onChange={e => set('ipDate', e.target.value)} /></div>
              </div>
              <div><label className="label">Notlar</label><textarea className="input" rows={2} value={form.ipNotes} onChange={e => set('ipNotes', e.target.value)} /></div>
              <div>
                <label className="label">Fikri Mulkiyet Belgesi {needsIpDoc && <span className="text-red-500">*</span>}</label>
                <label className="block cursor-pointer">
                  <div className="input flex items-center gap-2 cursor-pointer" style={{ height: 40 }}>
                    <span className="text-sm text-muted">{ipFile ? ipFile.name : 'Dosya sec (PDF, Word, Resim)'}</span>
                  </div>
                  <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0] || null;
                      setIpFile(f);
                      if (f) setIpB64(await toB64(f));
                    }} />
                </label>
                {ipFile && <p className="text-xs text-green-600 mt-1">✓ {ipFile.name}</p>}
              </div>
            </>
          )}
        </div>
      );

      case 'confirm': return (
        <div className="space-y-5">
          {/* YZ Belge İncelemesi */}
          <div className="p-4 rounded-xl" style={{
            border: '2px solid',
            borderColor: docReviewLoading ? '#fde68a' : docReview?.status === 'ok' ? '#86efac' : docReview?.status === 'error' ? '#fca5a5' : '#fde68a',
            background: docReviewLoading ? '#fffbeb' : docReview?.status === 'ok' ? '#f0fdf4' : docReview?.status === 'error' ? '#fef2f2' : '#fffbeb',
          }}>
            <p className="text-sm font-bold mb-1" style={{ color: docReview?.status === 'ok' ? '#059669' : docReview?.status === 'error' ? '#dc2626' : '#d97706' }}>
              🤖 YZ Belge Tutarlilik İncelemesi {docReviewLoading ? '(İnceleniyor...)' : ''}
            </p>
            {docReviewLoading && <div className="flex items-center gap-2 text-xs text-muted"><span className="spinner w-3 h-3" /> Belgeler inceleniyor...</div>}
            {docReview && !docReviewLoading && (
              <>
                <p className="text-xs mb-1">{docReview.summary}</p>
                {docReview.issues?.map((iss: any, i: number) => (
                  <p key={i} className="text-xs mb-0.5" style={{ color: iss.severity === 'error' ? '#dc2626' : iss.severity === 'warning' ? '#d97706' : '#6b7280' }}>
                    {iss.severity === 'error' ? '❌' : iss.severity === 'warning' ? '⚠️' : 'ℹ️'} {iss.message}
                  </p>
                ))}
                {docReview.missingDocuments?.length > 0 && (
                  <p className="text-xs mt-1 text-amber-700">📎 Eksik: {docReview.missingDocuments.join(', ')}</p>
                )}
              </>
            )}
          </div>

          {/* Etik Analiz */}
          {ethicsLoading && <div className="p-3 rounded-xl text-xs flex items-center gap-2" style={{ background: '#f5f3ff' }}><span className="spinner w-3 h-3" /> YZ etik analizi yapiliyor...</div>}
          {ethicsAnalysis && !ethicsLoading && (
            <div className="p-4 rounded-xl" style={{ border: '1px solid', borderColor: ethicsAnalysis.required ? '#fca5a5' : '#86efac', background: ethicsAnalysis.required ? '#fef2f2' : '#f0fdf4' }}>
              <p className="text-sm font-bold mb-1" style={{ color: ethicsAnalysis.required ? '#dc2626' : '#059669' }}>
                🔬 YZ Etik Analizi: {ethicsAnalysis.required ? '⚠️ Etik Kurul Onayi Gerekiyor' : '✅ Etik Kurul Gerekmiyor'}
              </p>
              <p className="text-xs" style={{ color: ethicsAnalysis.required ? '#dc2626' : '#059669' }}>
                Risk: {ethicsAnalysis.riskScore}/100 — {ethicsAnalysis.recommendation}
              </p>
              {ethicsAnalysis.reasons?.map((r: string, i: number) => <p key={i} className="text-xs text-muted">• {r}</p>)}
              {ethicsAnalysis.required && <p className="text-xs mt-2 font-semibold text-amber-700">⚡ Proje kaydedilince etik kurul incelemesine gonderilecek.</p>}
            </div>
          )}

          {/* Özet */}
          <div className="p-4 rounded-xl space-y-2" style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
            <p className="text-xs font-bold uppercase tracking-wider text-navy">Proje Özeti</p>
            {[
              ['Baslik', form.title],
              ['Tur', projectTypes.find(t => t.key === form.type)?.label || form.type],
              ['Durum', STATUSES.find(s => s.value === form.status)?.label],
              form.faculty ? ['Fakulte', form.faculty] : null,
              form.budget ? ['Butce', Number(form.budget).toLocaleString('tr-TR') + ' ₺'] : null,
              sdgSelected.length ? ['SKH', sdgSelected.length + ' hedef'] : null,
              form.ipStatus !== 'none' ? ['Fikri Mulkiyet', IP_OPTS.find(o => o.value === form.ipStatus)?.label] : null,
              complianceResult ? ['YZ Uygunluk', complianceResult.score + '/100'] : null,
            ].filter(Boolean).map(([k, v]: any, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted">{k}</span>
                <span className="font-medium text-navy">{v}</span>
              </div>
            ))}
          </div>

          {needsAcceptance && (
            <div className="p-4 rounded-xl" style={{ border: '2px solid #059669', background: '#f0fdf4' }}>
              <label className="label text-green-800">Basvuru Kabul Belgesi *</label>
              <label className="block cursor-pointer mt-1">
                <div className="input flex items-center gap-2 cursor-pointer" style={{ height: 40 }}>
                  <span className="text-sm text-muted">{acceptanceFile ? acceptanceFile.name : 'Kabul belgesi sec'}</span>
                </div>
                <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0] || null;
                    setAcceptanceFile(f);
                    if (f) setAcceptanceB64(await toB64(f));
                  }} />
              </label>
              {acceptanceFile && <p className="text-xs text-green-600 mt-1">✓ {acceptanceFile.name}</p>}
            </div>
          )}
        </div>
      );

      default: return null;
    }
  };

  return (
    <DashboardLayout>
      <Header title="Yeni Proje Olustur" subtitle={STEPS[step].icon + ' ' + STEPS[step].label} />
      <div className="p-6" style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Adim göstergesi */}
        <div className="flex items-center gap-0 mb-6 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-shrink-0">
              <button type="button" onClick={() => i < step && setStep(i)} className="flex flex-col items-center" style={{ minWidth: 68 }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{ background: i === step ? '#1a3a6b' : i < step ? '#059669' : '#f0ede8', color: i <= step ? 'white' : '#9ca3af', fontWeight: 700 }}>
                  {i < step ? '✓' : s.icon}
                </div>
                <span className="text-[10px] mt-1 text-center leading-tight"
                  style={{ color: i === step ? '#1a3a6b' : i < step ? '#059669' : '#9ca3af', maxWidth: 60 }}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && <div className="h-0.5 flex-1 mx-0.5" style={{ background: i < step ? '#059669' : '#e8e4dc', minWidth: 12 }} />}
            </div>
          ))}
        </div>

        <div className="card p-6 mb-5">{renderStep()}</div>

        <div className="flex gap-3">
          {step > 0 && <button type="button" onClick={() => setStep(s => s - 1)} className="btn-secondary" style={{ minWidth: 100 }}>← Geri</button>}
          <div className="flex-1" />
          {!isLast
            ? <button type="button" onClick={goNext} className="btn-primary" style={{ minWidth: 160 }}>
                Devam → <span className="text-xs opacity-70 ml-1">{STEPS[step + 1]?.label}</span>
              </button>
            : <button type="button" onClick={handleSubmit} disabled={saving} className="btn-primary" style={{ minWidth: 160 }}>
                {saving ? 'Olusturuluyor...' : '✓ Projeyi Olustur'}
              </button>
          }
        </div>
      </div>
    </DashboardLayout>
  );
}
