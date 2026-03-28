'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { dashboardApi } from '@/lib/api';
import { PROJECT_STATUS_LABELS, formatDate, formatCurrency, getProjectTypeLabel, getProjectTypeColor } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

const STATUS_COLORS: Record<string, string> = { pending: '#d97706', active: '#059669', completed: '#2563eb', suspended: '#6b7280', cancelled: '#dc2626' };

function KpiCard({ label, value, sub, icon, color }: any) {
  return (
    <div className="card-hover p-6">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: color + '18' }}>
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <p className="font-display text-3xl font-bold text-navy mb-1">{value}</p>
      <p className="text-sm text-muted">{label}</p>
      {sub && <p className="text-xs font-semibold mt-1.5" style={{ color }}>{sub}</p>}
    </div>
  );
}

function GaugeChart({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const r = 52, cx = 64, cy = 64;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ * 0.75;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-28">
        <svg viewBox="0 0 128 100" className="w-full h-full">
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`} fill="none" stroke="#f0ede8" strokeWidth="10" strokeLinecap="round" />
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center mt-4">
          <span className="font-display text-2xl font-bold text-navy">%{pct}</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-navy mt-1">{label}</p>
      <p className="text-xs text-muted">{value} / {max}</p>
    </div>
  );
}

// ─── KİŞİSEL dashboard (normal kullanıcı) ────────────────────────────────────
function PersonalDashboard({ stats, user }: { stats: any; user: any }) {
  const total = stats.totalProjects || 0;

  const byStatusData = (stats.byStatus || []).map((s: any) => ({
    name: PROJECT_STATUS_LABELS[s.status] || s.status,
    value: +s.count,
    color: STATUS_COLORS[s.status] || '#64748b',
  }));

  const byTypeData = (stats.byType || []).map((t: any) => ({
    name: getProjectTypeLabel(t.type),
    value: +t.count,
    color: getProjectTypeColor(t.type),
  }));

  return (
    <div className="p-8 space-y-8">
      {/* Hoşgeldin bandı */}
      <div className="rounded-2xl px-8 py-6 flex items-center gap-6" style={{ background: 'linear-gradient(120deg,#0f2444,#1a3a6b)', border: '1px solid #1a3a6b' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <p className="text-white/60 text-sm font-semibold uppercase tracking-widest mb-0.5">Hoş geldiniz</p>
          <h2 className="font-display text-2xl font-bold text-white">{user?.firstName} {user?.lastName}</h2>
          <p className="text-white/50 text-sm mt-0.5">{user?.role?.name} · {user?.email}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-white/60 text-xs uppercase tracking-wider">Toplam proje</p>
          <p className="font-display text-4xl font-bold text-white">{total}</p>
        </div>
      </div>

      {/* KPI kartları */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiCard label="Yürütücü Olduğum" value={stats.ownedCount || 0} color="#1a3a6b"
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        <KpiCard label="Üye Olduğum" value={stats.memberCount || 0} color="#7c3aed"
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
        <KpiCard label="Aktif" value={stats.activeProjects || 0} color="#059669" sub={total ? `%${Math.round(((stats.activeProjects||0)/total)*100)} oran` : undefined}
          icon="M13 10V3L4 14h7v7l9-11h-7z" />
        <KpiCard label="Toplam Bütçe" value={formatCurrency(stats.budget?.total)} color="#c8a45a" sub={`Ort. ${formatCurrency(stats.budget?.avg)}`}
          icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </div>

      {/* Gauge + Durum dağılımı */}
      {total > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-display text-base font-semibold text-navy mb-6">Proje Hedef Oranları</h3>
            <div className="flex justify-around flex-wrap gap-4">
              <GaugeChart value={stats.completedProjects || 0} max={total} color="#059669" label="Tamamlanma" />
              <GaugeChart value={stats.activeProjects || 0} max={total} color="#1a3a6b" label="Aktif Oran" />
              <GaugeChart value={stats.ownedCount || 0} max={total} color="#c8a45a" label="Yürütücülük" />
            </div>
          </div>
          <div className="card">
            <h3 className="font-display text-base font-semibold text-navy mb-5">Durum Dağılımı</h3>
            <div className="space-y-3.5">
              {byStatusData.map((s: any) => {
                const pct = total ? Math.round((s.value / total) * 100) : 0;
                return (
                  <div key={s.name} className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-sm font-medium w-28 flex-shrink-0" style={{ color: s.color }}>{s.name}</span>
                    <div className="flex-1 progress-bar h-2.5">
                      <div className="progress-fill h-2.5" style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                    <span className="text-sm font-bold text-navy w-6 text-right">{s.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tür dağılımı (varsa) */}
      {byTypeData.length > 0 && (
        <div className="card">
          <h3 className="font-display text-base font-semibold text-navy mb-5">Proje Türlerim</h3>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {byTypeData.map((t: any) => (
              <div key={t.name} className="p-4 rounded-xl text-center" style={{ background: t.color + '10', border: `1px solid ${t.color}28` }}>
                <p className="font-display text-3xl font-bold" style={{ color: t.color }}>{t.value}</p>
                <p className="text-sm text-muted mt-1">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proje listesi */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#e8e4dc' }}>
          <h3 className="font-display text-base font-semibold text-navy">Projelerim</h3>
          <Link href="/projects" className="text-sm font-semibold" style={{ color: '#1a3a6b' }}>Tümünü Gör →</Link>
        </div>
        {(stats.recentProjects || []).length ? (
          <div className="divide-y" style={{ borderColor: '#f5f2ee' }}>
            {stats.recentProjects.map((p: any) => {
              const tc = getProjectTypeColor(p.type);
              const sc = STATUS_COLORS[p.status] || '#64748b';
              const isOwner = p.ownerId === user?.id;
              return (
                <div key={p.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-[#faf8f4]">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tc + '18' }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: tc }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/projects/${p.id}`} className="font-semibold text-navy hover:underline text-sm block truncate">{p.title}</Link>
                    <p className="text-xs text-muted mt-0.5">{getProjectTypeLabel(p.type)} · {formatDate(p.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {isOwner && <span className="badge badge-gold text-xs">Yürütücü</span>}
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: sc + '18', color: sc }}>
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                    {p.budget && <span className="text-xs font-bold text-navy hidden xl:block">{formatCurrency(p.budget)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state py-16">
            <div className="empty-state-icon">
              <svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm">Henüz projeniz bulunmuyor</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ADMİN dashboard ────────────────────────────────────────────────────────
function AdminDashboard({ stats }: { stats: any }) {
  const total = stats.totalProjects || 0;

  const byStatusData = (stats.byStatus || []).map((s: any) => ({ name: PROJECT_STATUS_LABELS[s.status] || s.status, value: +s.count, color: STATUS_COLORS[s.status] || '#64748b' }));
  const byTypeData   = (stats.byType || []).map((t: any) => ({ name: getProjectTypeLabel(t.type), value: +t.count, color: getProjectTypeColor(t.type) }));
  const byFaculty    = (stats.byFaculty || []).slice(0, 6).map((f: any) => ({ name: (f.faculty || 'Diğer').split(' ')[0], count: +f.count }));
  const byYear       = (stats.byYear || []).map((y: any) => ({ year: y.year, count: +y.count }));

  const statusBars = [
    { label: 'Aktif',      value: stats.activeProjects    || 0, color: '#059669' },
    { label: 'Beklemede',  value: stats.pendingProjects   || 0, color: '#d97706' },
    { label: 'Tamamlandı', value: stats.completedProjects || 0, color: '#2563eb' },
    { label: 'Askıya Alındı', value: stats.suspendedProjects || 0, color: '#6b7280' },
    { label: 'İptal',     value: stats.cancelledProjects  || 0, color: '#dc2626' },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiCard label="Toplam Proje" value={total.toLocaleString('tr-TR')} color="#1a3a6b"
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        <KpiCard label="Aktif Projeler" value={stats.activeProjects || 0} color="#059669"
          sub={total ? `%${Math.round(((stats.activeProjects||0)/total)*100)} aktif oran` : undefined}
          icon="M13 10V3L4 14h7v7l9-11h-7z" />
        <KpiCard label="Toplam Kullanıcı" value={stats.totalUsers || 0} color="#7c3aed"
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
        <KpiCard label="Toplam Bütçe" value={formatCurrency(stats.budget?.total)} color="#c8a45a"
          sub={`Ort. ${formatCurrency(stats.budget?.avg)}`}
          icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </div>

      {/* Gauge + Status */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-display text-base font-semibold text-navy mb-6">Gerçekleşme Oranları</h3>
          <div className="flex justify-around flex-wrap gap-4">
            <GaugeChart value={stats.completedProjects || 0} max={total} color="#059669" label="Tamamlanma" />
            <GaugeChart value={stats.activeProjects || 0} max={total} color="#1a3a6b" label="Aktivite" />
            <GaugeChart value={stats.budget?.total || 0} max={(stats.budget?.max || 1) * 5} color="#c8a45a" label="Bütçe" />
          </div>
        </div>
        <div className="card">
          <h3 className="font-display text-base font-semibold text-navy mb-5">Durum Dağılımı</h3>
          <div className="space-y-3.5">
            {statusBars.map(s => {
              const pct = total ? Math.round((s.value / total) * 100) : 0;
              return (
                <div key={s.label} className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-sm font-medium w-28 flex-shrink-0" style={{ color: s.color }}>{s.label}</span>
                  <div className="flex-1 progress-bar h-2.5">
                    <div className="progress-fill h-2.5" style={{ width: `${pct}%`, background: s.color }} />
                  </div>
                  <span className="text-sm font-bold text-navy w-6 text-right">{s.value}</span>
                  <span className="text-xs text-muted w-9">%{pct}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts: Tür donut + Fakülte bar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-display text-base font-semibold text-navy mb-5">Tür Dağılımı</h3>
          {byTypeData.length ? (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={byTypeData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={42}
                    label={({ percent }) => percent > 0.07 ? `%${(percent * 100).toFixed(0)}` : ''} labelLine={false}>
                    {byTypeData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {byTypeData.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: t.color }} />
                      <span className="text-muted">{t.name}</span>
                    </div>
                    <span className="font-bold text-navy">{t.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="empty-state py-8"><p>Veri yok</p></div>}
        </div>

        <div className="card xl:col-span-2">
          <h3 className="font-display text-base font-semibold text-navy mb-5">Fakülte Bazlı</h3>
          {byFaculty.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byFaculty} barSize={30}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 13 }} />
                <Bar dataKey="count" name="Proje" radius={[7, 7, 0, 0]}>
                  {byFaculty.map((_: any, i: number) => {
                    const c = ['#0f2444', '#1a3a6b', '#c8a45a', '#7c3aed', '#059669', '#0891b2'];
                    return <Cell key={i} fill={c[i % c.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state py-10"><p>Fakülte verisi yok</p></div>}
        </div>
      </div>

      {/* Yıllık trend + En yüksek bütçe */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {byYear.length > 0 && (
          <div className="card">
            <h3 className="font-display text-base font-semibold text-navy mb-5">Yıllık Proje Trendi</h3>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={byYear}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1a3a6b" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#1a3a6b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 13 }} />
                <Area type="monotone" dataKey="count" name="Proje" stroke="#1a3a6b" strokeWidth={2.5}
                  fill="url(#ag)" dot={{ fill: '#c8a45a', r: 5 }} activeDot={{ r: 7, fill: '#c8a45a' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-base font-semibold text-navy">En Yüksek Bütçeli</h3>
            <Link href="/analysis" className="text-sm font-semibold" style={{ color: '#1a3a6b' }}>Tüm Analiz →</Link>
          </div>
          {(stats.recentProjects || []).filter((p: any) => p.budget).length ? (
            <div className="space-y-3">
              {[...(stats.recentProjects || [])].filter((p: any) => p.budget)
                .sort((a: any, b: any) => (b.budget || 0) - (a.budget || 0)).slice(0, 5).map((p: any, i: number) => {
                  const maxB = Math.max(...(stats.recentProjects || []).map((x: any) => x.budget || 0));
                  const pct = maxB ? ((p.budget || 0) / maxB) * 100 : 0;
                  const tc = getProjectTypeColor(p.type);
                  return (
                    <div key={p.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <Link href={`/projects/${p.id}`} className="font-semibold text-navy hover:underline truncate mr-3 flex items-center gap-2">
                          <span className="text-muted font-normal">#{i + 1}</span>{p.title}
                        </Link>
                        <span className="font-bold text-navy flex-shrink-0">{formatCurrency(p.budget)}</span>
                      </div>
                      <div className="progress-bar h-1.5">
                        <div className="progress-fill h-1.5" style={{ width: `${pct}%`, background: tc }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : <div className="empty-state py-8"><p>Bütçe verisi yok</p></div>}
        </div>
      </div>

      {/* Son projeler tablosu */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#e8e4dc' }}>
          <h3 className="font-display text-base font-semibold text-navy">Son Eklenen Projeler</h3>
          <Link href="/projects" className="text-sm font-semibold" style={{ color: '#1a3a6b' }}>Tümünü Gör →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#faf8f4', borderBottom: '1px solid #e8e4dc' }}>
                {['Proje', 'Tür', 'Durum', 'Fakülte', 'Bütçe', 'Tarih'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted px-6 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(stats.recentProjects || []).map((p: any) => {
                const tc = getProjectTypeColor(p.type);
                const sc = STATUS_COLORS[p.status] || '#64748b';
                return (
                  <tr key={p.id} className="table-row-hover border-b" style={{ borderColor: '#f5f2ee' }}>
                    <td className="px-6 py-4">
                      <Link href={`/projects/${p.id}`} className="font-semibold text-navy hover:underline text-sm">{p.title}</Link>
                      {p.owner && <p className="text-xs text-muted mt-0.5">{p.owner.firstName} {p.owner.lastName}</p>}
                    </td>
                    <td className="px-5 py-4"><span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: tc + '18', color: tc }}>{getProjectTypeLabel(p.type)}</span></td>
                    <td className="px-5 py-4"><span className="badge text-xs" style={{ background: sc + '18', color: sc, border: `1px solid ${sc}33` }}>{PROJECT_STATUS_LABELS[p.status]}</span></td>
                    <td className="px-5 py-4 text-sm text-muted">{p.faculty?.split(' ')[0] || '—'}</td>
                    <td className="px-5 py-4 text-sm font-bold text-navy">{formatCurrency(p.budget)}</td>
                    <td className="px-5 py-4 text-sm text-muted">{formatDate(p.createdAt)}</td>
                  </tr>
                );
              })}
              {!(stats.recentProjects || []).length && (
                <tr><td colSpan={6} className="text-center py-12 text-muted text-sm">Proje bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── ANA sayfa ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { dashboardApi.getStats().then(r => setStats(r.data)).finally(() => setLoading(false)); }, []);

  const isAdmin = ['Süper Admin', 'Dekan', 'Bölüm Başkanı'].includes(user?.role?.name || '');

  if (loading) return (
    <DashboardLayout><Header title="Genel Bakış" />
      <div className="flex-1 flex items-center justify-center"><div className="spinner" /></div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <Header
        title={isAdmin ? 'Genel Bakış' : 'Projelerim'}
        subtitle={isAdmin ? 'Sistem geneli istatistikler' : `${user?.firstName} ${user?.lastName} · Proje Özeti`}
        actions={isAdmin && (
          <button onClick={() => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('tto_token');
    if (token) sessionStorage.setItem('tto_print_token', token);
  }
  window.open('/dashboard/print', '_blank');
}} className="btn-secondary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PDF Al
          </button>
        )}
      />
      {stats && (isAdmin
        ? <AdminDashboard stats={stats} />
        : <PersonalDashboard stats={stats} user={user} />
      )}
    </DashboardLayout>
  );
}
