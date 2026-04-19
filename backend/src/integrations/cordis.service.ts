import { Injectable, Logger } from '@nestjs/common';
import { HttpCache, RateLimiter, fetchJson } from './http-cache';

/**
 * CORDIS — Community Research and Development Information Service.
 * AB araştırma projelerinin resmi açık veri portalı.
 * Horizon Europe, Horizon 2020, FP7 projelerini indeksler.
 *
 * Docs: https://cordis.europa.eu/about/open-data
 * API: https://api.cordis.europa.eu/
 *
 * Ücretsiz, anahtarsız.
 *
 * Kullanım:
 *  - Türk kurumlarının katıldığı AB projelerini listelemek
 *  - Açık çağrı (topic) fırsatlarını feed olarak getirmek
 *  - Projenin konu alanına yakın önceki AB projeleri önermek
 */

export interface CordisProject {
  id: string;                     // gradId (grant agreement ID, örn. 101087527)
  acronym: string;
  title: string;
  framework: string;              // HORIZON, H2020, FP7
  startDate?: string;
  endDate?: string;
  totalCost?: number;             // EUR
  ecMaxContribution?: number;
  status?: 'SIGNED' | 'CLOSED' | 'TERMINATED';
  coordinator?: { name: string; country: string };
  partners: Array<{ name: string; country: string; role?: string; contribution?: number }>;
  topics?: string[];
  objective?: string;
  url?: string;
}

export interface CordisCall {
  id: string;                     // call identifier (örn. HORIZON-CL1-2024-...)
  title: string;
  programme: string;
  deadline?: string;
  budget?: number;
  description?: string;
  url?: string;
}

@Injectable()
export class CordisService {
  private readonly logger = new Logger(CordisService.name);
  private readonly cache = new HttpCache('cordis');
  private readonly limiter = new RateLimiter(5, 1000);

  isConfigured(): boolean {
    return process.env.CORDIS_DISABLED !== 'true';
  }

  /**
   * Türk katılımcıları olan AB projeleri — MKÜ için özellikle anlamlı.
   */
  async searchProjectsByCountry(countryCode = 'TR', limit = 50): Promise<CordisProject[]> {
    if (!this.isConfigured()) return [];
    const cacheKey = `country:${countryCode}:${limit}`;
    const cached = this.cache.get<CordisProject[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      // CORDIS public search — query DSL kullanır
      const url = `https://cordis.europa.eu/search/api/projects?query=contentType=project AND participants/country/code=${countryCode}&num=${limit}`;
      const data = await fetchJson(url, { timeoutMs: 20000 });
      const items = (data?.hits?.hits || data?.results || []).map((h: any) => this.mapProject(h._source || h)).filter(Boolean) as CordisProject[];
      this.cache.set(cacheKey, items, 60 * 60 * 24); // 24 saat
      return items;
    } catch (e: any) {
      this.logger.warn(`CORDIS country search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Bir organizasyonun (kurum adı) katıldığı projeleri bul.
   */
  async searchProjectsByOrganization(orgName: string, limit = 25): Promise<CordisProject[]> {
    if (!this.isConfigured() || !orgName) return [];
    const cacheKey = `org:${orgName.toLowerCase()}:${limit}`;
    const cached = this.cache.get<CordisProject[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const url = `https://cordis.europa.eu/search/api/projects?query=contentType=project AND participants/name="${encodeURIComponent(orgName)}"&num=${limit}`;
      const data = await fetchJson(url, { timeoutMs: 20000 });
      const items = (data?.hits?.hits || []).map((h: any) => this.mapProject(h._source || h)).filter(Boolean) as CordisProject[];
      this.cache.set(cacheKey, items, 60 * 60 * 24);
      return items;
    } catch (e: any) {
      this.logger.warn(`CORDIS org search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Anahtar kelimeye göre açık/kapalı çağrı arama.
   */
  async searchProjects(query: string, limit = 25): Promise<CordisProject[]> {
    if (!this.isConfigured() || !query) return [];
    const cacheKey = `q:${query.toLowerCase()}:${limit}`;
    const cached = this.cache.get<CordisProject[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const url = `https://cordis.europa.eu/search/api/projects?query=contentType=project AND (title=~"${encodeURIComponent(query)}" OR objective=~"${encodeURIComponent(query)}")&num=${limit}`;
      const data = await fetchJson(url, { timeoutMs: 20000 });
      const items = (data?.hits?.hits || []).map((h: any) => this.mapProject(h._source || h)).filter(Boolean) as CordisProject[];
      this.cache.set(cacheKey, items, 60 * 60 * 12);
      return items;
    } catch (e: any) {
      this.logger.warn(`CORDIS query search failed: ${e.message}`);
      return [];
    }
  }

  private mapProject(p: any): CordisProject | null {
    const id = p?.id || p?.rcn || p?.gradId;
    const title = p?.title;
    if (!id || !title) return null;
    return {
      id: String(id),
      acronym: p.acronym || '',
      title: String(title),
      framework: p.frameworkProgramme || p.fundingScheme || 'HORIZON',
      startDate: p.startDate,
      endDate: p.endDate,
      totalCost: p.totalCost ? +p.totalCost : undefined,
      ecMaxContribution: p.ecMaxContribution ? +p.ecMaxContribution : undefined,
      status: p.status,
      coordinator: p.coordinator ? {
        name: p.coordinator.name || p.coordinator.shortName || '',
        country: p.coordinator.country?.code || p.coordinator.country || '',
      } : undefined,
      partners: (p.participants || p.partners || []).map((x: any) => ({
        name: x.name || x.shortName || '',
        country: x.country?.code || x.country || '',
        role: x.role,
        contribution: x.ecContribution ? +x.ecContribution : undefined,
      })),
      topics: p.topics || p.keywords,
      objective: p.objective,
      url: `https://cordis.europa.eu/project/id/${id}`,
    };
  }
}
