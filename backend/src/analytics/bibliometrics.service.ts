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
  summary: {
    total: number;
    totalCitations: number;
    hIndex: number;
    i10Index: number;
    openAccessCount: number;
    openAccessRatio: number;
    quartileDistribution: Record<string, number>;
    byYear: Array<{ year: number; count: number; citations: number }>;
    sdgDistribution: Array<{ id: string; name: string; count: number }>;
  };
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

    // ORCID yoksa ama Scopus ID varsa, OpenAlex üzerinden dene
    if (pubs.length === 0 && user.scopusAuthorId) {
      try {
        const oaAuthor = await this.openalex.searchAuthorByName(`${user.firstName} ${user.lastName}`, user.faculty, 5);
        if (oaAuthor.length > 0) {
          const works = await this.openalex.getAuthorWorks(oaAuthor[0].id, 200);
          pubs = works.map(w => this.normalizeOaToUnified(w));
        }
      } catch (e: any) {
        this.logger.warn(`OpenAlex fallback failed: ${e.message}`);
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
   */
  async getInstitutional(institutionId: string, year?: number): Promise<any> {
    const pubs = await this.publications.getInstitutionPublications(institutionId, year, 500);
    const summary = this.publications.summarize(pubs);
    return {
      ...summary,
      institutionId,
      publications: pubs.map(p => ({
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
