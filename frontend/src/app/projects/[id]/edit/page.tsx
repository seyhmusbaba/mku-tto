'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api, projectsApi, documentsApi, facultiesApi } from '@/lib/api';
import { BudgetEstimator } from '@/components/BudgetEstimator';
import { SdgPicker } from '@/components/SdgPicker';
import { SavedIntelligenceReport } from '@/components/SavedIntelligenceReport';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

/* ─── Icon helper ───────────────────────────────────────── */
type EPIconName = 'clipboard' | 'building' | 'dollar' | 'document' | 'target' | 'scale' | 'beaker' | 'save' | 'x' | 'check' | 'info' | 'paperclip' | 'alert';
const EP_ICONS: Record<EPIconName, string> = {
  clipboard:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  building:   'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  dollar:     'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  document:   'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  target:     'M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z',
  scale:      'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
  beaker:     'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  save:       'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  x:          'M6 18L18 6M6 6l12 12',
  check:      'M5 13l4 4L19 7',
  info:       'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  paperclip:  'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13',
  alert:      'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
};
function EPIcon({ name, className = 'w-4 h-4', strokeWidth = 1.8 }: { name: EPIconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={EP_ICONS[name]} />
    </svg>
  );
}

const IP_STATUS_OPTIONS = [
  { value: 'none', label: 'Yok', color: '#6b7280' },
  { value: 'pending', label: 'Başvuru Aşamasında', color: '#d97706' },
  { value: 'registered', label: 'Tescilli', color: '#059669' },
  { value: 'published', label: 'Yayımlandı', color: '#2563eb' },
];

const IP_TYPES = [
  { value: 'patent', label: 'Patent' },
  { value: 'faydali_model', label: 'Faydalı Model' },
  { value: 'marka', label: 'Marka' },
  { value: 'tasarim', label: 'Tasarım' },
  { value: 'telif', label: 'Telif Hakkı' },
  { value: 'ticari_sir', label: 'Ticari Sır' },
];

const STATUSES = [
  { value: 'application', label: 'Başvuru Sürecinde', color: '#d97706' },
  { value: 'pending', label: 'Beklemede', color: '#6b7280' },
  { value: 'active', label: 'Aktif', color: '#059669' },
  { value: 'completed', label: 'Tamamlandı', color: '#2563eb' },
  { value: 'suspended', label: 'Askıya Alındı', color: '#6b7280' },
  { value: 'cancelled', label: 'İptal Edildi', color: '#dc2626' },
];

const TABS: Array<{ key: string; label: string; icon: EPIconName }> = [
  { key: 'basic',     label: 'Temel',          icon: 'clipboard' },
  { key: 'academic',  label: 'Kurumsal',       icon: 'building' },
  { key: 'financial', label: 'Finansal',       icon: 'dollar' },
  { key: 'text',      label: 'Proje Metni',    icon: 'document' },
  { key: 'sdg',       label: 'SKH & Etiket',   icon: 'target' },
  { key: 'ip',        label: 'Fikri Mülkiyet', icon: 'scale' },
  { key: 'ethics',    label: 'Etik Kurul',     icon: 'beaker' },
];

function isEthicsAuthority(roleName?: string): boolean {
  const r = (roleName || '').toLowerCase();
  return r === 'süper admin' || r.includes('etik') || r.includes('rekt') || r.includes('dekan');
}

/**
 * EPO OPS üzerinden patent doğrulama butonu.
 * Patent başvuru/tescil no'su girildikten sonra tıklanır - kurumun adıyla
 * eşleşme arar. EPO_CONSUMER_KEY yoksa API 503 döner, burada kullanıcıya
 * "yapılandırılmadı" mesajı gösteririz.
 */
