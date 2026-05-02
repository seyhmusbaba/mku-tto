import { Injectable, Logger } from '@nestjs/common';
import { HttpCache, RateLimiter, fetchJson } from './http-cache';

/**
 * OpenAlex - OurResearch projesi, Scopus/WoS'un ücretsiz ve açık alternatifi.
 * 240M+ yayın, 90M+ yazar, 100K+ kurum indeksli.
 *
 * Docs: https://docs.openalex.org/
 * Polite pool: User-Agent'ta email koy, 100k request/gün kotayla rahat çalış.
 *
 * Neden önemli:
 *  - ARBİS/YÖKSİS gibi kapalı sistemlerin yerini büyük ölçüde doldurur
 *  - WoS/Scopus key'i olmayanlar için tek geniş bibliyometrik kaynak
 *  - Yazar, yayın, kurum ve konu seviyesinde zengin metadata
 *  - h-index, i10-index, 2-year mean citedness, FWCI gibi metrikleri hazır verir
 */

export interface OpenAlexAuthor {
  id: string;                         // https://openalex.org/A...
  orcid?: string;
  displayName: string;
  worksCount: number;
  citedByCount: number;
  hIndex?: number;
  i10Index?: number;
  lastKnownInstitution?: { id: string; displayName?: string; country?: string };
  conceptCounts?: Array<{ name: string; level: number; count: number }>;
  countsByYear?: Array<{ year: number; worksCount: number; citedByCount: number }>;
}

export interface OpenAlexInstitution {
  id: string;
  ror?: string;
  displayName: string;
  country?: string;
  type?: string;
  worksCount: number;
  citedByCount: number;
}

export interface OpenAlexWork {
  id: string;
  doi?: string;
  title: string;
  publicationYear?: number;
  publicationDate?: string;
  type?: string;
  citedBy: number;
  openAccess?: { isOa: boolean; oaStatus?: string; oaUrl?: string };
  venue?: { displayName?: string; issn?: string[]; issnL?: string; sourceId?: string; type?: string; publisher?: string };
  authors: Array<{ id?: string; displayName: string; orcid?: string; institution?: string; institutions?: string[]; countries?: string[] }>;
  concepts: Array<{ displayName: string; level: number; score: number }>;
  sdgs?: Array<{ displayName: string; id: string; score: number }>;  // UN SDG eşlemesi - AVESIS seviyesini geçer
  referencesCount?: number;
  fwci?: number;                      // field-weighted citation impact
  citedByPercentile?: { min: number; max: number };  // alan-yıl normalize yüzdelik
  countriesDistinctCount?: number;    // farklı ülke sayısı (uluslararası işbirliği göstergesi)
  institutionsDistinctCount?: number;
}

@Injectable()
export class OpenAlexService {
  private readonly logger = new Logger(OpenAlexService.name);
  private readonly cache = new HttpCache('openalex');
  private readonly limiter = new RateLimiter(10, 1000); // 10/s polite
  private readonly baseUrl = 'https://api.openalex.org';

  isConfigured(): boolean {
    // OpenAlex ücretsiz, herkes kullanabilir. Email önerilir.
    return true;
  }

  private userAgent(): string {
    const mail = process.env.OPENALEX_MAILTO || process.env.CROSSREF_MAILTO || 'noreply@example.com';
    return `mku-tto/1.0 (mailto:${mail})`;
  }

  // ── AUTHOR ──────────────────────────────────────────────────────────

