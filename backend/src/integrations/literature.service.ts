import { Injectable, Logger } from '@nestjs/common';
import { HttpCache, RateLimiter, fetchJson } from './http-cache';

/**
 * Literatür kaynakları - tek servis altında 3 API:
 *   - PubMed (NCBI E-utilities) - tıp/sağlık/biyoloji
 *   - arXiv                     - STEM preprint'leri
 *   - Semantic Scholar          - atıf grafı + referans analizi
 *
 * Hepsi ücretsiz ve anahtarsız. PubMed email ister, Semantic Scholar
 * opsiyonel API key'le daha yüksek rate limit verir.
 */

export interface LiteraturePublication {
  source: 'pubmed' | 'arxiv' | 'semanticscholar';
  externalId: string;
  doi?: string;
  title: string;
  abstract?: string;
  authors: string[];
  year?: number;
  journal?: string;
  citedBy?: number;
  url?: string;
  pdfUrl?: string;
  keywords?: string[];
}

@Injectable()
export class LiteratureService {
  private readonly logger = new Logger(LiteratureService.name);
  private readonly cache = new HttpCache('literature');
  private readonly pubmedLimiter = new RateLimiter(3, 1000);  // NCBI önerisi: key'siz 3/s
  private readonly arxivLimiter = new RateLimiter(1, 3000);   // arXiv: 3 sn'de 1 istek
  private readonly s2Limiter = new RateLimiter(1, 1000);      // S2 free tier: 1/s

  // ═══ PUBMED ═══════════════════════════════════════════════════════════

  async searchPubmed(query: string, limit = 20): Promise<LiteraturePublication[]> {
    if (!query) return [];
    const cacheKey = `pubmed:q:${query.toLowerCase()}:${limit}`;
    const cached = this.cache.get<LiteraturePublication[]>(cacheKey);
    if (cached) return cached;

    const email = process.env.PUBMED_MAILTO || process.env.CROSSREF_MAILTO || 'noreply@example.com';
    try {
      await this.pubmedLimiter.acquire();
      // 1) esearch - PMID'leri al
      const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json&tool=mku-tto&email=${encodeURIComponent(email)}`;
      const search = await fetchJson(esearchUrl, { timeoutMs: 15000 });
      const ids: string[] = search?.esearchresult?.idlist || [];
      if (ids.length === 0) {
        this.cache.set(cacheKey, [], 60 * 60);
        return [];
      }
      // 2) esummary - detayları al
      await this.pubmedLimiter.acquire();
      const esummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json&tool=mku-tto&email=${encodeURIComponent(email)}`;
      const summary = await fetchJson(esummaryUrl, { timeoutMs: 15000 });
      const items = ids.map(id => this.mapPubmed(summary?.result?.[id], id)).filter(Boolean) as LiteraturePublication[];
      this.cache.set(cacheKey, items, 60 * 60 * 12);
      return items;
    } catch (e: any) {
      this.logger.warn(`PubMed search failed: ${e.message}`);
      return [];
    }
  }

  async getPubmedByDoi(doi: string): Promise<LiteraturePublication | null> {
    if (!doi) return null;
    const results = await this.searchPubmed(`${doi}[DOI]`, 1);
    return results[0] || null;
  }

  private mapPubmed(d: any, id: string): LiteraturePublication | null {
    if (!d?.title) return null;
    return {
      source: 'pubmed',
      externalId: id,
      doi: d.articleids?.find((x: any) => x.idtype === 'doi')?.value,
      title: d.title,
      authors: (d.authors || []).map((a: any) => a.name).filter(Boolean),
      year: d.pubdate ? parseInt(String(d.pubdate).slice(0, 4)) : undefined,
      journal: d.fulljournalname || d.source,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    };
  }

  // ═══ ARXIV ════════════════════════════════════════════════════════════

