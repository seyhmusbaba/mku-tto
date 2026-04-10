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
  { value: 'application', label: 'Başvuru Sürecinde', desc: 'Proje başvurusu devam ediyor', color: '#d97706' },
  { value: 'active',      label: 'Aktif',             desc: 'Kabul belgesi zorunlu',       color: '#059669' },
  { value: 'completed',   label: 'Tamamlandı',        desc: 'Proje sonuçlanmış',           color: '#2563eb' },
];

const IP_STATUS_OPTIONS = [
  { value: 'none',       label: 'Fikri Mülkiyet Yok',      desc: 'Bu projede fikri mülkiyet söz konusu değil', color: '#6b7280' },
  { value: 'pending',    label: 'Başvuru Aşamasında',       desc: 'Tescil başvurusu yapıldı, sonuç bekleniyor', color: '#d97706' },
  { value: 'registered', label: 'Tescilli',                  desc: 'Fikri mülkiyet tescil edildi',               color: '#059669' },
  { value: 'published',  label: 'Yayımlandı',                desc: 'Patent/Faydalı model yayımlandı',            color: '#2563eb' },
];

const IP_TYPES = [
  { value: 'patent',         label: '🔬 Patent',               desc: 'Buluş/icat tescili' },
  { value: 'faydali_model',  label: '⚙️ Faydalı Model',        desc: 'Küçük çaplı buluşlar' },
  { value: 'marka',          label: '™️ Marka',                 desc: 'Ticari marka tescili' },
  { value: 'tasarim',        label: '🎨 Tasarım Tescili',       desc: 'Endüstriyel tasarım' },
  { value: 'telif',          label: '©️ Telif Hakkı',           desc: 'Yazılım, eser, içerik' },
  { value: 'ticari_sir',     label: '🔒 Ticari Sır',            desc: 'Gizli formül/yöntem' },
];

