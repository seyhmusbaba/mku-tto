'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api, projectsApi, documentsApi, facultiesApi } from '@/lib/api';
import { BudgetEstimator } from '@/components/BudgetEstimator';
import { SdgPicker } from '@/components/SdgPicker';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

const IP_STATUS_OPTIONS = [
  { value: 'none', label: 'Yok', color: '#6b7280' },
  { value: 'pending', label: 'Başvuru Aşamasında', color: '#d97706' },
  { value: 'registered', label: 'Tescilli', color: '#059669' },
  { value: 'published', label: 'Yayımlandı', color: '#2563eb' },
];

const IP_TYPES = [
  { value: 'patent', label: '🔬 Patent' },
  { value: 'faydali_model', label: '⚙️ Faydalı Model' },
  { value: 'marka', label: '™️ Marka' },
  { value: 'tasarim', label: '🎨 Tasarım' },
  { value: 'telif', label: '©️ Telif Hakkı' },
  { value: 'ticari_sir', label: '🔒 Ticari Sır' },
];

const STATUSES = [
  { value: 'application', label: 'Başvuru Sürecinde', color: '#d97706' },
  { value: 'pending', label: 'Beklemede', color: '#6b7280' },
  { value: 'active', label: 'Aktif', color: '#059669' },
  { value: 'completed', label: 'Tamamlandı', color: '#2563eb' },
  { value: 'suspended', label: 'Askıya Alındı', color: '#6b7280' },
  { value: 'cancelled', label: 'İptal Edildi', color: '#dc2626' },
];

