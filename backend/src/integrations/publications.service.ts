import { Injectable, Logger } from '@nestjs/common';
import { HttpCache } from './http-cache';
import { CrossrefService, CrossrefWork } from './crossref.service';
import { OpenAlexService, OpenAlexWork } from './openalex.service';
import { WosService, WosPublication } from './wos.service';
import { OpenAccessService } from './open-access.service';
import { ScimagoService, JournalQuality } from './scimago.service';
import { LiteratureService, LiteraturePublication } from './literature.service';

/**
 * Birleşik yayın servisi.
 * Tüm dış kaynakları (Scopus, WoS, Crossref, OpenAlex, PubMed, arXiv, S2)
 * DOI üzerinden dedupe eder ve tek zengin yayın nesnesine indirger.
 *
 * Kazanım:
 *  - Bir yayın birden fazla indekste varsa her kaynaktan en güvenli metadata parçasını birleştirir
 *  - Açık erişim, dergi kalite, SDG, atıf metrikleri tek yerde
 *  - AVESIS'in vermediği: FWCI, SDG mapping, multi-index'li atıf teyidi
 */

export interface UnifiedPublication {
  doi?: string;
  title: string;
  abstract?: string;
  year?: number;
  publicationDate?: string;
  type?: string;

  // Venue
  journal?: string;
  issn?: string[];
  publisher?: string;

  // Authors
  authors: Array<{ name: string; orcid?: string; affiliation?: string }>;

  // Metrics (kaynakların max'ını al — bazen farklılık olur)
  citedBy: {
    crossref?: number;
    scopus?: number;
    wos?: number;
    openalex?: number;
    semanticScholar?: number;
    best: number;           // hangisi varsa en yüksek
  };

  // Kalite
  quality?: JournalQuality;

  // Açık erişim
  openAccess?: {
    isOa: boolean;
    oaStatus?: string;
    url?: string;
  };

  // SDG (OpenAlex'ten)
  sdgs?: Array<{ id: string; name: string; score: number }>;

  // Field-weighted citation impact
  fwci?: number;

  // Hangi kaynaklardan birleştirildi
  sources: Array<'crossref' | 'openalex' | 'wos' | 'scopus' | 'pubmed' | 'arxiv' | 'semanticScholar'>;

  // Kaynak bazlı dış ID'ler
  externalIds: {
    doi?: string;
    openalex?: string;
    wos?: string;
    pmid?: string;
    arxivId?: string;
    s2PaperId?: string;
    scopusId?: string;
  };

  url?: string;
}

@Injectable()
export class PublicationsService {
  private readonly logger = new Logger(PublicationsService.name);
  private readonly cache = new HttpCache('publications');

  constructor(
    private crossref: CrossrefService,
    private openalex: OpenAlexService,
    private wos: WosService,
    private oa: OpenAccessService,
    private scimago: ScimagoService,
    private literature: LiteratureService,
  ) {}

  /**
   * ORCID ile bir yazarın tüm kaynaklardan zenginleştirilmiş yayın listesi.
   */
  async getAuthorPublicationsByOrcid(orcidId: string, limit = 100): Promise<UnifiedPublication[]> {
    if (!orcidId) return [];
    const cacheKey = `orcid:${orcidId}:${limit}`;
    const cached = this.cache.get<UnifiedPublication[]>(cacheKey);
    if (cached) return cached;

    // Paralel olarak 3 kaynaktan yayın listesi çek
    const [crossrefWorks, openalexWorks] = await Promise.all([
      this.crossref.getWorksByOrcid(orcidId, limit).catch(() => [] as CrossrefWork[]),
      (async () => {
        const a = await this.openalex.getAuthorByOrcid(orcidId);
        if (!a) return [] as OpenAlexWork[];
        return this.openalex.getAuthorWorks(a.id, limit);
      })().catch(() => [] as OpenAlexWork[]),
    ]);

    // DOI bazlı dedupe map
    const map = new Map<string, UnifiedPublication>();

    for (const w of crossrefWorks) this.mergeCrossref(map, w);
    for (const w of openalexWorks) this.mergeOpenAlex(map, w);

    // Kalite + OA zenginleştirmesi (her DOI için)
    await this.enrichAll(map);

    const result = Array.from(map.values())
      .sort((a, b) => (b.citedBy.best || 0) - (a.citedBy.best || 0))
      .slice(0, limit);
    this.cache.set(cacheKey, result, 60 * 60 * 6); // 6 saat
    return result;
  }