  async getAuthorByOrcid(orcidId: string): Promise<OpenAlexAuthor | null> {
    if (!orcidId) return null;
    const cacheKey = `author:orcid:${orcidId}`;
    const cached = this.cache.get<OpenAlexAuthor | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      await this.limiter.acquire();
      const url = `${this.baseUrl}/authors/orcid:${encodeURIComponent(orcidId)}`;
      const data = await fetchJson(url, { headers: { 'User-Agent': this.userAgent() } });
      const mapped = this.mapAuthor(data);
      this.cache.set(cacheKey, mapped, 60 * 60 * 24); // 24 saat
      return mapped;
    } catch (e: any) {
      this.logger.warn(`OpenAlex author lookup failed: ${e.message}`);
      this.cache.set(cacheKey, null, 60 * 60);
      return null;
    }
  }

  async searchAuthorByName(name: string, affiliation?: string, limit = 10): Promise<OpenAlexAuthor[]> {
    if (!name) return [];
    const cacheKey = `author:search:${name.toLowerCase()}:${affiliation || ''}:${limit}`;
    const cached = this.cache.get<OpenAlexAuthor[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const params = new URLSearchParams({
        search: name,
        'per-page': String(Math.min(limit, 25)),
      });
      if (affiliation) {
        params.set('filter', `last_known_institutions.display_name.search:${affiliation}`);
      }
      const url = `${this.baseUrl}/authors?${params}`;
      const data = await fetchJson(url, { headers: { 'User-Agent': this.userAgent() } });
      const items = (data?.results || []).map((a: any) => this.mapAuthor(a)).filter(Boolean) as OpenAlexAuthor[];
      this.cache.set(cacheKey, items, 60 * 60 * 12);
      return items;
    } catch (e: any) {
      this.logger.warn(`OpenAlex author search failed: ${e.message}`);
      return [];
    }
  }

  async getAuthorWorks(authorId: string, limit = 100): Promise<OpenAlexWork[]> {
    if (!authorId) return [];
    const cleanId = authorId.replace(/^https?:\/\/openalex\.org\//, '');
    const cacheKey = `works:${cleanId}:${limit}`;
    const cached = this.cache.get<OpenAlexWork[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const params = new URLSearchParams({
        filter: `author.id:${cleanId}`,
        'per-page': String(Math.min(limit, 200)),
        sort: 'cited_by_count:desc',
      });
      const url = `${this.baseUrl}/works?${params}`;
      const data = await fetchJson(url, { headers: { 'User-Agent': this.userAgent() } });
      const items = (data?.results || []).map((w: any) => this.mapWork(w)).filter(Boolean) as OpenAlexWork[];
      this.cache.set(cacheKey, items, 60 * 60 * 12);
      return items;
    } catch (e: any) {
      this.logger.warn(`OpenAlex works failed: ${e.message}`);
      return [];
    }
  }

  // ── INSTITUTION ─────────────────────────────────────────────────────

  async searchInstitution(name: string, country = 'TR'): Promise<OpenAlexInstitution[]> {
    if (!name) return [];
    const cacheKey = `inst:${name.toLowerCase()}:${country}`;
    const cached = this.cache.get<OpenAlexInstitution[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const params = new URLSearchParams({
        search: name,
        filter: `country_code:${country.toUpperCase()}`,
        'per-page': '10',
      });
      const url = `${this.baseUrl}/institutions?${params}`;
      const data = await fetchJson(url, { headers: { 'User-Agent': this.userAgent() } });
      const items = (data?.results || []).map((i: any) => this.mapInstitution(i)).filter(Boolean) as OpenAlexInstitution[];
      this.cache.set(cacheKey, items, 60 * 60 * 24 * 30); // 30 gün - kurum nadiren değişir
      return items;
    } catch (e: any) {
      this.logger.warn(`OpenAlex institution search failed: ${e.message}`);
      return [];
    }
  }

  async getInstitutionWorks(institutionId: string, yearOrRange?: number | { from?: number; to?: number }, limit = 25): Promise<OpenAlexWork[]> {
    if (!institutionId) return [];
    const cleanId = institutionId.replace(/^https?:\/\/openalex\.org\//, '');

    // Year param'ı normalize et - tek yıl mı, aralık mı?
    let yearFilter: string | undefined;
    let cacheKeyYear: string;
    if (typeof yearOrRange === 'number') {
      yearFilter = String(yearOrRange);
      cacheKeyYear = String(yearOrRange);
    } else if (yearOrRange && (yearOrRange.from || yearOrRange.to)) {
      const from = yearOrRange.from || 1900;
      const to = yearOrRange.to || new Date().getFullYear();
      yearFilter = `${from}-${to}`;
      cacheKeyYear = `${from}-${to}`;
    } else {
      cacheKeyYear = 'all';
    }

    const cacheKey = `inst-works:${cleanId}:${cacheKeyYear}:${limit}`;
    const cached = this.cache.get<OpenAlexWork[]>(cacheKey);
    if (cached) return cached;

    try {
      const filterParts = [`institutions.id:${cleanId}`];
      if (yearFilter) filterParts.push(`publication_year:${yearFilter}`);
      const perPage = 100;
      const maxPages = Math.ceil(Math.min(limit, 2000) / perPage); // Max 2000 kayıt = 20 sayfa
      const collected: OpenAlexWork[] = [];

      // Sayfalama - OpenAlex `page` parametresi ile
      for (let page = 1; page <= maxPages; page++) {
        await this.limiter.acquire();
        const params = new URLSearchParams({
          filter: filterParts.join(','),
          'per-page': String(perPage),
          page: String(page),
          sort: 'cited_by_count:desc',
        });
        const url = `${this.baseUrl}/works?${params}`;
        const data = await fetchJson(url, { headers: { 'User-Agent': this.userAgent() } });
        const items = (data?.results || []).map((w: any) => this.mapWork(w)).filter(Boolean) as OpenAlexWork[];
        collected.push(...items);
        // Daha az sonuç geldiyse son sayfadayız
        if (items.length < perPage) break;
        if (collected.length >= limit) break;
      }

      const final = collected.slice(0, limit);
      this.cache.set(cacheKey, final, 60 * 60 * 6);
      return final;
    } catch (e: any) {
      this.logger.warn(`OpenAlex institution works failed: ${e.message}`);
      return [];
    }
  }

  // ── WORK ────────────────────────────────────────────────────────────

  async getWorkByDoi(doi: string): Promise<OpenAlexWork | null> {
    if (!doi) return null;
    const normalized = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase();
    const cacheKey = `work:${normalized}`;
    const cached = this.cache.get<OpenAlexWork | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      await this.limiter.acquire();
      const url = `${this.baseUrl}/works/https://doi.org/${encodeURIComponent(normalized)}`;
      const data = await fetchJson(url, { headers: { 'User-Agent': this.userAgent() } });
      const w = this.mapWork(data);
      this.cache.set(cacheKey, w, 60 * 60 * 24 * 7);
      return w;
    } catch (e: any) {
      this.logger.warn(`OpenAlex work lookup failed: ${e.message}`);
      this.cache.set(cacheKey, null, 60 * 60);
      return null;
    }
  }

  // ── Mappers ─────────────────────────────────────────────────────────

  private mapAuthor(a: any): OpenAlexAuthor | null {
    if (!a?.id) return null;
    return {
      id: a.id,
      orcid: a.orcid ? String(a.orcid).replace(/^https?:\/\/orcid\.org\//, '') : undefined,
      displayName: a.display_name || '',
      worksCount: a.works_count || 0,
      citedByCount: a.cited_by_count || 0,
      hIndex: a.summary_stats?.h_index,
      i10Index: a.summary_stats?.i10_index,
      lastKnownInstitution: a.last_known_institutions?.[0] || a.last_known_institution
        ? {
            id: (a.last_known_institutions?.[0] || a.last_known_institution)?.id,
            displayName: (a.last_known_institutions?.[0] || a.last_known_institution)?.display_name,
            country: (a.last_known_institutions?.[0] || a.last_known_institution)?.country_code,
          }
        : undefined,
      conceptCounts: (a.x_concepts || []).slice(0, 10).map((c: any) => ({
        name: c.display_name, level: c.level, count: c.score || 0,
      })),
      countsByYear: (a.counts_by_year || []).map((c: any) => ({
        year: c.year, worksCount: c.works_count, citedByCount: c.cited_by_count,
      })),
    };
  }

  private mapInstitution(i: any): OpenAlexInstitution | null {
    if (!i?.id) return null;
    return {
      id: i.id,
      ror: i.ror,
      displayName: i.display_name,
      country: i.country_code,
      type: i.type,
      worksCount: i.works_count || 0,
      citedByCount: i.cited_by_count || 0,
    };
  }

  private mapWork(w: any): OpenAlexWork | null {
    if (!w?.id) return null;
    const primaryLocation = w.primary_location || {};
    const bestOa = w.best_oa_location || {};
    return {
      id: w.id,
      doi: w.doi ? String(w.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : undefined,
      title: w.title || w.display_name || '',
      publicationYear: w.publication_year,
      publicationDate: w.publication_date,
      type: w.type,
      citedBy: w.cited_by_count || 0,
      openAccess: {
        isOa: !!w.open_access?.is_oa,
        oaStatus: w.open_access?.oa_status,
        oaUrl: bestOa.pdf_url || bestOa.landing_page_url,
      },
      venue: primaryLocation.source ? {
        displayName: primaryLocation.source.display_name,
        issn: primaryLocation.source.issn,
        // ISSN-L = linking ISSN: print/electronic versionlar arasi tek kimlik
        issnL: primaryLocation.source.issn_l,
        // OpenAlex source ID: 'https://openalex.org/Sxxxxxxx' - en guvenilir lookup anahtari
        sourceId: primaryLocation.source.id ? String(primaryLocation.source.id).replace(/^https?:\/\/openalex\.org\//, '') : undefined,
        type: primaryLocation.source.type,
        publisher: primaryLocation.source.host_organization_name,
      } : undefined,
      authors: (w.authorships || []).map((a: any) => {
        const countries = Array.from(new Set(
          (a.institutions || []).map((i: any) => i.country_code).filter(Boolean)
        )) as string[];
        // Fallback - bazı kayıtlarda author ana düzeyinde countries var
        if (countries.length === 0 && Array.isArray(a.countries)) {
          for (const c of a.countries) if (c) countries.push(c);
        }
        // Yazarın tüm kurum adlarını listele (co-authorship universite analizi için)
        const institutions = (a.institutions || [])
          .map((i: any) => i.display_name)
          .filter(Boolean) as string[];
        return {
          id: a.author?.id,
          displayName: a.author?.display_name || '',
          orcid: a.author?.orcid ? String(a.author.orcid).replace(/^https?:\/\/orcid\.org\//, '') : undefined,
          institution: a.institutions?.[0]?.display_name,
          institutions,
          countries,
        };
      }),
      concepts: (w.concepts || []).map((c: any) => ({
        displayName: c.display_name, level: c.level, score: c.score,
      })),
      sdgs: (w.sustainable_development_goals || []).map((s: any) => ({
        displayName: s.display_name, id: s.id, score: s.score,
      })),
      referencesCount: w.referenced_works_count,
      fwci: w.fwci,
      citedByPercentile: w.cited_by_percentile_year
        ? { min: w.cited_by_percentile_year.min || 0, max: w.cited_by_percentile_year.max || 0 }
        : undefined,
      countriesDistinctCount: w.countries_distinct_count,
      institutionsDistinctCount: w.institutions_distinct_count,
    };
  }

  /**
   * Kurum özeti - peer benchmark için kullanılır.
   * /institutions/{id} endpoint'ine tek istekle tüm özet gelir.
   */
  async getInstitutionSummary(institutionId: string): Promise<{
    id: string;
    displayName: string;
    country?: string;
    worksCount: number;
    citedByCount: number;
    hIndex?: number;
    i10Index?: number;
    twoYearMeanCitedness?: number;
    countsByYear: Array<{ year: number; worksCount: number; citedByCount: number; oaWorksCount: number }>;
    topConcepts: Array<{ name: string; level: number; score: number }>;
  } | null> {
    if (!institutionId) return null;
    const cleanId = institutionId.replace(/^https?:\/\/openalex\.org\//, '');
    const cacheKey = `inst-summary:${cleanId}`;
    const cached = this.cache.get<any>(cacheKey);
    if (cached !== undefined) return cached;
    try {
      await this.limiter.acquire();
      const url = `${this.baseUrl}/institutions/${cleanId}`;
      const data = await fetchJson(url, { headers: { 'User-Agent': this.userAgent() } });
      if (!data?.id) { this.cache.set(cacheKey, null, 60 * 60); return null; }
      const mapped = {
        id: data.id,
        displayName: data.display_name,
        country: data.country_code,
        worksCount: data.works_count || 0,
        citedByCount: data.cited_by_count || 0,
        hIndex: data.summary_stats?.h_index,
        i10Index: data.summary_stats?.i10_index,
        twoYearMeanCitedness: data.summary_stats?.['2yr_mean_citedness'],
        countsByYear: (data.counts_by_year || []).map((c: any) => ({
          year: c.year,
          worksCount: c.works_count || 0,
          citedByCount: c.cited_by_count || 0,
          oaWorksCount: c.oa_works_count || 0,
        })),
        topConcepts: (data.x_concepts || []).slice(0, 8).map((c: any) => ({
          name: c.display_name, level: c.level || 0, score: c.score || 0,
        })),
      };
      this.cache.set(cacheKey, mapped, 60 * 60 * 24 * 7); // 7 gün
      return mapped;
    } catch (e: any) {
      this.logger.warn(`OpenAlex institution summary failed: ${e.message}`);
      return null;
    }
  }

  /**
   * KURUM GENEL AGREGAT METRIKLERI - sample DEGİL, gerçek institution-wide.
   *
   * OpenAlex /works endpoint'ini filter+meta.count ve group_by ile kullanir.
   * per_page=1 ile sadece toplam sayilari aliriz, yayinlari indirmeyiz.
   * Bu sayede 11K+ yayinli bir kurum icin de hizli ve dogru sonuc verir.
   *
   * Donen metrikler:
   * - openAccessCount / total → gercek OA orani
   * - top1PctCount → gercek Top %1 yayin sayisi (cited_by_percentile_year ≥99)
   * - top10PctCount → gercek Top %10 yayin sayisi (cited_by_percentile_year ≥90)
   * - internationalCount → en az 2 farkli ulkeden yazarli yayin (gercek)
   * - typeDistribution → publication type dagilimi (article/book/...)
   * - countryCollab → ortak yazarli ulke listesi (top 50)
   * - topJournals → en cok yayin yapilan dergiler (top 30)
   */
  async getInstitutionAggregates(institutionId: string, opts?: { fromYear?: number; toYear?: number }): Promise<{
    total: number;
    openAccessCount: number;
    openAccessRatio: number;
    top1PctCount: number;
    top10PctCount: number;
    top1PctRatio: number;
    top10PctRatio: number;
    internationalCount: number;
    internationalRatio: number;
    typeDistribution: Array<{ type: string; count: number }>;
    countryCollaboration: Array<{ code: string; count: number }>;
    topJournals: Array<{ id: string; name: string; count: number }>;
    fwciAvailable: boolean;
  } | null> {
    if (!institutionId) return null;
    const cleanId = institutionId.replace(/^https?:\/\/openalex\.org\//, '');
    const yearFilter = (opts?.fromYear || opts?.toYear)
      ? `,publication_year:${opts.fromYear || 1900}-${opts.toYear || new Date().getFullYear()}`
      : '';
    const cacheKey = `inst-agg:${cleanId}:${yearFilter}`;
    const cached = this.cache.get<any>(cacheKey);
    if (cached !== undefined) return cached;

    const baseFilter = `institutions.id:${cleanId}${yearFilter}`;
    const headers = { 'User-Agent': this.userAgent() };

    // Tek bir count almak icin: per_page=1, response.meta.count okunur
    const countOnly = async (filter: string): Promise<number> => {
      try {
        await this.limiter.acquire();
        const url = `${this.baseUrl}/works?filter=${filter}&per_page=1`;
        const data = await fetchJson(url, { headers });
        return data?.meta?.count || 0;
      } catch (e: any) {
        this.logger.warn(`OpenAlex count failed (${filter.slice(0, 60)}...): ${e.message}`);
        return 0;
      }
    };

    // group_by ile dagilim almak: per_page=1, group_by=field
    // OpenAlex group_by 'key' field'ini tam URL olarak doner
    // (orn. 'https://openalex.org/types/article'). Bunu strip edip son segmenti aliriz.
    const stripOpenAlexUrl = (key: string): string => {
      if (!key) return '';
      // 'https://openalex.org/types/article' → 'article'
      // 'https://openalex.org/countries/US' → 'us' (sonra upper)
      // 'https://openalex.org/sources/S12345' → 'S12345'
      const m = key.match(/openalex\.org\/[^/]+\/(.+)$/i);
      return m ? m[1] : key;
    };
    const groupBy = async (filter: string, field: string, limit = 50): Promise<Array<{ key: string; key_display_name?: string; count: number }>> => {
      try {
        await this.limiter.acquire();
        const url = `${this.baseUrl}/works?filter=${filter}&group_by=${field}&per_page=${limit}`;
        const data = await fetchJson(url, { headers });
        return (data?.group_by || []).map((g: any) => ({
          key: stripOpenAlexUrl(g.key),
          key_display_name: g.key_display_name,
          count: g.count || 0,
        }));
      } catch (e: any) {
        this.logger.warn(`OpenAlex group_by failed (${field}): ${e.message}`);
        return [];
      }
    };

    try {
      // Tum sorgulari paralel cek - 5 count + 3 group_by
      const [
        total,
        openAccessCount,
        top1PctCount,
        top10PctCount,
        internationalCount,
        typeDist,
        countryDist,
        journalDist,
      ] = await Promise.all([
        countOnly(baseFilter),
        countOnly(`${baseFilter},is_oa:true`),
        countOnly(`${baseFilter},cited_by_percentile_year.min:99,cited_by_percentile_year.max:100`),
        countOnly(`${baseFilter},cited_by_percentile_year.min:90,cited_by_percentile_year.max:100`),
        countOnly(`${baseFilter},countries_distinct_count:>1`),
        groupBy(baseFilter, 'type', 20),
        groupBy(baseFilter, 'authorships.countries.id', 60),
        groupBy(baseFilter, 'primary_location.source.id', 30),
      ]);

      const result = {
        total,
        openAccessCount,
        openAccessRatio: total > 0 ? Math.round((openAccessCount / total) * 100) : 0,
        top1PctCount,
        top10PctCount,
        top1PctRatio: total > 0 ? Math.round((top1PctCount / total) * 1000) / 10 : 0,
        top10PctRatio: total > 0 ? Math.round((top10PctCount / total) * 1000) / 10 : 0,
        internationalCount,
        internationalRatio: total > 0 ? Math.round((internationalCount / total) * 100) : 0,
        typeDistribution: typeDist
          .filter(t => t.key && t.key !== 'unknown')
          .map(t => ({ type: t.key, count: t.count })),
        countryCollaboration: countryDist
          .filter(c => c.key && c.key.length === 2 && c.key.toUpperCase() !== 'TR')   // TR'yi cikar - kendi kurumumuz
          .slice(0, 50)
          .map(c => ({ code: c.key.toUpperCase(), count: c.count })),
        topJournals: journalDist
          .filter(j => j.key && j.key_display_name)
          .slice(0, 30)
          .map(j => ({ id: j.key, name: j.key_display_name || '', count: j.count })),
        fwciAvailable: false,  // FWCI sample-based kalir; OpenAlex group_by FWCI desteklemiyor
      };

      this.cache.set(cacheKey, result, 60 * 60 * 12);  // 12 saat
      this.logger.log(`[InstitutionAgg] ${cleanId}: total=${total}, OA=${openAccessCount} (%${result.openAccessRatio}), Top1%=${top1PctCount}, Top10%=${top10PctCount}, intl=${internationalCount}`);
      return result;
    } catch (e: any) {
      this.logger.warn(`OpenAlex institution aggregates failed: ${e.message}`);
      return null;
    }
  }
}
