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
  async getAuthorProfile(researcherId: string, force = false): Promise<WosAuthorProfile | null> {
    if (!this.isConfigured()) return null;
    if (!researcherId) return null;

    const cacheKey = `author:${researcherId}`;
    if (!force) {
      const cached = this.cache.get<WosAuthorProfile | null>(cacheKey);
      if (cached !== undefined) return cached;
    }

    try {
      await this.limiter.acquire();
      // Birden çok query formatını dene — WoS Starter API ORCID için farklı syntaxlar
      const isOrcid = /^\d{4}-\d{4}-\d{4}-\d{3}[0-9Xx]$/.test(researcherId);
      const queryFormats = isOrcid
        ? [`AO=(${researcherId})`, `AO="${researcherId}"`, `AU_ORCID="${researcherId}"`]
        : [`AI=(${researcherId})`, `AI="${researcherId}"`, `AU_ID="${researcherId}"`];

      let hitCount = 0;
      for (const q of queryFormats) {
        const url = `${this.baseUrl}/documents?db=WOS&q=${encodeURIComponent(q)}&limit=1&page=1`;
        try {
          const data = await fetchJson(url, { headers: this.authHeaders(), timeoutMs: 20000 });
          const total = data?.metadata?.total ?? 0;
          if (total > 0) {
            hitCount = total;
            this.logger.log(`[WoS] ${researcherId}: "${q}" ile ${total} kayıt bulundu`);
            break;
          }
        } catch (e: any) {
          this.logger.log(`[WoS] "${q}" formatı fail: ${e.message}`);
        }
      }

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
      // Birden çok query formatını sırayla dene — 400 alırsan sonrakine geç
      const isOrcid = /^\d{4}-\d{4}-\d{4}-\d{3}[0-9Xx]$/.test(researcherId);
      const queryFormats = isOrcid
        ? [`AO=(${researcherId})`, `AO="${researcherId}"`, `AU_ORCID="${researcherId}"`]
        : [`AI=(${researcherId})`, `AI="${researcherId}"`, `AU_ID="${researcherId}"`];

      let data: any = null;
      let successQuery = '';
      for (const q of queryFormats) {
        const url = `${this.baseUrl}/documents?db=WOS&q=${encodeURIComponent(q)}&limit=${Math.min(limit, 50)}&page=1`;
        try {
          const attempt = await fetchJson(url, { headers: this.authHeaders(), timeoutMs: 25000 });
          if (attempt && (attempt.hits?.length > 0 || attempt.metadata?.total > 0)) {
            data = attempt;
            successQuery = q;
            this.logger.log(`[WoS] ${researcherId}: "${q}" formatı çalıştı`);
            break;
          }
        } catch (e: any) {
          // Bir sonraki formata geç
          this.logger.log(`[WoS] "${q}" denendi, sonuçsuz: ${e.message}`);
        }
      }

      if (!data) {
        this.logger.warn(`[WoS] ${researcherId}: hiçbir query formatı çalışmadı`);
        return [];
      }

      const hits = data?.hits || [];
      const items: WosPublication[] = hits.map((h: any) => this.mapWosHit(h)).filter(Boolean);

      // Debug: ilk hit'in ham yapısı — atıf field'ı neyin altında geldi?
      if (hits[0]) {
        const sample = hits[0];
        const citationKeys: string[] = [];
        if (Array.isArray(sample.citations)) citationKeys.push(`citations[${sample.citations.length}]: ${JSON.stringify(sample.citations[0] || {}).slice(0, 100)}`);
        if ('timesCited' in sample) citationKeys.push(`timesCited=${sample.timesCited}`);
        if ('tc' in sample) citationKeys.push(`tc=${sample.tc}`);
        if ('citedBy' in sample) citationKeys.push(`citedBy=${sample.citedBy}`);
        this.logger.log(`[WoS] ${researcherId}: ${hits.length} kayıt alındı. Citation alanları: ${citationKeys.join(' · ') || 'BULUNAMADI'}`);
        const totalCites = items.reduce((s, p) => s + (p.citedBy || 0), 0);
        this.logger.log(`[WoS] ${researcherId}: Toplam çıkarılan atıf: ${totalCites}`);
      }

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

  /**
   * Debug — 3 farklı query formatını dener, hepsinin response'unu döner.
   * WoS Starter API quirk'lerini çözmek için.
   */
  async debugRawResponse(identifier: string): Promise<any> {
    if (!this.isConfigured()) {
      return { configured: false, error: 'WOS_API_KEY tanımlı değil' };
    }

    const isOrcid = /^\d{4}-\d{4}-\d{4}-\d{3}[0-9Xx]$/.test(identifier);

    // 3 farklı query varyasyonu dene — hangisi çalışıyor görelim
    const attempts = isOrcid ? [
      { label: 'AO with parens',  q: `AO=(${identifier})` },
      { label: 'AO with quotes',  q: `AO="${identifier}"` },
      { label: 'AU_ORCID quoted', q: `AU_ORCID="${identifier}"` },
    ] : [
      { label: 'AI with parens',  q: `AI=(${identifier})` },
      { label: 'AI with quotes',  q: `AI="${identifier}"` },
      { label: 'AU_ID quoted',    q: `AU_ID="${identifier}"` },
    ];

    const results: any[] = [];
    for (const att of attempts) {
      const url = `${this.baseUrl}/documents?db=WOS&q=${encodeURIComponent(att.q)}&limit=3&page=1`;
      try {
        const res = await fetch(url, { headers: this.authHeaders() as any, signal: AbortSignal.timeout(15000) });
        const text = await res.text();
        let data: any;
        try { data = JSON.parse(text); } catch { data = { rawText: text.slice(0, 500) }; }

        results.push({
          label: att.label,
          query: att.q,
          url,
          statusCode: res.status,
          ok: res.ok,
          metadata: data?.metadata,
          totalHits: data?.hits?.length || 0,
          firstHitKeys: data?.hits?.[0] ? Object.keys(data.hits[0]) : [],
          firstHit: data?.hits?.[0] || null,
          errorMessage: !res.ok ? (data?.message || data?.error || data?.rawText || 'Bilinmeyen hata') : null,
        });

        // İlk başarılı olanı gördükten sonra dur
        if (res.ok && data?.hits?.length > 0) break;
      } catch (e: any) {
        results.push({ label: att.label, query: att.q, url, error: e.message });
      }
    }

    return {
      identifier,
      isOrcid,
      configured: true,
      attempts: results,
    };
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
      citedBy: this.extractCitationCount(h),
      type: h.types?.[0],
      abstract: h.abstract,
      keywords: h.keywords?.authorKeywords,
      indexedIn: h.sourceTypes,
    };
  }

  /**
   * WoS Starter API response'unda atıf sayısı birden fazla yerde olabilir:
   *  - citations: [{db: "WOS", count: N}]
   *  - citations: [{count: N}]   (db belirsiz)
   *  - timesCited / tc / citedBy  (farklı sürümler)
   *  - dynamic_data.citation_related.tc_list.silo_tc[].local_count  (WoS Lite)
   *
   * Bu metod tüm olası yolları defansif dener, ilk bulduğu number'ı döner.
   */
  private extractCitationCount(h: any): number | undefined {
    if (!h) return undefined;

    // 1. WoS Starter — citations array
    if (Array.isArray(h.citations)) {
      // WoS veritabanı öncelikli
      const wos = h.citations.find((c: any) => {
        const db = String(c?.db || c?.database || '').toLowerCase();
        return db === 'wos' || db === 'wos.cc' || db === 'webofscience';
      });
      if (wos && typeof wos.count === 'number') return wos.count;

      // Herhangi bir DB
      const first = h.citations.find((c: any) => typeof c?.count === 'number');
      if (first) return first.count;
    }

    // 2. Düz alanlar (farklı sürümlerde)
    if (typeof h.timesCited === 'number') return h.timesCited;
    if (typeof h.tc === 'number') return h.tc;
    if (typeof h.citedBy === 'number') return h.citedBy;

    // 3. WoS Lite — dynamic_data.citation_related
    const siloTc = h?.dynamic_data?.citation_related?.tc_list?.silo_tc;
    if (Array.isArray(siloTc)) {
      const entry = siloTc.find((s: any) => s?.coll_id === 'WOS') || siloTc[0];
      if (entry?.local_count != null) return +entry.local_count;
    }

    return undefined;
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
