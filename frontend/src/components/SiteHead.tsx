'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { loadSettings, getSettings, subscribeSettings } from '@/lib/settings-store';

export function SiteHead() {
  const pathname = usePathname();

  useEffect(() => {
    const apply = (s: any) => {
      if (s.site_name) document.title = `${s.site_name} - Proje Yönetim Sistemi`;
      if (s.favicon_url) {
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = s.favicon_url;
      }
    };

    // Önce cache'ten anında uygula
    apply(getSettings());
    // Sonra API'den yükle
    loadSettings().then(apply);
    // Store güncellenince tekrar uygula
    const unsub = subscribeSettings(apply);
    return unsub;
  }, [pathname]);

  return null;
}
