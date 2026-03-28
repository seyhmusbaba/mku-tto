// Global settings cache — tüm bileşenler buradan okur, tek API çağrısı yapılır

export interface AppSettings {
  site_name: string;
  logo_url: string;
  favicon_url: string;
  footer_text: string;
  [key: string]: string;
}

const DEFAULT: AppSettings = {
  site_name: 'MKÜ TTO',
  logo_url: '',
  favicon_url: '',
  footer_text: '© Hatay Mustafa Kemal Üniversitesi TTO',
};

let _cache: AppSettings = { ...DEFAULT };
let _loaded = false;
let _promise: Promise<AppSettings> | null = null;
const _listeners: Array<(s: AppSettings) => void> = [];

export function getSettings(): AppSettings {
  return _cache;
}

export function subscribeSettings(fn: (s: AppSettings) => void): () => void {
  _listeners.push(fn);
  return () => {
    const idx = _listeners.indexOf(fn);
    if (idx > -1) _listeners.splice(idx, 1);
  };
}

export function loadSettings(): Promise<AppSettings> {
  if (_loaded) return Promise.resolve(_cache);
  if (_promise) return _promise;

  const base = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
    : 'http://localhost:3001/api';

  _promise = fetch(`${base}/settings`)
    .then(r => r.json())
    .then((data: Record<string, string>) => {
      _cache = { ...DEFAULT, ...data };
      _loaded = true;
      _listeners.forEach(fn => fn(_cache));
      return _cache;
    })
    .catch(() => {
      _loaded = true;
      return _cache;
    });

  return _promise;
}
