'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/lib/auth-context';
import { auditApi } from '@/lib/api';

/**
 * Admin Audit Log Viewer — tüm sistem üzerindeki proje değişikliklerini
 * kronolojik olarak listeler, filtrelenebilir.
 */

const ACTION_META: Record<string, { label: string; color: string }> = {
  created:             { label: 'Oluşturuldu',         color: '#059669' },
  updated:             { label: 'Güncellendi',         color: '#1a3a6b' },
  deleted:             { label: 'Silindi',             color: '#dc2626' },
  status_changed:      { label: 'Durum Değişti',       color: '#d97706' },
  member_added:        { label: 'Üye Eklendi',         color: '#059669' },
  member_removed:      { label: 'Üye Çıkarıldı',       color: '#dc2626' },
  member_role_changed: { label: 'Üye Rolü Değişti',    color: '#7c3aed' },
  document_uploaded:   { label: 'Belge Yüklendi',      color: '#1a3a6b' },
  document_deleted:    { label: 'Belge Silindi',       color: '#dc2626' },
  report_added:        { label: 'Rapor Eklendi',       color: '#059669' },
  report_updated:      { label: 'Rapor Güncellendi',   color: '#1a3a6b' },
  report_deleted:      { label: 'Rapor Silindi',       color: '#dc2626' },
  partner_added:       { label: 'Ortak Eklendi',       color: '#059669' },
  partner_removed:     { label: 'Ortak Kaldırıldı',    color: '#dc2626' },
};

export default function AdminAuditPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');

  const isAdmin = user?.role?.name === 'Süper Admin';

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    auditApi.getRecent(500)
      .then(r => setLogs(r.data || []))
      .catch(e => setError(e?.response?.data?.message || 'Audit log yüklenemedi'))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const filtered = useMemo(() => {
    let result = logs;
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter(l =>
        l.entityTitle?.toLowerCase().includes(q) ||
        l.user?.firstName?.toLowerCase().includes(q) ||
        l.user?.lastName?.toLowerCase().includes(q)
      );
    }
    if (actionFilter) result = result.filter(l => l.action === actionFilter);
    return result;
  }, [logs, filter, actionFilter]);

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of logs) counts[l.action] = (counts[l.action] || 0) + 1;
    return counts;
  }, [logs]);

  if (user && !isAdmin) return null;

  const exportToCsv = () => {
    if (!filtered.length) return;
    const headers = ['Tarih', 'İşlem', 'Varlık', 'Başlık', 'Kullanıcı', 'Email'];
    const rows = filtered.map(l => [
      new Date(l.createdAt).toISOString(),
      ACTION_META[l.action]?.label || l.action,
      l.entityType,
      l.entityTitle || '',
      l.user ? `${l.user.firstName} ${l.user.lastName}` : 'Sistem',
      l.user?.email || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => {
      const s = String(c).replace(/"/g, '""');
      return /[;"\n]/.test(s) ? `"${s}"` : s;
    }).join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <Header title="Sistem Denetim Kaydı"
        subtitle={`${logs.length} kayıt · ${filtered.length} görüntüleniyor`}
        actions={
          <button onClick={exportToCsv} disabled={!filtered.length}
            className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-40">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV İndir
          </button>
        } />

      <div className="p-6 space-y-5">
        {/* Filtreler */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <input
              className="input flex-1 min-w-64"
              placeholder="Proje/kullanıcı adı ara..."
              value={filter} onChange={e => setFilter(e.target.value)}
            />
            <select className="input w-56" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
              <option value="">Tüm işlemler</option>
              {Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).map(([action, count]) => (
                <option key={action} value={action}>
                  {ACTION_META[action]?.label || action} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Popüler işlemler chip'leri */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([action, count]) => (
              <button key={action} onClick={() => setActionFilter(action === actionFilter ? '' : action)}
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: actionFilter === action ? (ACTION_META[action]?.color || '#0f2444') : '#f0ede8',
                  color: actionFilter === action ? 'white' : '#6b7280',
                }}>
                {ACTION_META[action]?.label || action} · {count}
              </button>
            ))}
            {(filter || actionFilter) && (
              <button onClick={() => { setFilter(''); setActionFilter(''); }}
                className="text-xs text-red-500 hover:text-red-700 ml-2">
                Filtreleri temizle
              </button>
            )}
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="card flex justify-center py-16"><div className="spinner" /></div>
        ) : error ? (
          <div className="card py-10 text-center text-sm text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="card py-16 text-center text-sm text-muted">Kayıt bulunamadı</div>
        ) : (
          <div className="card p-0 overflow-hidden">
            {filtered.map((log, i) => {
              const meta = ACTION_META[log.action] || { label: log.action, color: '#6b7280' };
              return (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3 border-b last:border-0 hover:bg-[#faf8f4] transition-colors"
                  style={{ borderColor: '#f5f2ee' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ background: meta.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                      {log.entityTitle && (
                        <Link href={log.entityType === 'project' ? `/projects/${log.entityId}` : '#'}
                          className="text-sm text-navy hover:underline font-medium truncate max-w-md">
                          {log.entityTitle}
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {log.user ? (
                        <Link href={`/users/${log.userId}`} className="hover:underline">
                          {log.user.title} {log.user.firstName} {log.user.lastName}
                        </Link>
                      ) : 'Sistem'}
                      {' · '}
                      {new Date(log.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
