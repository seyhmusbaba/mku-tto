import { Injectable, Logger } from '@nestjs/common';
import { HttpCache, RateLimiter, fetchJson } from './http-cache';

/**
 * AB araştırma projeleri entegrasyonu — OpenAIRE Graph API üzerinden.
 *
 * Neden OpenAIRE, CORDIS direkt değil?
 * CORDIS'in resmi public JSON API'si yok — web sitesi HTML dönüyor.
 * OpenAIRE ise CORDIS verilerini + diğer AB/ulusal fon kaynaklarını
 * aggregate eden, resmi public JSON API'si olan serbest erişimli servis.
 * AB Komisyonu tarafından resmi olarak destekleniyor.
 *
 * Docs: https://graph.openaire.eu/develop/api.html
 * Base: https://api.openaire.eu/search/projects
 *
 * Ücretsiz, anahtarsız.
 *
 * NOT: Service sınıf adı backward compat için CordisService kaldı —
 * frontend zaten bu endpoint'leri çağırıyor.
 */

export interface CordisProject {
  id: string;
  acronym: string;
  title: string;
  framework: string;              // HORIZON, H2020, FP7, vs.
  startDate?: string;
  endDate?: string;
  totalCost?: number;
  ecMaxContribution?: number;
  status?: string;
  coordinator?: { name: string; country: string };
  partners: Array<{ name: string; country: string; role?: string; contribution?: number }>;
  topics?: string[];
  objective?: string;
  url?: string;
}

export interface CordisCall {
  id: string;
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
  private readonly cache = new HttpCache('openaire');
  private readonly limiter = new RateLimiter(5, 1000);
  private readonly baseUrl = 'https://api.openaire.eu/search/projects';

  isConfigured(): boolean {
    return process.env.CORDIS_DISABLED !== 'true';
  }

