'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { loadSettings } from '@/lib/settings-store';
import { settingsApi, dynamicFieldsApi, projectTypesApi, facultiesApi, reportTypesApi } from '@/lib/api';
import { DynamicField, ProjectTypeItem, FacultyItem } from '@/types';
import { useAuth } from '@/lib/auth-context';

interface ReportTypeItem { id:string; key:string; label:string; color:string; description:string; showProgress:number; isSystem:number; isActive:number; }
import toast from 'react-hot-toast';

/* ─── Icon helper ───────────────────────────────────── */
type SIconName = 'save' | 'plus' | 'x' | 'edit' | 'trash' | 'cog' | 'palette' | 'tag' | 'building' | 'chart' | 'grid' | 'info' | 'alert-circle' | 'refresh' | 'image' | 'upload';
const S_I: Record<SIconName, string> = {
  save:    'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  plus:    'M12 4v16m8-8H4',
  x:       'M6 18L18 6M6 6l12 12',
  edit:    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:   'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  cog:     'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  palette: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
  tag:     'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  building:'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  chart:   'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  grid:    'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  info:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'alert-circle':'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  image:   'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  upload:  'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
};
function SIcon({ name, className = 'w-4 h-4', strokeWidth = 1.8 }: { name: SIconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={S_I[name]} />
    </svg>
  );
}

const FIELD_TYPES = [['text','Metin'],['number','Sayı'],['date','Tarih'],['select','Seçim Listesi'],['textarea','Uzun Metin'],['checkbox','Onay Kutusu']];
type Tab = 'general' | 'appearance' | 'types' | 'faculties' | 'reporttypes' | 'fields' | 'maintenance';
const TAB_ICONS: Record<Tab, SIconName> = {
  general: 'cog', appearance: 'palette', types: 'tag', faculties: 'building', reporttypes: 'chart', fields: 'grid', maintenance: 'cog',
};

