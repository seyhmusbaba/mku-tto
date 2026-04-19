import { Injectable, Logger } from '@nestjs/common';
import { HttpCache, RateLimiter, fetchJson } from './http-cache';

/**
 * AB araştırma projeleri entegrasyonu — OpenAIRE üzerinden.
 *
 * Neden OpenAIRE?
 *   CORDIS'in public JSON API'si yok; web sitesi HTML dönüyor. OpenAIRE,
 *   CORDIS + Horizon Europe + diğer Avrupa fon verilerini aggregate eden,
 *   resmi public JSON API'ye sahip servistir (AB Komisyonu destekli).
 *
 * Docs: https://graph.openaire.eu/develop/api.html
 * Base: https://api.openaire.eu/search/projects
 *
 * DOĞRU parametreler (v1 Search API):
 *  - participantCountries=TR   (ISO-2)
 *  - participantAcronyms=MKU   (org kısaltması)
 *  - keywords=<text>           (full-text başlık/özet)
 *  - funder=EC                 (sadece AB Komisyonu fonlu)
 *  - size=<int>                (sayfa büyüklüğü, max 100)
 *  - format=json
 *  - sortBy=projectstartdate,descending
 *
 * Ücretsiz, anahtarsız.
 */

export interface CordisProject {
  id: string;
  acronym: string;
  title: string;
  framework: string;
  startDate?: string;
  endDate?: string;
  totalCost?: number;
  ecMaxContribution?: number;
  status?: string;
  coordinator?: { name: string; country: string };
  partners: Array<{ name: string; country: string; role?: string; contribution?: number }>;
  topics?: string[];
  objective?: string;
  url?: string;                   // OpenAIRE veya CORDIS link
  openaireId?: string;            // OpenAIRE internal ID — fallback link için
}

@Injectable()
export class CordisService {
  private readonly logger = new Logger(CordisService.name);
  private readonly cache = new HttpCache('openaire');
  private readonly limiter = new RateLimiter(5, 1000);
  private readonly baseUrl = 'https://api.openaire.eu/search/projects';

  // Son sorgunun raw cevabı — diagnostic endpoint için (küçük bir örnek)
  private lastRawSample: any = null;
  private lastRawUrl: string = '';

  isConfigured(): boolean {
    return process.env.CORDIS_DISABLED !== 'true';
  }

  /**
   * Diagnostic — son sorgunun ne döndüğünü raporla. Servis çalışıyor mu,
   * parametreler doğru mu, veri dönüyor mu tarayıcıdan görülsün.
   */
  getDiagnostic() {
    return {
      lastUrl: this.lastRawUrl,
      hasData: !!this.lastRawSample,
      sampleKeys: this.lastRawSample ? Object.keys(this.lastRawSample) : [],
      totalResults: this.lastRawSample?.response?.header?.total?.$ || this.lastRawSample?.response?.header?.total || 'bilinmiyor',
      firstResultPreview: (() => {
        try {
          const first = this.lastRawSample?.response?.results?.result;
          if (!first) return null;
          const f = Array.isArray(first) ? first[0] : first;
          const p = f?.metadata?.['oaf:entity']?.['oaf:project'];
          return {
            code: p?.code?.$ || p?.code,
            acronym: p?.acronym?.$ || p?.acronym,
            title: p?.title?.$ || p?.title,
          };
        } catch { return null; }
      })(),
    };
  }

