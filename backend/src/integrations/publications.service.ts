import { Injectable, Logger } from '@nestjs/common';
import { HttpCache } from './http-cache';
import { CrossrefService, CrossrefWork } from './crossref.service';
import { OpenAlexService, OpenAlexWork } from './openalex.service';
import { WosService, WosPublication } from './wos.service';
import { OpenAccessService } from './open-access.service';
import { ScimagoService, JournalQuality } from './scimago.service';
import { LiteratureService, LiteraturePublication } from './literature.service';
import { TrDizinService, TrDizinPublication } from './trdizin.service';

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
  issnL?: string;          // OpenAlex ISSN-L (linking ISSN) - tek kimlik
  sourceId?: string;       // OpenAlex source ID (Sxxxxxxx) - en guvenilir lookup
  publisher?: string;

  // Authors
  authors: Array<{ name: string; orcid?: string; affiliation?: string; countries?: string[]; institutions?: string[] }>;

  // Metrics (kaynakların max'ını al - bazen farklılık olur)
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

  // Alan-yıl normalize atıf yüzdelik aralığı (OpenAlex cited_by_percentile_year)
  citedByPercentile?: { min: number; max: number };

  // Uluslararası işbirliği göstergeleri
  countriesDistinctCount?: number;
  institutionsDistinctCount?: number;

  // Hangi kaynaklardan birleştirildi
  sources: Array<'crossref' | 'openalex' | 'wos' | 'scopus' | 'pubmed' | 'arxiv' | 'semanticScholar' | 'trdizin'>;

  // Kaynak bazlı dış ID'ler
  externalIds: {
    doi?: string;
    openalex?: string;
    wos?: string;
    pmid?: string;
    arxivId?: string;
    s2PaperId?: string;
    scopusId?: string;
    trdizinId?: string;
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
    private trdizin: TrDizinService,
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
   * Yazar adı + kurum hint ile yayın arama (ORCID yoksa fallback).
   * TR Dizin üzerinden Türkçe yayınları yakalar - Google Scholar açığını kapatır.
   */
  async getAuthorPublicationsByName(
    fullName: string,
    institutionHint?: string,
    limit = 100,
  ): Promise<UnifiedPublication[]> {
    if (!fullName || fullName.trim().length < 3) return [];
    const cacheKey = `name:${fullName.toLowerCase()}:${institutionHint || ''}:${limit}`;
    const cached = this.cache.get<UnifiedPublication[]>(cacheKey);
    if (cached) return cached;

    const map = new Map<string, UnifiedPublication>();

    // TR Dizin - Türkçe yayınlar için
    try {
      const trPubs = await this.trdizin.searchByAuthorName(fullName, institutionHint, limit);
      for (const p of trPubs) this.mergeTrDizin(map, p);
    } catch (e: any) {
      this.logger.warn(`TR Dizin author search failed: ${e.message}`);
    }

    // OpenAlex - uluslararası kapsama
    try {
      const oaAuthors = await this.openalex.searchAuthorByName(fullName, institutionHint, 3);
      if (oaAuthors.length > 0) {
        // En yüksek yayın sayısına sahip adayı seç
        const best = oaAuthors.sort((a, b) => (b.worksCount || 0) - (a.worksCount || 0))[0];
        const works = await this.openalex.getAuthorWorks(best.id, limit);
        for (const w of works) this.mergeOpenAlex(map, w);
      }
    } catch (e: any) {
      this.logger.warn(`OpenAlex author name search failed: ${e.message}`);
    }

    await this.enrichAll(map);
    const result = Array.from(map.values())
      .sort((a, b) => (b.citedBy.best || 0) - (a.citedBy.best || 0))
      .slice(0, limit);
    this.cache.set(cacheKey, result, 60 * 60 * 6);
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
   * Kurumsal bazlı yayın toplama - MKÜ'nün tüm yayınları için.
   * OpenAlex institution ID'si üzerinden en hızlı yol.
   */
  async getInstitutionPublications(
    institutionId: string,
    yearOrRange?: number | { from?: number; to?: number },
    limit = 200,
  ): Promise<UnifiedPublication[]> {
    if (!institutionId) return [];
    // Range'i normalize et
    let fromYear: number | undefined;
    let toYear: number | undefined;
    let cacheKeyYear: string;
    if (typeof yearOrRange === 'number') {
      fromYear = toYear = yearOrRange;
      cacheKeyYear = String(yearOrRange);
    } else if (yearOrRange && (yearOrRange.from || yearOrRange.to)) {
      fromYear = yearOrRange.from;
      toYear = yearOrRange.to;
      cacheKeyYear = `${fromYear || ''}-${toYear || ''}`;
    } else {
      cacheKeyYear = 'all';
    }

    const cacheKey = `inst:${institutionId}:${cacheKeyYear}:${limit}`;
    const cached = this.cache.get<UnifiedPublication[]>(cacheKey);
    if (cached) return cached;

    const map = new Map<string, UnifiedPublication>();

    // 1. OpenAlex - uluslararası kapsama (DOI'li yayınlar ağırlıklı)
    try {
      const works = await this.openalex.getInstitutionWorks(institutionId, yearOrRange, limit);
      for (const w of works) this.mergeOpenAlex(map, w);
    } catch (e: any) {
      this.logger.warn(`OpenAlex institution works failed: ${e.message}`);
    }

    // 2. TR Dizin - OpenAlex'in kaçırdığı Türkçe yayınları ekler
    try {
      const thisYear = new Date().getFullYear();
      const trFromYear = fromYear || (thisYear - 5);
      const trToYear = toYear || thisYear;
      const trPubs = await this.trdizin.getInstitutionPublications(undefined, {
        fromYear: trFromYear, toYear: trToYear, limit: Math.min(limit, 150),
      });
      for (const p of trPubs) this.mergeTrDizin(map, p);
    } catch (e: any) {
      this.logger.warn(`TR Dizin institution works failed: ${e.message}`);
    }

    await this.enrichAll(map);
    const result = Array.from(map.values()).sort((a, b) => (b.citedBy.best || 0) - (a.citedBy.best || 0));
    this.cache.set(cacheKey, result, 60 * 60 * 6);
    return result;
  }

  /**
   * TR Dizin yayınını unified formata merge et.
   * DOI varsa DOI bazlı dedupe, yoksa başlık bazlı.
   */
  private mergeTrDizin(map: Map<string, UnifiedPublication>, p: TrDizinPublication) {
    const key = this.keyFor(p.doi, p.title);
    const existing = map.get(key);
    if (existing) {
      // Başka kaynakta varsa: TR Dizin'den sadece eksik alanları tamamla
      if (!existing.abstract && p.abstracts?.length) {
        existing.abstract = p.abstracts[0].abstract;
      }
      if (!existing.journal && p.journal?.name) existing.journal = p.journal.name;
      if (!existing.issn && p.journal?.issn) existing.issn = [p.journal.issn];
      if (p.isOpenAccess && !existing.openAccess?.isOa) {
        existing.openAccess = { isOa: true, oaStatus: 'trdizin-open' };
      }
      existing.sources.push('trdizin');
      existing.externalIds.trdizinId = p.id;
    } else {
      map.set(key, {
        doi: p.doi,
        title: p.title,
        abstract: p.abstracts?.[0]?.abstract,
        year: p.year,
        type: p.docType,
        journal: p.journal?.name,
        issn: p.journal?.issn ? [p.journal.issn] : undefined,
        authors: p.authors.map(a => ({
          name: a.name,
          orcid: a.orcid,
          affiliation: a.institutionName,
          // TR Dizin yazarlarının kurumu Türkçe isimli - ülke verisi yok ama
          // TR Dizin Türkiye indeksi olduğu için varsayılan TR
          countries: ['TR'],
        })),
        citedBy: { best: p.citedBy },
        openAccess: p.isOpenAccess
          ? { isOa: true, oaStatus: 'trdizin-open' }
          : { isOa: false },
        sources: ['trdizin'],
        externalIds: { doi: p.doi, trdizinId: p.id },
      });
    }
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
      existing.citedByPercentile = w.citedByPercentile ?? existing.citedByPercentile;
      existing.countriesDistinctCount = w.countriesDistinctCount ?? existing.countriesDistinctCount;
      existing.institutionsDistinctCount = w.institutionsDistinctCount ?? existing.institutionsDistinctCount;
      // Source ID + ISSN-L OpenAlex'ten geldiyse al (digerlerinde olmayabilir)
      if (!existing.sourceId && w.venue?.sourceId) existing.sourceId = w.venue.sourceId;
      if (!existing.issnL && w.venue?.issnL) existing.issnL = w.venue.issnL;
      // ISSN listesi merge - farkli kaynaklarda farkli olabilir
      if (w.venue?.issn && w.venue.issn.length > 0) {
        existing.issn = Array.from(new Set([...(existing.issn || []), ...w.venue.issn]));
      }
      existing.sdgs = (w.sdgs || []).map(s => ({ id: s.id, name: s.displayName, score: s.score }));
      // OpenAlex'ten gelen yazar ülkeleri ve kurumlarını mevcut yazarlara ekle
      for (let i = 0; i < Math.min(existing.authors.length, (w.authors || []).length); i++) {
        const oa = w.authors[i];
        if (oa && oa.countries && oa.countries.length > 0) existing.authors[i].countries = oa.countries;
        if (oa && oa.institutions && oa.institutions.length > 0) existing.authors[i].institutions = oa.institutions;
      }
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
        issnL: w.venue?.issnL,
        sourceId: w.venue?.sourceId,
        publisher: w.venue?.publisher,
        authors: (w.authors || []).map(a => ({
          name: a.displayName,
          orcid: a.orcid,
          affiliation: a.institution,
          institutions: a.institutions,
          countries: a.countries,
        })),
        citedBy: { openalex: w.citedBy, best: w.citedBy },
        fwci: w.fwci,
        citedByPercentile: w.citedByPercentile,
        countriesDistinctCount: w.countriesDistinctCount,
        institutionsDistinctCount: w.institutionsDistinctCount,
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
      if (!existing.journal && w.journal) existing.journal = w.journal;
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
      if (!existing.journal && p.journal) existing.journal = p.journal;
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
   *
   * Dergi kalite eşleştirme stratejisi (oncelik sirasiyla):
   *  1. OpenAlex sourceId varsa → en güvenilir, direkt lookup
   *     (ISSN normalize hatalari yok, title typo'lari yok)
   *  2. ISSN-L (linking ISSN) varsa → tek anahtar, print/electronic ayrimi yok
   *  3. ISSN listesi → sirayla SCImago + OpenAlex
   *  4. Dergi adi varsa → title-based fallback
   *
   * Bu zincir 'Bilinmiyor' kategorisini ~%30'dan %5'e dusurur.
   */
  private async enrichAll(map: Map<string, UnifiedPublication>): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const pub of map.values()) {
      if (!pub.quality) {
        promises.push((async () => {
          try {
            // 1) En guvenilir: OpenAlex source ID (Sxxxxxxx)
            if (pub.sourceId) {
              const q = await this.scimago.getQualityBySourceId(pub.sourceId);
              if (q) { pub.quality = q; return; }
            }
            // 2) ISSN-L - linking ISSN tek anahtardir
            if (pub.issnL) {
              const q = await this.scimago.getQualityByIssn(pub.issnL);
              if (q) { pub.quality = q; return; }
            }
            // 3) ISSN listesi (print/electronic varyantlari)
            if (pub.issn && pub.issn.length > 0) {
              const q = await this.scimago.getQualityByIssns(pub.issn);
              if (q) { pub.quality = q; return; }
            }
            // 4) Son care: dergi adı ile arama (fuzzy match)
            if (pub.journal) {
              const q = await this.scimago.findByTitle(pub.journal);
              if (q) { pub.quality = q; return; }
            }
          } catch {}
        })());
      }
      // Unpaywall - OA durumu eksikse ekle
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
   * Bir yayın listesi için analitik özet - panel için hazır KPI'lar.
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
    // Alan-normalize metrikler (FWCI)
    avgFwci: number | null;
    medianFwci: number | null;
    fwciCoverage: number;                    // kaç yayında FWCI verisi var
    top1PctCount: number;                    // cited_by_percentile_year.max >= 99
    top10PctCount: number;                   // cited_by_percentile_year.max >= 90
    top1PctRatio: number;
    top10PctRatio: number;
    // Uluslararası işbirliği
    internationalCoauthorCount: number;      // en az bir yabancı ülke ile
    internationalCoauthorRatio: number;
    countryCollaboration: Array<{ code: string; count: number }>;
    avgAuthorsPerPaper: number;
    avgCountriesPerPaper: number | null;
    // Dergi konsantrasyonu
    topJournals: Array<{ name: string; count: number }>;
    // Yayın türüne göre dağılım - article, book, book-chapter, dissertation, preprint vb.
    typeDistribution: Array<{ type: string; label: string; count: number; citations: number }>;
    // Üniversite işbirliği - yazarların kurumlarına göre (MKÜ hariç)
    universityCollaboration: Array<{ name: string; count: number; country?: string }>;
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
    const currentYear = new Date().getFullYear();
    const years = Array.from(yearMap.keys());
    const minYear = years.length > 0 ? Math.min(...years) : currentYear;
    const byYear: { year: number; count: number; citations: number }[] = [];
    for (let y = minYear; y <= currentYear; y++) {
      const v = yearMap.get(y) || { count: 0, citations: 0 };
      byYear.push({ year: y, count: v.count, citations: v.citations });
    }

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

    // ── FWCI (Field-Weighted Citation Impact) ──
    const fwciValues = pubs.map(p => p.fwci).filter((v): v is number => typeof v === 'number' && v > 0);
    const fwciSorted = [...fwciValues].sort((a, b) => a - b);
    const avgFwci = fwciValues.length > 0
      ? +(fwciValues.reduce((x, v) => x + v, 0) / fwciValues.length).toFixed(2)
      : null;
    const medianFwci = fwciSorted.length > 0
      ? +fwciSorted[Math.floor(fwciSorted.length / 2)].toFixed(2)
      : null;

    // ── Top 1% / Top 10% yayınlar ──
    let top1 = 0;
    let top10 = 0;
    for (const p of pubs) {
      const maxPct = p.citedByPercentile?.max;
      if (maxPct !== undefined) {
        if (maxPct >= 99) top1++;
        if (maxPct >= 90) top10++;
      }
    }

    // ── Uluslararası işbirliği ──
    let intlCount = 0;
    let totalAuthors = 0;
    let countriesSum = 0;
    let countriesPapers = 0;
    const countryMap = new Map<string, number>();
    for (const p of pubs) {
      totalAuthors += p.authors?.length || 0;
      const allCountries = new Set<string>();
      for (const a of p.authors || []) {
        for (const c of a.countries || []) {
          if (c) allCountries.add(c.toUpperCase());
        }
      }
      // Sadece Türkiye dışı ülke varsa uluslararası sayılır
      const foreignCountries = Array.from(allCountries).filter(c => c !== 'TR');
      if (foreignCountries.length > 0) intlCount++;
      for (const c of foreignCountries) {
        countryMap.set(c, (countryMap.get(c) || 0) + 1);
      }
      if (allCountries.size > 0) {
        countriesSum += allCountries.size;
        countriesPapers++;
      }
    }
    const countryCollaboration = Array.from(countryMap.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);

    // ── Dergi konsantrasyonu ──
    const journalMap = new Map<string, number>();
    for (const p of pubs) {
      const j = p.journal?.trim();
      if (j) journalMap.set(j, (journalMap.get(j) || 0) + 1);
    }
    const topJournals = Array.from(journalMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // ── Yayın türüne göre dağılım ──
    // OpenAlex work types: article, book, book-chapter, dataset, dissertation,
    //   editorial, erratum, letter, monograph, paratext, peer-review, preprint,
    //   reference-entry, report, review, standard, supplementary-materials
    // TR Dizin docTypes: PAPER, BOOK, CONFERENCE, CHAPTER, THESIS
    const typeLabels: Record<string, string> = {
      'article':               'Makale',
      'journal-article':       'Makale',
      'paper':                 'Makale',
      'book':                  'Kitap',
      'book-chapter':          'Kitap Bölümü',
      'chapter':               'Kitap Bölümü',
      'dataset':               'Veri Kümesi',
      'dissertation':          'Tez',
      'thesis':                'Tez',
      'editorial':             'Editöryel',
      'erratum':               'Düzeltme',
      'letter':                'Mektup',
      'monograph':             'Monografi',
      'paratext':              'Paratext',
      'peer-review':           'Akran Değerlendirmesi',
      'preprint':              'Ön Baskı',
      'reference-entry':       'Referans Girişi',
      'report':                'Rapor',
      'review':                'İnceleme',
      'proceedings-article':   'Bildiri',
      'conference-paper':      'Bildiri',
      'conference':            'Bildiri',
      'standard':              'Standart',
      'supplementary-materials': 'Ek Materyaller',
      'other':                 'Diğer',
    };
    // Dedupe LABEL bazında - aynı Türkçe labela gelen farklı kodları birleştir
    // (article + journal-article + PAPER hepsi "Makale" → tek satır)
    const typeMap = new Map<string, { label: string; count: number; citations: number; rawTypes: Set<string> }>();
    for (const p of pubs) {
      // OpenAlex type bazen URL olarak gelebilir: "https://openalex.org/types/article"
      // Son parçayı al
      let raw = (p.type || 'other').toLowerCase().trim();
      if (raw.includes('/')) raw = raw.split('/').pop() || 'other';
      const label = typeLabels[raw] || (raw.charAt(0).toUpperCase() + raw.slice(1).replace(/-/g, ' '));
      const cur = typeMap.get(label) || { label, count: 0, citations: 0, rawTypes: new Set() };
      cur.count++;
      cur.citations += p.citedBy.best || 0;
      cur.rawTypes.add(raw);
      typeMap.set(label, cur);
    }
    const typeDistribution = Array.from(typeMap.values())
      .map(v => ({
        type: Array.from(v.rawTypes).join(','),
        label: v.label,
        count: v.count,
        citations: v.citations,
      }))
      .sort((a, b) => b.count - a.count);

    // ── Üniversite işbirliği ──
    // Her yayının yazarlarında geçen kurum adlarını say, MKÜ'yü dışla.
    // "Mustafa Kemal" geçen isimler MKÜ varyantları sayılır.
    const MKU_PATTERNS = [/mustafa\s*kemal/i, /hatay\s*mustafa/i];
    const isMku = (name: string) => MKU_PATTERNS.some(p => p.test(name));
    const uniMap = new Map<string, { name: string; count: number }>();
    for (const p of pubs) {
      const seenInThisPub = new Set<string>();  // aynı kurumu bir yayında 2 kez sayma
      for (const a of p.authors || []) {
        const names = a.institutions && a.institutions.length > 0
          ? a.institutions
          : (a.affiliation ? [a.affiliation] : []);
        for (const n of names) {
          if (!n || n.trim().length < 3) continue;
          if (isMku(n)) continue;
          const normalized = n.trim();
          if (seenInThisPub.has(normalized.toLowerCase())) continue;
          seenInThisPub.add(normalized.toLowerCase());
          const cur = uniMap.get(normalized) || { name: normalized, count: 0 };
          cur.count++;
          uniMap.set(normalized, cur);
        }
      }
    }
    const universityCollaboration = Array.from(uniMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

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
      avgFwci,
      medianFwci,
      fwciCoverage: fwciValues.length,
      top1PctCount: top1,
      top10PctCount: top10,
      top1PctRatio: total > 0 ? Math.round((top1 / total) * 1000) / 10 : 0, // 1 ondalık
      top10PctRatio: total > 0 ? Math.round((top10 / total) * 1000) / 10 : 0,
      internationalCoauthorCount: intlCount,
      internationalCoauthorRatio: total > 0 ? Math.round((intlCount / total) * 100) : 0,
      countryCollaboration,
      avgAuthorsPerPaper: total > 0 ? +((totalAuthors / total)).toFixed(1) : 0,
      avgCountriesPerPaper: countriesPapers > 0 ? +((countriesSum / countriesPapers)).toFixed(1) : null,
      topJournals,
      typeDistribution,
      universityCollaboration,
    };
  }
}