  async searchArxiv(query: string, limit = 20): Promise<LiteraturePublication[]> {
    if (!query) return [];
    const cacheKey = `arxiv:${query.toLowerCase()}:${limit}`;
    const cached = this.cache.get<LiteraturePublication[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.arxivLimiter.acquire();
      const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${limit}&sortBy=relevance`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return [];
      const xml = await res.text();
      const items = this.parseArxiv(xml);
      this.cache.set(cacheKey, items, 60 * 60 * 12);
      return items;
    } catch (e: any) {
      this.logger.warn(`arXiv search failed: ${e.message}`);
      return [];
    }
  }

  private parseArxiv(xml: string): LiteraturePublication[] {
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    return entries.map(entry => {
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
      const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim();
      if (!title || !id) return null;
      const abstract = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim();
      const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1];
      const doi = entry.match(/<arxiv:doi>([\s\S]*?)<\/arxiv:doi>/)?.[1];
      const authors = (entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g) || [])
        .map(a => a.match(/<name>([\s\S]*?)<\/name>/)?.[1]?.trim())
        .filter(Boolean) as string[];
      const pdfUrl = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/)?.[1];
      const arxivId = id.replace(/^http:\/\/arxiv\.org\/abs\//, '');
      return {
        source: 'arxiv' as const,
        externalId: arxivId,
        doi,
        title,
        abstract,
        authors,
        year: published ? new Date(published).getFullYear() : undefined,
        url: id,
        pdfUrl,
      };
    }).filter(Boolean) as LiteraturePublication[];
  }

  // ═══ SEMANTIC SCHOLAR ════════════════════════════════════════════════

  async getS2Paper(idOrDoi: string): Promise<LiteraturePublication | null> {
    if (!idOrDoi) return null;
    const cacheKey = `s2:${idOrDoi}`;
    const cached = this.cache.get<LiteraturePublication | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      await this.s2Limiter.acquire();
      const id = /^10\./.test(idOrDoi) ? `DOI:${idOrDoi}` : idOrDoi;
      const fields = 'title,abstract,authors,year,venue,externalIds,citationCount,openAccessPdf,fieldsOfStudy,tldr';
      const url = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(id)}?fields=${fields}`;
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (process.env.SEMANTIC_SCHOLAR_KEY) headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_KEY;
      const data = await fetchJson(url, { headers, timeoutMs: 15000 });
      const mapped = this.mapS2(data);
      this.cache.set(cacheKey, mapped, 60 * 60 * 24 * 7);
      return mapped;
    } catch (e: any) {
      this.logger.warn(`Semantic Scholar lookup failed: ${e.message}`);
      this.cache.set(cacheKey, null, 60 * 60);
      return null;
    }
  }

  /**
   * Bir makalenin atıflarını/referanslarını çek - collaboration grafı için altyapı.
   */
  async getS2Citations(paperId: string, limit = 50): Promise<Array<{ paperId: string; title: string; year?: number; authors: string[] }>> {
    if (!paperId) return [];
    const cacheKey = `s2-cit:${paperId}:${limit}`;
    const cached = this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.s2Limiter.acquire();
      const url = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(paperId)}/citations?fields=title,year,authors&limit=${limit}`;
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (process.env.SEMANTIC_SCHOLAR_KEY) headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_KEY;
      const data = await fetchJson(url, { headers, timeoutMs: 15000 });
      const items = (data?.data || []).map((c: any) => ({
        paperId: c.citingPaper?.paperId,
        title: c.citingPaper?.title,
        year: c.citingPaper?.year,
        authors: (c.citingPaper?.authors || []).map((a: any) => a.name).filter(Boolean),
      }));
      this.cache.set(cacheKey, items, 60 * 60 * 24);
      return items;
    } catch (e: any) {
      this.logger.warn(`Semantic Scholar citations failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Bir yazar için makale listesi - h-index'li yazar profili.
   */
  async getS2AuthorProfile(authorId: string): Promise<{ id: string; name: string; hIndex?: number; paperCount?: number; citationCount?: number } | null> {
    if (!authorId) return null;
    const cacheKey = `s2-auth:${authorId}`;
    const cached = this.cache.get<any>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      await this.s2Limiter.acquire();
      const url = `https://api.semanticscholar.org/graph/v1/author/${encodeURIComponent(authorId)}?fields=name,hIndex,paperCount,citationCount`;
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (process.env.SEMANTIC_SCHOLAR_KEY) headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_KEY;
      const data = await fetchJson(url, { headers, timeoutMs: 15000 });
      const result = data?.authorId ? {
        id: data.authorId,
        name: data.name,
        hIndex: data.hIndex,
        paperCount: data.paperCount,
        citationCount: data.citationCount,
      } : null;
      this.cache.set(cacheKey, result, 60 * 60 * 24);
      return result;
    } catch (e: any) {
      this.logger.warn(`Semantic Scholar author failed: ${e.message}`);
      return null;
    }
  }

  private mapS2(d: any): LiteraturePublication | null {
    if (!d?.paperId) return null;
    return {
      source: 'semanticscholar',
      externalId: d.paperId,
      doi: d.externalIds?.DOI,
      title: d.title || '',
      abstract: d.abstract || d.tldr?.text,
      authors: (d.authors || []).map((a: any) => a.name).filter(Boolean),
      year: d.year,
      journal: d.venue,
      citedBy: d.citationCount,
      url: `https://www.semanticscholar.org/paper/${d.paperId}`,
      pdfUrl: d.openAccessPdf?.url,
      keywords: d.fieldsOfStudy,
    };
  }

  // ═══ UNIFIED SEARCH ══════════════════════════════════════════════════

  /**
   * Tüm kaynaklardan paralel arama.
   */
  async searchAll(query: string, limit = 10): Promise<LiteraturePublication[]> {
    const [pubmed, arxiv] = await Promise.all([
      this.searchPubmed(query, limit).catch(() => []),
      this.searchArxiv(query, limit).catch(() => []),
    ]);
    return [...pubmed, ...arxiv];
  }
}
