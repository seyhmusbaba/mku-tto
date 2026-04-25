import { Injectable, Logger } from '@nestjs/common';
import { HttpCache, RateLimiter } from './http-cache';

/**
 * DergiPark - Türkiye'nin en büyük akademik dergi platformu.
 * OAI-PMH protokolüyle metadata hasat edilebilir (endüstri standardı).
 *
 * Docs: https://dergipark.org.tr/help/api
 * OAI-PMH base: https://dergipark.org.tr/oai
 *
 * Ücretsiz, anahtarsız, rate-limit nazik.
 *
 * Kullanım alanları:
 *  - Bir DergiPark ID ile Türk dergilerde yayınlanan makaleleri çekmek
 *  - Türkçe yayın izleme (Scopus/WoS dışı, TR Dizin entegrasyonu yerine)
 *  - Dergi metadata'sı
 */

export interface DergiparkRecord {
  identifier: string;         // OAI identifier
  title: string;
  authors: string[];
  abstract?: string;
  publisher?: string;         // Dergi adı
  year?: number;
  doi?: string;
  language?: string;
  subjects?: string[];
  url?: string;
}

@Injectable()
export class DergiparkService {
  private readonly logger = new Logger(DergiparkService.name);
  private readonly cache = new HttpCache('dergipark');
  private readonly limiter = new RateLimiter(2, 1000); // 2/s - nazikçe

  isConfigured(): boolean {
    return process.env.DERGIPARK_DISABLED !== 'true';
  }

  /**
   * Bir ORCID veya yazar adıyla DergiPark kayıtlarını getir.
   * Not: OAI-PMH başlı başına yazar bazlı filtre desteklemez - indirip filtre uyguluyoruz.
   * Pratikte DergiPark'ın JSON arama endpoint'i daha hızlı.
   */
  async searchByAuthor(authorName: string, limit = 20): Promise<DergiparkRecord[]> {
    if (!this.isConfigured() || !authorName) return [];
    const cacheKey = `author:${authorName.toLowerCase()}:${limit}`;
    const cached = this.cache.get<DergiparkRecord[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      // DergiPark'ın genel arama endpoint'i (HTML, ama JSON-LD embed var)
      // OAI-PMH yerine arama için JSON arama endpoint'ini kullanıyoruz
      const url = `https://dergipark.org.tr/api/search?q=${encodeURIComponent(authorName)}&type=article&limit=${limit}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'mku-tto/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        this.cache.set(cacheKey, [], 60 * 60); // negatif cache
        return [];
      }
      const data = await res.json().catch(() => ({}));
      const items = this.parseSearchResults(data);
      this.cache.set(cacheKey, items, 60 * 60 * 6); // 6 saat
      return items;
    } catch (e: any) {
      this.logger.warn(`DergiPark search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * OAI-PMH ile bir dergiyi (setSpec) aylık artımlı hasat et.
   * DergiPark her dergi için `journal:<id>` setSpec'i sağlar.
   */
  async harvestJournal(journalSetSpec: string, fromDate?: string): Promise<DergiparkRecord[]> {
    if (!this.isConfigured() || !journalSetSpec) return [];
    const cacheKey = `harvest:${journalSetSpec}:${fromDate || 'all'}`;
    const cached = this.cache.get<DergiparkRecord[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const params = new URLSearchParams({
        verb: 'ListRecords',
        metadataPrefix: 'oai_dc',
        set: journalSetSpec,
      });
      if (fromDate) params.set('from', fromDate);
      const url = `https://dergipark.org.tr/oai?${params}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/xml' }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) return [];
      const xml = await res.text();
      const items = this.parseOaiDc(xml);
      this.cache.set(cacheKey, items, 60 * 60 * 24); // 24 saat
      return items;
    } catch (e: any) {
      this.logger.warn(`DergiPark OAI-PMH harvest failed: ${e.message}`);
      return [];
    }
  }

  // ── Parsers ─────────────────────────────────────────────────────────

  private parseSearchResults(data: any): DergiparkRecord[] {
    const results = data?.results || data?.items || data?.articles || [];
    return (Array.isArray(results) ? results : []).map((r: any) => ({
      identifier: r.id || r.identifier || String(r.articleId || ''),
      title: r.title || '',
      authors: this.asArray(r.authors || r.authorList || []),
      abstract: r.abstract,
      publisher: r.journal || r.journalTitle,
      year: r.year || (r.publishDate ? new Date(r.publishDate).getFullYear() : undefined),
      doi: r.doi,
      language: r.language,
      subjects: this.asArray(r.keywords || r.subjects),
      url: r.url || (r.id ? `https://dergipark.org.tr/tr/pub/.../${r.id}` : undefined),
    })).filter((r: any) => r.title);
  }

  private parseOaiDc(xml: string): DergiparkRecord[] {
    // Basit XML parse - `<record>...</record>` bloklarını yakala
    const records: DergiparkRecord[] = [];
    const recordPattern = /<record>[\s\S]*?<\/record>/g;
    const recordMatches = xml.match(recordPattern) || [];
    for (const rec of recordMatches) {
      const identifier = this.extractTag(rec, 'identifier');
      const title = this.extractTag(rec, 'dc:title') || this.extractTag(rec, 'title');
      if (!title) continue;

      records.push({
        identifier: identifier || '',
        title,
        authors: this.extractAllTags(rec, 'dc:creator').concat(this.extractAllTags(rec, 'creator')),
        abstract: this.extractTag(rec, 'dc:description') || this.extractTag(rec, 'description'),
        publisher: this.extractTag(rec, 'dc:publisher') || this.extractTag(rec, 'publisher'),
        year: (() => {
          const d = this.extractTag(rec, 'dc:date') || this.extractTag(rec, 'date');
          const y = d?.match(/\d{4}/)?.[0];
          return y ? parseInt(y) : undefined;
        })(),
        doi: (() => {
          const ids = this.extractAllTags(rec, 'dc:identifier').concat(this.extractAllTags(rec, 'identifier'));
          const doi = ids.find(i => i.toLowerCase().includes('doi.org/') || /^10\./.test(i));
          return doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
        })(),
        language: this.extractTag(rec, 'dc:language') || this.extractTag(rec, 'language'),
        subjects: this.extractAllTags(rec, 'dc:subject').concat(this.extractAllTags(rec, 'subject')),
        url: (() => {
          const ids = this.extractAllTags(rec, 'dc:identifier').concat(this.extractAllTags(rec, 'identifier'));
          return ids.find(i => i.startsWith('http'));
        })(),
      });
    }
    return records;
  }

  private extractTag(xml: string, tag: string): string | undefined {
    const safeTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = xml.match(new RegExp(`<${safeTag}[^>]*>([\\s\\S]*?)<\/${safeTag}>`));
    return m?.[1]?.trim();
  }

  private extractAllTags(xml: string, tag: string): string[] {
    const safeTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`<${safeTag}[^>]*>([\\s\\S]*?)<\/${safeTag}>`, 'g');
    const results: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(xml)) !== null) {
      if (m[1].trim()) results.push(m[1].trim());
    }
    return results;
  }

  private asArray(v: any): string[] {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(x => typeof x === 'string' ? x : (x.name || x.displayName || String(x)));
    return [String(v)];
  }
}
