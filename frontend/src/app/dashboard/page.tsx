'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { dashboardApi, auditApi } from '@/lib/api';
import { PROJECT_STATUS_LABELS, formatDate, formatCurrency, getProjectTypeLabel, getProjectTypeColor } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  application: '#d97706', pending: '#d97706', active: '#059669',
  completed: '#2563eb', suspended: '#6b7280', cancelled: '#dc2626',
};

/* ─── SVG Icon set ────────────────────────────────────────── */
type IconName =
  | 'briefcase' | 'users' | 'bolt' | 'dollar' | 'printer' | 'plus'
  | 'alert' | 'clock' | 'chart' | 'activity' | 'trophy' | 'arrow-right'
  | 'folder-plus' | 'edit' | 'trash' | 'check' | 'refresh' | 'sparkles';

const ICONS: Record<IconName, string> = {
  briefcase:   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  users:       'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  bolt:        'M13 10V3L4 14h7v7l9-11h-7z',
  dollar:      'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  printer:     'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
  plus:        'M12 4v16m8-8H4',
  alert:       'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  clock:       'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  chart:       'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  activity:    'M22 12h-4l-3 9L9 3l-3 9H2',
  trophy:      'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  'arrow-right':'M17 8l4 4m0 0l-4 4m4-4H3',
  'folder-plus':'M12 10v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
  edit:        'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:       'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  check:       'M5 13l4 4L19 7',
  refresh:     'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  sparkles:    'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
};

function Icon({ name, className = 'w-4 h-4', strokeWidth = 1.8, style }: { name: IconName; className?: string; strokeWidth?: number; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[name]} />
    </svg>
  );
}

