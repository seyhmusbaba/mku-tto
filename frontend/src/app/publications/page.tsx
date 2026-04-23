'use client';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/lib/auth-context';
import { userPublicationsApi } from '@/lib/api';

interface Publication {
  id: string;
  title: string;
  authors?: string;
  journal?: string;
  year?: number;
  doi?: string;
  url?: string;
  type: string;
  citations?: number;
  quartile?: string;
  isOpenAccess?: boolean;
  isFeatured?: boolean;
  notes?: string;
}

const TYPE_LABELS: Record<string, string> = {
  article: 'Makale',
  book: 'Kitap',
  'book-chapter': 'Kitap Bölümü',
  proceedings: 'Bildiri',
  thesis: 'Tez',
  patent: 'Patent',
  other: 'Diğer',
};

export default function PublicationsPage() {
  const { user } = useAuth();
  const [pubs, setPubs] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Publication | null>(null);
  const [form, setForm] = useState<Partial<Publication>>({
    title: '', authors: '', journal: '', year: new Date().getFullYear(),
    doi: '', url: '', type: 'article', citations: 0, quartile: '',
    isOpenAccess: false, notes: '',
  });

  const load = () => {
    setLoading(true);
    userPublicationsApi.listMine()
      .then(r => setPubs(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (user) load(); }, [user]);

  const reset = () => {
    setEditing(null); setShowForm(false);
    setForm({ title: '', authors: '', journal: '', year: new Date().getFullYear(),
      doi: '', url: '', type: 'article', citations: 0, quartile: '',
      isOpenAccess: false, notes: '' });
  };

  const submit = async () => {
    if (!form.title?.trim()) return alert('Başlık zorunlu');
    try {
      if (editing) await userPublicationsApi.update(editing.id, form);
      else await userPublicationsApi.create(form);
      reset(); load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Hata');
    }
  };

  const startEdit = (p: Publication) => {
    setEditing(p); setShowForm(true); setForm({ ...p });
  };

  const remove = async (id: string) => {
    if (!confirm('Yayın silinsin mi?')) return;
    await userPublicationsApi.remove(id);
    load();
  };

  const toggleFeat = async (id: string) => {
    await userPublicationsApi.toggleFeatured(id);
    load();
  };

  return (
    <DashboardLayout>
      <Header title="Yayınlarım"
        subtitle={`Toplam ${pubs.length} yayın · ${pubs.filter(p => p.isFeatured).length} öne çıkan`}
        actions={
          <button className="btn-primary text-sm" onClick={() => { reset(); setShowForm(true); }}>
            + Yayın Ekle
          </button>
        } />

      <div className="p-6 space-y-5">
        {showForm && (
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-navy">{editing ? 'Yayın Güncelle' : 'Yeni Yayın'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="input md:col-span-2" placeholder="Başlık *"
                value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
              <input className="input md:col-span-2" placeholder="Yazarlar (örn: Ali Yılmaz, Ayşe Demir)"
                value={form.authors || ''} onChange={e => setForm({ ...form, authors: e.target.value })} />
              <input className="input" placeholder="Dergi / Yayınevi"
                value={form.journal || ''} onChange={e => setForm({ ...form, journal: e.target.value })} />
              <input className="input" type="number" placeholder="Yıl"
                value={form.year || ''} onChange={e => setForm({ ...form, year: +e.target.value })} />
              <select className="input" value={form.type || 'article'}
                onChange={e => setForm({ ...form, type: e.target.value })}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className="input" value={form.quartile || ''}
                onChange={e => setForm({ ...form, quartile: e.target.value })}>
                <option value="">Çeyrek (Quartile)</option>
                <option value="Q1">Q1</option><option value="Q2">Q2</option>
                <option value="Q3">Q3</option><option value="Q4">Q4</option>
              </select>
              <input className="input" placeholder="DOI"
                value={form.doi || ''} onChange={e => setForm({ ...form, doi: e.target.value })} />
              <input className="input" placeholder="URL"
                value={form.url || ''} onChange={e => setForm({ ...form, url: e.target.value })} />
              <input className="input" type="number" placeholder="Atıf sayısı"
                value={form.citations || 0} onChange={e => setForm({ ...form, citations: +e.target.value })} />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={form.isOpenAccess || false}
                  onChange={e => setForm({ ...form, isOpenAccess: e.target.checked })} />
                Açık Erişim
              </label>
              <textarea className="input md:col-span-2" placeholder="Notlar" rows={2}
                value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary text-sm" onClick={submit}>{editing ? 'Güncelle' : 'Kaydet'}</button>
              <button className="btn-secondary text-sm" onClick={reset}>İptal</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="card flex justify-center py-16"><div className="spinner" /></div>
        ) : pubs.length === 0 ? (
          <div className="card py-16 text-center text-sm text-muted">
            Henüz yayın eklememişsiniz. "+ Yayın Ekle" butonunu kullanarak ekleyebilirsiniz.
          </div>
        ) : (
          <div className="space-y-2">
            {pubs.map(p => (
              <div key={p.id} className="card p-4 flex items-start gap-3">
                <button onClick={() => toggleFeat(p.id)} title="Öne çıkar" className="mt-1 flex-shrink-0">
                  <svg className="w-5 h-5" fill={p.isFeatured ? '#f59e0b' : 'none'} stroke="#f59e0b" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy leading-tight">{p.title}</p>
                  {p.authors && <p className="text-sm text-muted mt-0.5">{p.authors}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted">
                    {p.journal && <span>📘 {p.journal}</span>}
                    {p.year && <span>📅 {p.year}</span>}
                    <span className="px-2 py-0.5 rounded-full bg-[#f0ede8] text-[#0f2444] font-semibold">
                      {TYPE_LABELS[p.type] || p.type}
                    </span>
                    {p.quartile && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">{p.quartile}</span>}
                    {p.isOpenAccess && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">🔓 OA</span>}
                    {typeof p.citations === 'number' && p.citations > 0 && <span>📊 {p.citations} atıf</span>}
                    {p.doi && <a className="text-blue-600 hover:underline" href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">DOI: {p.doi}</a>}
                    {p.url && <a className="text-blue-600 hover:underline" href={p.url} target="_blank" rel="noreferrer">Link</a>}
                  </div>
                  {p.notes && <p className="text-xs text-muted mt-1.5 italic">{p.notes}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="btn-secondary text-xs" onClick={() => startEdit(p)}>Düzenle</button>
                  <button className="btn-secondary text-xs text-red-600" onClick={() => remove(p.id)}>Sil</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
