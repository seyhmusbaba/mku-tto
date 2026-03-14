'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { notificationsApi } from '@/lib/api';
import { Notification } from '@/types';
import { timeAgo, getInitials } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

interface HeaderProps { title: string; subtitle?: string; actions?: React.ReactNode; }

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const [nRes, cRes] = await Promise.all([notificationsApi.getAll(), notificationsApi.getUnreadCount()]);
      setNotifications(nRes.data);
      setUnread(cRes.data.count || 0);
    } catch {}
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => { setOpen(o => !o); if (!open) load(); };

  const markRead = async (n: Notification) => {
    if (!n.isRead) { await notificationsApi.markRead(n.id); setUnread(u => Math.max(0, u - 1)); setNotifications(ns => ns.map(x => x.id === n.id ? {...x, isRead: true as any} : x)); }
    if (n.link) { try { window.location.href = n.link; } catch {} }
  };

  const markAll = async () => { await notificationsApi.markAllRead(); setNotifications(ns => ns.map(n => ({...n, isRead: 1}))); setUnread(0); };
  const del = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); await notificationsApi.delete(id); setNotifications(ns => ns.filter(n => n.id !== id)); };

  const typeColors: Record<string, string> = { success: '#059669', info: '#1a3a6b', warning: '#d97706' };

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleOpen} className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{ background: open ? '#f0ede8' : 'transparent', border: '1.5px solid #e8e4dc' }}>
        <svg className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="#6b7280" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
            style={{ fontSize: 9, background: '#dc2626' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-navy z-50"
          style={{ border: '1px solid #e8e4dc', maxHeight: 480, overflowY: 'auto' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10"
            style={{ borderColor: '#e8e4dc' }}>
            <span className="font-display font-semibold text-navy text-sm">Bildirimler</span>
            {unread > 0 && <button onClick={markAll} className="text-xs font-medium" style={{ color: '#1a3a6b' }}>Tümünü Okundu İşaretle</button>}
          </div>
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-muted text-sm">Bildirim yok</div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#f5f2ee' }}>
              {notifications.map(n => (
                <div key={n.id} onClick={() => markRead(n)}
                  className="flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors relative group"
                  style={{ background: n.isRead ? 'transparent' : '#f8f6f2' }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: n.isRead ? 'transparent' : (typeColors[n.type] || '#1a3a6b') }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy line-clamp-1">{n.title}</p>
                    {n.message && <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-xs mt-1" style={{ color: '#b0a99a' }}>{timeAgo(n.createdAt)}</p>
                  </div>
                  <button onClick={(e) => del(n.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-red-500 flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { user } = useAuth();
  return (
    <div className="page-header sticky top-0 z-20">
      <div>
        <h1 className="font-display text-xl font-semibold text-navy">{title}</h1>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <NotificationBell />
        {/* User avatar */}
        {user && (
          <Link href={`/users/${user.id}`} className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all hover:bg-cream"
            style={{ border: '1.5px solid #e8e4dc' }}>
            {user.avatar ? (
              <img src={user.avatar} alt={user.firstName} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#0f2444,#1a3a6b)' }}>
                {getInitials(user.firstName, user.lastName)}
              </div>
            )}
            <span className="text-xs font-semibold text-navy hidden sm:block">{user.firstName}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
