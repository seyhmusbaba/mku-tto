'use client';

/**
 * Dark mode minimal kontrolü — localStorage + <html data-theme="dark">
 */
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tto_theme';

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {}
  // Sistem tercihi fallback
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/**
 * Uygulama root'unda ilk yüklemede çağrılmalı — saved tercihi uygula.
 * _app veya layout'ta hemen.
 */
export function initTheme() {
  applyTheme(getTheme());
}