  /**
   * DOI ile tek bir yayının her kaynaktan birleştirilmiş görünümü.
   * Rapor sayfasında yayın kartı için kullanılır.
   */
  async getUnifiedByDoi(doi: string): Promise<UnifiedPublication | null> {
    if (!doi) return null;
    const cacheKey = `doi:${doi.toLowerCase()}`;
    const cached = this.cache.get<UnifiedPublication | null>(cacheKey);
    if (cached !== undefined) return cached;

    const [cr, oax, wos, s2] = await Promise.all([
      this.crossref.getWorkByDoi(doi).catch(() => null),
      this.openalex.getWorkByDoi(doi).catch(() => null),
      this.wos.getByDoi(doi).catch(() => null),
      this.literature.getS2Paper(doi).catch(() => null),
    ]);

    const map = new Map<string, UnifiedPublication>();
    if (cr)  this.mergeCrossref(map, cr);
    if (oax) this.mergeOpenAlex(map, oax);
    if (wos) this.mergeWos(map, wos);
    if (s2)  this.mergeLiterature(map, s2);

    await this.enrichAll(map);

    const result = Array.from(map.values())[0] || null;
    this.cache.set(cacheKey, result, 60 * 60 * 24);
    return result;
  }

  /**
   * Kurumsal bazlı yayın toplama — MKÜ'nün tüm yayınları için.
   * OpenAlex institution ID'si üzerinden en hızlı yol.
   */
  async getInstitutionPublications(institutionId: string, year?: number, limit = 200): Promise<UnifiedPublication[]> {
    if (!institutionId) return [];
    const cacheKey = `inst:${institutionId}:${year || 'all'}:${limit}`;
    const cached = this.cache.get<UnifiedPublication[]>(cacheKey);
    if (cached) return cached;

    const works = await this.openalex.getInstitutionWorks(institutionId, year, limit);
    const map = new Map<string, UnifiedPublication>();
    for (const w of works) this.mergeOpenAlex(map, w);
    await this.enrichAll(map);
    const result = Array.from(map.values()).sort((a, b) => (b.citedBy.best || 0) - (a.citedBy.best || 0));
    this.cache.set(cacheKey, result, 60 * 60 * 6);
    return result;
  }

  // ── Dedupe merge helpers ──────────────────────────────────────────────

  private keyFor(doi?: string, title?: string): string {
    if (doi) return `doi:${doi.toLowerCase()}`;
    if (title) return `t:${title.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 100)}`;
    return `r:${Math.random()}`;
  }

  private mergeCrossref(map: Map<string, UnifiedPublication>, w: CrossrefWork) {
    const key = this.keyFor(w.doi, w.title);
    const existing = map.get(key);
    if (existing) {
      if (!existing.abstract && w.abstract) existing.abstract = w.abstract;
      if (w.citedBy !== undefined) existing.citedBy.crossref = w.citedBy;
      existing.sources.push('crossref');
      existing.externalIds.doi = existing.externalIds.doi || w.doi;
    } else {
      map.set(key, {
        doi: w.doi,
        title: w.title,
        abstract: w.abstract,
        year: w.year,
        publicationDate: w.year ? `${w.year}-${String(w.month || 1).padStart(2, '0')}-01` : undefined,
        type: w.type,
        journal: w.journal,
        issn: w.issn,
        publisher: w.publisher,
        authors: w.authors.map(a => ({
          name: [a.given, a.family].filter(Boolean).join(' '),
          orcid: a.orcid,
          affiliation: a.affiliation,
        })),
        citedBy: { crossref: w.citedBy, best: w.citedBy || 0 },
        openAccess: w.openAccess !== undefined ? { isOa: w.openAccess } : undefined,
        sources: ['crossref'],
        externalIds: { doi: w.doi },
        url: w.url,
      });
    }
  }