  /**
   * Ülke koduna göre proje araması.
   * OpenAIRE parametre: `country=TR` (2 harfli ISO kodu).
   */
  async searchProjectsByCountry(countryCode = 'TR', limit = 50): Promise<CordisProject[]> {
    if (!this.isConfigured()) return [];
    const cacheKey = `country:${countryCode}:${limit}`;
    const cached = this.cache.get<CordisProject[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const params = new URLSearchParams({
        country: countryCode.toUpperCase(),
        size: String(Math.min(limit, 100)),
        format: 'json',
        sortBy: 'projectstartdate,descending',
      });
      const url = `${this.baseUrl}?${params}`;
      const data = await fetchJson(url, { timeoutMs: 25000 });
      const items = this.parseOpenAire(data);
      this.cache.set(cacheKey, items, 60 * 60 * 24);
      return items;
    } catch (e: any) {
      this.logger.warn(`OpenAIRE country search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Organizasyon adıyla arama.
   */
  async searchProjectsByOrganization(orgName: string, limit = 25): Promise<CordisProject[]> {
    if (!this.isConfigured() || !orgName) return [];
    const cacheKey = `org:${orgName.toLowerCase()}:${limit}`;
    const cached = this.cache.get<CordisProject[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      // OpenAIRE'da organizasyon adı araması için `participantAcronyms` veya
      // `partnerCountries` yerine keyword üzerinden de yapılabilir.
      // En sağlam: keywords'e org adını koy.
      const params = new URLSearchParams({
        keywords: orgName,
        size: String(Math.min(limit, 100)),
        format: 'json',
        sortBy: 'projectstartdate,descending',
      });
      const url = `${this.baseUrl}?${params}`;
      const data = await fetchJson(url, { timeoutMs: 25000 });
      const items = this.parseOpenAire(data);
      this.cache.set(cacheKey, items, 60 * 60 * 24);
      return items;
    } catch (e: any) {
      this.logger.warn(`OpenAIRE org search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Anahtar kelime araması.
   */
  async searchProjects(query: string, limit = 25): Promise<CordisProject[]> {
    if (!this.isConfigured() || !query) return [];
    const cacheKey = `q:${query.toLowerCase()}:${limit}`;
    const cached = this.cache.get<CordisProject[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const params = new URLSearchParams({
        keywords: query,
        size: String(Math.min(limit, 100)),
        format: 'json',
        sortBy: 'projectstartdate,descending',
      });
      const url = `${this.baseUrl}?${params}`;
      const data = await fetchJson(url, { timeoutMs: 25000 });
      const items = this.parseOpenAire(data);
      this.cache.set(cacheKey, items, 60 * 60 * 12);
      return items;
    } catch (e: any) {
      this.logger.warn(`OpenAIRE query search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * OpenAIRE JSON cevabını mapla.
   * Format: `response.results.result[i].metadata['oaf:entity']['oaf:project']`
   * İç yapı karmaşık, defensive parsing yapıyoruz.
   */
  private parseOpenAire(data: any): CordisProject[] {
    const results = data?.response?.results?.result;
    if (!results) return [];
    const arr = Array.isArray(results) ? results : [results];
    return arr
      .map((r: any) => this.mapOpenAireProject(r))
      .filter(Boolean) as CordisProject[];
  }

  private mapOpenAireProject(r: any): CordisProject | null {
    try {
      const meta = r?.metadata?.['oaf:entity']?.['oaf:project'];
      if (!meta) return null;

      const code = meta.code?.$ || meta.code || '';
      const acronym = meta.acronym?.$ || meta.acronym || '';
      const title = meta.title?.$ || meta.title || '';
      if (!title) return null;

      const startDate = meta.startdate?.$ || meta.startdate;
      const endDate = meta.enddate?.$ || meta.enddate;
      const totalCost = this.asNumber(meta.totalcost?.$ || meta.totalcost);
      const funding = meta.fundedamount?.$ || meta.fundedamount;
      const ecMaxContribution = this.asNumber(funding);

      // Fon programı
      const fundingtree = meta.fundingtree;
      const frameworkName = this.extractFramework(fundingtree);

      // Koordinatör + ortaklar
      const relProjects = r?.metadata?.['oaf:entity']?.['oaf:project']?.rels?.rel;
      const relArr = relProjects ? (Array.isArray(relProjects) ? relProjects : [relProjects]) : [];
      const partners: CordisProject['partners'] = [];
      let coordinator: CordisProject['coordinator'] = undefined;

      for (const rel of relArr) {
        if (rel?.to?.$ && rel?.['to']?.class === 'hasParticipant') {
          const orgName = rel.legalname?.$ || rel.legalname || '';
          const country = rel.country?.classid || rel.country || '';
          const isCoordinator = rel.relClass === 'isProjectCoordinator' || rel.iscoordinator === 'true';
          if (orgName) {
            if (isCoordinator && !coordinator) {
              coordinator = { name: orgName, country };
            } else {
              partners.push({ name: orgName, country, role: isCoordinator ? 'coordinator' : 'participant' });
            }
          }
        }
      }

      // Anahtar kelimeler / konular
      const subjects = meta.subjects?.subject;
      const topics = subjects
        ? (Array.isArray(subjects) ? subjects : [subjects]).map((s: any) => s?.$ || s).filter(Boolean)
        : [];

      const objective = meta.summary?.$ || meta.summary || '';

      return {
        id: code,
        acronym: typeof acronym === 'string' ? acronym : '',
        title: typeof title === 'string' ? title : String(title),
        framework: frameworkName || 'UNKNOWN',
        startDate: typeof startDate === 'string' ? startDate : undefined,
        endDate: typeof endDate === 'string' ? endDate : undefined,
        totalCost,
        ecMaxContribution,
        coordinator,
        partners,
        topics,
        objective: typeof objective === 'string' ? objective : '',
        url: code ? `https://cordis.europa.eu/project/id/${code}` : undefined,
      };
    } catch (e) {
      return null;
    }
  }

  /** Funding tree'den framework adını çıkar (HORIZON / H2020 / FP7 vs) */
  private extractFramework(tree: any): string {
    if (!tree) return 'UNKNOWN';
    const str = JSON.stringify(tree).toUpperCase();
    if (str.includes('HORIZON')) return 'HORIZON';
    if (str.includes('H2020')) return 'H2020';
    if (str.includes('FP7')) return 'FP7';
    if (str.includes('ERC')) return 'ERC';
    if (str.includes('MARIE')) return 'MSCA';
    return 'AB';
  }

  private asNumber(v: any): number | undefined {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
}
