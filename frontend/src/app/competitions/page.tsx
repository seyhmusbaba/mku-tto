'use client';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

const SOURCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  tubitak:  { label: 'TÜBİTAK',        color: '#1d4ed8', bg: '#eff6ff' },
  horizon:  { label: 'Horizon Europe',  color: '#003399', bg: '#eef2ff' },
  kosgeb:   { label: 'KOSGEB',          color: '#059669', bg: '#f0fdf4' },
  kalkinma: { label: 'Kalkınma Ajansı', color: '#7c3aed', bg: '#f5f3ff' },
  diger:    { label: 'Diğer',           color: '#6b7280', bg: '#f9fafb' },
};

const CATEGORY_LABELS: Record<string, string> = {
  araştırma: '🔬 Araştırma',
  inovasyon: '💡 İnovasyon',
  girişim: '🚀 Girişim',
  uluslararası: '🌍 Uluslararası',
  diger: '📋 Diğer',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: 'Aktif', color: '#059669' },
  upcoming: { label: 'Yakında', color: '#d97706' },
  expired:  { label: 'Sona Erdi', color: '#dc2626' },
};

export default function CompetitionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role?.name === 'Süper Admin';

  const [competitions, setCompetitions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [filters, setFilters] = useState({ source: '', category: '', status: '', search: '' });
  const [form, setForm] = useState({
    title: '', description: '', source: 'tubitak', applyUrl: '', sourceUrl: '',
    deadline: '', budget: '', category: 'araştırma', status: 'active',
  });

  const load = async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '12', ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
      const r = await api.get('/competitions?' + params);
      setCompetitions(r.data.data || []);
      setTotal(r.data.total || 0);
      setTotalPages(r.data.totalPages || 1);
    } catch { toast.error('Yüklenemedi'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load(1);
    api.get('/competitions/stats').then(r => setStats(r.data)).catch(() => {});
  }, [filters]);

  const handleFetch = async () => {
    setFetching(true);
    try {
      const r = await api.get('/competitions/fetch');
      const d = r.data;
      if (d.added > 0) {
        toast.success(`${d.added} yeni duyuru eklendi: ${d.sources.join(', ')}`);
        load(1);
        api.get('/competitions/stats').then(r => setStats(r.data)).catch(() => {});
      } else {
        toast('Yeni duyuru bulunamadı', { icon: 'ℹ️' });
      }
    } catch { toast.error('Kaynaklar taranamadı'); }
    finally { setFetching(false); }
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ title: '', description: '', source: 'tubitak', applyUrl: '', sourceUrl: '', deadline: '', budget: '', category: 'araştırma', status: 'active' });
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({ title: item.title || '', description: item.description || '', source: item.source || 'diger', applyUrl: item.applyUrl || '', sourceUrl: item.sourceUrl || '', deadline: item.deadline || '', budget: item.budget || '', category: item.category || 'diger', status: item.status || 'active' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('Başlık zorunlu'); return; }
    setSaving(true);
    try {
      if (editItem) { await api.put(`/competitions/${editItem.id}`, form); toast.success('Güncellendi'); }
      else { await api.post('/competitions', form); toast.success('Eklendi — kullanıcılara bildirim gönderildi'); }
      setShowModal(false);
      load(1);
      api.get('/competitions/stats').then(r => setStats(r.data)).catch(() => {});
    } catch { toast.error('Kaydedilemedi'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Silmek istiyor musunuz?')) return;
    await api.delete(`/competitions/${id}`);
    toast.success('Silindi');
    load(page);
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <DashboardLayout>
      <Header
        title="Yarışmalar & Destekler"
        subtitle="TÜBİTAK, Horizon Europe ve diğer kaynaklardan güncel fırsatlar"
        actions={
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <button onClick={handleFetch} disabled={fetching}
                  className="btn-secondary text-sm flex items-center gap-2">
                  {fetching ? <span className="spinner w-4 h-4" /> : '🔄'}
                  {fetching ? 'Taranıyor...' : 'Kaynakları Tara'}
                </button>
                <button onClick={openAdd} className="btn-primary text-sm">+ Duyuru Ekle</button>
              </>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-5">
        {/* İstatistikler */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Toplam Duyuru', value: stats.total, color: '#1a3a6b' },
              { label: 'Aktif', value: stats.active, color: '#059669' },
              ...((stats.bySources || []).slice(0, 2).map((s: any) => ({
                label: SOURCE_LABELS[s.source]?.label || s.source,
                value: s.count,
                color: SOURCE_LABELS[s.source]?.color || '#6b7280',
              }))),
            ].map((st, i) => (
              <div key={i} className="card py-4 text-center">
                <p className="font-display text-2xl font-bold" style={{ color: st.color }}>{st.value}</p>
                <p className="text-xs text-muted mt-1">{st.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filtreler */}
        <div className="card p-4 flex flex-wrap gap-3">
          <input className="input flex-1 min-w-48 text-sm" placeholder="🔍 Ara..."
            value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          <select className="input text-sm" style={{ width: 160 }}
            value={filters.source} onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}>
            <option value="">Tüm Kaynaklar</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="input text-sm" style={{ width: 160 }}
            value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
            <option value="">Tüm Kategoriler</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input text-sm" style={{ width: 140 }}
            value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="upcoming">Yakında</option>
            <option value="expired">Sona Erdi</option>
          </select>
          {(filters.source || filters.category || filters.status || filters.search) && (
            <button onClick={() => setFilters({ source: '', category: '', status: '', search: '' })}
              className="btn-ghost text-sm">✕ Temizle</button>
          )}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : competitions.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon">🏆</div>
            <p className="text-sm font-medium text-navy">Duyuru bulunamadı</p>
            <p className="text-xs text-muted mt-1">
              {isAdmin ? '"Kaynakları Tara" butonuyla güncel duyuruları çekebilirsiniz.' : 'Henüz duyuru eklenmemiş.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {competitions.map(c => {
                const src = SOURCE_LABELS[c.source] || { label: c.source, color: '#6b7280', bg: '#f9fafb' };
                const status = STATUS_LABELS[c.status] || { label: c.status, color: '#6b7280' };
                return (
                  <div key={c.id} className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
                    {/* Kaynak + Durum */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full"
                        style={{ background: src.bg, color: src.color }}>
                        {src.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: status.color }}>
                          ● {status.label}
                        </span>
                        {c.isManual && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#92651a' }}>Manuel</span>}
                      </div>
                    </div>

                    {/* Başlık */}
                    <h3 className="font-display font-semibold text-navy text-sm leading-snug line-clamp-3">{c.title}</h3>

                    {/* Açıklama */}
                    {c.description && (
                      <p className="text-xs text-muted leading-relaxed line-clamp-3">{c.description}</p>
                    )}

                    {/* Meta */}
                    <div className="space-y-1">
                      {c.deadline && (
                        <p className="text-xs flex items-center gap-1.5">
                          <span className="text-muted">⏰ Son Başvuru:</span>
                          <span className="font-semibold text-navy">{c.deadline}</span>
                        </p>
                      )}
                      {c.budget && (
                        <p className="text-xs flex items-center gap-1.5">
                          <span className="text-muted">💰 Destek:</span>
                          <span className="font-semibold text-navy">{c.budget}</span>
                        </p>
                      )}
                      {c.category && (
                        <p className="text-xs text-muted">{CATEGORY_LABELS[c.category] || c.category}</p>
                      )}
                    </div>

                    {/* Butonlar */}
                    <div className="flex gap-2 mt-auto pt-2 border-t" style={{ borderColor: '#f0ede8' }}>
                      {c.applyUrl && (
                        <a href={c.applyUrl} target="_blank" rel="noopener noreferrer"
                          className="btn-primary text-xs flex-1 text-center">
                          Başvur / İncele ↗
                        </a>
                      )}
                      {isAdmin && (
                        <>
                          <button onClick={() => openEdit(c)} className="btn-secondary text-xs px-3">✏️</button>
                          <button onClick={() => handleDelete(c.id)} className="btn-danger text-xs px-3">🗑️</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sayfalama */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted">{total} duyurudan {(page-1)*12+1}–{Math.min(page*12, total)} gösteriliyor</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => { setPage(page-1); load(page-1); }} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">← Önceki</button>
                  <span className="btn-ghost text-xs px-3 py-1.5">{page}/{totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => { setPage(page+1); load(page+1); }} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Sonraki →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ border: '1px solid #e8e4dc' }}
            onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: '#e8e4dc' }}>
              <h2 className="font-display font-semibold text-navy">{editItem ? 'Duyuru Düzenle' : 'Yeni Duyuru Ekle'}</h2>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-navy">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Başlık *</label>
                <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Duyuru başlığı" />
              </div>
              <div>
                <label className="label">Açıklama</label>
                <textarea className="input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Kısa açıklama..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Kaynak</label>
                  <select className="input" value={form.source} onChange={e => set('source', e.target.value)}>
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Kategori</label>
                  <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Durum</label>
                  <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                    <option value="active">Aktif</option>
                    <option value="upcoming">Yakında</option>
                    <option value="expired">Sona Erdi</option>
                  </select>
                </div>
                <div>
                  <label className="label">Son Başvuru Tarihi</label>
                  <input className="input" value={form.deadline} onChange={e => set('deadline', e.target.value)} placeholder="ör. 15 Mayıs 2025" />
                </div>
              </div>
              <div>
                <label className="label">Destek Miktarı</label>
                <input className="input" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="ör. 500.000 ₺'ye kadar" />
              </div>
              <div>
                <label className="label">Başvuru / İnceleme Linki</label>
                <input className="input" value={form.applyUrl} onChange={e => set('applyUrl', e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className="label">Kaynak Sayfa Linki</label>
                <input className="input" value={form.sourceUrl} onChange={e => set('sourceUrl', e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3" style={{ borderColor: '#e8e4dc' }}>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Kaydediliyor...' : editItem ? 'Güncelle' : 'Ekle'}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-secondary">İptal</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