/* ─── KPI kartı ───────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon, color, href }: { label: string; value: React.ReactNode; sub?: string; icon: IconName; color: string; href?: string }) {
  const body = (
    <div className={`card-hover p-6 h-full ${href ? 'cursor-pointer group' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: color + '18', color }}>
          <Icon name={icon} className="w-5 h-5" strokeWidth={1.8} />
        </div>
        {href && (
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-muted">
            <Icon name="arrow-right" className="w-4 h-4" />
          </span>
        )}
      </div>
      <p className="font-display text-3xl font-bold text-navy mb-1 leading-tight">{value}</p>
      <p className="text-sm text-muted">{label}</p>
      {sub && <p className="text-xs font-semibold mt-1.5" style={{ color }}>{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

/* ─── Gauge ───────────────────────────────────────────────── */
function GaugeChart({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
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

/* ─── Karşılama bandı ─────────────────────────────────────── */
function WelcomeBanner({ user, scopeLabel, total, endingSoon }: { user: any; scopeLabel: string; total: number; endingSoon: number }) {
  const hour = new Date().getHours();
  const greeting = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi öğleden sonra' : 'İyi akşamlar';
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

  return (
    <div className="rounded-2xl overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg,#0f2444 0%,#1a3a6b 55%,#1a3a6b 100%)' }}>
      <div className="absolute inset-0 opacity-20"
        style={{ background: 'radial-gradient(circle at 15% 30%, #c8a45a 0%, transparent 35%), radial-gradient(circle at 90% 100%, #ffffff 0%, transparent 40%)' }} />
      <div className="relative px-8 py-6 flex items-center gap-6 flex-wrap">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ring-1 ring-white/20"
          style={{ background: 'rgba(255,255,255,0.12)' }}>
          <Icon name="sparkles" className="w-6 h-6 text-white" strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">{greeting} · {today}</p>
          <h2 className="font-display text-2xl font-bold text-white leading-tight truncate">
            {user?.firstName} {user?.lastName}
          </h2>
          <p className="text-white/60 text-sm mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{user?.role?.name}</span>
            <span className="opacity-50">·</span>
            <span>{scopeLabel}</span>
          </p>
        </div>
        <div className="flex gap-6 flex-shrink-0">
          <div className="text-right">
            <p className="text-white/60 text-xs uppercase tracking-wider">Toplam</p>
            <p className="font-display text-3xl font-bold text-white">{total}</p>
            <p className="text-white/50 text-xs">proje</p>
          </div>
          {endingSoon > 0 && (
            <div className="text-right pl-6 border-l border-white/10">
              <p className="text-white/60 text-xs uppercase tracking-wider">Süre dolan</p>
              <p className="font-display text-3xl font-bold" style={{ color: '#fbbf24' }}>{endingSoon}</p>
              <p className="text-white/50 text-xs">30 gün içinde</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Hızlı aksiyonlar ────────────────────────────────────── */
function QuickActions({ canCreateProject }: { canCreateProject: boolean }) {
  const items = [
    canCreateProject && { href: '/projects/new', icon: 'folder-plus' as IconName, label: 'Yeni Proje', color: '#1a3a6b' },
    { href: '/projects', icon: 'briefcase' as IconName, label: 'Projelerim', color: '#059669' },
    { href: '/analysis', icon: 'chart' as IconName, label: 'Analiz', color: '#7c3aed' },
    { href: '/competitions', icon: 'trophy' as IconName, label: 'Yarışmalar', color: '#c8a45a' },
  ].filter(Boolean) as any[];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {items.map((a: any) => (
        <Link key={a.label} href={a.href}
          className="flex items-center gap-3 p-4 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5"
          style={{ background: 'white', borderColor: '#e8e4dc' }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: a.color + '18', color: a.color }}>
            <Icon name={a.icon} className="w-5 h-5" />
          </span>
          <span className="text-sm font-semibold text-navy">{a.label}</span>
          <Icon name="arrow-right" className="w-4 h-4 text-muted ml-auto" />
        </Link>
      ))}
    </div>
  );
}

/* ─── Aktivite feed ───────────────────────────────────────── */
const ACTION_META: Record<string, { label: string; icon: IconName; color: string }> = {
  created:             { label: 'Proje oluşturuldu',   icon: 'sparkles',    color: '#059669' },
  updated:             { label: 'Proje güncellendi',   icon: 'edit',        color: '#1a3a6b' },
  deleted:             { label: 'Proje silindi',       icon: 'trash',       color: '#dc2626' },
  status_changed:      { label: 'Durum değişti',       icon: 'refresh',     color: '#d97706' },
  member_added:        { label: 'Üye eklendi',         icon: 'users',       color: '#059669' },
  member_removed:      { label: 'Üye çıkarıldı',       icon: 'users',       color: '#dc2626' },
  document_uploaded:   { label: 'Belge yüklendi',      icon: 'briefcase',   color: '#1a3a6b' },
  report_added:        { label: 'Rapor eklendi',       icon: 'chart',       color: '#059669' },
  partner_added:       { label: 'Ortak eklendi',       icon: 'users',       color: '#059669' },
};

function ActivityFeed({ logs }: { logs: any[] }) {
  if (!logs?.length) {
    return (
      <div className="card text-center py-10">
        <Icon name="activity" className="w-10 h-10 mx-auto text-muted" strokeWidth={1.4} />
        <p className="text-sm font-medium text-navy mt-3">Henüz aktivite yok</p>
      </div>
    );
  }
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#e8e4dc' }}>
        <h3 className="font-display text-base font-semibold text-navy inline-flex items-center gap-2">
          <Icon name="activity" className="w-4 h-4 text-navy" />
          Son Aktivite
        </h3>
      </div>
      <div className="divide-y max-h-[420px] overflow-y-auto" style={{ borderColor: '#f5f2ee' }}>
        {logs.slice(0, 10).map(log => {
          const meta = ACTION_META[log.action] || { label: log.action, icon: 'sparkles' as IconName, color: '#6b7280' };
          return (
            <Link key={log.id} href={`/projects/${log.entityId}`}
              className="flex items-start gap-3 p-4 transition-colors hover:bg-[#faf8f4]">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: meta.color + '15', color: meta.color }}>
                <Icon name={meta.icon} className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy">
                  {meta.label}
                  {log.entityTitle && <span className="text-muted font-normal"> - {log.entityTitle}</span>}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sistem'}
                  {' · '}
                  {new Date(log.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Durum dağılımı bar'ı ────────────────────────────────── */
function StatusDistribution({ items, total }: { items: Array<{ label: string; value: number; color: string }>; total: number }) {
  const visible = items.filter(i => i.value > 0);
  if (!visible.length) {
    return <div className="text-center text-sm text-muted py-8">Henüz veri yok</div>;
  }
  return (
    <div className="space-y-3.5">
      {visible.map(s => {
        const pct = total ? Math.round((s.value / total) * 100) : 0;
        return (
          <div key={s.label} className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-sm font-medium w-28 flex-shrink-0" style={{ color: s.color }}>{s.label}</span>
            <div className="flex-1 progress-bar h-2.5">
              <div className="progress-fill h-2.5" style={{ width: `${pct}%`, background: s.color }} />
            </div>
            <span className="text-sm font-bold text-navy w-6 text-right">{s.value}</span>
            <span className="text-xs text-muted w-9 text-right">%{pct}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Kişisel dashboard ──────────────────────────────────── */
function PersonalDashboard({ stats, user, auditLogs }: { stats: any; user: any; auditLogs: any[] }) {
  const total = stats.totalProjects || 0;
  const statusItems = [
    { label: 'Aktif',       value: stats.activeProjects    || 0, color: STATUS_COLORS.active },
    { label: 'Beklemede',   value: stats.pendingProjects   || 0, color: STATUS_COLORS.application },
    { label: 'Tamamlandı',  value: stats.completedProjects || 0, color: STATUS_COLORS.completed },
  ].filter(s => s.value > 0);

  const byTypeData = (stats.byType || []).map((t: any) => ({
    name: getProjectTypeLabel(t.type),
    value: +t.count,
    color: getProjectTypeColor(t.type),
  }));

  return (
    <div className="p-6 xl:p-8 space-y-6">
      <WelcomeBanner user={user} scopeLabel="Kişisel Panel" total={total} endingSoon={stats.endingSoon || 0} />

      <QuickActions canCreateProject={true} />

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiCard label="Yürütücü Olduğum" value={stats.ownedCount || 0} icon="briefcase" color="#1a3a6b" href="/projects?ownership=owned" />
        <KpiCard label="Üye Olduğum"       value={stats.memberCount || 0} icon="users"     color="#7c3aed" href="/projects?ownership=member" />
        <KpiCard label="Aktif"             value={stats.activeProjects || 0} icon="bolt" color="#059669"
          sub={total ? `%${Math.round(((stats.activeProjects||0)/total)*100)} oran` : undefined} />
        <KpiCard label="Toplam Bütçe" value={formatCurrency(stats.budget?.total)} icon="dollar" color="#c8a45a"
          sub={`Ort. ${formatCurrency(stats.budget?.avg)}`} />
      </div>

      {/* Alert: 30 gün içinde sona eren projeler */}
      {stats.endingSoon > 0 && (
        <div className="p-4 rounded-2xl flex items-center gap-3 border"
          style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#fde68a', color: '#b45309' }}>
            <Icon name="alert" className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {stats.endingSoon} aktif projenizin süresi 30 gün içinde doluyor
            </p>
            <p className="text-xs opacity-80">İlerleme raporu veya süre uzatımı için projeleri inceleyin.</p>
          </div>
          <Link href="/projects?status=active" className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: '#b45309', color: 'white' }}>
            İncele
          </Link>
        </div>
      )}

      {/* Gauge + Status */}
      {total > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-display text-base font-semibold text-navy mb-6 inline-flex items-center gap-2">
              <Icon name="chart" className="w-4 h-4 text-navy" />
              Hedef Oranları
            </h3>
            <div className="flex justify-around flex-wrap gap-4">
              <GaugeChart value={stats.completedProjects || 0} max={total} color="#059669" label="Tamamlanma" />
              <GaugeChart value={stats.activeProjects || 0}    max={total} color="#1a3a6b" label="Aktif" />
              <GaugeChart value={stats.ownedCount || 0}        max={total} color="#c8a45a" label="Yürütücülük" />
            </div>
          </div>
          <div className="card">
            <h3 className="font-display text-base font-semibold text-navy mb-5">Durum Dağılımı</h3>
            <StatusDistribution items={statusItems} total={total} />
          </div>
        </div>
      )}

      {/* Tür dağılımı */}
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

      {/* Proje listesi + Aktivite */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 card p-0 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#e8e4dc' }}>
            <h3 className="font-display text-base font-semibold text-navy">Son Projelerim</h3>
            <Link href="/projects" className="text-sm font-semibold inline-flex items-center gap-1" style={{ color: '#1a3a6b' }}>
              Tümünü Gör <Icon name="arrow-right" className="w-3 h-3" />
            </Link>
          </div>
          {(stats.recentProjects || []).length ? (
            <div className="divide-y" style={{ borderColor: '#f5f2ee' }}>
              {stats.recentProjects.map((p: any) => {
                const tc = getProjectTypeColor(p.type);
                const sc = STATUS_COLORS[p.status] || '#64748b';
                const isOwner = p.ownerId === user?.id;
                return (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#faf8f4]">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: tc + '18' }}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: tc }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-navy text-sm truncate">{p.title}</p>
                      <p className="text-xs text-muted mt-0.5">{getProjectTypeLabel(p.type)} · {formatDate(p.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isOwner && <span className="badge badge-gold text-xs">Yürütücü</span>}
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: sc + '18', color: sc }}>
                        {PROJECT_STATUS_LABELS[p.status]}
                      </span>
                      {p.budget && <span className="text-xs font-bold text-navy hidden xl:block">{formatCurrency(p.budget)}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="empty-state py-14">
              <Icon name="briefcase" className="w-10 h-10 mx-auto text-muted" strokeWidth={1.4} />
              <p className="text-sm font-medium text-navy mt-3">Henüz projeniz bulunmuyor</p>
              <p className="text-xs text-muted mt-1">Bir proje oluşturarak başlayın.</p>
              <Link href="/projects/new" className="btn-primary text-sm mt-4 inline-flex items-center gap-1.5">
                <Icon name="plus" className="w-4 h-4" />
                Yeni Proje Oluştur
              </Link>
            </div>
          )}
        </div>

        <ActivityFeed logs={auditLogs} />
      </div>
    </div>
  );
}

/* ─── Yönetici dashboard ─────────────────────────────────── */
function AdminDashboard({ stats, user, auditLogs }: { stats: any; user: any; auditLogs: any[] }) {
  const total = stats.totalProjects || 0;
  const isGlobal = stats.scope === 'global';
  const scopeLabel = stats.scope === 'faculty' ? `Fakülte · ${stats.scopeValue}`
    : stats.scope === 'department' ? `Bölüm · ${stats.scopeValue}` : 'Tüm Kurum';

  const byTypeData = (stats.byType || []).map((t: any) => ({ name: getProjectTypeLabel(t.type), value: +t.count, color: getProjectTypeColor(t.type) }));
  const byFaculty  = (stats.byFaculty || []).slice(0, 6).map((f: any) => ({ name: (f.faculty || 'Diğer').split(' ')[0], full: f.faculty, count: +f.count }));
  const byYear     = (stats.byYear || []).map((y: any) => ({ year: y.year, count: +y.count }));
  const topBudget  = stats.topBudget || [];

  const statusItems = [
    { label: 'Aktif',        value: stats.activeProjects    || 0, color: '#059669' },
    { label: 'Beklemede',    value: stats.pendingProjects   || 0, color: '#d97706' },
    { label: 'Tamamlandı',   value: stats.completedProjects || 0, color: '#2563eb' },
    { label: 'Askıya Alındı',value: stats.suspendedProjects || 0, color: '#6b7280' },
    { label: 'İptal',        value: stats.cancelledProjects || 0, color: '#dc2626' },
  ];

  return (
    <div className="p-6 xl:p-8 space-y-6">
      <WelcomeBanner user={user} scopeLabel={scopeLabel} total={total} endingSoon={stats.endingSoon || 0} />

      <QuickActions canCreateProject={true} />

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiCard label="Toplam Proje" value={total.toLocaleString('tr-TR')} icon="briefcase" color="#1a3a6b" href="/projects" />
        <KpiCard label="Aktif" value={stats.activeProjects || 0} icon="bolt" color="#059669"
          sub={total ? `%${Math.round(((stats.activeProjects||0)/total)*100)} aktif` : undefined} />
        {isGlobal ? (
          <KpiCard label="Kullanıcı" value={stats.totalUsers || 0} icon="users" color="#7c3aed" href="/users" />
        ) : (
          <KpiCard label="Tamamlandı" value={stats.completedProjects || 0} icon="check" color="#7c3aed"
            sub={total ? `%${Math.round(((stats.completedProjects||0)/total)*100)} başarı` : undefined} />
        )}
        <KpiCard label="Toplam Bütçe" value={formatCurrency(stats.budget?.total)} icon="dollar" color="#c8a45a"
          sub={`Ort. ${formatCurrency(stats.budget?.avg)}`} />
      </div>

      {/* endingSoon alert */}
      {stats.endingSoon > 0 && (
        <div className="p-4 rounded-2xl flex items-center gap-3 border"
          style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#fde68a', color: '#b45309' }}>
            <Icon name="alert" className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {stats.endingSoon} aktif proje önümüzdeki 30 gün içinde sona eriyor
            </p>
            <p className="text-xs opacity-80">Süre uzatımı veya final raporu için ilgili projeleri inceleyin.</p>
          </div>
          <Link href="/projects?status=active" className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: '#b45309', color: 'white' }}>
            Listeyi Aç
          </Link>
        </div>
      )}

      {/* Gauge + Status */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-display text-base font-semibold text-navy mb-6 inline-flex items-center gap-2">
            <Icon name="chart" className="w-4 h-4 text-navy" />
            Gerçekleşme Oranları
          </h3>
          <div className="flex justify-around flex-wrap gap-4">
            <GaugeChart value={stats.activeProjects || 0}    max={total || 1} color="#059669" label="Aktiflik" />
            <GaugeChart value={stats.completedProjects || 0} max={total || 1} color="#2563eb" label="Tamamlanma" />
            <GaugeChart value={stats.pendingProjects || 0}   max={total || 1} color="#d97706" label="Başvuru Sürecinde" />
          </div>
        </div>
        <div className="card">
          <h3 className="font-display text-base font-semibold text-navy mb-5">Durum Dağılımı</h3>
          <StatusDistribution items={statusItems} total={total} />
        </div>
      </div>

      {/* Tür donut + Fakülte bar (sadece global scope'ta fakülte barı) */}
      <div className={`grid grid-cols-1 gap-6 ${isGlobal ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
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
          ) : <div className="empty-state py-8"><p className="text-sm text-muted">Veri yok</p></div>}
        </div>

        {isGlobal && (
          <div className="card xl:col-span-2">
            <h3 className="font-display text-base font-semibold text-navy mb-5">Fakülte Bazlı</h3>
            {byFaculty.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byFaculty} barSize={30}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8e4dc', fontSize: 13 }}
                    labelFormatter={(n) => byFaculty.find((x: any) => x.name === n)?.full || n} />
                  <Bar dataKey="count" name="Proje" radius={[7, 7, 0, 0]}>
                    {byFaculty.map((_: any, i: number) => {
                      const c = ['#0f2444', '#1a3a6b', '#c8a45a', '#7c3aed', '#059669', '#0891b2'];
                      return <Cell key={i} fill={c[i % c.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state py-10"><p className="text-sm text-muted">Fakülte verisi yok</p></div>}
          </div>
        )}

        {!isGlobal && (
          <div className="card">
            <h3 className="font-display text-base font-semibold text-navy mb-5 inline-flex items-center gap-2">
              <Icon name="trophy" className="w-4 h-4 text-navy" />
              En Yüksek Bütçeli
            </h3>
            {topBudget.length ? (
              <div className="space-y-3">
                {topBudget.map((p: any, i: number) => {
                  const maxB = topBudget[0].budget;
                  const pct = maxB ? (p.budget / maxB) * 100 : 0;
                  const tc = getProjectTypeColor(p.type);
                  return (
                    <div key={p.id}>
                      <div className="flex justify-between text-sm mb-1 gap-3">
                        <Link href={`/projects/${p.id}`} className="font-semibold text-navy hover:underline truncate flex items-center gap-2">
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
            ) : <div className="empty-state py-6"><p className="text-sm text-muted">Bütçeli proje yok</p></div>}
          </div>
        )}
      </div>

      {/* Yıllık trend + En yüksek bütçe (global) */}
      {isGlobal && (
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
              <h3 className="font-display text-base font-semibold text-navy inline-flex items-center gap-2">
                <Icon name="trophy" className="w-4 h-4 text-navy" />
                En Yüksek Bütçeli
              </h3>
              <Link href="/analysis" className="text-sm font-semibold" style={{ color: '#1a3a6b' }}>Tüm Analiz →</Link>
            </div>
            {topBudget.length ? (
              <div className="space-y-3">
                {topBudget.map((p: any, i: number) => {
                  const maxB = topBudget[0].budget;
                  const pct = maxB ? (p.budget / maxB) * 100 : 0;
                  const tc = getProjectTypeColor(p.type);
                  return (
                    <div key={p.id}>
                      <div className="flex justify-between text-sm mb-1 gap-3">
                        <Link href={`/projects/${p.id}`} className="font-semibold text-navy hover:underline truncate flex items-center gap-2">
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
            ) : <div className="empty-state py-8"><p className="text-sm text-muted">Bütçeli proje yok</p></div>}
          </div>
        </div>
      )}

      {/* Son projeler tablosu + aktivite */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 card p-0 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#e8e4dc' }}>
            <h3 className="font-display text-base font-semibold text-navy">Son Eklenen Projeler</h3>
            <Link href="/projects" className="text-sm font-semibold inline-flex items-center gap-1" style={{ color: '#1a3a6b' }}>
              Tümünü Gör <Icon name="arrow-right" className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#faf8f4', borderBottom: '1px solid #e8e4dc' }}>
                  {['Proje', 'Tür', 'Durum', 'Bütçe', 'Tarih'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted px-5 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(stats.recentProjects || []).map((p: any) => {
                  const tc = getProjectTypeColor(p.type);
                  const sc = STATUS_COLORS[p.status] || '#64748b';
                  return (
                    <tr key={p.id} className="table-row-hover border-b" style={{ borderColor: '#f5f2ee' }}>
                      <td className="px-5 py-4">
                        <Link href={`/projects/${p.id}`} className="font-semibold text-navy hover:underline text-sm block">{p.title}</Link>
                        {p.owner && <p className="text-xs text-muted mt-0.5">{p.owner.firstName} {p.owner.lastName}</p>}
                      </td>
                      <td className="px-5 py-4"><span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: tc + '18', color: tc }}>{getProjectTypeLabel(p.type)}</span></td>
                      <td className="px-5 py-4"><span className="badge text-xs" style={{ background: sc + '18', color: sc, border: `1px solid ${sc}33` }}>{PROJECT_STATUS_LABELS[p.status]}</span></td>
                      <td className="px-5 py-4 text-sm font-bold text-navy">{formatCurrency(p.budget)}</td>
                      <td className="px-5 py-4 text-sm text-muted">{formatDate(p.createdAt)}</td>
                    </tr>
                  );
                })}
                {!(stats.recentProjects || []).length && (
                  <tr><td colSpan={5} className="text-center py-12 text-muted text-sm">Proje bulunamadı</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <ActivityFeed logs={auditLogs} />
      </div>
    </div>
  );
}

/* ─── ANA sayfa ──────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    dashboardApi.getStats()
      .then(r => setStats(r.data))
      .catch(e => setError(e?.response?.data?.message || 'Veriler yüklenemedi'))
      .finally(() => setLoading(false));
    auditApi.getRecent(15).then(r => setAuditLogs(r.data || [])).catch(() => setAuditLogs([]));
  }, []);

  const openPrint = () => {
    // Güvenlik: token query string'e YAZILMAZ. sessionStorage ile aktarılır.
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('tto_token');
      if (token) sessionStorage.setItem('tto_print_token', token);
    }
    window.open('/dashboard/print', '_blank');
  };

  if (loading) return (
    <DashboardLayout><Header title="Genel Bakış" />
      <div className="flex-1 flex items-center justify-center"><div className="spinner" /></div>
    </DashboardLayout>
  );

  if (error || !stats) return (
    <DashboardLayout><Header title="Genel Bakış" />
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#fee2e2', color: '#dc2626' }}>
          <Icon name="alert" className="w-7 h-7" strokeWidth={1.6} />
        </div>
        <p className="text-lg font-semibold text-navy mb-1">Dashboard yüklenemedi</p>
        <p className="text-sm text-muted max-w-md">{error || 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edip tekrar deneyin.'}</p>
        <button onClick={() => location.reload()} className="btn-primary text-sm mt-5 inline-flex items-center gap-1.5">
          <Icon name="refresh" className="w-4 h-4" />
          Yeniden Dene
        </button>
      </div>
    </DashboardLayout>
  );

  const isAdminView = stats.isPersonal !== true;

  return (
    <DashboardLayout>
      <Header
        title={isAdminView ? 'Genel Bakış' : 'Panelim'}
        subtitle={isAdminView ? 'Sistem istatistikleri ve aktiviteler' : `${user?.firstName} ${user?.lastName} · Kişisel panel`}
        actions={isAdminView && (
          <button onClick={openPrint} className="btn-secondary flex items-center gap-2 text-sm">
            <Icon name="printer" className="w-4 h-4" />
            PDF Al
          </button>
        )}
      />
      {isAdminView
        ? <AdminDashboard stats={stats} user={user} auditLogs={auditLogs} />
        : <PersonalDashboard stats={stats} user={user} auditLogs={auditLogs} />
      }
    </DashboardLayout>
  );
}
