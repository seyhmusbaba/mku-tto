'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';

/**
 * Uluslararası Fırsatlar - CORDIS AB projeleri feed'i.
 *
 * 3 sekme:
 *  - MKÜ'nün AB projeleri (kurum adıyla CORDIS'te arama)
 *  - Türkiye geneli AB projeleri (referans/trend)
 *  - Anahtar kelime ile arama (kendi projenize benzer AB projeleri)
 */

type IconName = 'globe' | 'search' | 'ext' | 'building' | 'alert' | 'money' | 'link';
const ICONS: Record<IconName, string> = {
  globe:   'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  ext:     'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
  building:'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  alert:   'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  money:   'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  link:    'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
};

function Icon({ name, className = 'w-4 h-4', strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[name]} />
    </svg>
  );
}

const FRAMEWORK_COLORS: Record<string, string> = {
  HORIZON: '#0891b2',
  H2020: '#059669',
  FP7: '#7c3aed',
};

type Tab = 'mku' | 'turkey' | 'search';

export default function OpportunitiesPage() {
  const [tab, setTab] = useState<Tab>('mku');
  const [mkuProjects, setMkuProjects] = useState<any[]>([]);
  const [trProjects, setTrProjects] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingTab, setLoadingTab] = useState<Record<Tab, boolean>>({ mku: true, turkey: false, search: false });
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    // İlk açılışta MKÜ projelerini çek
    setLoadingTab(s => ({ ...s, mku: true }));
    api.get('/integrations/cordis/organization', { params: { name: 'Mustafa Kemal University', limit: 50 } })
      .then(r => setMkuProjects(r.data || []))
      .catch(() => setMkuProjects([]))
      .finally(() => setLoadingTab(s => ({ ...s, mku: false })));
  }, []);

  const loadTurkey = () => {
    if (trProjects.length > 0) return;
    setLoadingTab(s => ({ ...s, turkey: true }));
    api.get('/integrations/cordis/country', { params: { country: 'TR', limit: 50 } })
      .then(r => setTrProjects(r.data || []))
      .catch(() => setTrProjects([]))
      .finally(() => setLoadingTab(s => ({ ...s, turkey: false })));
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const r = await api.get('/integrations/cordis/search', { params: { q: searchQuery, limit: 30 } });
      setSearchResults(r.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    if (t === 'turkey' && trProjects.length === 0) loadTurkey();
  };

  const renderProjectList = (projects: any[], emptyMsg: string) => {
    if (projects.length === 0) {
      return (
        <div className="card py-12 text-center">
          <Icon name="alert" className="w-10 h-10 mx-auto text-muted" strokeWidth={1.5} />
          <p className="text-sm text-muted mt-3">{emptyMsg}</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {projects.map((p: any) => (
          <div key={p.id} className="card p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: FRAMEWORK_COLORS[p.framework] || '#6b7280' }}>
                    {p.framework}
                  </span>
                  {p.acronym && <span className="text-xs font-bold text-navy">{p.acronym}</span>}
                  {p.status && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: p.status === 'SIGNED' ? '#d1fae5' : '#f3f4f6', color: p.status === 'SIGNED' ? '#065f46' : '#374151' }}>{p.status}</span>}
                </div>
                <h3 className="font-display font-semibold text-navy text-sm leading-snug">{p.title}</h3>
                {p.objective && (
                  <p className="text-xs text-muted mt-2 line-clamp-3 leading-relaxed">{p.objective}</p>
                )}
              </div>
              {p.url && (
                <a href={p.url} target="_blank" rel="noopener noreferrer"
                  className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 flex-shrink-0">
                  CORDIS'te Aç <Icon name="ext" className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="flex flex-wrap gap-3 mt-3 text-xs">
              {p.totalCost && (
                <span className="inline-flex items-center gap-1 text-muted">
                  <Icon name="money" className="w-3 h-3" />
                  <span>Bütçe: <strong className="text-navy">€{Number(p.totalCost).toLocaleString('tr-TR')}</strong></span>
                </span>
              )}
              {p.ecMaxContribution && (
                <span className="text-muted">AB Katkı: <strong className="text-emerald-600">€{Number(p.ecMaxContribution).toLocaleString('tr-TR')}</strong></span>
              )}
              {p.startDate && (
                <span className="text-muted">
                  {new Date(p.startDate).toLocaleDateString('tr-TR')}
                  {p.endDate && ' → ' + new Date(p.endDate).toLocaleDateString('tr-TR')}
                </span>
              )}
              {p.coordinator && (
                <span className="inline-flex items-center gap-1 text-muted">
                  <Icon name="building" className="w-3 h-3" />
                  <span>Koordinatör: <strong className="text-navy">{p.coordinator.name}</strong> ({p.coordinator.country})</span>
                </span>
              )}
            </div>

            {p.partners?.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-muted cursor-pointer hover:text-navy inline-flex items-center gap-1">
                  <Icon name="link" className="w-3 h-3" />
                  {p.partners.length} Ortak Kurum
                </summary>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {p.partners.slice(0, 20).map((pt: any, i: number) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#f0ede8', color: '#374151' }}>
                      {pt.name} <span className="opacity-50">({pt.country})</span>
                    </span>
                  ))}
                  {p.partners.length > 20 && <span className="text-[11px] text-muted">+{p.partners.length - 20} daha</span>}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    );
  };

  const tabs: Array<{ key: Tab; label: string; icon: IconName }> = [
    { key: 'mku',    label: 'MKÜ AB Projeleri',    icon: 'building' },
    { key: 'turkey', label: 'Türkiye AB Projeleri', icon: 'globe' },
    { key: 'search', label: 'Fırsat Arama',         icon: 'search' },
  ];

  return (
    <DashboardLayout>
      <Header title="Uluslararası Fırsatlar" subtitle="CORDIS - AB araştırma projeleri açık veri portalı" />
      <div className="p-6 xl:p-8 space-y-5">
        {/* Bilgilendirme */}
        <div className="p-4 rounded-2xl text-xs flex items-start gap-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
          <Icon name="globe" className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="leading-relaxed">
            <strong className="font-semibold">CORDIS nedir?</strong> Avrupa Komisyonu'nun araştırma & yenilik
            bilgi sistemi. Horizon Europe, Horizon 2020 ve FP7 programları altında fonlanan tüm projeleri
            ortak kurumları, bütçesi ve çıktılarıyla açık kaynak olarak yayınlar. Bu sayfa üç farklı
            perspektiften CORDIS verisini size getirir.
          </div>
        </div>

        {/* Sekmeler */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#f0ede8' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => switchTab(t.key)}
              className="px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
              style={{
                background: tab === t.key ? 'white' : 'transparent',
                color: tab === t.key ? '#0f2444' : '#6b7280',
                boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              <Icon name={t.icon} className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* İçerik */}
        {tab === 'mku' && (
          loadingTab.mku
            ? <div className="flex justify-center py-16"><div className="spinner" /></div>
            : renderProjectList(mkuProjects, 'MKÜ adına kayıtlı AB projesi bulunamadı. Yeni ortaklık için Türkiye AB Projeleri sekmesine bakabilirsiniz.')
        )}

        {tab === 'turkey' && (
          loadingTab.turkey
            ? <div className="flex justify-center py-16"><div className="spinner" /></div>
            : renderProjectList(trProjects, 'Türk katılımcılı AB projesi bulunamadı.')
        )}

        {tab === 'search' && (
          <div className="space-y-4">
            <div className="card p-4">
              <p className="text-xs text-muted mb-2">Anahtar kelimeyle CORDIS'te proje ara - kendi araştırma alanınızda yapılan AB projelerini keşfedin</p>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runSearch()}
                    placeholder="örn. artificial intelligence, climate, agriculture"
                    className="input pl-9"
                  />
                </div>
                <button onClick={runSearch} disabled={searchLoading || !searchQuery.trim()} className="btn-primary text-sm disabled:opacity-40">
                  {searchLoading ? <span className="spinner w-4 h-4" /> : 'Ara'}
                </button>
              </div>
            </div>
            {searchLoading ? (
              <div className="flex justify-center py-16"><div className="spinner" /></div>
            ) : searchResults.length > 0 ? (
              renderProjectList(searchResults, '')
            ) : searchQuery ? (
              <div className="card py-12 text-center text-sm text-muted">Eşleşen proje bulunamadı. Farklı anahtar kelime deneyin.</div>
            ) : (
              <div className="card py-12 text-center text-sm text-muted">
                Yukarıdan anahtar kelime girerek arama yapın.
                <div className="flex gap-2 justify-center mt-4 flex-wrap">
                  {['artificial intelligence', 'climate change', 'agriculture', 'health', 'renewable energy'].map(s => (
                    <button key={s} onClick={() => { setSearchQuery(s); setTimeout(runSearch, 100); }}
                      className="text-xs px-2.5 py-1 rounded-full hover:bg-navy hover:text-white transition-colors"
                      style={{ background: '#f0ede8' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
