'use client';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

// Tarih ayrıştır — "15 Mayıs 2025", "2025-05-15", "15.05.2025" gibi formatları destekle
function parseDeadline(str: string): Date | null {
  if (!str) return null;
  // ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str);
  // dd.mm.yyyy
  const dmy = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) return new Date(+dmy[3], +dmy[2]-1, +dmy[1]);
  // Türkçe ay adları
  const TR_MONTHS: Record<string, number> = { 'ocak':0,'şubat':1,'mart':2,'nisan':3,'mayıs':4,'haziran':5,'temmuz':6,'ağustos':7,'eylül':8,'ekim':9,'kasım':10,'aralık':11 };
  const parts = str.toLowerCase().replace(/[,]/g,'').split(/\s+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0]);
    const month = TR_MONTHS[parts[1]];
    const year = parseInt(parts[parts.length-1]);
    if (!isNaN(day) && month !== undefined && !isNaN(year)) return new Date(year, month, day);
  }
  if (parts.length === 2) {
    const month = TR_MONTHS[parts[0]];
    const year = parseInt(parts[1]);
    if (month !== undefined && !isNaN(year)) return new Date(year, month, 1);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function getDeadlineInfo(deadlineStr: string): { daysLeft: number | null; isExpired: boolean; isUrgent: boolean; isSoon: boolean; label: string; color: string; bg: string; icon: string } {
  const date = parseDeadline(deadlineStr);
  if (!date) return { daysLeft: null, isExpired: false, isUrgent: false, isSoon: false, label: deadlineStr, color: '#6b7280', bg: 'transparent', icon: '⏰' };
  const now = new Date();
  now.setHours(0,0,0,0);
  date.setHours(0,0,0,0);
  const diff = Math.round((date.getTime() - now.getTime()) / (1000*60*60*24));
  if (diff < 0) return { daysLeft: diff, isExpired: true, isUrgent: false, isSoon: false, label: `${Math.abs(diff)} gün önce sona erdi`, color: '#9ca3af', bg: '#f3f4f6', icon: '🔒' };
  if (diff === 0) return { daysLeft: 0, isExpired: false, isUrgent: true, isSoon: false, label: 'Bugün son gün!', color: '#dc2626', bg: '#fef2f2', icon: '🚨' };
  if (diff <= 3) return { daysLeft: diff, isExpired: false, isUrgent: true, isSoon: false, label: `${diff} gün kaldı`, color: '#dc2626', bg: '#fef2f2', icon: '🔥' };
  if (diff <= 7) return { daysLeft: diff, isExpired: false, isUrgent: false, isSoon: true, label: `${diff} gün kaldı`, color: '#d97706', bg: '#fffbeb', icon: '⚡' };
  if (diff <= 30) return { daysLeft: diff, isExpired: false, isUrgent: false, isSoon: true, label: `${diff} gün kaldı`, color: '#059669', bg: '#f0fdf4', icon: '📅' };
  return { daysLeft: diff, isExpired: false, isUrgent: false, isSoon: false, label: deadlineStr, color: '#6b7280', bg: 'transparent', icon: '⏰' };
}

const CATEGORY_LABELS: Record<string, string> = {
  'araştırma': '🔬 Araştırma', 'inovasyon': '💡 İnovasyon',
  'girişim': '🚀 Girişim', 'uluslararası': '🌍 Uluslararası', 'diger': '📋 Diğer',
};
const STATUS_STYLES: Record<string, any> = {
  active:   { label: 'Aktif',      color: '#059669', bg: '#f0fdf4' },
  upcoming: { label: 'Yakında',    color: '#d97706', bg: '#fffbeb' },
  expired:  { label: 'Sona Erdi',  color: '#dc2626', bg: '#fef2f2' },
};

export default function CompetitionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role?.name === 'Süper Admin';

  const [tab, setTab] = useState<'list' | 'sources'>('list');
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Kaynak yönetimi
  const [sources, setSources] = useState<any[]>([]);
  const [sourceModal, setSourceModal] = useState(false);
  const [editSource, setEditSource] = useState<any>(null);
  const [sourceForm, setSourceForm] = useState({ name: '', url: '', type: 'rss', description: '', color: '#1d4ed8', defaultCategory: 'araştırma', isActive: true });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [savingSource, setSavingSource] = useState(false);
  const [scheduleInfo, setScheduleInfo] = useState<any>(null);

  // Duyuru modal
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', source: '', applyUrl: '', sourceUrl: '', deadline: '', budget: '', category: 'araştırma', status: 'active' });

  const [filters, setFilters] = useState({ source: '', category: '', status: '', search: '' });

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '12', ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
      const r = await api.get('/competitions?' + params);
      setCompetitions(r.data.data || []);
      setTotal(r.data.total || 0);
      setTotalPages(r.data.totalPages || 1);
      setPage(p);
    } catch { toast.error('Yüklenemedi'); }
    finally { setLoading(false); }
  };

  const loadSources = async () => {
    const r = await api.get('/competitions/sources/list').catch(() => ({ data: [] }));
    setSources(r.data || []);
    api.get('/competitions/schedule-info').then(r => setScheduleInfo(r.data)).catch(() => {});
  };

  useEffect(() => { load(1); api.get('/competitions/stats').then(r => setStats(r.data)).catch(() => {}); }, [filters]);
  useEffect(() => { if (tab === 'sources') loadSources(); }, [tab]);

  const handleFetch = async () => {
    setFetching(true);
    try {
      const r = await api.get('/competitions/fetch');
      const d = r.data;
      toast(d.message || (d.added > 0 ? `${d.added} yeni duyuru eklendi` : 'Yeni duyuru bulunamadı'), { icon: d.added > 0 ? '✅' : 'ℹ️' });
      if (d.added > 0) { load(1); api.get('/competitions/stats').then(r => setStats(r.data)).catch(() => {}); }
    } catch { toast.error('Kaynaklar taranamadı'); }
    finally { setFetching(false); }
  };

  const handleTestSource = async () => {
    if (!sourceForm.url) { toast.error('URL girin'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post('/competitions/sources/test', { url: sourceForm.url });
      setTestResult(r.data);
    } catch { setTestResult({ ok: false, count: 0, preview: ['Bağlantı hatası'] }); }
    finally { setTesting(false); }
  };

  const openAddSource = () => {
    setEditSource(null);
    setSourceForm({ name: '', url: '', type: 'rss', description: '', color: '#1d4ed8', defaultCategory: 'araştırma', isActive: true });
    setTestResult(null);
    setSourceModal(true);
  };

  const openEditSource = (src: any) => {
    setEditSource(src);
    setSourceForm({ name: src.name, url: src.url, type: src.type, description: src.description || '', color: src.color || '#1d4ed8', defaultCategory: src.defaultCategory || 'araştırma', isActive: src.isActive });
    setTestResult(null);
    setSourceModal(true);
  };

  const handleSaveSource = async () => {
    if (!sourceForm.name || !sourceForm.url) { toast.error('Ad ve URL zorunlu'); return; }
    setSavingSource(true);
    try {
      if (editSource) { await api.put(`/competitions/sources/${editSource.id}`, sourceForm); toast.success('Kaynak güncellendi'); }
      else { await api.post('/competitions/sources', sourceForm); toast.success('Kaynak eklendi'); }
      setSourceModal(false);
      loadSources();
    } catch { toast.error('Kaydedilemedi'); }
    finally { setSavingSource(false); }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Kaynağı silmek istiyor musunuz?')) return;
    await api.delete(`/competitions/sources/${id}`);
    toast.success('Silindi');
    loadSources();
  };

  const openAdd = () => { setEditItem(null); setForm({ title: '', description: '', source: '', applyUrl: '', sourceUrl: '', deadline: '', budget: '', category: 'araştırma', status: 'active' }); setShowModal(true); };
  const openEdit = (item: any) => { setEditItem(item); setForm({ title: item.title||'', description: item.description||'', source: item.source||'', applyUrl: item.applyUrl||'', sourceUrl: item.sourceUrl||'', deadline: item.deadline||'', budget: item.budget||'', category: item.category||'diger', status: item.status||'active' }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.title) { toast.error('Başlık zorunlu'); return; }
    setSaving(true);
    try {
      if (editItem) { await api.put(`/competitions/${editItem.id}`, form); toast.success('Güncellendi'); }
      else { await api.post('/competitions', form); toast.success('Eklendi'); }
      setShowModal(false);
      load(1);
      api.get('/competitions/stats').then(r => setStats(r.data)).catch(() => {});
    } catch { toast.error('Kaydedilemedi'); }
    finally { setSaving(false); }
  };

  const sf = (k: string, v: any) => setSourceForm(f => ({ ...f, [k]: v }));
  const f = (k: string, v: any) => setForm(fm => ({ ...fm, [k]: v }));

  return (
    <DashboardLayout>
      <Header
        title="Yarışmalar & Destekler"
        subtitle="Güncel fon ve destek duyuruları"
        actions={
          <div className="flex gap-2">
            {isAdmin && tab === 'list' && (
              <>
                <button onClick={handleFetch} disabled={fetching} className="btn-secondary text-sm flex items-center gap-2">
                  {fetching ? <span className="spinner w-3.5 h-3.5" /> : '🔄'}
                  {fetching ? 'Taranıyor...' : 'Kaynakları Tara'}
                </button>
                <button onClick={openAdd} className="btn-primary text-sm">+ Duyuru Ekle</button>
              </>
            )}
            {isAdmin && tab === 'sources' && (
              <button onClick={openAddSource} className="btn-primary text-sm">+ Kaynak Ekle</button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-5">
        {/* Sekmeler */}
        {isAdmin && (
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#f0ede8' }}>
            {[['list','🏆 Duyurular'], ['sources','📡 Kaynaklar']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k as any)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: tab === k ? 'white' : 'transparent', color: tab === k ? '#0f2444' : '#9ca3af', boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                {l}
              </button>
            ))}
          </div>
        )}

        {/* ── KAYNAKLAR SEKMESİ ── */}
        {tab === 'sources' && isAdmin && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="card p-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <p className="text-sm font-semibold text-blue-800 mb-1">📡 Kaynak Yönetimi</p>
                <p className="text-xs text-blue-700">RSS feed URL'lerini buraya ekleyin. Kaynaklar <strong>otomatik olarak her 6 saatte bir</strong> taranır. Yeni duyuru bulunursa tüm kullanıcılara otomatik bildirim gider. Manuel tarama için "Kaynakları Tara" butonunu kullanabilirsiniz.</p>
              </div>
              {/* Otomatik tarama bilgisi */}
              <div className="card p-4 flex items-center gap-4" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#059669' }}>
                  <span className="text-white text-lg">⏱️</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Otomatik Tarama Aktif</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {scheduleInfo?.interval || 'Her 6 saatte bir (00:00, 06:00, 12:00, 18:00)'} — Yeni duyuru bulununca tüm kullanıcılara 🔔 bildirim gider
                  </p>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold" style={{ background: '#dcfce7', color: '#15803d' }}>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                    Aktif
                  </span>
                </div>
              </div>
            </div>

            {sources.length === 0 ? (
              <div className="empty-state py-12">
                <div className="empty-state-icon">📡</div>
                <p className="text-sm font-medium text-navy">Henüz kaynak eklenmemiş</p>
                <p className="text-xs text-muted mt-1">RSS feed URL'si olan herhangi bir kaynağı ekleyebilirsiniz</p>
                <p className="text-xs text-muted mt-1">Örnek: TÜBİTAK, KOSGEB, üniversite haber sayfaları</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sources.map(src => (
                  <div key={src.id} className="card p-4 flex items-center gap-4">
                    <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ background: src.color || '#1d4ed8' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-navy text-sm">{src.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: src.isActive ? '#f0fdf4' : '#f9fafb', color: src.isActive ? '#059669' : '#6b7280' }}>
                          {src.isActive ? '● Aktif' : '○ Pasif'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{src.type.toUpperCase()}</span>
                      </div>
                      <p className="text-xs text-muted mt-0.5 truncate">{src.url}</p>
                      {src.description && <p className="text-xs text-muted mt-0.5">{src.description}</p>}
                      <div className="flex gap-3 mt-1 text-xs text-muted">
                        {src.lastFetchedAt && <span>Son tarama: {new Date(src.lastFetchedAt).toLocaleDateString('tr-TR')}</span>}
                        {src.totalFetched > 0 && <span>Toplam: {src.totalFetched} duyuru</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => openEditSource(src)} className="btn-secondary text-xs px-3">✏️ Düzenle</button>
                      <button onClick={() => handleDeleteSource(src.id)} className="btn-danger text-xs px-3">Sil</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DUYURULAR SEKMESİ ── */}
        {tab === 'list' && (
          <>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Toplam', value: stats.total, color: '#1a3a6b' },
                  { label: 'Aktif', value: stats.active, color: '#059669' },
                  ...((stats.bySources || []).slice(0, 2).map((s: any) => ({ label: s.source, value: s.count, color: '#7c3aed' }))),
                ].map((st, i) => (
                  <div key={i} className="card py-4 text-center">
                    <p className="font-display text-2xl font-bold" style={{ color: st.color }}>{st.value}</p>
                    <p className="text-xs text-muted mt-1">{st.label}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="card p-4 flex flex-wrap gap-3">
              <input className="input flex-1 min-w-48 text-sm" placeholder="🔍 Ara..."
                value={filters.search} onChange={e => setFilters(flt => ({ ...flt, search: e.target.value }))} />
              <select className="input text-sm" style={{ width: 160 }}
                value={filters.category} onChange={e => setFilters(flt => ({ ...flt, category: e.target.value }))}>
                <option value="">Tüm Kategoriler</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="input text-sm" style={{ width: 140 }}
                value={filters.status} onChange={e => setFilters(flt => ({ ...flt, status: e.target.value }))}>
                <option value="">Tüm Durumlar</option>
                <option value="active">Aktif</option>
                <option value="upcoming">Yakında</option>
                <option value="expired">Sona Erdi</option>
              </select>
              {(filters.source || filters.category || filters.status || filters.search) && (
                <button onClick={() => setFilters({ source: '', category: '', status: '', search: '' })} className="btn-ghost text-sm">✕ Temizle</button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><div className="spinner" /></div>
            ) : competitions.length === 0 ? (
              <div className="empty-state py-16">
                <div className="empty-state-icon">🏆</div>
                <p className="text-sm font-medium text-navy">Duyuru bulunamadı</p>
                {isAdmin && <p className="text-xs text-muted mt-1">"📡 Kaynaklar" sekmesinden RSS kaynağı ekleyin, ardından "Kaynakları Tara" butonuna basın.</p>}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {competitions.map(comp => {
                    const status = STATUS_STYLES[comp.status] || STATUS_STYLES.active;
                    return (
                      <div key={comp.id} className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow relative overflow-hidden"
                       style={{ opacity: comp.deadline && getDeadlineInfo(comp.deadline).isExpired ? 0.72 : 1 }}>
                        {/* Sona erdi şeridi */}
                        {comp.deadline && getDeadlineInfo(comp.deadline).isExpired && (
                          <div className="absolute top-3 right-[-28px] rotate-45 text-white text-[9px] font-bold px-8 py-0.5 z-10"
                            style={{ background: '#9ca3af' }}>
                            SONA ERDİ
                          </div>
                        )}
                        {/* Acil şerit */}
                        {comp.deadline && getDeadlineInfo(comp.deadline).isUrgent && !getDeadlineInfo(comp.deadline).isExpired && (
                          <div className="absolute top-3 right-[-24px] rotate-45 text-white text-[9px] font-bold px-8 py-0.5 z-10"
                            style={{ background: '#dc2626' }}>
                            ACİL
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: '#f0ede8', color: '#0f2444' }}>{comp.source || 'Duyuru'}</span>
                          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: status.bg, color: status.color }}>● {status.label}</span>
                        </div>
                        <h3 className="font-display font-semibold text-navy text-sm leading-snug">{comp.title}</h3>
                        {comp.description && <p className="text-xs text-muted leading-relaxed line-clamp-3">{comp.description}</p>}
                        <div className="space-y-1.5 text-xs">
                          {comp.deadline && (() => {
                            const dl = getDeadlineInfo(comp.deadline);
                            return (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {dl.bg !== 'transparent' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-semibold"
                                    style={{ background: dl.bg, color: dl.color, border: `1px solid ${dl.color}22` }}>
                                    {dl.icon} {dl.isExpired ? 'Sona erdi: ' : 'Son başvuru: '}{dl.label}
                                    {dl.isUrgent && !dl.isExpired && (
                                      <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[9px] font-bold animate-pulse"
                                        style={{ background: dl.color }}>!</span>
                                    )}
                                  </span>
                                ) : (
                                  <p><span className="text-muted">⏰ Son Başvuru: </span><span className="font-semibold text-navy">{comp.deadline}</span></p>
                                )}
                              </div>
                            );
                          })()}
                          {comp.budget && <p><span className="text-muted">💰 Destek: </span><span className="font-semibold text-navy">{comp.budget}</span></p>}
                          {comp.category && <p className="text-muted">{CATEGORY_LABELS[comp.category] || comp.category}</p>}
                        </div>
                        <div className="flex gap-2 mt-auto pt-2 border-t" style={{ borderColor: '#f0ede8' }}>
                          {comp.applyUrl && (
                            <a href={comp.applyUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs flex-1 text-center">Başvur / İncele ↗</a>
                          )}
                          {isAdmin && (
                            <>
                              <button onClick={() => openEdit(comp)} className="btn-secondary text-xs px-3">✏️</button>
                              <button onClick={async () => { if (!confirm('Silinsin mi?')) return; await api.delete(`/competitions/${comp.id}`); toast.success('Silindi'); load(page); }} className="btn-danger text-xs px-3">🗑️</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted">{total} duyurudan {(page-1)*12+1}–{Math.min(page*12, total)} gösteriliyor</span>
                    <div className="flex gap-2">
                      <button disabled={page <= 1} onClick={() => load(page-1)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">← Önceki</button>
                      <span className="btn-ghost text-xs px-3 py-1.5">{page}/{totalPages}</span>
                      <button disabled={page >= totalPages} onClick={() => load(page+1)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Sonraki →</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Kaynak Modal */}
      {sourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSourceModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ border: '1px solid #e8e4dc' }} onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex justify-between" style={{ borderColor: '#e8e4dc' }}>
              <h2 className="font-display font-semibold text-navy">{editSource ? 'Kaynağı Düzenle' : 'Yeni Kaynak Ekle'}</h2>
              <button onClick={() => setSourceModal(false)} className="text-muted">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Kaynak Adı *</label><input className="input" value={sourceForm.name} onChange={e => sf('name', e.target.value)} placeholder="TÜBİTAK, KOSGEB..." /></div>
              <div>
                <label className="label">RSS Feed URL *</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={sourceForm.url} onChange={e => { sf('url', e.target.value); setTestResult(null); }} placeholder="https://..." />
                  <button onClick={handleTestSource} disabled={testing} className="btn-secondary text-xs px-3 flex-shrink-0">
                    {testing ? <span className="spinner w-3.5 h-3.5" /> : '🧪 Test'}
                  </button>
                </div>
                {testResult && (
                  <div className="mt-2 p-3 rounded-xl text-xs" style={{ background: testResult.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testResult.ok ? '#86efac' : '#fca5a5'}` }}>
                    {testResult.ok ? (
                      <>
                        <p className="font-semibold text-green-700">✅ Bağlantı başarılı — {testResult.count} duyuru bulundu</p>
                        {testResult.preview?.map((t: string, i: number) => <p key={i} className="text-green-600 mt-1 truncate">• {t}</p>)}
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-red-700">❌ Bağlantı başarısız</p>
                        {testResult.preview?.map((t: string, i: number) => <p key={i} className="text-red-600 mt-1">{t}</p>)}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div><label className="label">Açıklama</label><input className="input" value={sourceForm.description} onChange={e => sf('description', e.target.value)} placeholder="Kısa açıklama" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Varsayılan Kategori</label>
                  <select className="input" value={sourceForm.defaultCategory} onChange={e => sf('defaultCategory', e.target.value)}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Renk</label>
                  <div className="flex gap-2">
                    <input type="color" className="h-10 w-12 rounded cursor-pointer border" style={{ borderColor: '#e8e4dc' }} value={sourceForm.color} onChange={e => sf('color', e.target.value)} />
                    <input className="input flex-1" value={sourceForm.color} onChange={e => sf('color', e.target.value)} />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sourceForm.isActive} onChange={e => sf('isActive', e.target.checked)} className="w-4 h-4" />
                <span className="text-sm text-navy">Aktif (tarama yapılsın)</span>
              </label>
            </div>
            <div className="p-5 border-t flex gap-3" style={{ borderColor: '#e8e4dc' }}>
              <button onClick={handleSaveSource} disabled={savingSource} className="btn-primary flex-1">{savingSource ? 'Kaydediliyor...' : editSource ? 'Güncelle' : 'Ekle'}</button>
              <button onClick={() => setSourceModal(false)} className="btn-secondary">İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Duyuru Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ border: '1px solid #e8e4dc' }} onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex justify-between" style={{ borderColor: '#e8e4dc' }}>
              <h2 className="font-display font-semibold text-navy">{editItem ? 'Duyuru Düzenle' : 'Yeni Duyuru Ekle'}</h2>
              <button onClick={() => setShowModal(false)} className="text-muted">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Başlık *</label><input className="input" value={form.title} onChange={e => f('title', e.target.value)} /></div>
              <div><label className="label">Açıklama</label><textarea className="input" rows={3} value={form.description} onChange={e => f('description', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Kaynak Adı</label><input className="input" value={form.source} onChange={e => f('source', e.target.value)} placeholder="TÜBİTAK, KOSGEB..." /></div>
                <div><label className="label">Kategori</label>
                  <select className="input" value={form.category} onChange={e => f('category', e.target.value)}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Durum</label>
                  <select className="input" value={form.status} onChange={e => f('status', e.target.value)}>
                    <option value="active">Aktif</option>
                    <option value="upcoming">Yakında</option>
                    <option value="expired">Sona Erdi</option>
                  </select>
                </div>
                <div><label className="label">Son Başvuru</label><input className="input" value={form.deadline} onChange={e => f('deadline', e.target.value)} placeholder="15 Mayıs 2025" /></div>
              </div>
              <div><label className="label">Destek Miktarı</label><input className="input" value={form.budget} onChange={e => f('budget', e.target.value)} placeholder="500.000 ₺'ye kadar" /></div>
              <div><label className="label">Başvuru Linki</label><input className="input" value={form.applyUrl} onChange={e => f('applyUrl', e.target.value)} placeholder="https://..." /></div>
            </div>
            <div className="p-5 border-t flex gap-3" style={{ borderColor: '#e8e4dc' }}>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Kaydediliyor...' : editItem ? 'Güncelle' : 'Ekle'}</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary">İptal</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