  /**
   * Türkiye (veya başka ülke) katılımlı AB projeleri.
   * participantCountries parametresi ile filtreleriz.
   */
  async searchProjectsByCountry(countryCode = 'TR', limit = 50): Promise<CordisProject[]> {
    if (!this.isConfigured()) return [];
    const cacheKey = `country:${countryCode}:${limit}`;
    const cached = this.cache.get<CordisProject[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.limiter.acquire();
      const params = new URLSearchParams({
        participantCountries: countryCode.toUpperCase(),
        size: String(Math.min(limit, 100)),
        format: 'json',
        sortBy: 'projectstartdate,descending',
      });
      const url = `${this.baseUrl}?${params}`;
      this.lastRawUrl = url;
      const data = await fetchJson(url, { timeoutMs: 25000 });
      this.lastRawSample = data;
      const items = this.parseOpenAire(data);
      this.cache.set(cacheKey, items, 60 * 60 * 24);
      return items;
    } catch (e: any) {
      this.logger.warn(`OpenAIRE country search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * MKÜ gibi belirli bir kurum için — önce TR projelerini çek, sonra
   * partner listesinde kurum adı geçenleri CLIENT-SIDE filtrele.
   * OpenAIRE search API'sinde participant-name filter yok.
   */
  async searchProjectsByOrganization(orgName: string, limit = 25): Promise<CordisProject[]> {
    if (!this.isConfigured() || !orgName) return [];
    const cacheKey = `org:${orgName.toLowerCase()}:${limit}`;
    const cached = this.cache.get<CordisProject[]>(cacheKey);
    if (cached) return cached;

    try {
      // Önce Türkiye projelerini getir (daha geniş havuz — max 100)
      const turkeyProjects = await this.searchProjectsByCountry('TR', 100);
      // Client-side filter — kurum adı partnerlardan birinde substring olarak geçiyor mu
      const needle = orgName.toLowerCase();
      const matched = turkeyProjects.filter(p => {
        if (p.coordinator?.name?.toLowerCase().includes(needle)) return true;
        return p.partners.some(pt => pt.name.toLowerCase().includes(needle));
      }).slice(0, limit);
      this.cache.set(cacheKey, matched, 60 * 60 * 12);
      return matched;
    } catch (e: any) {
      this.logger.warn(`OpenAIRE org search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Anahtar kelime araması — keywords parametresi ile.
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
      this.lastRawUrl = url;
      const data = await fetchJson(url, { timeoutMs: 25000 });
      this.lastRawSample = data;
      const items = this.parseOpenAire(data);
      this.cache.set(cacheKey, items, 60 * 60 * 12);
      return items;
    } catch (e: any) {
      this.logger.warn(`OpenAIRE query search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * OpenAIRE JSON cevabını UnifiedProject listesine çevir.
   * Yapı: response.results.result[i].metadata['oaf:entity']['oaf:project']
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
      // OpenAIRE project nesnesi farklı yerlerde olabilir — defensive lookup
      const entity = r?.metadata?.['oaf:entity'] || r?.['oaf:entity'];
      const meta = entity?.['oaf:project'];
      if (!meta) return null;

      const code = this.unwrap(meta.code);
      const acronym = this.unwrap(meta.acronym);
      const title = this.unwrap(meta.title);
      if (!title) return null;

      const startDate = this.unwrap(meta.startdate);
      const endDate = this.unwrap(meta.enddate);
      const totalCost = this.asNumber(this.unwrap(meta.totalcost));
      const ecMaxContribution = this.asNumber(this.unwrap(meta.fundedamount));

      // Framework — fundingtree string'inden çıkar
      const frameworkName = this.extractFramework(meta.fundingtree);

      // OpenAIRE internal ID — header'da genellikle
      const header = r?.header;
      const openaireId = this.unwrap(header?.['dri:objIdentifier']) || this.unwrap(r?.objIdentifier) || '';

      // Partnerler — 'rels' altında 'hasParticipant' sınıfında
      const partners: CordisProject['partners'] = [];
      let coordinator: CordisProject['coordinator'] = undefined;

      const relsWrapper = meta?.rels || entity?.rels;
      const rels = relsWrapper?.rel;
      const relArr = rels ? (Array.isArray(rels) ? rels : [rels]) : [];

      for (const rel of relArr) {
        if (!rel) continue;
        const toClass = rel.to?.class || rel['to']?.class;
        if (toClass !== 'hasParticipant' && !rel.legalname) continue;

        const orgName = this.unwrap(rel.legalname);
        if (!orgName) continue;
        const countryObj = rel.country;
        const country = countryObj?.classid || this.unwrap(countryObj) || '';
        const isCoordinator = rel.relClass === 'isProjectCoordinator' ||
                              rel.iscoordinator === 'true' ||
                              rel.iscoordinator === true;

        if (isCoordinator && !coordinator) {
          coordinator = { name: orgName, country: String(country) };
        } else {
          partners.push({
            name: orgName,
            country: String(country),
            role: isCoordinator ? 'coordinator' : 'participant',
          });
        }
      }

      // Subject/konu listesi
      const subjects = meta.subjects?.subject;
      const topics = subjects
        ? (Array.isArray(subjects) ? subjects : [subjects]).map((s: any) => this.unwrap(s)).filter(Boolean)
        : [];

      const objective = this.unwrap(meta.summary);

      // URL — CORDIS koduna bakıyoruz; yoksa OpenAIRE project page
      const cordisUrl = code && /^\d+$/.test(String(code))
        ? `https://cordis.europa.eu/project/id/${code}`
        : undefined;
      const openaireUrl = openaireId
        ? `https://explore.openaire.eu/search/project?projectId=${encodeURIComponent(openaireId)}`
        : undefined;
      const url = cordisUrl || openaireUrl;

      return {
        id: code || openaireId,
        acronym: acronym || '',
        title,
        framework: frameworkName || 'AB',
        startDate,
        endDate,
        totalCost,
        ecMaxContribution,
        coordinator,
        partners,
        topics,
        objective,
        url,
        openaireId,
      };
    } catch (e) {
      return null;
    }
  }

  /** OpenAIRE bazen {$: "value"} bazen direkt string dönüyor */
  private unwrap(v: any): string | undefined {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'string') return v.trim() || undefined;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object') {
      if (v.$) return this.unwrap(v.$);
      if (v.content) return this.unwrap(v.content);
    }
    return undefined;
  }

  private extractFramework(tree: any): string {
    if (!tree) return 'AB';
    const str = JSON.stringify(tree).toUpperCase();
    if (str.includes('HORIZON')) return 'HORIZON';
    if (str.includes('H2020')) return 'H2020';
    if (str.includes('FP7')) return 'FP7';
    if (str.includes('ERC')) return 'ERC';
    if (str.includes('MARIE') || str.includes('MSCA')) return 'MSCA';
    return 'AB';
  }

  private asNumber(v: any): number | undefined {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
}
