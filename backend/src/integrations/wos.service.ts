import { Injectable, Logger } from '@nestjs/common';
import { HttpCache, RateLimiter, fetchJson } from './http-cache';

/**
 * Web of Science — Clarivate.
 * Kurumsal üyelik gerektirir. MKÜ'nün WoS aboneliği varsa Clarivate
 * Developer Portal'dan "Web of Science Starter API" anahtarı alınır.
 * Docs: https://developer.clarivate.com/apis/wos-starter
 *
 * Yapılandırma:
 *  - WOS_API_KEY: Clarivate Developer Portal'dan alınan API anahtarı
 *  - WOS_API_BASE (opsiyonel): default https://api.clarivate.com/apis/wos-starter/v1
 *
 * Key yoksa: isConfigured() === false, tüm endpoint'ler 503 döner.
 * Sistem çökmez, panel "yapılandırılmadı" uyarısı verir.
 */

export interface WosPublication {
  uid: string;                   // WoS UT ID (örn. WOS:000123456789012)
  doi?: string;
  title: string;
  journal?: string;
  year?: number;
  authors: string[];
  citedBy?: number;              // Times Cited
  type?: string;                 // article, review, proceedings-paper...
  abstract?: string;
  keywords?: string[];
  indexedIn?: string[];          // SCI-EXPANDED, SSCI, A&HCI, ESCI
}

export interface WosAuthorProfile {
  researcherId: string;
  name?: string;
  documentCount: number;
  citedByCount: number;
  hIndex?: number;
  lastSync: string;
}

@Injectable()
export class WosService {
  private readonly logger = new Logger(WosService.name);
  private readonly cache = new HttpCache('wos');
  private readonly limiter = new RateLimiter(5, 1000); // 5 req/s — starter tier güvenli limit

  private get baseUrl(): string {
    return process.env.WOS_API_BASE || 'https://api.clarivate.com/apis/wos-starter/v1';
  }

  isConfigured(): boolean {
    return !!process.env.WOS_API_KEY;
  }

  private authHeaders(): Record<string, string> {
    return {
      'X-ApiKey': process.env.WOS_API_KEY || '',
      'Accept': 'application/json',
    };
  }

