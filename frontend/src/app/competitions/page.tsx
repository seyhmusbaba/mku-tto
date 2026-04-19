'use client';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

/* ─── Icon helper ───────────────────────────────────── */
type CIconName =
  | 'trophy' | 'rss' | 'refresh' | 'plus' | 'x' | 'edit' | 'trash' | 'search'
  | 'clock' | 'fire' | 'bolt' | 'calendar' | 'lock' | 'alert' | 'bell' | 'check'
  | 'flask' | 'bulb' | 'rocket' | 'globe' | 'clipboard' | 'hourglass';

const C_I: Record<CIconName, string> = {
  trophy:   'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  rss:      'M5 15a6 6 0 016 6M5 9a12 12 0 0112 12M5 21a2 2 0 100-4 2 2 0 000 4z',
  refresh:  'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  plus:     'M12 4v16m8-8H4',
  x:        'M6 18L18 6M6 6l12 12',
  edit:     'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  clock:    'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  fire:     'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 7.341 18 9.5 18.998 9.5 19.657 9.343z',
  bolt:     'M13 10V3L4 14h7v7l9-11h-7z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  lock:     'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  alert:    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  bell:     'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  check:    'M5 13l4 4L19 7',
  flask:    'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  bulb:     'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  rocket:   'M13 10V3L4 14h7v7l9-11h-7z',
  globe:    'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  clipboard:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  hourglass:'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
};

function CIcon({ name, className = 'w-4 h-4', strokeWidth = 1.8 }: { name: CIconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={C_I[name]} />
    </svg>
  );
}

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

function getDeadlineInfo(deadlineStr: string): { daysLeft: number | null; isExpired: boolean; isUrgent: boolean; isSoon: boolean; label: string; color: string; bg: string; icon: CIconName } {
  const date = parseDeadline(deadlineStr);
  if (!date) return { daysLeft: null, isExpired: false, isUrgent: false, isSoon: false, label: deadlineStr, color: '#6b7280', bg: 'transparent', icon: 'clock' };
  const now = new Date();
  now.setHours(0,0,0,0);
  date.setHours(0,0,0,0);
  const diff = Math.round((date.getTime() - now.getTime()) / (1000*60*60*24));
  if (diff < 0) return { daysLeft: diff, isExpired: true, isUrgent: false, isSoon: false, label: `${Math.abs(diff)} gün önce sona erdi`, color: '#9ca3af', bg: '#f3f4f6', icon: 'lock' };
  if (diff === 0) return { daysLeft: 0, isExpired: false, isUrgent: true, isSoon: false, label: 'Bugün son gün!', color: '#dc2626', bg: '#fef2f2', icon: 'alert' };
  if (diff <= 3) return { daysLeft: diff, isExpired: false, isUrgent: true, isSoon: false, label: `${diff} gün kaldı`, color: '#dc2626', bg: '#fef2f2', icon: 'fire' };
  if (diff <= 7) return { daysLeft: diff, isExpired: false, isUrgent: false, isSoon: true, label: `${diff} gün kaldı`, color: '#d97706', bg: '#fffbeb', icon: 'bolt' };
  if (diff <= 30) return { daysLeft: diff, isExpired: false, isUrgent: false, isSoon: true, label: `${diff} gün kaldı`, color: '#059669', bg: '#f0fdf4', icon: 'calendar' };
  return { daysLeft: diff, isExpired: false, isUrgent: false, isSoon: false, label: deadlineStr, color: '#6b7280', bg: 'transparent', icon: 'clock' };
}

