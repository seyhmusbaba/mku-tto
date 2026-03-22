'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { settingsApi } from '@/lib/api';

let _cachedSiteName = '';
let _cachedFaviconUrl = '';
let _loaded = false;

export function SiteHead() {
  const pathname = usePathname();

  useEffect(() => {
    const apply = (siteName: string, faviconUrl: string) => {
      if (siteName) document.title = `${siteName} - Proje Yönetim Sistemi`;
      if (faviconUrl) {
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = faviconUrl;
      }
    };

    if (_loaded) {
      apply(_cachedSiteName, _cachedFaviconUrl);
      return;
    }

    settingsApi.getAll().then(r => {
      const s: Record<string, string> = r.data || {};
      _cachedSiteName = s.site_name || '';
      _cachedFaviconUrl = s.favicon_url || '';
      _loaded = true;
      apply(_cachedSiteName, _cachedFaviconUrl);
    }).catch(() => {});
  }, [pathname]); // Her sayfa değişiminde title güncelle

  return null;
}
