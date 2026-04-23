'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { partnersPortfolioApi } from '@/lib/api';

interface Org {
  name: string;
  projectCount: number;
  totalContractValue: number;
  totalContribution: number;
  activeContracts: number;
  projectIds: string[];
  sectors?: string[];
  tiers?: string[];
}

interface Partner {
  id: string;
  name: string;
  role: string;
  projectId: string;
  projectTitle?: string;
  contactName?: string;
  contactEmail?: string;
  sector?: string;
  tier?: string;
  contractEndDate?: string;
  isActive?: boolean;
}

export default function PartnersPortfolioPage() {
  const [tab, setTab] = useState<'orgs' | 'list' | 'expiring'>('orgs');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [expiring, setExpiring] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      partnersPortfolioApi.byOrganization().catch(() => ({ data: [] })),
      partnersPortfolioApi.list().catch(() => ({ data: [] })),
      partnersPortfolioApi.contractsExpiring().catch(() => ({ data: [] })),
    ])
      .then(([o, l, e]) => {
        setOrgs(o.data || []);
        setPartners(l.data || []);
        setExpiring(e.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = (list: any[]) => {
    const q = search.toLowerCase();
    if (!q) return list;
    return list.filter(x =>
      (x.name || '').toLowerCase().includes(q) ||
      (x.sector || '').toLowerCase().includes(q) ||
      (x.contactName || '').toLowerCase().includes(q) ||
      (x.projectTitle || '').toLowerCase().includes(q)
    );
  };

  const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(Math.round(n || 0));

  return (
    <DashboardLayout>
      <Header title="Paydaş & Partner Portföyü"
        subtitle={`${orgs.length} kuruluş · ${partners.length} partner kaydı · ${expiring.length} yaklaşan sözleşme`} />

      <div className="p-6 space-y-5">
        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { v: 'orgs', l: 'Kuruluş Bazlı', n: orgs.length },
            { v: 'list', l: 'Tüm Partnerler', n: partners.length },
            { v: 'expiring', l: 'Sözleşmesi Bitecek', n: expiring.length },
          ].map((o: any) => (
            <button key={o.v}
              onClick={() => setTab(o.v)}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: tab === o.v ? '#0f2444' : '#f0ede8',
                color: tab === o.v ? 'white' : '#6b7280',
              }}>
              {o.l} <span className="ml-1 opacity-70">({o.n})</span>
            </button>
          ))}
        </div>

        <input className="input" placeholder="Ara — kuruluş, sektör, kişi, proje..."
          value={search} onChange={e => setSearch(e.target.value)} />

        {loading ? (
          <div className="card flex justify-center py-16"><div className="spinner" /></div>
        ) : tab === 'orgs' ? (
          <div className="grid gap-3">
            {filtered(orgs).length === 0 ? (
              <div className="card py-12 text-center text-sm text-muted">Henüz partner kaydı yok</div>
            ) : filtered(orgs).map((o: Org) => (
              <div key={o.name} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-navy">{o.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted">
                      <span>📊 {o.projectCount} proje</span>
                      <span>✓ {o.activeContracts} aktif sözleşme</span>
                      {o.totalContractValue > 0 && <span>💰 {fmt(o.totalContractValue)} ₺ sözleşme değeri</span>}
                      {o.totalContribution > 0 && <span>🤝 {fmt(o.totalContribution)} ₺ katkı</span>}
                      {o.sectors?.filter(Boolean).length ? <span>🏭 {o.sectors.filter(Boolean).join(', ')}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {o.tiers?.includes('strategic') && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">⭐ Stratejik</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'list' ? (
          <div className="card p-0 overflow-hidden">
            {filtered(partners).length === 0 ? (
              <div className="py-12 text-center text-sm text-muted">Kayıt yok</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#faf8f4]">
                  <tr className="border-b" style={{ borderColor: '#f5f2ee' }}>
                    <th className="text-left px-4 py-3 font-semibold text-navy">Kuruluş</th>
                    <th className="text-left px-4 py-3 font-semibold text-navy">Sektör</th>
                    <th className="text-left px-4 py-3 font-semibold text-navy">Rol</th>
                    <th className="text-left px-4 py-3 font-semibold text-navy">Proje</th>
                    <th className="text-left px-4 py-3 font-semibold text-navy">İletişim</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered(partners).map((p: Partner) => (
                    <tr key={p.id} className="border-b hover:bg-[#faf8f4]" style={{ borderColor: '#f5f2ee' }}>
                      <td className="px-4 py-3 font-semibold">{p.name}</td>
                      <td className="px-4 py-3 text-muted">{p.sector || '—'}</td>
                      <td className="px-4 py-3 text-muted">{p.role}</td>
                      <td className="px-4 py-3">
                        <Link href={`/projects/${p.projectId}`} className="text-blue-600 hover:underline">
                          {p.projectTitle || 'Proje'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {p.contactName && <div>{p.contactName}</div>}
                        {p.contactEmail && <a className="text-blue-600 hover:underline" href={`mailto:${p.contactEmail}`}>{p.contactEmail}</a>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            {filtered(expiring).length === 0 ? (
              <div className="card py-12 text-center text-sm text-muted">30 gün içinde sözleşmesi bitecek partner yok</div>
            ) : filtered(expiring).map((p: Partner) => (
              <div key={p.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    <Link className="text-blue-600 hover:underline" href={`/projects/${p.projectId}`}>
                      {p.projectTitle || 'Proje'}
                    </Link>
                    {' · '}Sözleşme sonu: <span className="font-semibold text-red-600">{p.contractEndDate}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