  /**
   * ResearcherID / ORCID üzerinden yazar profilini getir.
   * WoS Starter documents endpoint → ilk sayfa metadata.
   */
  async getAuthorProfile(researcherId: string): Promise<WosAuthorProfile | null> {
    if (!this.isConfigured()) return null;
    if (!researcherId) return null;

    const cacheKey = `author:${researcherId}`;
    const cached = this.cache.get<WosAuthorProfile | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      await this.limiter.acquire();
      const q = this.buildAuthorQuery(researcherId);
      const url = `${this.baseUrl}/documents?q=${encodeURIComponent(q)}&limit=1&page=1`;
      const data = await fetchJson(url, { headers: this.authHeaders(), timeoutMs: 20000 });

      const hitCount: number = data?.metadata?.total ?? 0;
      if (hitCount === 0) {
        this.cache.set(cacheKey, null, 60 * 60 * 12);
        return null;
      }

      // WoS Starter hızlı h-index vermiyor — tam doğru değeri için atıfla tara
      const hIndex = await this.computeHIndex(researcherId).catch(() => undefined);

      // Toplam atıf — ayrıca hesap gerekir
      const citedBy = await this.sumCitedBy(researcherId).catch(() => 0);

      const profile: WosAuthorProfile = {
        researcherId,
        documentCount: hitCount,
        citedByCount: citedBy,
        hIndex,
        lastSync: new Date().toISOString(),
      };
      this.cache.set(cacheKey, profile, 60 * 60 * 24); // 24 saat
      return profile;
    } catch (e: any) {
      this.logger.warn(`WoS author lookup failed: ${e.message}`);
      this.cache.set(cacheKey, null, 60 * 60);
      return null;
    }
  }

  /**
   * Yazarın yayın listesini çek (sayfalı).
   */
  async getAuthorPublications(researcherId: string, limit = 50): Promise<WosPublication[]> {
    if (!this.isConfigured()) return [];
    if (!researcherId) return [];

    const cacheKey = `pubs:${researcherId}:${limit}`;
    const cached = this.cache.get<WosPublication[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const q = this.buildAuthorQuery(researcherId);
      const url = `${this.baseUrl}/documents?q=${encodeURIComponent(q)}&limit=${Math.min(limit, 50)}&page=1&sortField=TC`;
      const data = await fetchJson(url, { headers: this.authHeaders(), timeoutMs: 25000 });

      const items: WosPublication[] = (data?.hits || []).map((h: any) => this.mapWosHit(h)).filter(Boolean);
      this.cache.set(cacheKey, items, 60 * 60 * 12);
      return items;
    } catch (e: any) {
      this.logger.warn(`WoS publications lookup failed: ${e.message}`);
      return [];
    }
  }

  /**
   * DOI'den WoS kaydı ara — Scopus ile dedupe için kullanışlı.
   */
  async getByDoi(doi: string): Promise<WosPublication | null> {
    if (!this.isConfigured() || !doi) return null;
    const cacheKey = `doi:${doi.toLowerCase()}`;
    const cached = this.cache.get<WosPublication | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      await this.limiter.acquire();
      const q = `DO=("${doi}")`;
      const url = `${this.baseUrl}/documents?q=${encodeURIComponent(q)}&limit=1&page=1`;
      const data = await fetchJson(url, { headers: this.authHeaders(), timeoutMs: 15000 });
      const hit = data?.hits?.[0];
      const pub = hit ? this.mapWosHit(hit) : null;
      this.cache.set(cacheKey, pub, 60 * 60 * 24 * 7); // 7 gün
      return pub;
    } catch (e: any) {
      this.logger.warn(`WoS DOI lookup failed: ${e.message}`);
      return null;
    }
  }

  /** Kurumsal arama — MKÜ için agrega metrikler */
  async searchByAffiliation(affiliation: string, limit = 100): Promise<{ total: number; sample: WosPublication[] }> {
    if (!this.isConfigured()) return { total: 0, sample: [] };
    try {
      await this.limiter.acquire();
      const q = `OG=("${affiliation}")`;
      const url = `${this.baseUrl}/documents?q=${encodeURIComponent(q)}&limit=${Math.min(limit, 50)}&page=1&sortField=TC`;
      const data = await fetchJson(url, { headers: this.authHeaders(), timeoutMs: 25000 });
      return {
        total: data?.metadata?.total ?? 0,
        sample: (data?.hits || []).map((h: any) => this.mapWosHit(h)).filter(Boolean),
      };
    } catch (e: any) {
      this.logger.warn(`WoS affiliation search failed: ${e.message}`);
      return { total: 0, sample: [] };
    }
  }

  // ── YARDIMCILAR ─────────────────────────────────────────────────────────

  private buildAuthorQuery(identifier: string): string {
    // ORCID (4x4 format) ise AO= kullan, aksi halde AI= (ResearcherID)
    const isOrcid = /^\d{4}-\d{4}-\d{4}-\d{3}[0-9Xx]$/.test(identifier);
    return isOrcid ? `AO=(${identifier})` : `AI=(${identifier})`;
  }

  private mapWosHit(h: any): WosPublication | null {
    if (!h) return null;
    const id = h.uid || h.UT;
    const title = h.title?.title || h.title;
    if (!id || !title) return null;

    const source = h.source || {};
    return {
      uid: id,
      doi: h.identifiers?.doi,
      title: typeof title === 'string' ? title : String(title),
      journal: source.sourceTitle || source.title,
      year: source.publishYear || (source.publishTimestamp ? new Date(source.publishTimestamp).getFullYear() : undefined),
      authors: (h.names?.authors || []).map((a: any) => a.displayName || a.fullName).filter(Boolean),
      citedBy: h.citations?.[0]?.count,
      type: h.types?.[0],
      abstract: h.abstract,
      keywords: h.keywords?.authorKeywords,
      indexedIn: h.sourceTypes,
    };
  }

  /**
   * h-index hesabı — yazarın tüm makalelerini atıf sırasıyla çek, sonra h-index çıkar.
   * WoS Starter küçük tier'da pahalı; 200 kayıt üst sınır.
   */
  private async computeHIndex(researcherId: string): Promise<number | undefined> {
    const pubs = await this.getAuthorPublications(researcherId, 200);
    const citations = pubs.map(p => p.citedBy || 0).sort((a, b) => b - a);
    let h = 0;
    for (let i = 0; i < citations.length; i++) {
      if (citations[i] >= i + 1) h = i + 1; else break;
    }
    return h;
  }

  /** Yazarın toplam atıf sayısı — getAuthorPublications üzerinden */
  private async sumCitedBy(researcherId: string): Promise<number> {
    const pubs = await this.getAuthorPublications(researcherId, 200);
    return pubs.reduce((s, p) => s + (p.citedBy || 0), 0);
  }
}
