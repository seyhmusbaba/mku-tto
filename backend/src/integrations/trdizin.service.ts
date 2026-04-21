import { Injectable, Logger } from '@nestjs/common';
import { HttpCache } from './http-cache';

/**
 * TR Dizin (TÜBİTAK ULAKBİM) entegrasyonu.
 *
 * Resmi API değil ama açık erişimli Elasticsearch-backed JSON endpoint'ler:
 *   https://search.trdizin.gov.tr/api/...
 *
 * Key özellikleri:
 *  - OpenAlex'in çoğunlukla kaçırdığı Türkçe akademik yayınları indeksler
 *  - DOI'si olmayan yerli dergilerden de veri çeker
 *  - Her yazar için: name, ORCID, institution.title, institution.code
 *  - Dergi metadata: ISSN, e-ISSN, adı
 *  - Açık erişim (OPEN/CLOSED), dil, atıf sayısı (orderCitationCount)
 *
 * MKÜ institution code: MzU1MDg2 (env ile override edilebilir: TRDIZIN_INST_CODE)
 */

export interface TrDizinPublication {
  id: string;
  title: string;
  year?: number;
  doi?: string;
  journal?: { name?: string; issn?: string; eissn?: string };
  authors: Array<{
    name: string;
    orcid?: string;
    institutionName?: string;
    institutionCode?: string;
    duty?: string;
  }>;
  citedBy: number;
  isOpenAccess: boolean;
  language?: string;
  docType?: string;
  subjects?: string[];
  abstracts?: Array<{ language: string; abstract: string }>;
}

export interface TrDizinAuthor {
  id: string;
  name: string;
  orcid?: string;
  institution?: string;
  publicationCount?: number;
  totalCitations?: number;
}

@Injectable()
export class TrDizinService {
  private readonly logger = new Logger(TrDizinService.name);
  private readonly cache = new HttpCache('trdizin');
  private readonly baseUrl = 'https://search.trdizin.gov.tr/api';
  private readonly mkuInstCode = process.env.TRDIZIN_INST_CODE || 'MzU1MDg2';

  isConfigured(): boolean {
    // Public API — yapılandırma gerektirmez
    return true;
  }

