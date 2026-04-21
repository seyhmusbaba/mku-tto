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
  async getInstitutional(
    institutionId: string,
    yearOrRange?: number | { from?: number; to?: number },
  ): Promise<any> {
    // 1. Kurumsal TOPLAMLAR — OpenAlex institution endpoint'inden direkt
    const instSummary = await this.openalex.getInstitutionSummary(institutionId).catch(() => null);

    // 2. SAMPLE — detay tablolar için en çok atıf alan yayınlar (dönem filtreli olabilir)
    const pubs = await this.publications.getInstitutionPublications(institutionId, yearOrRange, 500);
    const sampleSummary = this.publications.summarize(pubs);

    // Dönem filtrelendiyse etiket için tut
    let periodLabel: string | undefined;
    let filterFromYear: number | undefined;
    let filterToYear: number | undefined;
    if (typeof yearOrRange === 'number') {
      periodLabel = `${yearOrRange} yılı`;
      filterFromYear = filterToYear = yearOrRange;
    } else if (yearOrRange && (yearOrRange.from || yearOrRange.to)) {
      filterFromYear = yearOrRange.from;
      filterToYear = yearOrRange.to;
      periodLabel = `${filterFromYear || '—'} — ${filterToYear || '—'}`;
    }

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

    // Dönem filtresi uygulanmışsa kurumsal toplamları o dönemden hesapla
    let periodTotal: number | undefined;
    let periodCitations: number | undefined;
    let periodOaCount: number | undefined;
    if ((filterFromYear || filterToYear) && byYearReal.length > 0) {
      const from = filterFromYear || 1900;
      const to = filterToYear || new Date().getFullYear();
      let pt = 0, pc = 0, poa = 0;
      for (const y of byYearReal) {
        if (y.year >= from && y.year <= to) {
          pt += y.count;
          pc += y.citations;
          poa += y.oaCount || 0;
        }
      }
      periodTotal = pt;
      periodCitations = pc;
      periodOaCount = poa;
    }

    return {
      institutionId,
      periodLabel,
      filterFromYear,
      filterToYear,
      isPeriodFiltered: !!(filterFromYear || filterToYear),

      // KURUMSAL GERÇEK TOPLAMLAR
      // Dönem filtresi varsa — byYear verisinden o dönemin toplamı
      // Yoksa — OpenAlex institution endpoint'inden tüm zamanlar
      total: periodTotal !== undefined ? periodTotal : (instSummary?.worksCount ?? sampleSummary.total),
      totalCitations: periodCitations !== undefined ? periodCitations : (instSummary?.citedByCount ?? sampleSummary.totalCitations),
      // h-index dönem hesabı zor — kurumsal veri global, sample'dan dönemsel h-index hesaplanır
      hIndex: periodTotal !== undefined ? sampleSummary.hIndex : (instSummary?.hIndex ?? sampleSummary.hIndex),
      i10Index: periodTotal !== undefined ? sampleSummary.i10Index : (instSummary?.i10Index ?? sampleSummary.i10Index),
      twoYearMeanCitedness: instSummary?.twoYearMeanCitedness,
      byYear: byYearReal.length > 0 ? byYearReal : sampleSummary.byYear,

      // SAMPLE BAZLI — net olarak 'sample' prefix ile
      // Kalite dağılımı sample'dan — 500 top-cited içinde Q1-Q4 oranı
      quartileDistribution: sampleSummary.quartileDistribution,
      sdgDistribution: sampleSummary.sdgDistribution,

      // Açık erişim:
      // - Dönem filtresi varsa → byYearReal'dan dönemsel OA toplamı
      // - Yoksa → tüm kurum için counts_by_year toplamı
      // - Hiçbiri yoksa → sample'dan
      openAccessCount:
        periodOaCount !== undefined ? periodOaCount :
        realOaRatio !== null ? realTotalOaCount :
        sampleSummary.openAccessCount,
      openAccessRatio:
        periodTotal && periodTotal > 0 && periodOaCount !== undefined
          ? Math.round((periodOaCount / periodTotal) * 100)
          : realOaRatio !== null ? realOaRatio : sampleSummary.openAccessRatio,
      openAccessSource:
        periodOaCount !== undefined ? 'period-institutional' :
        realOaRatio !== null ? 'institutional' : 'sample',
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
   * Fakülteler arası bibliyometri karşılaştırması.
   * Her fakültenin lightweight bibliyometri özetini paralel çeker.
   * Dekan/Rektör bu endpoint ile tüm fakülteleri kıyaslayabilir.
   *
   * Hız için: her fakülteden en fazla 5 araştırmacı örneklenir, her biri 50 yayın.
   */
  async getFacultyComparison(): Promise<{
    faculties: Array<{
      faculty: string;
      researcherCount: number;
      withIdentifiersCount: number;
      sampleSize: number;         // kaç araştırmacı gerçekten çekildi
      totalPubs: number;
      totalCitations: number;
      hIndex: number;
      i10Index: number;
      avgFwci: number | null;
      top1PctCount: number;
      top10PctCount: number;
      openAccessCount: number;
      openAccessRatio: number;
      q1Count: number;
      internationalRatio: number;
      topResearcher?: { name: string; hIndex: number; citations: number; docs: number };
    }>;
    note: string;
  }> {
    // Tüm fakülteleri projeler tablosundan al (istatistik için uygun)
    const facultyRows = await this.userRepo
      .createQueryBuilder('u')
      .select('u.faculty', 'faculty')
      .addSelect('COUNT(*)', 'count')
      .where('u.faculty IS NOT NULL AND u.faculty != \'\'')
      .andWhere('u."isActive" = true')
      .groupBy('u.faculty')
      .getRawMany();

    const faculties = facultyRows.map(r => r.faculty).filter(Boolean);
    if (faculties.length === 0) return { faculties: [], note: 'Fakülte verisi bulunamadı.' };

    // Her fakülte için paralel özet
    const results = await Promise.all(faculties.map(async (faculty) => {
      const researchers = await this.userRepo.find({ where: { faculty, isActive: true as any } });
      const withIdentifiers = researchers.filter(r => r.orcidId || (r as any).scopusAuthorId || (r as any).wosResearcherId);
      if (withIdentifiers.length === 0) {
        return {
          faculty,
          researcherCount: researchers.length,
          withIdentifiersCount: 0,
          sampleSize: 0,
          totalPubs: 0, totalCitations: 0, hIndex: 0, i10Index: 0,
          avgFwci: null as number | null, top1PctCount: 0, top10PctCount: 0,
          openAccessCount: 0, openAccessRatio: 0, q1Count: 0, internationalRatio: 0,
        };
      }

      // Her fakülteden max 5 araştırmacı sample
      const sample = withIdentifiers.slice(0, 5);
      const perResearcher: Array<{ user: User; pubs: UnifiedPublication[] }> = [];

      // 5'li paralel batch
      for (let i = 0; i < sample.length; i += 5) {
        const batch = sample.slice(i, i + 5);
        const batchResults = await Promise.all(
          batch.map(async (u) => {
            try {
              if (u.orcidId) {
                const pubs = await this.publications.getAuthorPublicationsByOrcid(u.orcidId, 50);
                return { user: u, pubs };
              }
            } catch {}
            return { user: u, pubs: [] as UnifiedPublication[] };
          }),
        );
        perResearcher.push(...batchResults);
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

      // Top araştırmacı (h-index bazlı)
      const topR = perResearcher
        .map(({ user, pubs }) => {
          const s = this.publications.summarize(pubs);
          return {
            name: `${user.title || ''} ${user.firstName} ${user.lastName}`.trim(),
            hIndex: s.hIndex,
            citations: s.totalCitations,
            docs: s.total,
          };
        })
        .sort((a, b) => b.hIndex - a.hIndex)[0];

      return {
        faculty,
        researcherCount: researchers.length,
        withIdentifiersCount: withIdentifiers.length,
        sampleSize: sample.length,
        totalPubs: summary.total,
        totalCitations: summary.totalCitations,
        hIndex: summary.hIndex,
        i10Index: summary.i10Index,
        avgFwci: summary.avgFwci,
        top1PctCount: summary.top1PctCount,
        top10PctCount: summary.top10PctCount,
        openAccessCount: summary.openAccessCount,
        openAccessRatio: summary.openAccessRatio,
        q1Count: summary.quartileDistribution.Q1 || 0,
        internationalRatio: summary.internationalCoauthorRatio,
        topResearcher: topR,
      };
    }));

    // h-index DESC'e göre sırala
    results.sort((a, b) => b.hIndex - a.hIndex);

    return {
      faculties: results,
      note: `${results.length} fakülte karşılaştırıldı. Her fakülteden en çok 5 araştırmacı örneklenmiştir — fakülte başına yayın sayıları bu örneklemi yansıtır, tam kapsam değildir.`,
    };
  }

  /**
   * Bir fakülte içindeki bölümler arası bibliyometri karşılaştırması.
   * Bölüm Başkanı kendi fakültesindeki diğer bölümleri kıyaslayabilir.
   */
  async getDepartmentComparison(faculty: string): Promise<{
    faculty: string;
    departments: Array<{
      department: string;
      researcherCount: number;
      withIdentifiersCount: number;
      sampleSize: number;
      totalPubs: number;
      totalCitations: number;
      hIndex: number;
      avgFwci: number | null;
      openAccessRatio: number;
      q1Count: number;
      topResearcher?: { name: string; hIndex: number; citations: number; docs: number };
    }>;
    note: string;
  }> {
    const deptRows = await this.userRepo
      .createQueryBuilder('u')
      .select('u.department', 'department')
      .addSelect('COUNT(*)', 'count')
      .where('u.faculty = :faculty', { faculty })
      .andWhere('u.department IS NOT NULL AND u.department != \'\'')
      .andWhere('u."isActive" = true')
      .groupBy('u.department')
      .getRawMany();

    const departments = deptRows.map(r => r.department).filter(Boolean);
    if (departments.length === 0) {
      return { faculty, departments: [], note: 'Bu fakültede bölüm verisi yok.' };
    }

    const results = await Promise.all(departments.map(async (department) => {
      const researchers = await this.userRepo.find({
        where: { faculty, department, isActive: true as any },
      });
      const withIdentifiers = researchers.filter(r => r.orcidId || (r as any).scopusAuthorId);

      if (withIdentifiers.length === 0) {
        return {
          department,
          researcherCount: researchers.length,
          withIdentifiersCount: 0,
          sampleSize: 0,
          totalPubs: 0, totalCitations: 0, hIndex: 0,
          avgFwci: null as number | null,
          openAccessRatio: 0, q1Count: 0,
        };
      }

      // Her bölümden max 3 araştırmacı sample (bölümler küçük olabilir)
      const sample = withIdentifiers.slice(0, 3);
      const perR = await Promise.all(sample.map(async (u) => {
        try {
          if (u.orcidId) {
            const pubs = await this.publications.getAuthorPublicationsByOrcid(u.orcidId, 50);
            return { user: u, pubs };
          }
        } catch {}
        return { user: u, pubs: [] as UnifiedPublication[] };
      }));

      // Dedupe
      const allMap = new Map<string, UnifiedPublication>();
      for (const { pubs } of perR) {
        for (const p of pubs) {
          const key = p.doi ? `doi:${p.doi.toLowerCase()}` : `t:${p.title.toLowerCase().slice(0, 80)}`;
          if (!allMap.has(key)) allMap.set(key, p);
        }
      }
      const summary = this.publications.summarize(Array.from(allMap.values()));

      const topR = perR
        .map(({ user, pubs }) => {
          const s = this.publications.summarize(pubs);
          return {
            name: `${user.title || ''} ${user.firstName} ${user.lastName}`.trim(),
            hIndex: s.hIndex, citations: s.totalCitations, docs: s.total,
          };
        })
        .sort((a, b) => b.hIndex - a.hIndex)[0];

      return {
        department,
        researcherCount: researchers.length,
        withIdentifiersCount: withIdentifiers.length,
        sampleSize: sample.length,
        totalPubs: summary.total,
        totalCitations: summary.totalCitations,
        hIndex: summary.hIndex,
        avgFwci: summary.avgFwci,
        openAccessRatio: summary.openAccessRatio,
        q1Count: summary.quartileDistribution.Q1 || 0,
        topResearcher: topR,
      };
    }));

    results.sort((a, b) => b.hIndex - a.hIndex);

    return {
      faculty,
      departments: results,
      note: `${results.length} bölüm karşılaştırıldı. Her bölümden en çok 3 araştırmacı örneklenmiştir.`,
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
   * Kullanıcının fakültesini DB'den çek — department-comparison için Dekan fallback.
   */
  async getUserFaculty(userId: string): Promise<string | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return user?.faculty || null;
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