function PatentVerifyButton({ number }: { number?: string }) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);

  const applicantDefault = 'Mustafa Kemal';  // kurum adı substring - eşleşmek için yeterli

  const verify = async () => {
    if (!number) { toast.error('Önce başvuru/tescil numarası girin'); return; }
    setVerifying(true);
    setResult(null);
    try {
      const res = await api.get('/integrations/patent/verify', {
        params: { number, applicant: applicantDefault },
      });
      setResult(res.data);
    } catch (e: any) {
      if (e?.response?.status === 503) {
        setResult({ notConfigured: true });
      } else {
        setResult({ error: e?.response?.data?.message || 'Doğrulama başarısız' });
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <button type="button" onClick={verify} disabled={!number || verifying}
        className="btn-secondary text-xs px-3 whitespace-nowrap inline-flex items-center gap-1.5 disabled:opacity-40"
        title="EPO OPS ile kurumsal aitliği doğrula">
        {verifying ? <span className="spinner w-3 h-3" /> : <EPIcon name="check" className="w-3.5 h-3.5" />}
        EPO Doğrula
      </button>
      {result && (
        <div className="col-span-2 mt-2 p-3 rounded-xl text-xs"
          style={{
            background: result.verified ? '#f0fdf4' : result.notConfigured ? '#fffbeb' : '#fef2f2',
            border: '1px solid ' + (result.verified ? '#86efac' : result.notConfigured ? '#fde68a' : '#fca5a5'),
            color: result.verified ? '#166534' : result.notConfigured ? '#92400e' : '#991b1b',
          }}>
          {result.notConfigured && (
            <p><strong>EPO servisi yapılandırılmamış:</strong> EPO_CONSUMER_KEY + SECRET env'leri backend'e eklenmelidir. developers.epo.org adresinden ücretsiz alınabilir.</p>
          )}
          {result.error && <p><strong>Hata:</strong> {result.error}</p>}
          {result.verified && result.record && (
            <>
              <p className="font-semibold">✓ Doğrulandı - kayıt EPO OPS'ta bulundu ve kurum adıyla eşleşti</p>
              <p className="mt-1 text-xs opacity-80">Başlık: {result.record.title}</p>
              <p className="text-xs opacity-80">Başvuru sahipleri: {result.record.applicants.join(' · ')}</p>
            </>
          )}
          {result.verified === false && !result.notConfigured && !result.error && (
            <>
              <p className="font-semibold">⚠ Uyarı: Doğrulanamadı</p>
              <p className="mt-1 text-xs">{result.reason}</p>
              {result.record && (
                <p className="mt-1 opacity-80">Kayıt bulundu ama başvuru sahibi uyuşmuyor: {result.record.applicants.join(', ')}</p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

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
        // sdgGoals getter JSON'da gelmeyebilir - sdgGoalsJson'dan da parse et
        const sdg = p.sdgGoals && Array.isArray(p.sdgGoals) && p.sdgGoals.length > 0
          ? p.sdgGoals
          : (() => { try { return p.sdgGoalsJson ? JSON.parse(p.sdgGoalsJson) : []; } catch { return []; } })();
        setSdgSelected(sdg);
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
    if (form.budget) {
      const b = Number(form.budget);
      if (!Number.isFinite(b) || b < 0) { toast.error('Bütçe negatif olamaz'); return; }
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      toast.error('Bitiş tarihi başlangıçtan önce olamaz'); return;
    }
    setSaving(true);
    try {
      const canSetEthics = isEthicsAuthority(user?.role?.name);
      const {
        dynamicFields: dynFields, tags: tagsStr, keywords: kwStr,
        ethicsRequired, ethicsApproved, ethicsCommittee, ethicsApprovalNo, ethicsApprovalDate,
        ...restForm
      } = form;
      const payload: any = {
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
      };
      // Etik alanları sadece yetkili rollerde payload'a eklenir.
      // Backend zaten bu alanları filtreliyor; frontend tarafında da göndermeyerek
      // yanlış etkileşimi kesin olarak önlüyoruz.
      if (canSetEthics) {
        payload.ethicsRequired = ethicsRequired;
        payload.ethicsApproved = ethicsApproved;
        payload.ethicsCommittee = ethicsCommittee || null;
        payload.ethicsApprovalNo = ethicsApprovalNo || null;
        payload.ethicsApprovalDate = ethicsApprovalDate || null;
      }

      await projectsApi.update(id, payload);

      // FormData ile belge yukle - başarısızlığı kullanıcıya bildir
      if (ipFile) {
        const fd = new FormData(); fd.append('file', ipFile); fd.append('name', 'Fikri Mülkiyet Belgesi'); fd.append('type', 'ip');
        try { await documentsApi.upload(id, fd); }
        catch { toast.error('IP belgesi yüklenemedi - Belgeler sekmesinden elle yükleyin.'); }
        setIpFile(null); setIpBase64(null);
      }
      if (ethicsFile) {
        const fd = new FormData(); fd.append('file', ethicsFile); fd.append('name', 'Etik Kurul Onay Belgesi'); fd.append('type', 'ethics');
        try { await documentsApi.upload(id, fd); }
        catch { toast.error('Etik belgesi yüklenemedi - Belgeler sekmesinden elle yükleyin.'); }
        setEthicsFile(null); setEthicsBase64(null);
      }

      toast.success('Proje güncellendi - değişiklikler kayıt altına alındı');
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
            <EPIcon name="paperclip" className="w-4 h-4 text-muted flex-shrink-0" strokeWidth={2} />
            <span className="text-sm text-muted truncate">{file ? file.name : 'Yeni belge ekle (isteğe bağlı)'}</span>
          </div>
          <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
        </label>
        {file && (
          <button type="button" onClick={() => onChange(null)} aria-label="Dosyayı kaldır" className="text-red-400 hover:text-red-600 p-1">
            <EPIcon name="x" className="w-3.5 h-3.5" strokeWidth={2.2} />
          </button>
        )}
      </div>
      {file && (
        <p className="text-xs text-green-600 mt-1 inline-flex items-center gap-1">
          <EPIcon name="check" className="w-3 h-3" strokeWidth={2.4} />
          {file.name}
        </p>
      )}
    </div>
  );

  if (loading) return <DashboardLayout><div className="flex justify-center py-20"><div className="spinner" /></div></DashboardLayout>;
  if (!project) return <DashboardLayout><div className="p-8 text-muted">Proje bulunamadı</div></DashboardLayout>;

  const isAdmin = user?.role?.name === 'Süper Admin';
  const isOwner = project.ownerId === user?.id;
  const canSetEthics = isEthicsAuthority(user?.role?.name);
  const visibleTabs = canSetEthics ? TABS : TABS.filter(t => t.key !== 'ethics');
  const activeTab = !canSetEthics && tab === 'ethics' ? 'basic' : tab;
  if (!isAdmin && !isOwner) return <DashboardLayout><div className="p-8 text-muted">Bu projeyi düzenleme yetkiniz yok</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Header
        title="Proje Düzenle"
        subtitle={project.title}
        actions={
          <div className="flex gap-2">
            <button onClick={() => router.push('/projects/' + id)} className="btn-secondary text-sm">İptal</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm inline-flex items-center gap-1.5">
              {saving ? <><span className="spinner w-4 h-4" />Kaydediliyor...</> : <><EPIcon name="save" className="w-4 h-4" />Kaydet</>}
            </button>
          </div>
        }
      />

      <div className="p-6" style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Audit log uyarısı */}
        <div className="mb-4 p-3 rounded-xl text-xs flex items-center gap-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
          <EPIcon name="info" className="w-4 h-4 flex-shrink-0" />
          <span>Yapılan tüm değişiklikler otomatik olarak Geçmiş sekmesine kaydedilir.</span>
        </div>

        {/* Sekmeler */}
        <div className="flex gap-1 p-1 rounded-xl mb-5 overflow-x-auto" style={{ background: '#f0ede8' }}>
          {visibleTabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5"
              style={{ background: tab === t.key ? 'white' : 'transparent', color: tab === t.key ? '#0f2444' : '#9ca3af', boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              <EPIcon name={t.icon} className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="card p-6 space-y-5">
          {/* ── TEMEL ── */}
          {activeTab === 'basic' && <>
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
          {activeTab === 'academic' && <>
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
          {activeTab === 'financial' && <>
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
          {activeTab === 'text' && <>
            <div className="p-3 rounded-xl text-xs mb-2 flex items-start gap-2" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92651a' }}>
              <EPIcon name="alert" className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Proje metnini değiştirdikten sonra YZ Uygunluk Analizi ve Etik Analizi güncellenmiş olmayacaktır. Proje kaydedildikten sonra yeniden analiz yapılması önerilir.</span>
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
          {activeTab === 'sdg' && <>
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
          {activeTab === 'ip' && <>
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
                  <div className="flex gap-2">
                    <input className="input flex-1" value={form.ipRegistrationNo || ''} onChange={e => set('ipRegistrationNo', e.target.value)} placeholder="TR2024012345 veya EP3456789" />
                    <PatentVerifyButton number={form.ipRegistrationNo} />
                  </div>
                  <p className="text-xs text-muted mt-1">EPO OPS üzerinden patentin kuruma aitliğini doğrulayabilirsiniz</p>
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
          {activeTab === 'ethics' && <>
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
                  <p className="text-sm font-semibold text-navy inline-flex items-center gap-1.5">
                    Onay alındı
                    {form.ethicsApproved && <EPIcon name="check" className="w-3.5 h-3.5 text-green-600" strokeWidth={2.4} />}
                  </p>
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
          <button onClick={handleSave} disabled={saving} className="btn-primary inline-flex items-center gap-1.5">
            {saving ? <><span className="spinner w-4 h-4" />Kaydediliyor...</> : <><EPIcon name="save" className="w-4 h-4" />Değişiklikleri Kaydet</>}
          </button>
        </div>
      </div>

      {/* Proje Zekasi Raporu - olusturma aninda kaydedilen sonuc */}
      <div className="px-6 pb-10 pt-4 border-t" style={{ borderColor: '#e8e4dc', background: '#faf8f4' }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0f2444', color: 'white' }}>
              <EPIcon name="beaker" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-navy">Proje Zekası Raporu</h3>
              <p className="text-xs text-muted">Proje oluşturulurken kaydedilen rapor (yeniden hesaplama yapılmaz)</p>
            </div>
          </div>
          <SavedIntelligenceReport
            report={project?.intelligenceReport}
            reportAt={project?.intelligenceReportAt}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
