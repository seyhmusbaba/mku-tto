// Global settings cache - localStorage ile anlık yükleme, API ile güncelleme

export interface AppSettings {
  site_name: string;
  logo_url: string;
  favicon_url: string;
  footer_text: string;
  [key: string]: string;
}

const LS_KEY = 'tto_settings';

const DEFAULT: AppSettings = {
  site_name: 'MKÜ TTO',
  logo_url: '',
  favicon_url: '',
  footer_text: '© Hatay Mustafa Kemal Üniversitesi TTO',
};

// localStorage'dan anında oku - sayfa yenilenince flash olmaz
function readFromStorage(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT };
}

function writeToStorage(s: AppSettings) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

// İlk değer localStorage'dan - anında, senkron
let _cache: AppSettings = readFromStorage();
let _loaded = false;
let _promise: Promise<AppSettings> | null = null;
const _listeners: Array<(s: AppSettings) => void> = [];

export function getSettings(): AppSettings {
  return _cache;
}

/**
 * Bibliyometrik görünümler (h-index, yayın sayısı, atıf grafikleri) kapalı mı?
 * Admin panelden kapatılabilir. Default: açık.
 */
export function showBibliometrics(): boolean {
  const v = _cache.show_bibliometrics;
  if (v === undefined || v === null || v === '') return true;
  return String(v).toLowerCase() !== 'false';
}

export function subscribeSettings(fn: (s: AppSettings) => void): () => void {
  _listeners.push(fn);
  return () => {
    const idx = _listeners.indexOf(fn);
    if (idx > -1) _listeners.splice(idx, 1);
  };
}

export function loadSettings(force = false): Promise<AppSettings> {
  if (force) { _loaded = false; _promise = null; }
  if (_loaded) return Promise.resolve(_cache);
  if (_promise) return _promise;

  const base = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
    : 'http://localhost:3001/api';

  _promise = fetch(`${base}/settings`)
    .then(r => r.json())
    .then((data: Record<string, string>) => {
      _cache = { ...DEFAULT, ...data };
      writeToStorage(_cache); // localStorage'a yaz - sonraki açılışta anında okunur
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