const TABS = [
  { key: 'basic', label: '📋 Temel' },
  { key: 'academic', label: '🏛️ Kurumsal' },
  { key: 'financial', label: '💰 Finansal' },
  { key: 'text', label: '📄 Proje Metni' },
  { key: 'sdg', label: '🎯 SKH & Etiket' },
  { key: 'ip', label: '⚖️ Fikri Mülkiyet' },
  { key: 'ethics', label: '🔬 Etik Kurul' },
];

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('basic');
  const [project, setProject] = useState<any>(null);
  const [faculties, setFaculties] = useState<string[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [dynamicFields, setDynamicFields] = useState<any[]>([]);
  const [sdgSelected, setSdgSelected] = useState<string[]>([]);
  const [ipFile, setIpFile] = useState<File | null>(null);
  const [ipBase64, setIpBase64] = useState<string | null>(null);
  const [ethicsFile, setEthicsFile] = useState<File | null>(null);
  const [ethicsBase64, setEthicsBase64] = useState<string | null>(null);

  const [form, setForm] = useState<any>({});

  useEffect(() => {
    Promise.all([
      projectsApi.getOne(id).then(r => {
        const p = r.data;
        setProject(p);
        setSdgSelected(p.sdgGoals || []);
        setForm({
          title: p.title || '',
          description: p.description || '',
          type: p.type || 'other',
          status: p.status || 'pending',
          faculty: p.faculty || '',
          department: p.department || '',
          budget: p.budget || '',
          fundingSource: p.fundingSource || '',
          startDate: p.startDate || '',
          endDate: p.endDate || '',
          projectText: p.projectText || '',
          tags: (p.tags || []).join(', '),
          keywords: (p.keywords || []).join(', '),
          dynamicFields: p.dynamicFields || {},
          ipStatus: p.ipStatus || 'none',
          ipType: p.ipType || '',
          ipRegistrationNo: p.ipRegistrationNo || '',
          ipDate: p.ipDate || '',
          ipNotes: p.ipNotes || '',
          ethicsRequired: p.ethicsRequired || false,
          ethicsApproved: p.ethicsApproved || false,
          ethicsCommittee: p.ethicsCommittee || '',
          ethicsApprovalNo: p.ethicsApprovalNo || '',
          ethicsApprovalDate: p.ethicsApprovalDate || '',
        });
      }),
      facultiesApi.getActive().then(r => setFaculties((r.data || []).map((f: any) => f.name))).catch(() => {}),
      api.get('/project-types').then(r => setProjectTypes(r.data || [])).catch(() => {}),
      api.get('/dynamic-fields').then(r => setDynamicFields(r.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const setDyn = (k: string, v: any) => setForm((f: any) => ({ ...f, dynamicFields: { ...f.dynamicFields, [k]: v } }));

  const toBase64 = (file: File): Promise<string> =>
    new Promise(res => { const r = new FileReader(); r.onload = e => res((e.target?.result as string).split(',')[1]); r.readAsDataURL(file); });

  const handleFileChange = async (file: File | null, setter: any, base64Setter: any) => {
    setter(file);
    if (file) { const b64 = await toBase64(file); base64Setter(b64); }
    else base64Setter(null);
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('Proje adı zorunlu'); return; }
    setSaving(true);
    try {
      const { dynamicFields: dynFields, tags: tagsStr, keywords: kwStr, ...restForm } = form;
      const payload = {
        ...restForm,
        tags: tagsStr ? tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        keywords: kwStr ? kwStr.split(',').map((k: string) => k.trim()).filter(Boolean) : [],
        sdgGoals: sdgSelected,
        dynamicFields: dynFields || {},
        budget: form.budget ? Number(form.budget) : null,
        ipType: form.ipType || null,
        ipRegistrationNo: form.ipRegistrationNo || null,
        ipDate: form.ipDate || null,
        ipNotes: form.ipNotes || null,
        ethicsCommittee: form.ethicsCommittee || null,
        ethicsApprovalNo: form.ethicsApprovalNo || null,
        ethicsApprovalDate: form.ethicsApprovalDate || null,
      };

      await projectsApi.update(id, payload);

      // FormData ile belge yukle
      if (ipFile) {
        const fd = new FormData(); fd.append('file', ipFile); fd.append('name', 'Fikri Mülkiyet Belgesi'); fd.append('type', 'ip');
        await documentsApi.upload(id, fd).catch(() => {});
        setIpFile(null); setIpBase64(null);
      }
      if (ethicsFile) {
        const fd = new FormData(); fd.append('file', ethicsFile); fd.append('name', 'Etik Kurul Onay Belgesi'); fd.append('type', 'ethics');
        await documentsApi.upload(id, fd).catch(() => {});
        setEthicsFile(null); setEthicsBase64(null);
      }

      toast.success('Proje güncellendi — değişiklikler kayıt altına alındı');
      router.push('/projects/' + id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const FileUploadField = ({ label, file, onChange, hint }: any) => (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="text-xs text-muted mb-1.5">{hint}</p>}
      <div className="flex items-center gap-2">
        <label className="flex-1 cursor-pointer">
          <div className="input flex items-center gap-2 cursor-pointer" style={{ height: 40 }}>
            <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            <span className="text-sm text-muted truncate">{file ? file.name : 'Yeni belge ekle (isteğe bağlı)'}</span>
          </div>
          <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
        </label>
        {file && <button type="button" onClick={() => onChange(null)} className="text-red-400 text-xs">✕</button>}
      </div>
      {file && <p className="text-xs text-green-600 mt-1">✓ {file.name}</p>}
    </div>
  );

  if (loading) return <DashboardLayout><div className="flex justify-center py-20"><div className="spinner" /></div></DashboardLayout>;
  if (!project) return <DashboardLayout><div className="p-8 text-muted">Proje bulunamadı</div></DashboardLayout>;

  const isAdmin = user?.role?.name === 'Süper Admin';
  const isOwner = project.ownerId === user?.id;
  if (!isAdmin && !isOwner) return <DashboardLayout><div className="p-8 text-muted">Bu projeyi düzenleme yetkiniz yok</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Header
        title="Proje Düzenle"
        subtitle={project.title}
        actions={
          <div className="flex gap-2">
            <button onClick={() => router.push('/projects/' + id)} className="btn-secondary text-sm">İptal</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
            </button>
          </div>
        }
      />

      <div className="p-6" style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Audit log uyarısı */}
        <div className="mb-4 p-3 rounded-xl text-xs flex items-center gap-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
          📋 Yapılan tüm değişiklikler otomatik olarak Geçmiş sekmesine kaydedilir.
        </div>

        {/* Sekmeler */}
        <div className="flex gap-1 p-1 rounded-xl mb-5 overflow-x-auto" style={{ background: '#f0ede8' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0"
              style={{ background: tab === t.key ? 'white' : 'transparent', color: tab === t.key ? '#0f2444' : '#9ca3af', boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="card p-6 space-y-5">
          {/* ── TEMEL ── */}
          {tab === 'basic' && <>
            <div>
              <label className="label">Proje Adı *</label>
              <input className="input text-base" value={form.title || ''} onChange={e => set('title', e.target.value)} />
            </div>
            <div>
              <label className="label">Proje Özeti</label>
              <textarea className="input" rows={4} value={form.description || ''} onChange={e => set('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Proje Türü</label>
                <select className="input" value={form.type || ''} onChange={e => set('type', e.target.value)}>
                  {projectTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Durum</label>
                <select className="input" value={form.status || ''} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </>}

          {/* ── KURUMSAL ── */}
          {tab === 'academic' && <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Fakülte</label>
                <select className="input" value={form.faculty || ''} onChange={e => set('faculty', e.target.value)}>
                  <option value="">Seçin</option>
                  {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Bölüm / Birim</label>
                <input className="input" value={form.department || ''} onChange={e => set('department', e.target.value)} />
              </div>
            </div>
            {dynamicFields.length > 0 && (
              <div className="space-y-4 pt-3 border-t" style={{ borderColor: '#e8e4dc' }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ek Alanlar</p>
                {dynamicFields.map(field => (
                  <div key={field.id}>
                    <label className="label">{field.label || field.name}</label>
                    {field.type === 'textarea'
                      ? <textarea className="input" value={form.dynamicFields?.[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)} />
                      : field.type === 'select'
                      ? <select className="input" value={form.dynamicFields?.[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)}><option value="">Seçin</option>{field.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>
                      : field.type === 'checkbox'
                      ? <label className="flex items-center gap-2 mt-1"><input type="checkbox" checked={!!form.dynamicFields?.[field.key]} onChange={e => setDyn(field.key, e.target.checked)} /><span className="text-sm">Evet</span></label>
                      : <input type={field.type === 'number' ? 'number' : 'text'} className="input" value={form.dynamicFields?.[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)} />
                    }
                  </div>
                ))}
              </div>
            )}
          </>}

          {/* ── FİNANSAL ── */}
          {tab === 'financial' && <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Bütçe (₺)</label>
                <input type="number" className="input" value={form.budget || ''} onChange={e => set('budget', e.target.value)} />
              </div>
              <div>
                <label className="label">Fon Kaynağı</label>
                <input className="input" value={form.fundingSource || ''} onChange={e => set('fundingSource', e.target.value)} />
              </div>
            </div>
            <BudgetEstimator type={form.type} faculty={form.faculty} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Başlangıç Tarihi</label>
                <input type="date" className="input" value={form.startDate || ''} onChange={e => set('startDate', e.target.value)} />
              </div>
              <div>
                <label className="label">Bitiş Tarihi</label>
                <input type="date" className="input" value={form.endDate || ''} onChange={e => set('endDate', e.target.value)} />
              </div>
            </div>
          </>}

          {/* FIX #11: Proje metni degisince uyari */}
          {tab === 'text' && <>
            <div className="p-3 rounded-xl text-xs mb-2" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92651a' }}>
              ℹ️ Proje metnini değiştirdikten sonra YZ Uygunluk Analizi ve Etik Analizi güncellenmiş olmayacaktır. Proje kaydedildikten sonra yeniden analiz yapılması önerilir.
            </div>
            <div>
              <label className="label flex justify-between">
                <span>Proje Metni</span>
                <span className="text-xs text-muted font-normal">{(form.projectText || '').length} karakter</span>
              </label>
              <textarea className="input" style={{ minHeight: 320, lineHeight: 1.7 }} value={form.projectText || ''} onChange={e => set('projectText', e.target.value)} placeholder="Projenin detaylı açıklaması..." />
            </div>
          </>}

          {/* ── SKH & ETİKET ── */}
          {tab === 'sdg' && <>
            <div>
              <label className="label">Sürdürülebilir Kalkınma Hedefleri</label>
              <SdgPicker selected={sdgSelected} onChange={setSdgSelected} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Etiketler</label>
                <input className="input" value={form.tags || ''} onChange={e => set('tags', e.target.value)} placeholder="Virgülle ayırın" />
              </div>
              <div>
                <label className="label">Anahtar Kelimeler</label>
                <input className="input" value={form.keywords || ''} onChange={e => set('keywords', e.target.value)} />
              </div>
            </div>
          </>}

          {/* ── FİKRİ MÜLKİYET ── */}
          {tab === 'ip' && <>
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
            {form.ipStatus !== 'none' && <>
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
                  <input className="input" value={form.ipRegistrationNo || ''} onChange={e => set('ipRegistrationNo', e.target.value)} placeholder="TR2024/001234" />
                </div>
                <div>
                  <label className="label">Tarih</label>
                  <input type="date" className="input" value={form.ipDate || ''} onChange={e => set('ipDate', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Notlar</label>
                <textarea className="input" rows={2} value={form.ipNotes || ''} onChange={e => set('ipNotes', e.target.value)} />
              </div>
              <FileUploadField label="Fikri Mülkiyet Belgesi Güncelle" file={ipFile} onChange={setIpFile} hint="Yeni belge eklemek istiyorsanız seçin" />
            </>}
          </>}

          {/* ── ETİK KURUL ── */}
          {tab === 'ethics' && <>
            <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 transition-all"
              style={{ borderColor: form.ethicsRequired ? '#d97706' : '#e8e4dc', background: form.ethicsRequired ? '#fffbeb' : 'white' }}>
              <input type="checkbox" className="w-5 h-5 accent-amber-500" checked={form.ethicsRequired || false} onChange={e => set('ethicsRequired', e.target.checked)} />
              <div>
                <p className="text-sm font-semibold text-navy">Etik kurul onayı gerektiriyor</p>
                <p className="text-xs text-muted">İnsan/hayvan deneği, kişisel veri veya hassas grup araştırması</p>
              </div>
            </label>
            {form.ethicsRequired && (
              <div className="space-y-4 p-4 rounded-xl" style={{ border: '1px solid #fde68a', background: '#fffbeb' }}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-green-500" checked={form.ethicsApproved || false} onChange={e => set('ethicsApproved', e.target.checked)} />
                  <p className="text-sm font-semibold text-navy">Onay alındı ✓</p>
                </label>
                {form.ethicsApproved && <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Kurul Adı</label>
                      <input className="input" value={form.ethicsCommittee || ''} onChange={e => set('ethicsCommittee', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Onay No</label>
                      <input className="input" value={form.ethicsApprovalNo || ''} onChange={e => set('ethicsApprovalNo', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Onay Tarihi</label>
                    <input type="date" className="input" value={form.ethicsApprovalDate || ''} onChange={e => set('ethicsApprovalDate', e.target.value)} />
                  </div>
                  <FileUploadField label="Etik Kurul Belgesi Güncelle" file={ethicsFile} onChange={setEthicsFile} hint="Yeni belge eklemek istiyorsanız seçin" />
                </>}
              </div>
            )}
          </>}
        </div>

        {/* Kaydet butonu - alt */}
        <div className="flex justify-end mt-4 gap-3">
          <button onClick={() => router.push('/projects/' + id)} className="btn-secondary">İptal</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Kaydediliyor...' : '💾 Değişiklikleri Kaydet'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
