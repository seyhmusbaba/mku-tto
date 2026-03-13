'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { projectsApi, projectTypesApi, facultiesApi } from '@/lib/api';

import toast from 'react-hot-toast';

const STATUSES: [string,string][] = [['application','Başvuru Sürecinde'],['active','Aktif'],['completed','Tamamlandı']];

export default function EditProjectPage() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [faculties, setFaculties] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({});

  useEffect(() => {
    projectTypesApi.getActive().then(r => setProjectTypes(r.data)).catch(() => {});
    facultiesApi.getActive().then(r => setFaculties(r.data)).catch(() => {});
    projectsApi.getOne(id).then(r => {
      const p = r.data;
      setForm({
        title: p.title||'', description: p.description||'',
        type: p.type||'other', status: p.status||'pending',
        faculty: p.faculty||'', department: p.department||'',
        budget: p.budget||'', fundingSource: p.fundingSource||'',
        startDate: p.startDate?p.startDate.substring(0,10):'',
        endDate: p.endDate?p.endDate.substring(0,10):'',
        tags: p.tags?.join(', ')||'',
        keywords: p.keywords?.join(', ')||'',
      });
    }).finally(()=>setLoading(false));
  }, [id]);

  const set = (k: string, v: any) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) return toast.error('Proje adı zorunludur');
    setSaving(true);
    try {
      const payload = {
        ...form,
        budget: form.budget?+form.budget:null,
        tags: form.tags?form.tags.split(',').map((t:string)=>t.trim()).filter(Boolean):[],
        keywords: form.keywords?form.keywords.split(',').map((k:string)=>k.trim()).filter(Boolean):[],
      };
      await projectsApi.update(id, payload);
      toast.success('Proje güncellendi!');
      router.push(`/projects/${id}`);
    } catch { toast.error('Güncelleme başarısız'); }
    finally { setSaving(false); }
  };

  const Field = ({label, children}: {label:string,children:React.ReactNode}) => (
    <div><label className="label">{label}</label>{children}</div>
  );

  if (loading) return (
    <DashboardLayout><Header title="Proje Düzenle" />
      <div className="flex-1 flex items-center justify-center"><div className="spinner"/></div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <Header title="Proje Düzenle"
        actions={<button onClick={()=>router.back()} className="btn-secondary">← Geri</button>} />

      <div className="p-8">
        <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">

          {/* Basic */}
          <div className="card space-y-5">
            <h3 className="font-display text-base font-semibold text-navy pb-4 border-b" style={{borderColor:'#e8e4dc'}}>Temel Bilgiler</h3>
            <Field label="Proje Adı *">
              <input required className="input text-base" value={form.title||''} onChange={e=>set('title',e.target.value)} placeholder="Proje adı" />
            </Field>
            <Field label="Açıklama">
              <textarea className="input" style={{minHeight:100}} value={form.description||''} onChange={e=>set('description',e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Proje Türü">
                <select className="input" value={form.type||''} onChange={e=>set('type',e.target.value)}>
                  {projectTypes.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Durum">
                <select className="input" value={form.status||''} onChange={e=>set('status',e.target.value)}>
                  {STATUSES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Institutional */}
          <div className="card space-y-5">
            <h3 className="font-display text-base font-semibold text-navy pb-4 border-b" style={{borderColor:'#e8e4dc'}}>Kurumsal Bilgiler</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fakülte">
                <select className="input" value={form.faculty||''} onChange={e=>set('faculty',e.target.value)}>
                  <option value="">Seçin</option>
                  {faculties.map(f=><option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
              </Field>
              <Field label="Bölüm">
                <input className="input" value={form.department||''} onChange={e=>set('department',e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Financial */}
          <div className="card space-y-5">
            <h3 className="font-display text-base font-semibold text-navy pb-4 border-b" style={{borderColor:'#e8e4dc'}}>Finansal Bilgiler</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bütçe (₺)">
                <input type="number" className="input" value={form.budget||''} onChange={e=>set('budget',e.target.value)} />
              </Field>
              <Field label="Fon Kaynağı">
                <input className="input" value={form.fundingSource||''} onChange={e=>set('fundingSource',e.target.value)} />
              </Field>
              <Field label="Başlangıç Tarihi">
                <input type="date" className="input" value={form.startDate||''} onChange={e=>set('startDate',e.target.value)} />
              </Field>
              <Field label="Bitiş Tarihi">
                <input type="date" className="input" value={form.endDate||''} onChange={e=>set('endDate',e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Tags */}
          <div className="card space-y-5">
            <h3 className="font-display text-base font-semibold text-navy pb-4 border-b" style={{borderColor:'#e8e4dc'}}>Etiketler</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Etiketler (virgülle ayırın)">
                <input className="input" value={form.tags||''} onChange={e=>set('tags',e.target.value)} placeholder="tag1, tag2" />
              </Field>
              <Field label="Anahtar Kelimeler">
                <input className="input" value={form.keywords||''} onChange={e=>set('keywords',e.target.value)} placeholder="kw1, kw2" />
              </Field>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary px-8 py-3">
              {saving?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Kaydediliyor...</>:'✓ Değişiklikleri Kaydet'}
            </button>
            <button type="button" onClick={()=>router.back()} className="btn-secondary px-8 py-3">İptal</button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
