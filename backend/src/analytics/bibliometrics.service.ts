import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { PublicationsService, UnifiedPublication } from '../integrations/publications.service';
import { OpenAlexService } from '../integrations/openalex.service';
import { ScimagoService } from '../integrations/scimago.service';

/**
 * Bibliyometri servisi — akademik çıktıları tüm kaynaklardan birleştirip
 * AVESIS-sınıfı analitik için uygun agregalar üretir.
 *
 * - Araştırmacı scorecard (tek kullanıcı)
 * - Fakülte bibliometrisi (fakülteye bağlı tüm kullanıcıların yayınları)
 * - Kurumsal bibliometri (tüm sistem)
 */

export interface ResearcherBibliometrics {
  user: {
    id: string;
    name: string;
    orcidId?: string;
    scopusAuthorId?: string;
    wosResearcherId?: string;
    faculty?: string;
    department?: string;
  };
  summary: ReturnType<PublicationsService['summarize']>;
  sourceCoverage: Record<string, number>;   // Her kaynaktan kaç yayın geldi
  topCited: UnifiedPublication[];            // En çok atıf alan 5 yayın
  publications?: UnifiedPublication[];       // İsteğe bağlı — full list
}

export interface FacultyBibliometrics {
  faculty: string;
  researcherCount: number;
  withIdentifiersCount: number;    // ORCID/Scopus/WoS ID'si olan
  summary: ResearcherBibliometrics['summary'];
  topResearchers: Array<{
    userId: string;
    name: string;
    hIndex: number;
    citations: number;
    docs: number;
  }>;
  publications?: Array<any>;
}

@Injectable()
export class BibliometricsService {
  private readonly logger = new Logger(BibliometricsService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private publications: PublicationsService,
    private openalex: OpenAlexService,
    private scimago: ScimagoService,
  ) {}

  /**
   * Bir araştırmacının tam bibliyometrik profili.
   * ORCID varsa en zengin veri; yoksa Scopus ID'den OpenAlex'e, son çare
   * Semantic Scholar araması.
   */
  async getResearcher(userId: string, includeFullList = false): Promise<ResearcherBibliometrics | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;

    let pubs: UnifiedPublication[] = [];

    // En iyi veri: ORCID
    if (user.orcidId) {
      pubs = await this.publications.getAuthorPublicationsByOrcid(user.orcidId, 200);
    }

    // ORCID yoksa veya ORCID'den hiç yayın gelmediyse — isim bazlı fallback
    // (TR Dizin + OpenAlex hem Türkçe hem uluslararası yakalar)
    if (pubs.length === 0) {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      // Kurum hint: sadece "Mustafa Kemal" ver — OpenAlex full affiliation ister
      const instHint = 'Mustafa Kemal';
      try {
        pubs = await this.publications.getAuthorPublicationsByName(fullName, instHint, 200);
      } catch (e: any) {
        this.logger.warn(`Name-based publications failed: ${e.message}`);
      }
    }

    const summary = this.publications.summarize(pubs);
    const sourceCoverage: Record<string, number> = {};
    for (const p of pubs) {
      for (const s of p.sources) {
        sourceCoverage[s] = (sourceCoverage[s] || 0) + 1;
      }
    }

    const topCited = [...pubs]
      .sort((a, b) => (b.citedBy.best || 0) - (a.citedBy.best || 0))
      .slice(0, 5);

