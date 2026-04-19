import { Injectable, Logger } from '@nestjs/common';
import { HttpCache, RateLimiter, fetchJson } from './http-cache';

/**
 * Açık Erişim (OA) tespit servisi.
 * İki kaynak birleştirir:
 *  - Unpaywall: DOI bazlı, hangi makalenin ücretsiz sürümü var
 *  - DOAJ:      Dergi bazlı, hangi dergiler tam açık erişim
 *
 * Her ikisi de ücretsiz ve anahtarsızdır (Unpaywall email ister).
 */

export interface OpenAccessInfo {
  doi: string;
  isOpenAccess: boolean;
  oaStatus?: 'gold' | 'green' | 'hybrid' | 'bronze' | 'closed';   // Unpaywall terimi
  bestOaUrl?: string;
  bestOaVersion?: 'publishedVersion' | 'acceptedVersion' | 'submittedVersion';
  license?: string;
  repository?: string;
  journalIsOa?: boolean;   // DOAJ teyidi
}

export interface DoajJournalInfo {
  title: string;
  issns: string[];
  publisher?: string;
  country?: string;
  apc?: { hasApc: boolean; averageAmount?: number; currency?: string };
  license?: string[];
  subjects?: string[];
}

@Injectable()
export class OpenAccessService {
  private readonly logger = new Logger(OpenAccessService.name);
  private readonly unpaywallCache = new HttpCache('unpaywall');
  private readonly doajCache = new HttpCache('doaj');
  private readonly unpaywallLimiter = new RateLimiter(10, 1000);  // 10/s
  private readonly doajLimiter = new RateLimiter(5, 1000);         // 5/s (nazik olalım)

  isConfigured(): boolean {
    // Her iki kaynak da ücretsiz. Unpaywall email önerir ama mecbur değil.
    return true;
  }

  /**
   * Unpaywall'dan makale OA durumu.
   * Docs: https://unpaywall.org/products/api
   */
  async getOaStatusByDoi(doi: string): Promise<OpenAccessInfo | null> {
    if (!doi) return null;
    const normalized = this.normalizeDoi(doi);
    const cacheKey = normalized;
    const cached = this.unpaywallCache.get<OpenAccessInfo | null>(cacheKey);
    if (cached !== undefined) return cached;

    const email = process.env.UNPAYWALL_MAILTO || process.env.CROSSREF_MAILTO || 'noreply@example.com';
    try {
      await this.unpaywallLimiter.acquire();
      const url = `https://api.unpaywall.org/v2/${encodeURIComponent(normalized)}?email=${encodeURIComponent(email)}`;
      const data = await fetchJson(url, { timeoutMs: 10000 });

      const info: OpenAccessInfo = {
        doi: normalized,
        isOpenAccess: !!data.is_oa,
        oaStatus: data.oa_status || (data.is_oa ? 'bronze' : 'closed'),
        bestOaUrl: data.best_oa_location?.url,
        bestOaVersion: data.best_oa_location?.version,
        license: data.best_oa_location?.license,
        repository: data.best_oa_location?.host_type,
        journalIsOa: !!data.journal_is_oa,
      };
      this.unpaywallCache.set(cacheKey, info, 60 * 60 * 24 * 30); // 30 gün
      return info;
    } catch (e: any) {
      this.logger.warn(`Unpaywall lookup failed for ${normalized}: ${e.message}`);
      this.unpaywallCache.set(cacheKey, null, 60 * 60); // 1 saat negatif cache
      return null;
    }
  }

  /**
   * Dergi DOAJ'da listeli mi (tam OA dergi).
   * Docs: https://doaj.org/api/docs
   */
  async getDoajJournal(issn: string): Promise<DoajJournalInfo | null> {
    if (!issn) return null;
    const normalized = this.normalizeIssn(issn);
    const cacheKey = normalized;
    const cached = this.doajCache.get<DoajJournalInfo | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      await this.doajLimiter.acquire();
      // DOAJ'da ISSN ile arama
      const url = `https://doaj.org/api/search/journals/issn%3A${encodeURIComponent(normalized)}`;
      const data = await fetchJson(url, { timeoutMs: 10000 });

      const item = data?.results?.[0];
      if (!item) {
        this.doajCache.set(cacheKey, null, 60 * 60 * 24 * 7);
        return null;
      }
      const bj = item.bibjson || {};
      const info: DoajJournalInfo = {
        title: bj.title || '',
        issns: (bj.eissn ? [bj.eissn] : []).concat(bj.pissn ? [bj.pissn] : []),
        publisher: bj.publisher?.name,
        country: bj.publisher?.country,
        apc: bj.apc ? { hasApc: !!bj.apc.has_apc, averageAmount: bj.apc.max?.[0]?.price, currency: bj.apc.max?.[0]?.currency } : undefined,
        license: (bj.license || []).map((l: any) => l.type).filter(Boolean),
        subjects: (bj.subject || []).map((s: any) => s.term).filter(Boolean),
      };
      this.doajCache.set(cacheKey, info, 60 * 60 * 24 * 30); // 30 gün
      return info;
    } catch (e: any) {
      this.logger.warn(`DOAJ lookup failed for ${normalized}: ${e.message}`);
      this.doajCache.set(cacheKey, null, 60 * 60);
      return null;
    }
  }

  /**
   * Bir dergi DOAJ'da listeli mi — kısa teyit.
   */
  async isJournalOpenAccess(issn: string): Promise<boolean> {
    const info = await this.getDoajJournal(issn);
    return info !== null;
  }

  /**
   * Kullanıcının yayın listesindeki OA oranını hesapla.
   */
  async getOpenAccessRatio(dois: string[]): Promise<{ total: number; openAccess: number; byStatus: Record<string, number>; ratio: number }> {
    const result = { total: dois.length, openAccess: 0, byStatus: {} as Record<string, number>, ratio: 0 };
    if (dois.length === 0) return result;

    for (const doi of dois) {
      const info = await this.getOaStatusByDoi(doi);
      const status = info?.oaStatus || 'unknown';
      result.byStatus[status] = (result.byStatus[status] || 0) + 1;
      if (info?.isOpenAccess) result.openAccess++;
    }
    result.ratio = Math.round((result.openAccess / result.total) * 100);
    return result;
  }

  private normalizeDoi(doi: string): string {
    return doi
      .trim()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
      .replace(/^doi:/i, '')
      .toLowerCase();
  }

  private normalizeIssn(issn: string): string {
    const cleaned = issn.trim().replace(/[^0-9xX]/g, '').toUpperCase();
    if (cleaned.length === 8) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    return cleaned;
  }
}