const STEP_LABELS = ['Temel Bilgiler', 'Kurumsal', 'Finansal', 'Proje Metni', 'SKH & Etiket', 'Fikri Mülkiyet', 'Etik Kurul', 'Onay'];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [faculties, setFaculties] = useState<string[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [dynamicFields, setDynamicFields] = useState<any[]>([]);
  const [sdgSelected, setSdgSelected] = useState<string[]>([]);
  const [acceptanceFile, setAcceptanceFile] = useState<File | null>(null);
  const [acceptanceBase64, setAcceptanceBase64] = useState<string | null>(null);
  const [complianceResult, setComplianceResult] = useState<any>(null);

  const [form, setForm] = useState({
    // Temel
    title: '', description: '', type: 'tubitak', status: 'application',
    // Kurumsal
    faculty: '', department: '', dynamicFields: {} as Record<string, any>,
    // Finansal
    budget: '', fundingSource: '', startDate: '', endDate: '',
    // Proje Metni
    projectText: '',
    // SKH
    tags: '', keywords: '',
    // Fikri Mülkiyet
    ipStatus: 'none', ipType: '', ipRegistrationNo: '', ipDate: '', ipNotes: '',
    // Etik
    ethicsRequired: false, ethicsApproved: false, ethicsCommittee: '', ethicsApprovalNo: '', ethicsApprovalDate: '',
  });

  useEffect(() => {
    facultiesApi.getActive().then(r => setFaculties((r.data || []).map((f: any) => f.name))).catch(() => {});
    api.get('/project-types').then(r => setProjectTypes(r.data || [])).catch(() => {});
    api.get('/dynamic-fields').then(r => setDynamicFields(r.data || [])).catch(() => {});
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setDyn = (k: string, v: any) => setForm(f => ({ ...f, dynamicFields: { ...f.dynamicFields, [k]: v } }));

  const needsAcceptance = form.status === 'active';
  const isLastStep = step === STEP_LABELS.length - 1;

  const handleSubmit = async () => {
    if (!form.title) { toast.error('Proje adı zorunlu'); return; }
    setLoading(true);
    try {
      const payload = {
        title: form.title, description: form.description, type: form.type,
        status: form.status, faculty: form.faculty, department: form.department,
        budget: form.budget ? Number(form.budget) : null,
        fundingSource: form.fundingSource, startDate: form.startDate, endDate: form.endDate,
        projectText: form.projectText,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        keywords: form.keywords ? form.keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
        sdgGoals: sdgSelected,
        dynamicFields: form.dynamicFields,
        // Fikri Mülkiyet
        ipStatus: form.ipStatus, ipType: form.ipType || null,
        ipRegistrationNo: form.ipRegistrationNo || null,
        ipDate: form.ipDate || null, ipNotes: form.ipNotes || null,
        // Etik
        ethicsRequired: form.ethicsRequired, ethicsApproved: form.ethicsApproved,
        ethicsCommittee: form.ethicsCommittee || null,
        ethicsApprovalNo: form.ethicsApprovalNo || null,
        ethicsApprovalDate: form.ethicsApprovalDate || null,
        // YZ Skoru
        aiComplianceScore: complianceResult?.score || null,
        aiComplianceResult: complianceResult ? JSON.stringify(complianceResult) : null,
      };

      const res = await projectsApi.create(payload);
      const projectId = res.data.id;

      if (acceptanceFile && acceptanceBase64) {
        try {
          await documentsApi.upload(projectId, {
            name: 'Başvuru Kabul Belgesi',
            fileName: acceptanceFile.name,
            fileData: acceptanceBase64,
            type: 'acceptance',
            size: acceptanceFile.size,
          });
        } catch { }
      }

      toast.success('Proje oluşturuldu!');
      router.push('/projects/' + projectId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    // ── ADIM 0: TEMEL ──────────────────────────────────────────
    <div key={0} className="space-y-5">
      <div>
        <label className="label">Proje Adı *</label>
        <input className="input text-base" value={form.title} onChange={e => set('title', e.target.value)}
          placeholder="Projenin tam adını girin" autoFocus />
      </div>
      <SimilarProjectsAlert title={form.title} description={form.description} type={form.type} />
      <div>
        <label className="label">Proje Özeti</label>
        <textarea className="input" style={{ minHeight: 100 }} value={form.description}
          onChange={e => set('description', e.target.value)} placeholder="Projeyi kısaca tanımlayın..." />
        <div className="mt-3">
          <AiSummaryPanel title={form.title} description={form.description}
            type={form.type} faculty={form.faculty} mode="create"
            onApply={(text) => set('description', text)} />
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
              style={{ borderColor: form.status === s.value ? s.color : '#e8e4dc', background: form.status === s.value ? s.color + '12' : '#faf8f4' }}>
              <div className="w-3 h-3 rounded-full mb-2" style={{ background: s.color }} />
              <p className="text-sm font-bold" style={{ color: form.status === s.value ? s.color : '#374151' }}>{s.label}</p>
              <p className="text-xs mt-1 text-muted">{s.desc}</p>
            </button>
          ))}
        </div>
        {needsAcceptance && (
          <div className="mt-3 p-3 rounded-xl text-sm flex items-center gap-2" style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92651a' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Son adımda başvuru kabul belgesi yüklemeniz gerekecek.
          </div>
        )}
      </div>
    </div>,

    // ── ADIM 1: KURUMSAL ───────────────────────────────────────
    <div key={1} className="space-y-5">
      <div>
        <label className="label">Fakülte</label>
        <select className="input" value={form.faculty} onChange={e => set('faculty', e.target.value)}>
          <option value="">Fakülte seçin</option>
          {faculties.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Bölüm / Birim</label>
        <input className="input" value={form.department} onChange={e => set('department', e.target.value)}
          placeholder="Örn: Bilgisayar Mühendisliği" />
      </div>
      {dynamicFields.length > 0 && (
        <>
          <div className="divider" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ek Alanlar</p>
          {dynamicFields.map(field => (
            <div key={field.id}>
              <label className="label">{field.label || field.name}{field.required ? ' *' : ''}</label>
              {field.type === 'textarea'
                ? <textarea className="input" required={!!field.required} value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)} />
                : field.type === 'select'
                ? <select className="input" value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)}>
                    <option value="">Seçin</option>
                    {field.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                  </select>
                : field.type === 'checkbox'
                ? <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={!!form.dynamicFields[field.key]} onChange={e => setDyn(field.key, e.target.checked)} />
                    <span className="text-sm">Evet</span>
                  </div>
                : <input type={field.type === 'number' ? 'number' : 'text'} className="input" required={!!field.required} value={form.dynamicFields[field.key] || ''} onChange={e => setDyn(field.key, e.target.value)} />
              }
            </div>
          ))}
        </>
      )}
    </div>,

    // ── ADIM 2: FİNANSAL ──────────────────────────────────────
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

    // ── ADIM 3: PROJE METNİ ───────────────────────────────────
    <div key={3} className="space-y-5">
      {/* Uyarı banner */}
      <div className="p-4 rounded-xl" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <p className="text-sm font-semibold text-blue-800 mb-1">📄 Proje Metni Nedir?</p>
        <p className="text-xs text-blue-700">
          Proje özetinden farklı olarak, projenin detaylı içeriğini, yöntemini, hedeflerini ve beklenen çıktılarını açıklayan kapsamlı metindir.
          TÜBİTAK ve diğer fon kuruluşlarına sunulan proje formlarındaki detaylı açıklama kısmına karşılık gelir.
        </p>
      </div>

      <div>
        <label className="label flex items-center justify-between">
          <span>Proje Metni</span>
          <span className="text-xs text-muted font-normal">{form.projectText.length} karakter</span>
        </label>
        <textarea
          className="input"
          style={{ minHeight: 240, fontFamily: 'inherit', lineHeight: 1.7 }}
          value={form.projectText}
          onChange={e => set('projectText', e.target.value)}
          placeholder={`Projenizin detaylı açıklamasını buraya yazın...

Önerilen başlıklar:
• Projenin amacı ve önemi
• Araştırma sorusu / hipotezi
• Yöntem ve yaklaşım
• Beklenen çıktılar ve katkılar
• Proje ekibi ve görev dağılımı
• Zaman çizelgesi`}
        />
      </div>

      {/* YZ Uygunluk Kontrolü */}
      <div className="p-4 rounded-xl" style={{ border: '1px solid #e8e4dc', background: '#faf8f4' }}>
        <ProjectComplianceCheck
          title={form.title}
          description={form.description}
          projectText={form.projectText}
          type={form.type}
          ethicsRequired={form.ethicsRequired}
          onResult={setComplianceResult}
        />
      </div>
    </div>,

    // ── ADIM 4: SKH & ETİKETLER ──────────────────────────────
    <div key={4} className="space-y-5">
      <div>
        <label className="label">Sürdürülebilir Kalkınma Hedefleri</label>
        <p className="text-xs text-muted mb-3">Bu projenin katkı sağladığı SKH hedeflerini işaretleyin.</p>
        <SdgPicker selected={sdgSelected} onChange={setSdgSelected} />
      </div>
      <div>
        <label className="label">Diğer Etiketler</label>
        <input className="input" value={form.tags} onChange={e => set('tags', e.target.value)}
          placeholder="yapay zeka, makine öğrenmesi..." />
        <p className="text-xs text-muted mt-1.5">Virgülle ayırın</p>
      </div>
      <div>
        <label className="label">Anahtar Kelimeler</label>
        <input className="input" value={form.keywords} onChange={e => set('keywords', e.target.value)}
          placeholder="keyword1, keyword2..." />
      </div>
    </div>,

    // ── ADIM 5: FİKRİ MÜLKİYET ──────────────────────────────
    <div key={5} className="space-y-5">
      <div className="p-4 rounded-xl" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
        <p className="text-sm font-semibold text-purple-800 mb-1">⚖️ Fikri Mülkiyet (TeDiKon)</p>
        <p className="text-xs text-purple-700">
          Projenizin fikri mülkiyet durumunu belirtin. Patent, faydalı model, marka tescili gibi korumaları buraya kaydedin.
          Tescil numaranız varsa aşağıya girin — proje detay sayfasında görüntülenecek.
        </p>
      </div>

      <div>
        <label className="label">Fikri Mülkiyet Durumu</label>
        <div className="grid grid-cols-2 gap-3 mt-1">
          {IP_STATUS_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => set('ipStatus', opt.value)}
              className="p-3 rounded-xl border-2 text-left transition-all"
              style={{ borderColor: form.ipStatus === opt.value ? opt.color : '#e8e4dc', background: form.ipStatus === opt.value ? opt.color + '10' : 'white' }}>
              <div className="w-2.5 h-2.5 rounded-full mb-1.5" style={{ background: opt.color }} />
              <p className="text-sm font-semibold" style={{ color: form.ipStatus === opt.value ? opt.color : '#374151' }}>{opt.label}</p>
              <p className="text-xs text-muted mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {form.ipStatus !== 'none' && (
        <>
          <div>
            <label className="label">Fikri Mülkiyet Türü</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {IP_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => set('ipType', t.value)}
                  className="p-2.5 rounded-xl border text-left transition-all"
                  style={{ borderColor: form.ipType === t.value ? '#7c3aed' : '#e8e4dc', background: form.ipType === t.value ? '#f5f3ff' : 'white' }}>
                  <p className="text-xs font-semibold" style={{ color: form.ipType === t.value ? '#7c3aed' : '#374151' }}>{t.label}</p>
                  <p className="text-[11px] text-muted">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tescil / Başvuru Numarası</label>
              <input className="input" value={form.ipRegistrationNo}
                onChange={e => set('ipRegistrationNo', e.target.value)}
                placeholder="Örn: TR2024/001234" />
            </div>
            <div>
              <label className="label">Tescil / Başvuru Tarihi</label>
              <input type="date" className="input" value={form.ipDate}
                onChange={e => set('ipDate', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Notlar</label>
            <textarea className="input" rows={3} value={form.ipNotes}
              onChange={e => set('ipNotes', e.target.value)}
              placeholder="Fikri mülkiyet ile ilgili ek notlar..." />
          </div>
        </>
      )}
    </div>,

    // ── ADIM 6: ETİK KURUL ────────────────────────────────────
    <div key={6} className="space-y-5">
      <div className="p-4 rounded-xl" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
        <p className="text-sm font-semibold text-amber-800 mb-1">🔬 Etik Kurul Bilgileri</p>
        <p className="text-xs text-amber-700">
          İnsan veya hayvan deneyi içeren, kişisel veri kullanan ya da hassas gruplarla yapılan araştırmalar için etik kurul onayı gereklidir.
          YZ uygunluk kontrolü bu alanı otomatik olarak işaretleyebilir.
        </p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl transition-all"
        style={{ border: '2px solid ' + (form.ethicsRequired ? '#d97706' : '#e8e4dc'), background: form.ethicsRequired ? '#fffbeb' : 'white' }}>
        <input type="checkbox" className="w-5 h-5 accent-amber-500" checked={form.ethicsRequired}
          onChange={e => set('ethicsRequired', e.target.checked)} />
        <div>
          <p className="text-sm font-semibold text-navy">Bu proje etik kurul onayı gerektiriyor</p>
          <p className="text-xs text-muted mt-0.5">İnsan deneği, hayvan deneyi, kişisel veri veya hassas grup araştırması</p>
        </div>
      </label>

      {form.ethicsRequired && (
        <div className="space-y-4 p-4 rounded-xl" style={{ border: '1px solid #fde68a', background: '#fffbeb' }}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-green-500" checked={form.ethicsApproved}
              onChange={e => set('ethicsApproved', e.target.checked)} />
            <div>
              <p className="text-sm font-semibold text-navy">Etik kurul onayı alındı ✓</p>
              <p className="text-xs text-muted">Onay belgesi Belgeler sekmesine yüklenebilir</p>
            </div>
          </label>

          {form.ethicsApproved && (
            <>
              <div>
                <label className="label">Etik Kurul Adı</label>
                <input className="input" value={form.ethicsCommittee}
                  onChange={e => set('ethicsCommittee', e.target.value)}
                  placeholder="Örn: MKÜ Etik Kurulu, Sağlık Bakanlığı..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Onay Numarası</label>
                  <input className="input" value={form.ethicsApprovalNo}
                    onChange={e => set('ethicsApprovalNo', e.target.value)}
                    placeholder="Örn: 2024/ETK-001" />
                </div>
                <div>
                  <label className="label">Onay Tarihi</label>
                  <input type="date" className="input" value={form.ethicsApprovalDate}
                    onChange={e => set('ethicsApprovalDate', e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* YZ uyarılarından gelen etik bayraklar */}
      {complianceResult?.ethicsFlags?.length > 0 && !form.ethicsRequired && (
        <div className="p-4 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
          <p className="text-sm font-bold text-red-700 mb-2">🤖 YZ Analizi Uyarısı</p>
          {complianceResult.ethicsFlags.map((flag: string, i: number) => (
            <p key={i} className="text-xs text-red-600 mb-1">• {flag}</p>
          ))}
          <button type="button" onClick={() => set('ethicsRequired', true)}
            className="mt-2 text-xs font-semibold text-red-700 underline">
            Etik kurul gerektiriyor olarak işaretle →
          </button>
        </div>
      )}
    </div>,

    // ── ADIM 7: ONAY ─────────────────────────────────────────
    <div key={7} className="space-y-5">
      {/* Özet */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
        <p className="text-xs font-bold uppercase tracking-wider text-navy">Proje Özeti</p>
        <div className="space-y-2 text-sm">
          {[
            ['Proje Adı', form.title || '—'],
            ['Tür', projectTypes.find(t => t.key === form.type)?.label || form.type],
            ['Durum', STATUSES.find(s => s.value === form.status)?.label || '—'],
            form.faculty ? ['Fakülte', form.faculty] : null,
            form.budget ? ['Bütçe', Number(form.budget).toLocaleString('tr-TR') + ' ₺'] : null,
            sdgSelected.length > 0 ? ['SKH Hedefleri', sdgSelected.length + ' hedef seçili'] : null,
            form.ipStatus !== 'none' ? ['Fikri Mülkiyet', IP_STATUS_OPTIONS.find(o => o.value === form.ipStatus)?.label || '—'] : null,
            form.ethicsRequired ? ['Etik Kurul', form.ethicsApproved ? '✅ Onaylandı' : '⏳ Onay Bekleniyor'] : null,
            complianceResult ? ['YZ Uygunluk Skoru', complianceResult.score + '/100 — ' + (complianceResult.level === 'excellent' ? '✅ Mükemmel' : complianceResult.level === 'good' ? '👍 İyi' : complianceResult.level === 'warning' ? '⚠️ Dikkat' : '🚨 Kritik')] : null,
          ].filter(Boolean).map(([k, v]: any, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-muted">{k}</span>
              <span className="font-medium text-navy text-right ml-4 max-w-xs truncate">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Kabul belgesi */}
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
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          className="text-sm w-full"
          onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            setAcceptanceFile(file);
            const reader = new FileReader();
            reader.onload = ev => setAcceptanceBase64((ev.target?.result as string).split(',')[1]);
            reader.readAsDataURL(file);
          }}
        />
        {acceptanceFile && (
          <p className="text-xs text-green-600 mt-2 font-semibold">✓ {acceptanceFile.name} seçildi</p>
        )}
      </div>
    </div>,
  ];

  return (
    <DashboardLayout>
      <Header title="Yeni Proje Oluştur" subtitle={STEP_LABELS[step]} />
      <div className="p-6 max-w-2xl mx-auto">
        {/* Adım Göstergesi */}
        <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-2">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center flex-shrink-0">
              <button type="button" onClick={() => i < step && setStep(i)}
                className="flex flex-col items-center group" style={{ minWidth: 60 }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: i === step ? '#1a3a6b' : i < step ? '#059669' : '#f0ede8',
                    color: i <= step ? 'white' : '#9ca3af',
                  }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="text-[9px] mt-1 text-center leading-tight"
                  style={{ color: i === step ? '#1a3a6b' : i < step ? '#059669' : '#9ca3af', maxWidth: 52 }}>
                  {label}
                </span>
              </button>
              {i < STEP_LABELS.length - 1 && (
                <div className="h-0.5 flex-1 mx-1" style={{ background: i < step ? '#059669' : '#e8e4dc', minWidth: 8 }} />
              )}
            </div>
          ))}
        </div>

        {/* Adım İçeriği */}
        <div className="card p-6 mb-5">{steps[step]}</div>

        {/* Navigasyon */}
        <div className="flex gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary flex-1">← Geri</button>
          )}
          {!isLastStep ? (
            <button type="button" onClick={() => setStep(step + 1)} className="btn-primary flex-1">
              Devam → <span className="text-xs opacity-70 ml-1">{STEP_LABELS[step + 1]}</span>
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">
              {loading ? 'Oluşturuluyor...' : '✓ Projeyi Oluştur'}
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
