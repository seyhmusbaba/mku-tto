'use client';
import { useEffect } from 'react';
import { settingsApi } from '@/lib/api';

export function SiteHead() {
  useEffect(() => {
    settingsApi.getAll().then(r => {
      const s: Record<string, string> = r.data || {};

      if (s.site_name) document.title = `${s.site_name} - Proje Yönetim Sistemi`;

      if (s.favicon_url) {
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = s.favicon_url;
      }
    }).catch(() => {});
  }, []);

  return null;
}