export default function SettingsPage() {
  const { user: me } = useAuth();
  const router = useRouter();
  const isAdmin = me?.role?.name === 'Süper Admin';
  useEffect(() => { if (me && !isAdmin) router.replace('/dashboard'); }, [me, isAdmin, router]);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string,any>>({});
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeItem[]>([]);
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('general');
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editField, setEditField] = useState<DynamicField|null>(null);
  const [fieldForm, setFieldForm] = useState({name:'',key:'',label:'',type:'text',options:'',required:false});
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editType, setEditType] = useState<ProjectTypeItem|null>(null);
  const [typeForm, setTypeForm] = useState({key:'',label:'',color:'#1a3a6b'});
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [editFaculty, setEditFaculty] = useState<FacultyItem|null>(null);
  const [facultyForm, setFacultyForm] = useState({name:'',shortName:'',color:'#1a3a6b'});
  const [reportTypes, setReportTypes] = useState<ReportTypeItem[]>([]);
  const [showRTModal, setShowRTModal] = useState(false);
  const [editRT, setEditRT] = useState<ReportTypeItem|null>(null);
  const [rtForm, setRtForm] = useState({label:'',description:'',color:'#1a3a6b',showProgress:true});
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  const loadAll = async () => {
    setLoadError(null);
    try {
      const [sRes, dfRes, ptRes, facRes] = await Promise.all([
        settingsApi.getAll(),
        dynamicFieldsApi.getAllAdmin(),
        projectTypesApi.getAll(),
        facultiesApi.getAll(),
      ]);
      const flat: Record<string,string> = {};
      const data = sRes.data;
      if (typeof data === 'object') {
        Object.entries(data).forEach(([k,v]: [string,any]) => { flat[k] = typeof v === 'object' && v?.value !== undefined ? v.value : String(v||''); });
      }
      setSettings(flat);
      setFields(dfRes.data);
      setProjectTypes(ptRes.data);
      setFaculties(facRes.data);
      // report types opsiyonel
      reportTypesApi.getAll().then(r => setReportTypes(r.data)).catch(() => setReportTypes([]));
    } catch (e: any) {
      setLoadError(e?.response?.data?.message || 'Ayarlar yüklenemedi');
    }
  };

  useEffect(() => {
    if (!me || !isAdmin) return;
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [me, isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string,string> = {};
      Object.entries(settings).forEach(([k,v]) => { payload[k] = String(v||''); });
      await settingsApi.update(payload);
      // Store cache'ini temizle — sidebar/login anında güncellensin
      await loadSettings(true);
      toast.success('Ayarlar kaydedildi');
    } catch { toast.error('Kayıt başarısız'); }
    finally { setSaving(false); }
  };

  const handleImageUpload = (file: File, key: string) => {
    const reader = new FileReader();
    reader.onload = e => { setSettings(s => ({...s,[key]: e.target?.result as string})); toast.success('Görsel yüklendi'); };
    reader.readAsDataURL(file);
  };

  // Field handlers
  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {...fieldForm, key: fieldForm.key||fieldForm.name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''), options: fieldForm.type==='select'&&fieldForm.options ? fieldForm.options.split(',').map(o=>o.trim()) : []};
    try {
      if (editField) await dynamicFieldsApi.update(editField.id, payload);
      else await dynamicFieldsApi.create(payload);
      toast.success(editField?'Alan güncellendi':'Alan eklendi');
      await dynamicFieldsApi.getAllAdmin().then(r => setFields(r.data));
      setShowFieldModal(false);
    } catch { toast.error('Hata oluştu'); }
  };

  // Type handlers
  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editType) await projectTypesApi.update(editType.id, typeForm);
      else await projectTypesApi.create({...typeForm, key: typeForm.key||typeForm.label.toLowerCase().replace(/\s+/g,'_')});
      toast.success(editType?'Tür güncellendi':'Tür eklendi');
      await projectTypesApi.getAll().then(r => setProjectTypes(r.data));
      setShowTypeModal(false);
    } catch { toast.error('Hata oluştu'); }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm('Bu proje türünü silmek istiyor musunuz?')) return;
    try { await projectTypesApi.delete(id); setProjectTypes(ts => ts.filter(t => t.id !== id)); toast.success('Tür silindi'); }
    catch(e: any) { toast.error(e.response?.data?.message || 'Sistem türleri silinemez'); }
  };

  // Faculty handlers
  const handleSaveFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editFaculty) await facultiesApi.update(editFaculty.id, facultyForm);
      else await facultiesApi.create(facultyForm);
      toast.success(editFaculty?'Fakülte güncellendi':'Fakülte eklendi');
      await facultiesApi.getAll().then(r => setFaculties(r.data));
      setShowFacultyModal(false);
    } catch { toast.error('Hata oluştu'); }
  };

  const handleDeleteFaculty = async (id: string) => {
    if (!confirm('Bu fakülteyi silmek istiyor musunuz?')) return;
    await facultiesApi.delete(id); setFaculties(fs => fs.filter(f => f.id !== id)); toast.success('Fakülte silindi');
  };

  const TABS: [Tab, string][] = [['general','Genel'],['appearance','Görünüm'],['types','Proje Türleri'],['faculties','Fakülteler'],['reporttypes','Rapor Türleri'],['fields','Form Alanları'],['maintenance','Bakım']];

  if (!me || !isAdmin) {
    return <DashboardLayout><Header title="Sistem Ayarları"/><div className="p-8 text-sm text-muted">Yönlendiriliyorsunuz...</div></DashboardLayout>;
  }

  if (loading) return <DashboardLayout><Header title="Sistem Ayarları"/><div className="flex-1 flex items-center justify-center"><div className="spinner"/></div></DashboardLayout>;

  if (loadError) return (
    <DashboardLayout><Header title="Sistem Ayarları"/>
      <div className="p-8">
        <div className="card py-16 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <SIcon name="alert-circle" className="w-7 h-7" strokeWidth={1.6} />
          </div>
          <p className="text-sm font-semibold text-navy">Ayarlar yüklenemedi</p>
          <p className="text-xs text-muted mt-1 max-w-md mx-auto">{loadError}</p>
          <button onClick={() => { setLoading(true); loadAll().finally(() => setLoading(false)); }} className="btn-primary text-sm mt-4 inline-flex items-center gap-1.5">
            <SIcon name="refresh" className="w-4 h-4" /> Yeniden Dene
          </button>
        </div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <Header title="Sistem Ayarları" subtitle="Platform yapılandırması ve özelleştirme"/>
      <div className="p-6 xl:p-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit flex-wrap overflow-x-auto" style={{background:'#f0ede8',border:'1px solid #e8e4dc'}}>
          {TABS.map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t as Tab)}
              className="px-3 py-2 rounded-xl text-sm font-semibold transition-all inline-flex items-center gap-1.5 whitespace-nowrap"
              style={{background:tab===t?'white':'transparent',color:tab===t?'#0f2444':'#9ca3af',boxShadow:tab===t?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
              <SIcon name={TAB_ICONS[t as Tab]} className="w-3.5 h-3.5" />
              {l}
            </button>
          ))}
        </div>

        {/* GENERAL */}
        {tab==='general' && (
          <div className="max-w-2xl space-y-6">
            <div className="card space-y-5">
              <h3 className="font-display text-base font-semibold text-navy pb-4 border-b" style={{borderColor:'#e8e4dc'}}>Site Bilgileri</h3>
              {[{key:'site_name',label:'Site Adı',placeholder:'MKÜ TTO'},{key:'site_title',label:'Tam Başlık',placeholder:'Hatay MKÜ TTO'},{key:'footer_text',label:'Footer Metni',placeholder:'© 2025 MKÜ TTO'}].map(({key,label,placeholder})=>(
                <div key={key}><label className="label">{label}</label>
                  <input className="input" value={settings[key]||''} placeholder={placeholder} onChange={e=>setSettings(s=>({...s,[key]:e.target.value}))} />
                </div>
              ))}
            </div>

            {/* Özellik kontrolleri — sistem genel davranışı */}
            <div className="card space-y-4">
              <h3 className="font-display text-base font-semibold text-navy pb-4 border-b" style={{borderColor:'#e8e4dc'}}>Sistem Özellikleri</h3>
              <label className="flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-[#faf8f4]" style={{ border: '1px solid #e8e4dc' }}>
                <input
                  type="checkbox"
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  checked={String(settings.show_bibliometrics ?? 'true').toLowerCase() !== 'false'}
                  onChange={e => setSettings(s => ({ ...s, show_bibliometrics: e.target.checked ? 'true' : 'false' }))}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy">Bibliyometrik Görünümler Aktif</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Profil sayfalarındaki OpenAlex/Scopus/WoS/Scholar/TR Dizin metrik kartları, "Otomatik Senkronize Et" butonu,
                    Kurumsal Analiz bibliyometri sekmesi ve vitrin portalındaki akademik göstergeler tüm sistemde gösterilir/gizlenir.
                  </p>
                </div>
              </label>
            </div>

            <button onClick={handleSave} disabled={saving} className="btn-primary px-8 py-3 inline-flex items-center gap-1.5">
              {saving ? <><span className="spinner w-4 h-4" />Kaydediliyor...</> : <><SIcon name="save" className="w-4 h-4" />Değişiklikleri Kaydet</>}
            </button>
          </div>
        )}

        {/* APPEARANCE */}
        {tab==='appearance' && (
          <div className="max-w-2xl space-y-6">
            <div className="card space-y-5">
              <h3 className="font-display text-base font-semibold text-navy pb-4 border-b" style={{borderColor:'#e8e4dc'}}>Renk Paleti</h3>
              <div className="grid grid-cols-2 gap-5">
                {[['primary_color','Ana Renk','#1a3a6b'],['secondary_color','Vurgu Rengi','#c8a45a']].map(([key,label,def])=>(
                  <div key={key}><label className="label">{label}</label>
                    <div className="flex gap-3 items-center">
                      <input type="color" value={settings[key]||def} onChange={e=>setSettings(s=>({...s,[key]:e.target.value}))} className="w-12 h-10 rounded-xl cursor-pointer" style={{border:'1.5px solid #e8e4dc',padding:2}}/>
                      <input className="input flex-1 font-mono-dm" value={settings[key]||def} onChange={e=>setSettings(s=>({...s,[key]:e.target.value}))}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card space-y-6">
              <h3 className="font-display text-base font-semibold text-navy pb-4 border-b" style={{borderColor:'#e8e4dc'}}>Logo & Favicon</h3>
              <div className="grid grid-cols-2 gap-6">
                {/* Logo */}
                <div>
                  <label className="label">Site Logosu</label>
                  <div className="rounded-2xl p-6 text-center cursor-pointer" style={{border:'2px dashed #e8e4dc',background:'#faf8f4'}} onClick={()=>logoRef.current?.click()}>
                    {settings.logo_url ? <img src={settings.logo_url} alt="Logo" className="max-h-16 mx-auto object-contain" /> :
                    <div><div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{background:'#f0ede8'}}>
                      <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>
                      <p className="text-xs text-muted">PNG, SVG — tıkla</p></div>}
                  </div>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e=>e.target.files?.[0]&&handleImageUpload(e.target.files[0],'logo_url')}/>
                  {settings.logo_url && (
                    <button className="btn-ghost text-xs mt-2 w-full inline-flex items-center justify-center gap-1" onClick={()=>setSettings(s=>({...s,logo_url:''}))}>
                      <SIcon name="x" className="w-3 h-3" />
                      Kaldır
                    </button>
                  )}
                </div>
                {/* Favicon */}
                <div>
                  <label className="label">Favicon</label>
                  <div className="rounded-2xl p-6 text-center cursor-pointer" style={{border:'2px dashed #e8e4dc',background:'#faf8f4'}} onClick={()=>faviconRef.current?.click()}>
                    {settings.favicon_url ? <img src={settings.favicon_url} alt="Favicon" className="w-10 h-10 mx-auto object-contain" /> :
                    <div><div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{background:'#f0ede8'}}>
                      <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg></div>
                      <p className="text-xs text-muted">ICO, PNG — tıkla</p></div>}
                  </div>
                  <input ref={faviconRef} type="file" accept="image/*,.ico" className="hidden" onChange={e=>e.target.files?.[0]&&handleImageUpload(e.target.files[0],'favicon_url')}/>
                  {settings.favicon_url && (
                    <button className="btn-ghost text-xs mt-2 w-full inline-flex items-center justify-center gap-1" onClick={()=>setSettings(s=>({...s,favicon_url:''}))}>
                      <SIcon name="x" className="w-3 h-3" />
                      Kaldır
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving} className="btn-primary px-8 py-3 inline-flex items-center gap-1.5">
              {saving ? <><span className="spinner w-4 h-4" />Kaydediliyor...</> : <><SIcon name="save" className="w-4 h-4" />Değişiklikleri Kaydet</>}
            </button>
          </div>
        )}

        {/* PROJECT TYPES */}
        {tab==='types' && (
          <div className="space-y-5 max-w-3xl">
            <div className="flex justify-end">
              <button onClick={()=>{setEditType(null);setTypeForm({key:'',label:'',color:'#1a3a6b'});setShowTypeModal(true);}}
                className="btn-primary inline-flex items-center gap-1.5">
                <SIcon name="plus" className="w-4 h-4" /> Proje Türü Ekle
              </button>
            </div>
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr style={{background:'#faf8f4',borderBottom:'1px solid #e8e4dc'}}>
                  {['Renk','Anahtar','Etiket','Sistem',''].map(h=><th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted px-5 py-3">{h}</th>)}
                </tr></thead>
                <tbody>
                  {projectTypes.map(t=>(
                    <tr key={t.id} className="table-row-hover border-b" style={{borderColor:'#f5f2ee'}}>
                      <td className="px-5 py-4"><div className="w-5 h-5 rounded-full" style={{background:t.color||'#1a3a6b'}}/></td>
                      <td className="px-5 py-4"><code className="text-xs font-mono-dm text-muted bg-slate-50 px-2 py-1 rounded">{t.key}</code></td>
                      <td className="px-5 py-4"><span className="font-semibold text-sm px-3 py-1 rounded-full" style={{background:(t.color||'#1a3a6b')+'18',color:t.color||'#1a3a6b'}}>{t.label}</span></td>
                      <td className="px-5 py-4">{t.isSystem?<span className="badge badge-gold text-xs">Sistem</span>:<span className="text-xs text-muted">—</span>}</td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button onClick={()=>{setEditType(t);setTypeForm({key:t.key,label:t.label,color:t.color||'#1a3a6b'});setShowTypeModal(true);}} className="btn-secondary text-xs px-3 py-1.5">Düzenle</button>
                          {!t.isSystem && <button onClick={()=>handleDeleteType(t.id)} className="btn-danger text-xs px-2 py-1.5">Sil</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!projectTypes.length && <tr><td colSpan={5}><div className="empty-state py-10"><p className="text-sm">Proje türü yok</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FACULTIES */}
        {tab==='faculties' && (
          <div className="space-y-5 max-w-3xl">
            <div className="flex justify-end">
              <button onClick={()=>{setEditFaculty(null);setFacultyForm({name:'',shortName:'',color:'#1a3a6b'});setShowFacultyModal(true);}}
                className="btn-primary inline-flex items-center gap-1.5">
                <SIcon name="plus" className="w-4 h-4" /> Fakülte Ekle
              </button>
            </div>
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr style={{background:'#faf8f4',borderBottom:'1px solid #e8e4dc'}}>
                  {['Renk','Fakülte Adı','Kısa Ad','Durum',''].map(h=><th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted px-5 py-3">{h}</th>)}
                </tr></thead>
                <tbody>
                  {faculties.map(f=>(
                    <tr key={f.id} className="table-row-hover border-b" style={{borderColor:'#f5f2ee'}}>
                      <td className="px-5 py-4"><div className="w-5 h-5 rounded-full" style={{background:f.color||'#1a3a6b'}}/></td>
                      <td className="px-5 py-4 font-semibold text-navy text-sm">{f.name}</td>
                      <td className="px-5 py-4 text-xs text-muted">{f.shortName||'—'}</td>
                      <td className="px-5 py-4">
                        <button onClick={async()=>{await facultiesApi.update(f.id,{isActive:f.isActive?0:1});await facultiesApi.getAll().then(r=>setFaculties(r.data));}}
                          className={`badge text-xs cursor-pointer ${f.isActive?'badge-green':'badge-gray'}`}>{f.isActive?'Aktif':'Pasif'}</button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button onClick={()=>{setEditFaculty(f);setFacultyForm({name:f.name,shortName:f.shortName||'',color:f.color||'#1a3a6b'});setShowFacultyModal(true);}} className="btn-secondary text-xs px-3 py-1.5">Düzenle</button>
                          <button onClick={()=>handleDeleteFaculty(f.id)} className="btn-danger text-xs px-2 py-1.5">Sil</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!faculties.length && <tr><td colSpan={5}><div className="empty-state py-10"><p className="text-sm">Fakülte eklenmemiş</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FIELDS */}
        {tab==='fields' && (
          <div className="space-y-5">
            <div className="card p-4" style={{background:'#eff6ff',border:'1px solid #bfdbfe'}}>
              <p className="text-sm font-semibold text-blue-800 mb-1 inline-flex items-center gap-1.5">
                <SIcon name="info" className="w-4 h-4" />
                Form Alanları Nedir?
              </p>
              <p className="text-xs text-blue-700 leading-relaxed">
                Proje oluşturma ve düzenleme formuna <strong>kurumunuza özel ekstra alanlar</strong> ekleyebilirsiniz.
                Örneğin: "Etik Kurul Onay No", "Sözleşme Başlangıç Tarihi", "Beklenen Yayın Sayısı" gibi.
                Buraya eklenen alanlar tüm projelerin formunda görünür ve kaydedilir.
              </p>
            </div>
            <div className="flex justify-end">
              <button onClick={()=>{setEditField(null);setFieldForm({name:'',key:'',label:'',type:'text',options:'',required:false});setShowFieldModal(true);}}
                className="btn-primary inline-flex items-center gap-1.5">
                <SIcon name="plus" className="w-4 h-4" /> Yeni Alan Ekle
              </button>
            </div>
            {fields.length ? (
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr style={{background:'#faf8f4',borderBottom:'1px solid #e8e4dc'}}>
                    {['Alan','Anahtar','Tür','Zorunlu','Durum',''].map(h=><th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted px-5 py-3">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {fields.map(f=>(
                      <tr key={f.id} className="table-row-hover border-b" style={{borderColor:'#f5f2ee'}}>
                        <td className="px-5 py-4 font-semibold text-navy text-sm">{f.label||f.name}</td>
                        <td className="px-5 py-4"><code className="text-xs font-mono-dm text-muted bg-slate-50 px-2 py-1 rounded">{f.key}</code></td>
                        <td className="px-5 py-4 text-xs text-muted">{FIELD_TYPES.find(t=>t[0]===f.type)?.[1]||f.type}</td>
                        <td className="px-5 py-4">{f.required?<span className="badge badge-green text-xs">Evet</span>:<span className="text-muted text-xs">—</span>}</td>
                        <td className="px-5 py-4">
                          <button onClick={async()=>{await dynamicFieldsApi.update(f.id,{isActive:f.isActive?0:1});await dynamicFieldsApi.getAllAdmin().then(r=>setFields(r.data));}}
                            className={`badge text-xs cursor-pointer ${f.isActive?'badge-green':'badge-gray'}`}>{f.isActive?'Aktif':'Pasif'}</button>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button onClick={()=>{setEditField(f);setFieldForm({name:f.name,key:f.key,label:f.label||'',type:f.type,options:f.options?.join(', ')||'',required:!!f.required});setShowFieldModal(true);}} className="btn-secondary text-xs px-3 py-1.5">Düzenle</button>
                            <button onClick={async()=>{if(!confirm('Silmek istiyor musunuz?'))return;await dynamicFieldsApi.delete(f.id);setFields(fs=>fs.filter(x=>x.id!==f.id));toast.success('Alan silindi');}} className="btn-danger text-xs px-2 py-1.5">Sil</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state"><p className="text-sm">Henüz alan eklenmemiş</p></div>}
          </div>
        )}

        {/* MAINTENANCE */}
        {tab==='maintenance' && (
          <div className="max-w-2xl space-y-6">
            <div className="card space-y-4">
              <h3 className="font-display text-base font-semibold text-navy pb-4 border-b" style={{borderColor:'#e8e4dc'}}>Demo Veriler</h3>
              <p className="text-sm text-muted">
                Sisteme daha önce eklenmiş demo/örnek projeleri toplu olarak silebilirsiniz.
                Bu işlem geri alınamaz.
              </p>
              <div className="p-3 rounded-xl" style={{background:'#fffbeb',border:'1px solid #fde68a'}}>
                <p className="text-xs text-amber-800">
                  <strong>Bilgi:</strong> Demo proje seed'i bootstrap'tan kaldırıldı —
                  yeni başlangıçlarda otomatik demo eklenmez. Bu buton sadece mevcut
                  demo kayıtları temizlemek içindir (ilişkili üye/belge/rapor/etik kayıtları dahil).
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!confirm('Tüm demo projeleri SİLMEK istediğinize emin misiniz?\n\nDemo projeler ve ilişkili tüm kayıtları (üye, belge, rapor, partner, etik inceleme) silinecektir. Bu işlem geri alınamaz.')) return;
                  try {
                    const r = await fetch((process.env.NEXT_PUBLIC_API_URL || '/api') + '/admin/demo-projects', {
                      method: 'DELETE',
                      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('tto_token') || '') },
                    });
                    const d = await r.json();
                    if (r.ok) toast.success(d.message || 'Demo projeler silindi');
                    else toast.error(d.message || 'Silme başarısız');
                  } catch (e: any) {
                    toast.error(e?.message || 'Bağlantı hatası');
                  }
                }}
                className="btn-danger inline-flex items-center gap-1.5">
                <SIcon name="trash" className="w-4 h-4" />
                Tüm Demo Projeleri Sil
              </button>
            </div>
          </div>
        )}
      </div>

      {/* REPORT TYPES */}
        {tab==='reporttypes' && (
          <div className="space-y-5 max-w-3xl">
            <div className="flex justify-end">
              <button onClick={()=>{setEditRT(null);setRtForm({label:'',description:'',color:'#1a3a6b',showProgress:true});setShowRTModal(true);}}
                className="btn-primary inline-flex items-center gap-1.5">
                <SIcon name="plus" className="w-4 h-4" /> Rapor Türü Ekle
              </button>
            </div>
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr style={{background:'#faf8f4',borderBottom:'1px solid #e8e4dc'}}>
                  {['Renk','Etiket','Açıklama','İlerleme','Sistem','Durum',''].map(h=><th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted px-5 py-3">{h}</th>)}
                </tr></thead>
                <tbody>
                  {reportTypes.map(rt=>(
                    <tr key={rt.id} className="table-row-hover border-b" style={{borderColor:'#f5f2ee'}}>
                      <td className="px-5 py-4"><div className="w-5 h-5 rounded-full" style={{background:rt.color||'#1a3a6b'}}/></td>
                      <td className="px-5 py-4"><span className="font-semibold text-sm px-3 py-1 rounded-full" style={{background:(rt.color||'#1a3a6b')+'18',color:rt.color||'#1a3a6b'}}>{rt.label}</span></td>
                      <td className="px-5 py-4 text-sm text-muted">{rt.description||'—'}</td>
                      <td className="px-5 py-4">{rt.showProgress?<span className="badge badge-green text-xs">Göster</span>:<span className="badge badge-gray text-xs">Gösterme</span>}</td>
                      <td className="px-5 py-4">{rt.isSystem?<span className="badge badge-gold text-xs">Sistem</span>:<span className="text-xs text-muted">—</span>}</td>
                      <td className="px-5 py-4">
                        <button onClick={async()=>{await reportTypesApi.update(rt.id,{isActive:rt.isActive?0:1});await reportTypesApi.getAll().then(r=>setReportTypes(r.data));}}
                          className={`badge text-xs cursor-pointer ${rt.isActive?'badge-green':'badge-gray'}`}>{rt.isActive?'Aktif':'Pasif'}</button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button onClick={()=>{setEditRT(rt);setRtForm({label:rt.label,description:rt.description||'',color:rt.color||'#1a3a6b',showProgress:!!rt.showProgress});setShowRTModal(true);}} className="btn-secondary text-xs px-3 py-1.5">Düzenle</button>
                          {!rt.isSystem&&<button onClick={async()=>{if(!confirm('Silmek istiyor musunuz?'))return;try{await reportTypesApi.delete(rt.id);setReportTypes(ts=>ts.filter(t=>t.id!==rt.id));toast.success('Silindi');}catch{toast.error('Sistem türleri silinemez');}}} className="btn-danger text-xs px-2 py-1.5">Sil</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!reportTypes.length&&<tr><td colSpan={7}><div className="empty-state py-10"><p className="text-sm">Rapor türü yok</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Field Modal */}
      {showFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{border:'1px solid #e8e4dc'}}>
            <div className="p-6 border-b sticky top-0 bg-white" style={{borderColor:'#e8e4dc'}}>
              <h3 className="font-display text-lg font-semibold text-navy">{editField?'Alanı Düzenle':'Yeni Form Alanı'}</h3>
            </div>
            <form onSubmit={handleSaveField} className="p-6 space-y-4">
              <div><label className="label">Alan Adı *</label><input required className="input" value={fieldForm.name} onChange={e=>setFieldForm(f=>({...f,name:e.target.value,key:editField?f.key:e.target.value.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')}))}/></div>
              <div><label className="label">Form Etiketi</label><input className="input" value={fieldForm.label} placeholder="Formda görünecek metin" onChange={e=>setFieldForm(f=>({...f,label:e.target.value}))}/></div>
              <div><label className="label">Anahtar</label><input className="input font-mono-dm text-sm" value={fieldForm.key} onChange={e=>setFieldForm(f=>({...f,key:e.target.value}))}/></div>
              <div><label className="label">Alan Türü</label><select className="input" value={fieldForm.type} onChange={e=>setFieldForm(f=>({...f,type:e.target.value}))}>{FIELD_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
              {fieldForm.type==='select' && <div><label className="label">Seçenekler (virgülle)</label><input className="input" value={fieldForm.options} onChange={e=>setFieldForm(f=>({...f,options:e.target.value}))} placeholder="A, B, C"/></div>}
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl" style={{background:'#faf8f4',border:'1px solid #e8e4dc'}}>
                <input type="checkbox" checked={fieldForm.required} onChange={e=>setFieldForm(f=>({...f,required:e.target.checked}))} className="w-4 h-4"/>
                <span className="text-sm font-semibold text-navy">Zorunlu alan</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editField?'Güncelle':'Ekle'}</button>
                <button type="button" onClick={()=>setShowFieldModal(false)} className="btn-secondary flex-1">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" style={{border:'1px solid #e8e4dc'}}>
            <div className="p-6 border-b" style={{borderColor:'#e8e4dc'}}><h3 className="font-display text-lg font-semibold text-navy">{editType?'Türü Düzenle':'Yeni Proje Türü'}</h3></div>
            <form onSubmit={handleSaveType} className="p-6 space-y-4">
              <div><label className="label">Etiket *</label><input required className="input" value={typeForm.label} onChange={e=>setTypeForm(f=>({...f,label:e.target.value,key:editType?f.key:e.target.value.toLowerCase().replace(/\s+/g,'_')}))}/></div>
              {!editType && <div><label className="label">Anahtar</label><input className="input font-mono-dm text-sm" value={typeForm.key} onChange={e=>setTypeForm(f=>({...f,key:e.target.value}))}/></div>}
              <div><label className="label">Renk</label><div className="flex gap-3"><input type="color" value={typeForm.color} onChange={e=>setTypeForm(f=>({...f,color:e.target.value}))} className="w-12 h-10 rounded-xl cursor-pointer" style={{border:'1.5px solid #e8e4dc',padding:2}}/><input className="input flex-1 font-mono-dm" value={typeForm.color} onChange={e=>setTypeForm(f=>({...f,color:e.target.value}))}/></div></div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editType?'Güncelle':'Ekle'}</button>
                <button type="button" onClick={()=>setShowTypeModal(false)} className="btn-secondary flex-1">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Faculty Modal */}
      {showFacultyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" style={{border:'1px solid #e8e4dc'}}>
            <div className="p-6 border-b" style={{borderColor:'#e8e4dc'}}><h3 className="font-display text-lg font-semibold text-navy">{editFaculty?'Fakülteyi Düzenle':'Yeni Fakülte'}</h3></div>
            <form onSubmit={handleSaveFaculty} className="p-6 space-y-4">
              <div><label className="label">Fakülte Adı *</label><input required className="input" value={facultyForm.name} onChange={e=>setFacultyForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label className="label">Kısa Ad</label><input className="input" value={facultyForm.shortName} placeholder="MÜH, FEN..." onChange={e=>setFacultyForm(f=>({...f,shortName:e.target.value}))}/></div>
              <div><label className="label">Renk</label><div className="flex gap-3"><input type="color" value={facultyForm.color} onChange={e=>setFacultyForm(f=>({...f,color:e.target.value}))} className="w-12 h-10 rounded-xl cursor-pointer" style={{border:'1.5px solid #e8e4dc',padding:2}}/><input className="input flex-1 font-mono-dm" value={facultyForm.color} onChange={e=>setFacultyForm(f=>({...f,color:e.target.value}))}/></div></div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editFaculty?'Güncelle':'Ekle'}</button>
                <button type="button" onClick={()=>setShowFacultyModal(false)} className="btn-secondary flex-1">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Report Type Modal */}
      {showRTModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" style={{border:'1px solid #e8e4dc'}}>
            <div className="p-6 border-b" style={{borderColor:'#e8e4dc'}}><h3 className="font-display text-lg font-semibold text-navy">{editRT?'Rapor Türü Düzenle':'Yeni Rapor Türü'}</h3></div>
            <form onSubmit={async(e)=>{e.preventDefault();try{if(editRT)await reportTypesApi.update(editRT.id,{...rtForm,showProgress:rtForm.showProgress?1:0});else await reportTypesApi.create({...rtForm,showProgress:rtForm.showProgress?1:0});toast.success(editRT?'Güncellendi':'Eklendi');await reportTypesApi.getAll().then(r=>setReportTypes(r.data));setShowRTModal(false);}catch{toast.error('Hata oluştu');}}} className="p-6 space-y-4">
              <div><label className="label">Etiket *</label><input required className="input" value={rtForm.label} onChange={e=>setRtForm(f=>({...f,label:e.target.value}))}/></div>
              <div><label className="label">Açıklama</label><input className="input" value={rtForm.description} onChange={e=>setRtForm(f=>({...f,description:e.target.value}))}/></div>
              <div><label className="label">Renk</label><div className="flex gap-3"><input type="color" value={rtForm.color} onChange={e=>setRtForm(f=>({...f,color:e.target.value}))} className="w-12 h-10 rounded-xl cursor-pointer" style={{border:'1.5px solid #e8e4dc',padding:2}}/><input className="input flex-1 font-mono-dm" value={rtForm.color} onChange={e=>setRtForm(f=>({...f,color:e.target.value}))}/></div></div>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl" style={{background:'#faf8f4',border:'1px solid #e8e4dc'}}>
                <input type="checkbox" checked={rtForm.showProgress} onChange={e=>setRtForm(f=>({...f,showProgress:e.target.checked}))} className="w-4 h-4"/>
                <div><p className="text-sm font-semibold text-navy">İlerleme Yüzdesi Göster</p><p className="text-xs text-muted">Bu türdeki raporlarda ilerleme çubuğu görünsün</p></div>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editRT?'Güncelle':'Ekle'}</button>
                <button type="button" onClick={()=>setShowRTModal(false)} className="btn-secondary flex-1">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
