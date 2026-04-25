import { Injectable, Logger } from '@nestjs/common';
import { HttpCache, RateLimiter, fetchJson } from './http-cache';

/**
 * Crossref - DOI metadata ve atıf olayları.
 * Ücretsiz. Sadece User-Agent header'ında email istiyor (polite pool).
 * Docs: https://api.crossref.org
 *
 * Polite pool kuralları:
 *  - User-Agent: "mku-tto/1.0 (mailto:name@domain.com)"
 *  - Rate limit: 50 req/s tavsiye edilir, biz 20/s kullanacağız
 */

export interface CrossrefWork {
  doi: string;
  title: string;
  abstract?: string;
  type: string;              // 'journal-article' | 'book-chapter' | 'proceedings-article' | ...
  year?: number;
  month?: number;
  publisher?: string;
  journal?: string;
  issn?: string[];
  volume?: string;
  issue?: string;
  pages?: string;
  authors: Array<{ given?: string; family?: string; orcid?: string; affiliation?: string }>;
  references?: number;
  citedBy?: number;          // is-referenced-by-count
  language?: string;
  subjects?: string[];
  url?: string;
  license?: string;
  openAccess?: boolean;
  funders?: Array<{ name: string; award?: string[] }>;
}

@Injectable()
export class CrossrefService {
  private readonly logger = new Logger(CrossrefService.name);
  private readonly cache = new HttpCache('crossref');
  private readonly limiter = new RateLimiter(20, 1000); // 20 req/s
  private readonly baseUrl = 'https://api.crossref.org';

  isConfigured(): boolean {
    // Crossref anahtar gerektirmez, ancak polite pool için mailto önerilir
    return !!process.env.CROSSREF_MAILTO;
  }

  private userAgent(): string {
    const mail = process.env.CROSSREF_MAILTO || 'noreply@example.com';
    return `mku-tto/1.0 (mailto:${mail})`;
  }