const CATEGORY_META: Record<string, { label: string; icon: CIconName }> = {
  'araştırma':      { label: 'Araştırma',      icon: 'flask' },
  'inovasyon':      { label: 'İnovasyon',      icon: 'bulb' },
  'girişim':        { label: 'Girişim',        icon: 'rocket' },
  'uluslararası':   { label: 'Uluslararası',   icon: 'globe' },
  'diger':          { label: 'Diğer',          icon: 'clipboard' },
};
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(Object.entries(CATEGORY_META).map(([k, v]) => [k, v.label]));
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
                <button onClick={handleFetch} disabled={fetching} className="btn-secondary text-sm inline-flex items-center gap-1.5">
                  {fetching ? <span className="spinner w-3.5 h-3.5" /> : <CIcon name="refresh" className="w-3.5 h-3.5" />}
                  {fetching ? 'Taranıyor...' : 'Kaynakları Tara'}
                </button>
                <button onClick={openAdd} className="btn-primary text-sm inline-flex items-center gap-1.5">
                  <CIcon name="plus" className="w-4 h-4" />
                  Duyuru Ekle
                </button>
              </>
            )}
            {isAdmin && tab === 'sources' && (
              <button onClick={openAddSource} className="btn-primary text-sm inline-flex items-center gap-1.5">
                <CIcon name="plus" className="w-4 h-4" />
                Kaynak Ekle
              </button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-5">
        {/* Sekmeler */}
        {isAdmin && (
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#f0ede8' }}>
            {([['list','Duyurular','trophy'], ['sources','Kaynaklar','rss']] as const).map(([k, l, ic]) => (
              <button key={k} onClick={() => setTab(k as any)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-1.5"
                style={{ background: tab === k ? 'white' : 'transparent', color: tab === k ? '#0f2444' : '#9ca3af', boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                <CIcon name={ic as CIconName} className="w-3.5 h-3.5" />
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
                <p className="text-sm font-semibold text-blue-800 mb-1 inline-flex items-center gap-1.5">
                  <CIcon name="rss" className="w-4 h-4" />
                  Kaynak Yönetimi
                </p>
                <p className="text-xs text-blue-700">RSS feed URL'lerini buraya ekleyin. Kaynaklar <strong>otomatik olarak her 6 saatte bir</strong> taranır. Yeni duyuru bulunursa tüm kullanıcılara otomatik bildirim gider. Manuel tarama için "Kaynakları Tara" butonunu kullanabilirsiniz.</p>
              </div>
              {/* Otomatik tarama bilgisi */}
              <div className="card p-4 flex items-center gap-4" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#059669' }}>
                  <CIcon name="clock" className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Otomatik Tarama Aktif</p>
                  <p className="text-xs text-green-700 mt-0.5 inline-flex items-center gap-1 flex-wrap">
                    {scheduleInfo?.interval || 'Her 6 saatte bir (00:00, 06:00, 12:00, 18:00)'} — Yeni duyuru bulununca tüm kullanıcılara
                    <CIcon name="bell" className="w-3.5 h-3.5" />
                    bildirim gider
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
                <CIcon name="rss" className="w-10 h-10 mx-auto text-muted" strokeWidth={1.4} />
                <p className="text-sm font-medium text-navy mt-3">Henüz kaynak eklenmemiş</p>
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
                      <button onClick={() => openEditSource(src)} className="btn-secondary text-xs px-3 inline-flex items-center gap-1">
                        <CIcon name="edit" className="w-3 h-3" />
                        Düzenle
                      </button>
                      <button onClick={() => handleDeleteSource(src.id)} className="btn-danger text-xs px-3 inline-flex items-center gap-1">
                        <CIcon name="trash" className="w-3 h-3" />
                        Sil
                      </button>
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
              <div className="relative flex-1 min-w-48">
                <CIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <input className="input pl-9 text-sm w-full" placeholder="Ara..."
                  value={filters.search} onChange={e => setFilters(flt => ({ ...flt, search: e.target.value }))} />
              </div>
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
                <button onClick={() => setFilters({ source: '', category: '', status: '', search: '' })}
                  className="btn-ghost text-sm inline-flex items-center gap-1">
                  <CIcon name="x" className="w-3.5 h-3.5" />
                  Temizle
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><div className="spinner" /></div>
            ) : competitions.length === 0 ? (
              <div className="empty-state py-16">
                <CIcon name="trophy" className="w-10 h-10 mx-auto text-muted" strokeWidth={1.4} />
                <p className="text-sm font-medium text-navy mt-3">Duyuru bulunamadı</p>
                {isAdmin && <p className="text-xs text-muted mt-1">"Kaynaklar" sekmesinden RSS kaynağı ekleyin, ardından "Kaynakları Tara" butonuna basın.</p>}
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
                                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold"
                                    style={{ background: dl.bg, color: dl.color, border: `1px solid ${dl.color}22` }}>
                                    <CIcon name={dl.icon} className="w-3.5 h-3.5" />
                                    {dl.isExpired ? 'Sona erdi: ' : 'Son başvuru: '}{dl.label}
                                    {dl.isUrgent && !dl.isExpired && (
                                      <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[9px] font-bold animate-pulse"
                                        style={{ background: dl.color }}>!</span>
                                    )}
                                  </span>
                                ) : (
                                  <p className="inline-flex items-center gap-1">
                                    <CIcon name="clock" className="w-3 h-3 text-muted" />
                                    <span className="text-muted">Son Başvuru:</span>
                                    <span className="font-semibold text-navy">{comp.deadline}</span>
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                          {comp.budget && (
                            <p className="inline-flex items-center gap-1">
                              <svg className="w-3 h-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-muted">Destek:</span>
                              <span className="font-semibold text-navy">{comp.budget}</span>
                            </p>
                          )}
                          {comp.category && CATEGORY_META[comp.category] && (
                            <p className="text-muted inline-flex items-center gap-1">
                              <CIcon name={CATEGORY_META[comp.category].icon} className="w-3 h-3" />
                              {CATEGORY_META[comp.category].label}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 mt-auto pt-2 border-t" style={{ borderColor: '#f0ede8' }}>
                          {comp.applyUrl && (
                            <a href={comp.applyUrl} target="_blank" rel="noopener noreferrer"
                              className="btn-primary text-xs flex-1 text-center inline-flex items-center justify-center gap-1">
                              Başvur / İncele
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                          {isAdmin && (
                            <>
                              <button onClick={() => openEdit(comp)} aria-label="Düzenle" title="Düzenle"
                                className="btn-secondary text-xs px-2.5 inline-flex items-center justify-center">
                                <CIcon name="edit" className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={async () => { if (!confirm('Silinsin mi?')) return; await api.delete(`/competitions/${comp.id}`); toast.success('Silindi'); load(page); }}
                                aria-label="Sil" title="Sil"
                                className="btn-danger text-xs px-2.5 inline-flex items-center justify-center">
                                <CIcon name="trash" className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
                    <span className="text-xs text-muted">{total} duyurudan <strong className="text-navy">{(page-1)*12+1}–{Math.min(page*12, total)}</strong> gösteriliyor</span>
                    <div className="flex gap-2">
                      <button disabled={page <= 1} onClick={() => load(page-1)}
                        className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 inline-flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Önceki
                      </button>
                      <span className="btn-ghost text-xs px-3 py-1.5 pointer-events-none">{page}/{totalPages}</span>
                      <button disabled={page >= totalPages} onClick={() => load(page+1)}
                        className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 inline-flex items-center gap-1">
                        Sonraki
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </button>
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
              <button onClick={() => setSourceModal(false)} aria-label="Kapat" className="p-1.5 rounded-lg text-muted hover:bg-slate-100 hover:text-navy">
                <CIcon name="x" className="w-4 h-4" />
              </button>
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
                        <p className="font-semibold text-green-700 inline-flex items-center gap-1.5">
                          <CIcon name="check" className="w-3.5 h-3.5" strokeWidth={2.2} />
                          Bağlantı başarılı — {testResult.count} duyuru bulundu
                        </p>
                        {testResult.preview?.map((t: string, i: number) => <p key={i} className="text-green-600 mt-1 truncate">• {t}</p>)}
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-red-700 inline-flex items-center gap-1.5">
                          <CIcon name="x" className="w-3.5 h-3.5" strokeWidth={2.2} />
                          Bağlantı başarısız
                        </p>
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