    return {
      user: {
        id: user.id,
        name: `${user.title || ''} ${user.firstName} ${user.lastName}`.trim(),
        orcidId: user.orcidId,
        scopusAuthorId: (user as any).scopusAuthorId,
        wosResearcherId: (user as any).wosResearcherId,
        faculty: user.faculty,
        department: user.department,
      },
      summary,
      sourceCoverage,
      topCited,
      publications: includeFullList ? pubs : undefined,
    };
  }

  /**
   * Fakülte düzeyinde bibliometri — tüm araştırmacıların yayınları dedupe edilir.
   */
  async getFaculty(faculty: string, topResearcherCount = 10): Promise<FacultyBibliometrics | null> {
    if (!faculty) return null;
    const researchers = await this.userRepo.find({ where: { faculty, isActive: true as any } });
    if (!researchers.length) return null;

    const withIdentifiers = researchers.filter(r => r.orcidId || (r as any).scopusAuthorId || (r as any).wosResearcherId);

    // Her araştırmacıdan paralel olarak yayın çek (makul limit — hepsi değil, en aktif 50)
    const limit = Math.min(withIdentifiers.length, 50);
    const sample = withIdentifiers.slice(0, limit);

    const perResearcher: Array<{ user: User; pubs: UnifiedPublication[] }> = [];
    // Batch halinde — 5'erli paralel, rate-limit dostu
    for (let i = 0; i < sample.length; i += 5) {
      const batch = sample.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (u) => {
          try {
            if (u.orcidId) {
              const pubs = await this.publications.getAuthorPublicationsByOrcid(u.orcidId, 100);
              return { user: u, pubs };
            }
          } catch {}
          return { user: u, pubs: [] as UnifiedPublication[] };
        }),
      );
      perResearcher.push(...results);
    }

    // Fakülte düzeyinde dedupe
    const allMap = new Map<string, UnifiedPublication>();
    for (const { pubs } of perResearcher) {
      for (const p of pubs) {
        const key = p.doi ? `doi:${p.doi.toLowerCase()}` : `t:${p.title.toLowerCase().slice(0, 80)}`;
        const existing = allMap.get(key);
        if (existing) {
          existing.citedBy.best = Math.max(existing.citedBy.best || 0, p.citedBy.best || 0);
        } else {
          allMap.set(key, p);
        }
      }
    }
    const allPubs = Array.from(allMap.values());
    const summary = this.publications.summarize(allPubs);

    // Top araştırmacılar — h-index bazlı
    const topResearchers = perResearcher
      .map(({ user, pubs }) => {
        const s = this.publications.summarize(pubs);
        return {
          userId: user.id,
          name: `${user.title || ''} ${user.firstName} ${user.lastName}`.trim(),
          hIndex: s.hIndex,
          citations: s.totalCitations,
          docs: s.total,
        };
      })
      .sort((a, b) => b.hIndex - a.hIndex)
      .slice(0, topResearcherCount);

    return {
      faculty,
      researcherCount: researchers.length,
      withIdentifiersCount: withIdentifiers.length,
      summary,
      topResearchers,
      publications: allPubs.map(p => ({
        title: p.title,
        year: p.year,
        journal: p.journal,
        doi: p.doi,
        citedBy: p.citedBy,
        quality: p.quality,
        openAccess: p.openAccess,
        sources: p.sources,
        authors: (p.authors || []).slice(0, 5).map(a => a.name),
      })),
    };
  }

  /**
   * Kurumsal bibliometri — OpenAlex institution ID üzerinden.
   *
   * İki-aşamalı hesap:
   *  1. Kurumsal TOPLAMLAR (works_count, cited_by_count, h_index, i10_index)
   *     → OpenAlex institution summary endpoint'inden DIREKT. Tüm kurumu kapsar.
   *  2. Sample bazlı detaylar (Q1-Q4, byYear, top papers, country collab, FWCI örnekleri)
   *     → En çok atıf alan ilk N yayından. Sample olduğu AÇIKÇA işaretlenir.
   *
   * Eskiden her şey sample üzerinden hesaplanıyordu → FWCI 22.67, Top 1% = %40 gibi
   * absürt sayılar çıkıyordu. Artık kurumsal gerçek sayılar + örneklem bazlı
   * göstergeler ayrı ayrı sunuluyor.
   */
  async getInstitutional(institutionId: string, year?: number): Promise<any> {
    // 1. Kurumsal TOPLAMLAR — OpenAlex institution endpoint'inden direkt
    const instSummary = await this.openalex.getInstitutionSummary(institutionId).catch(() => null);

    // 2. SAMPLE — detay tablolar için en çok atıf alan yayınlar
    const pubs = await this.publications.getInstitutionPublications(institutionId, year, 500);
    const sampleSummary = this.publications.summarize(pubs);

    // Kurumsal gerçek byYear — tüm yıllar için works + citations + OA
    let byYearReal: Array<{ year: number; count: number; citations: number; oaCount: number }> = [];
    let realTotalOaCount = 0;
    let realTotalWorksForOa = 0;
    if (instSummary?.countsByYear) {
      const currentYear = new Date().getFullYear();
      const byYearMap = new Map<number, { count: number; citations: number; oaCount: number }>();
      for (const c of instSummary.countsByYear) {
        byYearMap.set(c.year, { count: c.worksCount, citations: c.citedByCount, oaCount: c.oaWorksCount || 0 });
        realTotalOaCount += c.oaWorksCount || 0;
        realTotalWorksForOa += c.worksCount || 0;
      }
      const years = Array.from(byYearMap.keys());
      if (years.length > 0) {
        const minYear = Math.min(...years);
        for (let y = minYear; y <= currentYear; y++) {
          const v = byYearMap.get(y) || { count: 0, citations: 0, oaCount: 0 };
          byYearReal.push({ year: y, count: v.count, citations: v.citations, oaCount: v.oaCount });
        }
      }
    }

    // Kurumsal gerçek OA oranı — counts_by_year'dan
    const realOaRatio = realTotalWorksForOa > 0
      ? Math.round((realTotalOaCount / realTotalWorksForOa) * 100)
      : null;

    return {
      institutionId,

      // KURUMSAL GERÇEK TOPLAMLAR — OpenAlex institution endpoint kaynaklı
      total: instSummary?.worksCount ?? sampleSummary.total,
      totalCitations: instSummary?.citedByCount ?? sampleSummary.totalCitations,
      hIndex: instSummary?.hIndex ?? sampleSummary.hIndex,
      i10Index: instSummary?.i10Index ?? sampleSummary.i10Index,
      twoYearMeanCitedness: instSummary?.twoYearMeanCitedness,
      byYear: byYearReal.length > 0 ? byYearReal : sampleSummary.byYear,

      // SAMPLE BAZLI — net olarak 'sample' prefix ile
      // Kalite dağılımı sample'dan — 500 top-cited içinde Q1-Q4 oranı
      quartileDistribution: sampleSummary.quartileDistribution,
      sdgDistribution: sampleSummary.sdgDistribution,

      // Açık erişim — kurumsal gerçek (OpenAlex counts_by_year'dan) varsa onu kullan
      // yoksa sample'dan
      openAccessCount: realOaRatio !== null ? realTotalOaCount : sampleSummary.openAccessCount,
      openAccessRatio: realOaRatio !== null ? realOaRatio : sampleSummary.openAccessRatio,
      openAccessSource: realOaRatio !== null ? 'institutional' : 'sample',
      sampleOpenAccessCount: sampleSummary.openAccessCount,
      sampleOpenAccessRatio: sampleSummary.openAccessRatio,

      // FWCI ve Top Percentile — SAMPLE BAZLI — dürüst etiket
      // Bunlar "en çok atıf alan 500 yayının" istatistiği; tüm kurumun değil
      sampleSize: pubs.length,
      sampleNote: `Aşağıdaki FWCI, Top 1%, Top 10%, dergi kalite, uluslararası ortaklık ve ülke dağılımı metrikleri kurumun en çok atıf alan ${pubs.length} yayını üzerinden hesaplanmıştır — tüm kurum değil.`,
      avgFwci: sampleSummary.avgFwci,
      medianFwci: sampleSummary.medianFwci,
      fwciCoverage: sampleSummary.fwciCoverage,
      top1PctCount: sampleSummary.top1PctCount,
      top10PctCount: sampleSummary.top10PctCount,
      top1PctRatio: sampleSummary.top1PctRatio,
      top10PctRatio: sampleSummary.top10PctRatio,
      internationalCoauthorCount: sampleSummary.internationalCoauthorCount,
      internationalCoauthorRatio: sampleSummary.internationalCoauthorRatio,
      countryCollaboration: sampleSummary.countryCollaboration,
      avgAuthorsPerPaper: sampleSummary.avgAuthorsPerPaper,
      avgCountriesPerPaper: sampleSummary.avgCountriesPerPaper,
      topJournals: sampleSummary.topJournals,
      typeDistribution: sampleSummary.typeDistribution,

      // Yayın listesi — sample
      publications: pubs.map(p => {
        const countries = Array.from(new Set(
          (p.authors || []).flatMap(a => (a.countries || []).map(c => c.toUpperCase()))
        ));
        return {
          title: p.title,
          year: p.year,
          journal: p.journal,
          doi: p.doi,
          citedBy: p.citedBy,
          quality: p.quality,
          openAccess: p.openAccess,
          sources: p.sources,
          authors: (p.authors || []).slice(0, 5).map(a => a.name),
          countries,
        };
      }),
    };
  }

  /**
   * Peer benchmark — MKÜ'yü çevresindeki peer üniversitelerle karşılaştırır.
   * OpenAlex institution summary endpoint'i tek istekte kurum metriklerini verir.
   *
   * Peer seti: bölgesel (Hatay), yakın ölçekli (orta büyüklükte devlet üniversiteleri).
   * ENV ile override edilebilir (PEER_OPENALEX_IDS: virgüllü OpenAlex ID listesi).
   */
  async getPeerBenchmark(): Promise<{
    peers: Array<{
      id: string;
      displayName: string;
      country?: string;
      worksCount: number;
      citedByCount: number;
      hIndex?: number;
      i10Index?: number;
      twoYearMeanCitedness?: number;
      worksLastYear?: number;
      worksThisYear?: number;
      isMku: boolean;
    }>;
    note: string;
  }> {
    // Peer set — önce ENV, sonra varsayılan
    const peerEnv = process.env.PEER_OPENALEX_IDS;
    let peerIds: string[] = [];
    let peerNames: string[] = [];

    if (peerEnv) {
      peerIds = peerEnv.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      // Varsayılan peer seti — bölgesel ve benzer ölçekli TR devlet üniversiteleri
      peerNames = [
        'Mustafa Kemal University',          // MKÜ'nün kendisi
        'Cukurova University',               // Bölgesel (Adana)
        'Iskenderun Technical University',   // En yakın komşu (Hatay)
        'Gaziantep University',              // Yakın büyük devlet
        'Kahramanmaras Sutcu Imam University', // Bölgesel orta ölçek
      ];
    }

    // Her peer için OpenAlex ID'sini bul (paralel)
    if (peerIds.length === 0) {
      const found = await Promise.all(
        peerNames.map(async (name) => {
          try {
            const candidates = await this.openalex.searchInstitution(name, 'TR');
            const match = candidates.find(c =>
              c.displayName.toLowerCase().includes(name.toLowerCase().split(' ')[0])
            ) || candidates[0];
            return match?.id || null;
          } catch { return null; }
        }),
      );
      peerIds = found.filter((x): x is string => !!x);
    }

    const mkuId = await this.findMkuInstitutionId();
    // MKÜ ilk olsun — ama zaten listedeyse eklemeyelim
    const allIds = mkuId && !peerIds.includes(mkuId) ? [mkuId, ...peerIds] : peerIds;

    // Her peer için summary çek (paralel)
    const summaries = await Promise.all(
      allIds.map(id => this.openalex.getInstitutionSummary(id).catch(() => null)),
    );

    const currentYear = new Date().getFullYear();
    const peers = summaries
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map(s => {
        const lastYear = s.countsByYear.find(c => c.year === currentYear - 1)?.worksCount || 0;
        const thisYear = s.countsByYear.find(c => c.year === currentYear)?.worksCount || 0;
        return {
          id: s.id,
          displayName: s.displayName,
          country: s.country,
          worksCount: s.worksCount,
          citedByCount: s.citedByCount,
          hIndex: s.hIndex,
          i10Index: s.i10Index,
          twoYearMeanCitedness: s.twoYearMeanCitedness,
          worksLastYear: lastYear,
          worksThisYear: thisYear,
          isMku: s.id === mkuId || s.displayName.toLowerCase().includes('mustafa kemal'),
        };
      })
      .sort((a, b) => b.worksCount - a.worksCount); // En çok yayın üstte

    return {
      peers,
      note: peers.length === 0
        ? 'Peer kurum bulunamadı — PEER_OPENALEX_IDS env ile manuel tanımlayabilirsiniz.'
        : `${peers.length} kurum karşılaştırıldı. OpenAlex institution summary kaynaklı.`,
    };
  }

  /**
   * MKÜ için OpenAlex ID'sini bul.
   */
  async findMkuInstitutionId(): Promise<string | null> {
    const envId = process.env.MKU_OPENALEX_ID;
    if (envId) return envId;
    const candidates = await this.openalex.searchInstitution('Mustafa Kemal', 'TR');
    const mku = candidates.find(i => i.displayName.toLowerCase().includes('mustafa kemal'));
    return mku?.id || null;
  }

  private normalizeOaToUnified(w: any): UnifiedPublication {
    return {
      doi: w.doi,
      title: w.title,
      year: w.publicationYear,
      type: w.type,
      journal: w.venue?.displayName,
      issn: w.venue?.issn,
      publisher: w.venue?.publisher,
      authors: (w.authors || []).map((a: any) => ({
        name: a.displayName,
        orcid: a.orcid,
        affiliation: a.institution,
      })),
      citedBy: { openalex: w.citedBy, best: w.citedBy || 0 },
      fwci: w.fwci,
      sdgs: (w.sdgs || []).map((s: any) => ({ id: s.id, name: s.displayName, score: s.score })),
      openAccess: w.openAccess ? {
        isOa: w.openAccess.isOa,
        oaStatus: w.openAccess.oaStatus,
        url: w.openAccess.oaUrl,
      } : undefined,
      sources: ['openalex'],
      externalIds: { doi: w.doi, openalex: w.id },
    };
  }
}
