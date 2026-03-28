'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { loadSettings, getSettings, subscribeSettings } from '@/lib/settings-store';
import { getInitials } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}
interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { href: '/dashboard', label: 'Genel Bakış', icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z' },
      { href: '/projects', label: 'Projeler', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
      { href: '/analysis', label: 'Analiz', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    ]
  },
  {
    label: 'YÖNETİM',
    items: [
      { href: '/users', label: 'Kullanıcılar', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', adminOnly: true },
      { href: '/roles', label: 'Roller & Yetkiler', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', adminOnly: true },
      { href: '/settings', label: 'Sistem Ayarları', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4', adminOnly: true },
    ]
  }
];

// Sidebar logo/isim cache — flash önlemek için module-level


export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isAdmin = user?.role?.name === 'Süper Admin';
  const [siteName, setSiteName] = useState(() => getSettings().site_name || 'MKÜ TTO');
  const [logoUrl, setLogoUrl] = useState(() => getSettings().logo_url || '');

  useEffect(() => {
    const apply = (s: any) => {
      if (s.site_name) setSiteName(s.site_name);
      if (s.logo_url !== undefined) setLogoUrl(s.logo_url);
    };
    apply(getSettings());
    loadSettings().then(apply);
    return subscribeSettings(apply);
  }, []);

  return (
    <aside className="w-64 flex flex-col h-screen sticky top-0 flex-shrink-0"
      style={{background: 'linear-gradient(180deg, #0f2444 0%, #0a1a30 100%)'}}>
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
              style={{border:'1px solid rgba(255,255,255,0.15)'}} />
          ) : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{background:'linear-gradient(135deg,#c8a45a,#e8c97a)'}}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
          )}
          <div>
            <p className="text-white font-semibold text-sm leading-none">{siteName}</p>
            <p className="text-white/40 text-xs mt-0.5">Proje Yönetim Sistemi</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map((group, gi) => {
          const visible = group.items.filter((i: NavItem) => !i.adminOnly || isAdmin);
          if (!visible.length) return null;
          return (
            <div key={gi}>
              {group.label && <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-3 mb-2">{group.label}</p>}
              <div className="space-y-0.5">
                {visible.map(item => {
                  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href} className={`sidebar-link${active ? ' active' : ''}`}>
                      <svg className="flex-shrink-0" style={{width:18,height:18}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2 : 1.5} d={item.icon} />
                      </svg>
                      {item.label}
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{background:'#c8a45a'}} />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User — avatar göster */}
      <div className="px-3 pb-4 border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{background:'rgba(255,255,255,0.05)'}}>
          <Link href={`/users/${user?.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
            {(user as any)?.avatar ? (
              <img src={(user as any).avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                style={{minWidth:32}} />
            ) : (
              <div style={{width:32,height:32,minWidth:32,background:'linear-gradient(135deg,#c8a45a,#e8c97a)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'700',fontSize:'11px'}}>
                {getInitials(user?.firstName || '', user?.lastName || '')}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-white/40 text-[10px] truncate mt-0.5">{user?.role?.name}</p>
            </div>
          </Link>
          <button onClick={logout} title="Çıkış" className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