  private async fetchJson(url: string, timeoutMs = 15000): Promise<any | null> {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; MKU-TTO/1.0)',
          'Referer': 'https://search.trdizin.gov.tr/',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        this.logger.warn(`TrDizin fetch ${res.status}: ${url}`);
        return null;
      }
      return await res.json();
    } catch (e: any) {
      this.logger.warn(`TrDizin error: ${e.message}`);
      return null;
    }
  }

  /**
   * Yayın arama — genel sorgu ile.
   * q: aranacak terim (Türkçe başlık, yazar, anahtar kelime)
   * limit: en fazla kaç sonuç (max 100)
   */
  async searchPublications(q: string, limit = 50): Promise<TrDizinPublication[]> {
    if (!q || q.trim().length < 2) return [];
    const cleanQ = encodeURIComponent(q.trim());
    const cacheKey = `pubs:${cleanQ}:${limit}`;
    const cached = this.cache.get<TrDizinPublication[]>(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/defaultSearch/publication/?q=${cleanQ}&limit=${Math.min(limit, 100)}&offset=0&order=publicationYear-DESC&facet=false`;
    const data = await this.fetchJson(url);
    if (!data?.hits?.hits) return [];

    const pubs = data.hits.hits
      .map((h: any) => this.mapHit(h))
      .filter((p: TrDizinPublication | null): p is TrDizinPublication => !!p);
    this.cache.set(cacheKey, pubs, 60 * 60 * 6); // 6 saat
    return pubs;
  }

  /**
   * Bir kuruma ait yayınları çeker (MKÜ institution code ile).
   * İki aşamalı: önce institution endpoint IDs verir, sonra tek tek detay.
   * Burada daha verimli yol: direkt publication search ile institution adıyla filtrele.
   */
  async getInstitutionPublications(
    instCode?: string,
    opts?: { fromYear?: number; toYear?: number; limit?: number },
  ): Promise<TrDizinPublication[]> {
    const code = instCode || this.mkuInstCode;
    const limit = Math.min(opts?.limit || 100, 200);
    const fromYear = opts?.fromYear || (new Date().getFullYear() - 5);
    const toYear = opts?.toYear || new Date().getFullYear();

    const cacheKey = `inst:${code}:${fromYear}-${toYear}:${limit}`;
    const cached = this.cache.get<TrDizinPublication[]>(cacheKey);
    if (cached) return cached;

    // 1. adım: institution endpoint'inden ID listesi al
    const idsUrl = `${this.baseUrl}/institutionCodePublicationsById/${code}` +
      `?size=${limit}&from=0&toYear=${toYear}&fromYear=${fromYear}` +
      `&toDate=${toYear}-12-31&fromDate=${fromYear}-01-01`;
    const idsData = await this.fetchJson(idsUrl);
    const ids: string[] = (idsData?.hits?.hits || []).map((h: any) => h._id).filter(Boolean);
    if (ids.length === 0) {
      this.cache.set(cacheKey, [], 60 * 10);
      return [];
    }

    // 2. adım: her ID için detay çek (paralel 5'erli gruplar halinde — rate-limit dostu)
    const results: TrDizinPublication[] = [];
    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);
      const details = await Promise.all(
        batch.map(id => this.getPublicationById(id).catch(() => null)),
      );
      for (const d of details) {
        if (d) results.push(d);
      }
    }

    this.cache.set(cacheKey, results, 60 * 60 * 6);
    return results;
  }

  /**
   * Tek yayın detayı.
   */
  async getPublicationById(id: string): Promise<TrDizinPublication | null> {
    if (!id) return null;
    const cacheKey = `pub:${id}`;
    const cached = this.cache.get<TrDizinPublication | null>(cacheKey);
    if (cached !== undefined) return cached;

    const url = `${this.baseUrl}/publicationById/${id}`;
    const data = await this.fetchJson(url);
    const hit = data?.hits?.hits?.[0];
    const mapped = hit ? this.mapHit(hit) : null;
    this.cache.set(cacheKey, mapped, 60 * 60 * 24);
    return mapped;
  }

  /**
   * Bir yazarın yayınları — ad-soyad + kurum adı ile filtrele.
   * ORCID'i olmayan hocalar için fallback.
   */
  async searchByAuthorName(
    authorName: string,
    institutionHint?: string,
    limit = 50,
  ): Promise<TrDizinPublication[]> {
    if (!authorName || authorName.trim().length < 3) return [];

    // Önce yazar adı ile genel arama yap
    const query = institutionHint
      ? `${authorName} ${institutionHint}`
      : authorName;
    const pubs = await this.searchPublications(query, limit);

    // Eşleşme doğrulama: authors listesinde bu ad-soyada benzer kayıt var mı?
    const normalize = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[^a-zçğıiöşü\s]/g, '').trim();
    const target = normalize(authorName);
    const parts = target.split(/\s+/).filter(p => p.length > 2);

    return pubs.filter(p => {
      return p.authors.some(a => {
        const aName = normalize(a.name || '');
        // En az 2 parça eşleşmeli (isim + soyad)
        const matched = parts.filter(part => aName.includes(part)).length;
        return matched >= Math.min(2, parts.length);
      });
    });
  }

  /**
   * Elasticsearch hit → TrDizinPublication map.
   * API tutarsız — bazı alanlar array, bazıları object.
   */
  private mapHit(h: any): TrDizinPublication | null {
    const src = h?._source || h;
    if (!src) return null;

    // Title — orderTitle direct, veya title array'i
    const title = src.orderTitle
      || (Array.isArray(src.title) ? src.title[0]?.title || src.title[0]?.value : src.title)
      || '';

    if (!title) return null;

    // Authors
    const authors = (src.authors || []).map((a: any) => ({
      name: a.name || a.inPublicationName || '',
      orcid: a.orcid && a.orcid !== '0000-0000-0000-0000' ? a.orcid : undefined,
      institutionName: a.institution?.title?.[0] || a.institutionName?.[0],
      institutionCode: a.institution?.code?.[0] || a.institution?.rootCode?.[0],
      duty: a.duty,
    }));

    // Subjects — array of {name, fullName}
    const subjects = (src.subjects || [])
      .map((s: any) => s.name || s.fullName)
      .filter(Boolean);

    return {
      id: String(src.id || h._id || ''),
      title: title.trim(),
      year: src.publicationYear ? +src.publicationYear : undefined,
      doi: src.doi || undefined,
      journal: src.journal ? {
        name: src.journal.name,
        issn: src.journal.issn,
        eissn: src.journal.eissn,
      } : undefined,
      authors,
      citedBy: +(src.orderCitationCount || 0),
      isOpenAccess: src.accessType === 'OPEN',
      language: src.language,
      docType: src.docType,
      subjects,
      abstracts: (src.abstracts || []).map((a: any) => ({
        language: a.language,
        abstract: a.abstract,
      })),
    };
  }

  /**
   * Tanı için — mevcut kurum kodu, API erişim durumu.
   */
  async diagnostic(): Promise<{
    configured: boolean;
    mkuInstCode: string;
    lastCheck: string;
    canReach: boolean;
    samplePubsFound?: number;
  }> {
    const lastCheck = new Date().toISOString();
    // Basit test — MKÜ institution code'dan 3 yayın çekmeyi dene
    try {
      const url = `${this.baseUrl}/institutionCodePublicationsById/${this.mkuInstCode}` +
        `?size=3&from=0&toYear=${new Date().getFullYear()}&fromYear=${new Date().getFullYear() - 1}` +
        `&toDate=${new Date().getFullYear()}-12-31&fromDate=${new Date().getFullYear() - 1}-01-01`;
      const data = await this.fetchJson(url, 8000);
      const found = data?.hits?.total?.value || (data?.hits?.hits || []).length;
      return {
        configured: true,
        mkuInstCode: this.mkuInstCode,
        lastCheck,
        canReach: !!data,
        samplePubsFound: typeof found === 'number' ? found : undefined,
      };
    } catch {
      return {
        configured: true,
        mkuInstCode: this.mkuInstCode,
        lastCheck,
        canReach: false,
      };
    }
  }
}