  private mergeOpenAlex(map: Map<string, UnifiedPublication>, w: OpenAlexWork) {
    const key = this.keyFor(w.doi, w.title);
    const existing = map.get(key);
    const id = w.id.replace(/^https?:\/\/openalex\.org\//, '');
    if (existing) {
      if (!existing.abstract && (w as any).abstract) existing.abstract = (w as any).abstract;
      existing.citedBy.openalex = w.citedBy;
      existing.fwci = w.fwci ?? existing.fwci;
      existing.sdgs = (w.sdgs || []).map(s => ({ id: s.id, name: s.displayName, score: s.score }));
      if (w.openAccess) {
        existing.openAccess = {
          isOa: w.openAccess.isOa,
          oaStatus: w.openAccess.oaStatus,
          url: w.openAccess.oaUrl,
        };
      }
      existing.sources.push('openalex');
      existing.externalIds.openalex = id;
      existing.citedBy.best = Math.max(existing.citedBy.best || 0, w.citedBy);
    } else {
      map.set(key, {
        doi: w.doi,
        title: w.title,
        year: w.publicationYear,
        publicationDate: w.publicationDate,
        type: w.type,
        journal: w.venue?.displayName,
        issn: w.venue?.issn,
        publisher: w.venue?.publisher,
        authors: (w.authors || []).map(a => ({
          name: a.displayName,
          orcid: a.orcid,
          affiliation: a.institution,
        })),
        citedBy: { openalex: w.citedBy, best: w.citedBy },
        fwci: w.fwci,
        sdgs: (w.sdgs || []).map(s => ({ id: s.id, name: s.displayName, score: s.score })),
        openAccess: w.openAccess ? {
          isOa: w.openAccess.isOa,
          oaStatus: w.openAccess.oaStatus,
          url: w.openAccess.oaUrl,
        } : undefined,
        sources: ['openalex'],
        externalIds: { doi: w.doi, openalex: id },
      });
    }
  }

  private mergeWos(map: Map<string, UnifiedPublication>, w: WosPublication) {
    const key = this.keyFor(w.doi, w.title);
    const existing = map.get(key);
    if (existing) {
      existing.citedBy.wos = w.citedBy;
      existing.citedBy.best = Math.max(existing.citedBy.best || 0, w.citedBy || 0);
      existing.sources.push('wos');
      existing.externalIds.wos = w.uid;
    } else {
      map.set(key, {
        doi: w.doi,
        title: w.title,
        abstract: w.abstract,
        year: w.year,
        type: w.type,
        journal: w.journal,
        authors: w.authors.map(n => ({ name: n })),
        citedBy: { wos: w.citedBy, best: w.citedBy || 0 },
        sources: ['wos'],
        externalIds: { doi: w.doi, wos: w.uid },
      });
    }
  }

  private mergeLiterature(map: Map<string, UnifiedPublication>, p: LiteraturePublication) {
    const key = this.keyFor(p.doi, p.title);
    const existing = map.get(key);
    const sourceKey = p.source === 'pubmed' ? 'pubmed' : p.source === 'arxiv' ? 'arxiv' : 'semanticScholar';
    if (existing) {
      if (!existing.abstract && p.abstract) existing.abstract = p.abstract;
      if (p.source === 'semanticscholar' && p.citedBy !== undefined) {
        existing.citedBy.semanticScholar = p.citedBy;
        existing.citedBy.best = Math.max(existing.citedBy.best || 0, p.citedBy || 0);
      }
      existing.sources.push(sourceKey);
      if (p.source === 'pubmed') existing.externalIds.pmid = p.externalId;
      if (p.source === 'arxiv') existing.externalIds.arxivId = p.externalId;
      if (p.source === 'semanticscholar') existing.externalIds.s2PaperId = p.externalId;
    } else {
      map.set(key, {
        doi: p.doi,
        title: p.title,
        abstract: p.abstract,
        year: p.year,
        journal: p.journal,
        authors: p.authors.map(n => ({ name: n })),
        citedBy: {
          ...(p.source === 'semanticscholar' ? { semanticScholar: p.citedBy } : {}),
          best: p.citedBy || 0,
        },
        sources: [sourceKey],
        externalIds: {
          doi: p.doi,
          ...(p.source === 'pubmed' ? { pmid: p.externalId } : {}),
          ...(p.source === 'arxiv' ? { arxivId: p.externalId } : {}),
          ...(p.source === 'semanticscholar' ? { s2PaperId: p.externalId } : {}),
        },
        url: p.url,
      });
    }
  }

  /**
   * SCImago (quartile) + Unpaywall (OA) ile zenginleştir.
   * Batch'lemek yerine paralel (her yayın için tek fetch).
   */
  private async enrichAll(map: Map<string, UnifiedPublication>): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const pub of map.values()) {
      // SCImago — ISSN varsa kaliteyi ekle
      if (pub.issn && pub.issn.length > 0 && !pub.quality) {
        promises.push(
          this.scimago.getQualityByIssns(pub.issn).then(q => { if (q) pub.quality = q; }).catch(() => {}),
        );
      }
      // Unpaywall — OA durumu eksikse ekle
      if (pub.doi && !pub.openAccess) {
        promises.push(
          this.oa.getOaStatusByDoi(pub.doi).then(info => {
            if (info) {
              pub.openAccess = {
                isOa: info.isOpenAccess,
                oaStatus: info.oaStatus,
                url: info.bestOaUrl,
              };
            }
          }).catch(() => {}),
        );
      }
    }
    await Promise.all(promises);
  }

  /**
   * Bir yayın listesi için analitik özet — panel için hazır KPI'lar.
   */
  summarize(pubs: UnifiedPublication[]): {
    total: number;
    totalCitations: number;
    hIndex: number;
    i10Index: number;
    openAccessCount: number;
    openAccessRatio: number;
    quartileDistribution: Record<string, number>;
    byYear: Array<{ year: number; count: number; citations: number }>;
    sdgDistribution: Array<{ id: string; name: string; count: number }>;
  } {
    const total = pubs.length;
    const totalCitations = pubs.reduce((s, p) => s + (p.citedBy.best || 0), 0);

    const sortedCit = [...pubs].map(p => p.citedBy.best || 0).sort((a, b) => b - a);
    let hIndex = 0;
    for (let i = 0; i < sortedCit.length; i++) {
      if (sortedCit[i] >= i + 1) hIndex = i + 1; else break;
    }
    const i10Index = sortedCit.filter(c => c >= 10).length;

    const openAccessCount = pubs.filter(p => p.openAccess?.isOa).length;

    const quartileDistribution = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, unknown: 0 };
    for (const p of pubs) {
      const q = p.quality?.sjrQuartile;
      if (q) quartileDistribution[q]++; else quartileDistribution.unknown++;
    }

    const yearMap = new Map<number, { count: number; citations: number }>();
    for (const p of pubs) {
      if (!p.year) continue;
      const cur = yearMap.get(p.year) || { count: 0, citations: 0 };
      cur.count++;
      cur.citations += p.citedBy.best || 0;
      yearMap.set(p.year, cur);
    }
    const byYear = Array.from(yearMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, v]) => ({ year, count: v.count, citations: v.citations }));

    const sdgMap = new Map<string, { id: string; name: string; count: number }>();
    for (const p of pubs) {
      for (const s of p.sdgs || []) {
        const key = s.id;
        const cur = sdgMap.get(key) || { id: s.id, name: s.name, count: 0 };
        cur.count++;
        sdgMap.set(key, cur);
      }
    }
    const sdgDistribution = Array.from(sdgMap.values()).sort((a, b) => b.count - a.count);

    return {
      total,
      totalCitations,
      hIndex,
      i10Index,
      openAccessCount,
      openAccessRatio: total > 0 ? Math.round((openAccessCount / total) * 100) : 0,
      quartileDistribution,
      byYear,
      sdgDistribution,
    };
  }
}
