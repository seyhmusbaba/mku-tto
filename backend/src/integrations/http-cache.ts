/**
 * Entegrasyon modülleri için ortak in-memory cache.
 * Her dış servisin rate-limit'ini korumak ve performans için kısa TTL'li cache.
 * Production'da Redis'e taşınabilir - arayüz aynı kalır.
 */

type CacheEntry<T> = { value: T; expires: number };

export class HttpCache {
  private store = new Map<string, CacheEntry<any>>();
  private readonly maxEntries = 2000;

  constructor(private readonly namespace: string = 'default') {}

  private key(k: string): string {
    return `${this.namespace}::${k}`;
  }

  get<T>(k: string): T | undefined {
    const e = this.store.get(this.key(k));
    if (!e) return undefined;
    if (e.expires < Date.now()) {
      this.store.delete(this.key(k));
      return undefined;
    }
    return e.value as T;
  }

  set<T>(k: string, value: T, ttlSeconds: number): void {
    if (this.store.size >= this.maxEntries) {
      // En eski ~200 kaydı sil
      const keys = Array.from(this.store.keys()).slice(0, 200);
      for (const key of keys) this.store.delete(key);
    }
    this.store.set(this.key(k), { value, expires: Date.now() + ttlSeconds * 1000 });
  }

  clear(prefix?: string): void {
    if (!prefix) {
      this.store.clear();
      return;
    }
    const full = this.key(prefix);
    for (const k of this.store.keys()) {
      if (k.startsWith(full)) this.store.delete(k);
    }
  }

  size(): number {
    return this.store.size;
  }
}

/**
 * Rate-limited fetch helper.
 * ExternalRateLimiter her entegrasyon için kendi rate window'unu tutar.
 */
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(private readonly maxRequests: number, private readonly windowMs: number) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxRequests) {
      const waitMs = this.windowMs - (now - this.timestamps[0]);
      await new Promise(r => setTimeout(r, Math.max(0, waitMs)));
    }
    this.timestamps.push(Date.now());
  }
}

/**
 * Basit timeout + retry içeren fetch wrapper.
 * Entegrasyonlarda tutarlı hata yönetimi için.
 */
export async function fetchJson(
  url: string,
  opts: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
  } = {},
): Promise<any> {
  const { headers = {}, timeoutMs = 15000, retries = 2, retryDelayMs = 600 } = opts;
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        // 429 veya 5xx - retry
        if ((res.status === 429 || res.status >= 500) && i < retries) {
          await new Promise(r => setTimeout(r, retryDelayMs * (i + 1)));
          continue;
        }
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
      }
      return await res.json();
    } catch (e: any) {
      lastErr = e;
      if (i < retries) await new Promise(r => setTimeout(r, retryDelayMs * (i + 1)));
    }
  }
  throw lastErr;
}