  async getWorkByDoi(doi: string): Promise<CrossrefWork | null> {
    if (!doi) return null;
    const normalized = this.normalizeDoi(doi);
    const cacheKey = `doi:${normalized}`;
    const cached = this.cache.get<CrossrefWork | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      await this.limiter.acquire();
      const url = `${this.baseUrl}/works/${encodeURIComponent(normalized)}`;
      const data = await fetchJson(url, { headers: { 'User-Agent': this.userAgent() } });
      const work = this.mapWork(data?.message);
      this.cache.set(cacheKey, work, 60 * 60 * 24 * 7); // 7 gün
      return work;
    } catch (e: any) {
      this.logger.warn(`Crossref DOI lookup failed for ${normalized}: ${e.message}`);
      this.cache.set(cacheKey, null, 60 * 60); // 1 saat negatif cache
      return null;
    }
  }

  /**
   * Başlık + yazarla DOI arama. Tam eşleşme garantisi yok, en iyi eşleşmeyi döner.
   */
  async searchByTitle(title: string, author?: string, year?: number): Promise<CrossrefWork[]> {
    if (!title || title.length < 5) return [];
    const cacheKey = `search:${title.slice(0, 100)}:${author || ''}:${year || ''}`;
    const cached = this.cache.get<CrossrefWork[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const params = new URLSearchParams({
        'query.title': title,
        rows: '5',
      });
      if (author) params.set('query.author', author);
      if (year) params.set('filter', `from-pub-date:${year}-01-01,until-pub-date:${year}-12-31`);

      const url = `${this.baseUrl}/works?${params}`;
      const data = await fetchJson(url, { headers: { 'User-Agent': this.userAgent() } });
      const items = (data?.message?.items || []).map((w: any) => this.mapWork(w)).filter(Boolean) as CrossrefWork[];
      this.cache.set(cacheKey, items, 60 * 60 * 24); // 24 saat
      return items;
    } catch (e: any) {
      this.logger.warn(`Crossref search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * ORCID ID'ye göre bir yazarın yayınlarını getir.
   */
  async getWorksByOrcid(orcidId: string, limit = 100): Promise<CrossrefWork[]> {
    if (!orcidId) return [];
    const cleaned = orcidId.trim();
    const cacheKey = `orcid:${cleaned}:${limit}`;
    const cached = this.cache.get<CrossrefWork[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const params = new URLSearchParams({
        filter: `orcid:${cleaned}`,
        rows: String(Math.min(limit, 1000)),
        sort: 'published',
        order: 'desc',
      });
      const url = `${this.baseUrl}/works?${params}`;
      const data = await fetchJson(url, { headers: { 'User-Agent': this.userAgent() } });
      const items = (data?.message?.items || []).map((w: any) => this.mapWork(w)).filter(Boolean) as CrossrefWork[];
      this.cache.set(cacheKey, items, 60 * 60 * 12); // 12 saat
      return items;
    } catch (e: any) {
      this.logger.warn(`Crossref ORCID lookup failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Bir DOI için atıf olayları (haber, blog, Wikipedia atıfları).
   * Altmetric ücretsiz alternatifi.
   * Docs: https://www.eventdata.crossref.org
   */
  async getCitationEvents(doi: string): Promise<Array<{ source: string; url: string; date: string }>> {
    if (!doi) return [];
    const normalized = this.normalizeDoi(doi);
    const cacheKey = `events:${normalized}`;
    const cached = this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const url = `https://api.eventdata.crossref.org/v1/events?obj-id=${encodeURIComponent(normalized)}&rows=50`;
      const data = await fetchJson(url, { headers: { 'User-Agent': this.userAgent() } });
      const events = (data?.message?.events || []).map((e: any) => ({
        source: e.source_id || 'unknown',
        url: e.subj?.url || e.subj_id || '',
        date: e.occurred_at || '',
      }));
      this.cache.set(cacheKey, events, 60 * 60 * 24); // 24 saat
      return events;
    } catch (e: any) {
      this.logger.warn(`Crossref event data failed: ${e.message}`);
      return [];
    }
  }

  private normalizeDoi(doi: string): string {
    return doi
      .trim()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
      .replace(/^doi:/i, '')
      .toLowerCase();
  }

  private mapWork(w: any): CrossrefWork | null {
    if (!w || !w.DOI) return null;
    const title = Array.isArray(w.title) ? w.title[0] : w.title;
    if (!title) return null;

    const published = w['published-print'] || w['published-online'] || w.issued || w.created;
    const dateParts = published?.['date-parts']?.[0] || [];
    const year = dateParts[0];
    const month = dateParts[1];

    return {
      doi: w.DOI,
      title: typeof title === 'string' ? title : String(title),
      abstract: w.abstract ? String(w.abstract).replace(/<[^>]+>/g, '').trim() : undefined,
      type: w.type || 'unknown',
      year, month,
      publisher: w.publisher,
      journal: Array.isArray(w['container-title']) ? w['container-title'][0] : w['container-title'],
      issn: w.ISSN,
      volume: w.volume,
      issue: w.issue,
      pages: w.page,
      authors: (w.author || []).map((a: any) => ({
        given: a.given,
        family: a.family,
        orcid: a.ORCID ? String(a.ORCID).replace(/^https?:\/\/orcid\.org\//, '') : undefined,
        affiliation: Array.isArray(a.affiliation) && a.affiliation.length > 0 ? a.affiliation[0].name : undefined,
      })),
      references: w['references-count'],
      citedBy: w['is-referenced-by-count'],
      language: w.language,
      subjects: w.subject,
      url: w.URL,
      license: Array.isArray(w.license) && w.license.length > 0 ? w.license[0].URL : undefined,
      openAccess: this.detectOpenAccess(w),
      funders: (w.funder || []).map((f: any) => ({ name: f.name, award: f.award })),
    };
  }

  private detectOpenAccess(w: any): boolean {
    // Lisansta cc-by veya benzeri varsa açık erişim
    const licenses = w.license || [];
    return licenses.some((l: any) => {
      const url = (l.URL || '').toLowerCase();
      return url.includes('creativecommons') || url.includes('cc-by') || url.includes('cc0');
    });
  }
}
