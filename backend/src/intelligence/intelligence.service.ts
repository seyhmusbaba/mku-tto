import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { OpenAlexService, OpenAlexWork } from '../integrations/openalex.service';
import { ScimagoService } from '../integrations/scimago.service';
import { CordisService } from '../integrations/cordis.service';
import { PatentService } from '../integrations/patent.service';
import { CrossrefService } from '../integrations/crossref.service';

/**
 * Project Intelligence — proje oluşturma/düzenleme sayfasındaki canlı
 * karar destek paneli için backend. Her widget'a ayrı bir metod karşılık
 * gelir; biri başarısız olursa diğerleri çalışmaya devam eder.
 */

export interface TargetJournal {
  title: string;
  issn: string;
  sjrQuartile?: string;
  sjrScore?: number;
  hIndex?: number;
  country?: string;
  publisher?: string;
}

export interface EuOpportunity {
  id: string;
  acronym?: string;
  title: string;
  framework: string;
  totalCost?: number;
  ecMaxContribution?: number;
  startDate?: string;
  endDate?: string;
  coordinator?: string;
  partnerCountries: string[];
}

export interface SimilarWork {
  doi?: string;
  title: string;
  year?: number;
  citedBy: number;
  authors: string[];
  journal?: string;
  openaireId?: string;
}

export interface PotentialCollaborator {
  name: string;
  source: 'internal' | 'external';
  userId?: string;
  faculty?: string;
  publicationCount?: number;
  hIndex?: number;
  institution?: string;
}

export interface ProjectChecklistItem {
  label: string;
  required: boolean;
  category: string;
}

@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);

  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private openalex: OpenAlexService,
    private scimago: ScimagoService,
    private cordis: CordisService,
    private patent: PatentService,
    private crossref: CrossrefService,
  ) {}

  // ═══ 1. HEDEF DERGİ ÖNERİSİ ═══════════════════════════════════════════
  /**
   * Proje konusu ile uyumlu Q1/Q2 dergileri öner.
   * OpenAlex'teki benzer yayınların venue'larını topla, SCImago'dan
   * kalite bilgisini ekle, quartile'a göre sırala.
   */
  async getTargetJournals(keywords: string[], title?: string, limit = 10): Promise<TargetJournal[]> {
    if (keywords.length === 0 && !title) return [];

    try {
      // Benzer yayınları OpenAlex'ten çek
      const query = [title, ...keywords].filter(Boolean).join(' ').slice(0, 200);
      const works = await this.searchOpenAlexByQuery(query, 50);

      // Her yayının venue'sini topla + ISSN bul
      const venueMap = new Map<string, { title: string; issn?: string; count: number }>();
      for (const w of works) {
        const issn = w.venue?.issn?.[0];
        const name = w.venue?.displayName;
        if (!name) continue;
        const key = issn || name.toLowerCase();
        const cur = venueMap.get(key) || { title: name, issn, count: 0 };
        cur.count++;
        venueMap.set(key, cur);
      }

      // Her venue için SCImago kalite bilgisi çek
      const results: TargetJournal[] = [];
      for (const v of venueMap.values()) {
        let quality;
        if (v.issn) {
          quality = await this.scimago.getQualityByIssn(v.issn);
        }
        if (!quality && v.title) {
          quality = await this.scimago.findByTitle(v.title);
        }
        results.push({
          title: v.title,
          issn: v.issn || '',
          sjrQuartile: quality?.sjrQuartile,
          sjrScore: quality?.sjr,
          hIndex: quality?.hIndex,
          country: quality?.country,
          publisher: quality?.publisher,
        });
      }

      // Sırala: önce Q1, sonra Q2, sonra en yüksek kalite → ne kadar sık geçiyor
      const quartileOrder: Record<string, number> = { Q1: 4, Q2: 3, Q3: 2, Q4: 1 };
      return results
        .sort((a, b) => (quartileOrder[b.sjrQuartile || ''] || 0) - (quartileOrder[a.sjrQuartile || ''] || 0)
          || (b.sjrScore || 0) - (a.sjrScore || 0))
        .slice(0, limit);
    } catch (e: any) {
      this.logger.warn(`Target journals failed: ${e.message}`);
      return [];
    }
  }

  // ═══ 2. AB FIRSATLARI (CORDIS/OpenAIRE) ════════════════════════════════
  async getEuOpportunities(keywords: string[]): Promise<{ total: number; items: EuOpportunity[]; countries: Record<string, number> }> {
    const query = keywords.filter(k => k.length > 3).slice(0, 5).join(' ');
    if (!query) return { total: 0, items: [], countries: {} };

    try {
      const projects = await this.cordis.searchProjects(query, 25);
      const countries: Record<string, number> = {};
      for (const p of projects) {
        for (const pt of p.partners || []) {
          if (pt.country) countries[pt.country] = (countries[pt.country] || 0) + 1;
        }
      }
      return {
        total: projects.length,
        items: projects.slice(0, 8).map(p => ({
          id: p.id,
          acronym: p.acronym,
          title: p.title,
          framework: p.framework,
          totalCost: p.totalCost,
          ecMaxContribution: p.ecMaxContribution,
          startDate: p.startDate,
          endDate: p.endDate,
          coordinator: p.coordinator?.name,
          partnerCountries: Array.from(new Set((p.partners || []).map(x => x.country).filter(Boolean))),
        })),
        countries,
      };
    } catch (e: any) {
      this.logger.warn(`EU opportunities failed: ${e.message}`);
      return { total: 0, items: [], countries: {} };
    }
  }

  // ═══ 3. KÜRESEL BENZERLİK (OpenAlex) ═══════════════════════════════════
  async getGlobalSimilar(title: string, description?: string, limit = 8): Promise<{ total: number; items: SimilarWork[] }> {
    const query = [title, description].filter(Boolean).join(' ').slice(0, 250);
    if (query.length < 10) return { total: 0, items: [] };

    try {
      const works = await this.searchOpenAlexByQuery(query, 50);
      const items = works
        .sort((a, b) => (b.citedBy || 0) - (a.citedBy || 0))
        .slice(0, limit)
        .map(w => ({
          doi: w.doi,
          title: w.title,
          year: w.publicationYear,
          citedBy: w.citedBy || 0,
          authors: (w.authors || []).slice(0, 4).map(a => a.displayName).filter(Boolean),
          journal: w.venue?.displayName,
          openaireId: w.id,
        }));
      return { total: works.length, items };
    } catch (e: any) {
      this.logger.warn(`Global similar failed: ${e.message}`);
      return { total: 0, items: [] };
    }
  }

  // ═══ 4. PATENT MANZARASI (EPO OPS) ══════════════════════════════════════
  async getPatentLandscape(keywords: string[]): Promise<{ trCount: number; epCount: number; configured: boolean; samples: any[] }> {
    if (keywords.length === 0) return { trCount: 0, epCount: 0, configured: false, samples: [] };
    if (!this.patent.isConfigured()) {
      return { trCount: 0, epCount: 0, configured: false, samples: [] };
    }

    try {
      const query = keywords[0]; // EPO OPS'e ilk anahtar kelime
      const trSearch = await this.patent.searchByApplicant(query, 'TR', 10);
      const epSearch = await this.patent.searchByApplicant(query, 'EP', 10);
      return {
        trCount: trSearch.length,
        epCount: epSearch.length,
        configured: true,
        samples: [...trSearch.slice(0, 3), ...epSearch.slice(0, 2)],
      };
    } catch (e: any) {
      this.logger.warn(`Patent landscape failed: ${e.message}`);
      return { trCount: 0, epCount: 0, configured: true, samples: [] };
    }
  }

  // ═══ 5. POTANSİYEL EKİP ÖNERİSİ ═════════════════════════════════════════
  async getPotentialCollaborators(keywords: string[], currentFaculty?: string): Promise<PotentialCollaborator[]> {
    const results: PotentialCollaborator[] = [];
    if (keywords.length === 0) return results;

    // İç: MKÜ içindeki anahtar kelime-eşleşmeli araştırmacılar
    try {
      const q = keywords.join(' | ');
      const internal = await this.userRepo.createQueryBuilder('u')
        .leftJoinAndSelect('u.role', 'role')
        .where('u.expertiseArea ILIKE :q', { q: '%' + keywords[0] + '%' })
        .andWhere('u.isActive = true')
        .take(5)
        .getMany();

      for (const u of internal) {
        results.push({
          name: `${u.title || ''} ${u.firstName} ${u.lastName}`.trim(),
          source: 'internal',
          userId: u.id,
          faculty: u.faculty,
          publicationCount: (u as any).scopusDocCount || 0,
          hIndex: (u as any).scopusHIndex,
        });
      }
    } catch (e: any) {
      this.logger.warn(`Internal team suggestions failed: ${e.message}`);
    }

    // Dış: OpenAlex'te alanında aktif yazarlar (Türk üniversitelerinden tercih)
    try {
      const query = keywords.slice(0, 3).join(' ');
      const works = await this.searchOpenAlexByQuery(query, 30);
      const authorCounts = new Map<string, { name: string; institution?: string; count: number }>();
      for (const w of works) {
        for (const a of w.authors || []) {
          if (!a.displayName) continue;
          const key = a.displayName.toLowerCase();
          const cur = authorCounts.get(key) || { name: a.displayName, institution: a.institution, count: 0 };
          cur.count++;
          if (a.institution && !cur.institution) cur.institution = a.institution;
          authorCounts.set(key, cur);
        }
      }
      Array.from(authorCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .forEach(a => results.push({
          name: a.name,
          source: 'external',
          institution: a.institution,
          publicationCount: a.count,
        }));
    } catch (e: any) {
      this.logger.warn(`External collaborator suggestions failed: ${e.message}`);
    }

    return results;
  }

  // ═══ 6. SDG EMSAL REFERANSLARI ══════════════════════════════════════════
  async getSdgEvidence(title: string, description?: string): Promise<Array<{ sdgId: string; sdgName: string; projectCount: number; exampleTitles: string[] }>> {
    const query = [title, description].filter(Boolean).join(' ').slice(0, 200);
    if (query.length < 10) return [];

    try {
      const works = await this.searchOpenAlexByQuery(query, 20);
      const sdgMap = new Map<string, { name: string; count: number; titles: string[] }>();
      for (const w of works) {
        for (const s of w.sdgs || []) {
          if (s.score < 0.3) continue;
          const key = s.id;
          const cur = sdgMap.get(key) || { name: s.displayName, count: 0, titles: [] };
          cur.count++;
          if (cur.titles.length < 3) cur.titles.push(w.title);
          sdgMap.set(key, cur);
        }
      }
      return Array.from(sdgMap.entries())
        .map(([id, v]) => ({ sdgId: id, sdgName: v.name, projectCount: v.count, exampleTitles: v.titles }))
        .sort((a, b) => b.projectCount - a.projectCount);
    } catch (e: any) {
      this.logger.warn(`SDG evidence failed: ${e.message}`);
      return [];
    }
  }

  // ═══ 7. BAŞARI TAHMİNİ (iç geçmişten) ═════════════════════════════════
  async getSuccessEstimate(type: string, budget?: number, durationMonths?: number): Promise<{
    sampleSize: number;
    avgCompletionRate: number;
    avgPublications: number;
    avgCitations: number;
    budgetPercentile?: number;
  }> {
    try {
      const qb = this.projectRepo.createQueryBuilder('p')
        .leftJoinAndSelect('p.reports', 'reports');
      if (type) qb.where('p.type = :type', { type });

      const projects = await qb.getMany();
      if (projects.length === 0) {
        return { sampleSize: 0, avgCompletionRate: 0, avgPublications: 0, avgCitations: 0 };
      }

      const completed = projects.filter(p => p.status === 'completed').length;
      const totalDecided = projects.filter(p => ['completed', 'cancelled'].includes(p.status)).length;
      const completionRate = totalDecided > 0 ? (completed / totalDecided) * 100 : 0;

      // Bütçe percentile
      let budgetPercentile;
      if (budget) {
        const budgets = projects.map(p => p.budget || 0).filter(b => b > 0).sort((a, b) => a - b);
        const lower = budgets.filter(b => b < budget).length;
        budgetPercentile = budgets.length > 0 ? Math.round((lower / budgets.length) * 100) : undefined;
      }

      return {
        sampleSize: projects.length,
        avgCompletionRate: Math.round(completionRate),
        avgPublications: 0, // Scopus lookup ile doldurulabilir, şimdilik 0
        avgCitations: 0,
        budgetPercentile,
      };
    } catch (e: any) {
      this.logger.warn(`Success estimate failed: ${e.message}`);
      return { sampleSize: 0, avgCompletionRate: 0, avgPublications: 0, avgCitations: 0 };
    }
  }

  // ═══ 8. ULUSAL BENCHMARK (OpenAIRE Türkiye) ═══════════════════════════
  async getTurkeyBenchmark(keywords: string[]): Promise<{ total: number; topInstitutions: Array<{ name: string; count: number }> }> {
    const query = keywords.filter(k => k.length > 3).slice(0, 3).join(' ');
    if (!query) return { total: 0, topInstitutions: [] };

    try {
      // OpenAIRE'dan TR projelerinin keyword filtreli subset'i
      const all = await this.cordis.searchProjectsByCountry('TR', 100);
      const matched = all.filter(p =>
        keywords.some(k => (p.title + ' ' + (p.objective || '')).toLowerCase().includes(k.toLowerCase()))
      );

      const instCount = new Map<string, number>();
      for (const p of matched) {
        const names = [
          p.coordinator?.name,
          ...p.partners.filter(pt => pt.country === 'TR').map(pt => pt.name),
        ].filter(Boolean);
        for (const n of names) {
          if (!n) continue;
          instCount.set(n, (instCount.get(n) || 0) + 1);
        }
      }
      const topInstitutions = Array.from(instCount.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      return { total: matched.length, topInstitutions };
    } catch (e: any) {
      this.logger.warn(`Turkey benchmark failed: ${e.message}`);
      return { total: 0, topInstitutions: [] };
    }
  }

  // ═══ 9. KONSEPT OTOMATİK ETİKETLEME ════════════════════════════════════
  async getConcepts(title: string, description?: string): Promise<Array<{ name: string; level: number; score: number }>> {
    const query = [title, description].filter(Boolean).join(' ').slice(0, 200);
    if (query.length < 10) return [];

    try {
      const works = await this.searchOpenAlexByQuery(query, 10);
      const conceptMap = new Map<string, { name: string; level: number; score: number; count: number }>();
      for (const w of works) {
        for (const c of w.concepts || []) {
          if (c.score < 0.3) continue;
          const cur = conceptMap.get(c.displayName) || { name: c.displayName, level: c.level, score: 0, count: 0 };
          cur.score += c.score;
          cur.count++;
          conceptMap.set(c.displayName, cur);
        }
      }
      return Array.from(conceptMap.values())
        .map(c => ({ name: c.name, level: c.level, score: Math.round((c.score / c.count) * 100) / 100 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);
    } catch (e: any) {
      this.logger.warn(`Concepts failed: ${e.message}`);
      return [];
    }
  }

  // ═══ 10. BAŞVURU KONTROL LİSTESİ ═══════════════════════════════════════
  getChecklist(type: string): ProjectChecklistItem[] {
    const common: ProjectChecklistItem[] = [
      { label: 'Proje başlığı ve özeti',            required: true,  category: 'Temel' },
      { label: 'Ekip CV\'leri (PDF)',                required: true,  category: 'Temel' },
      { label: 'Bütçe tablosu',                      required: true,  category: 'Finansal' },
      { label: 'Referans listesi',                   required: true,  category: 'Akademik' },
      { label: 'SDG hedefleri',                      required: false, category: 'Etki' },
    ];

    const typeSpecific: Record<string, ProjectChecklistItem[]> = {
      tubitak: [
        { label: 'TÜBİTAK ARBİS güncel CV',          required: true,  category: 'TÜBİTAK' },
        { label: 'Türkçe ve İngilizce özet',         required: true,  category: 'TÜBİTAK' },
        { label: 'Çalışma paketleri ve iş planı',    required: true,  category: 'TÜBİTAK' },
        { label: 'Risk analizi',                     required: true,  category: 'TÜBİTAK' },
        { label: 'Etik kurul belgesi (gerekiyorsa)', required: false, category: 'TÜBİTAK' },
      ],
      eu: [
        { label: 'Konsorsiyum anlaşması',            required: true,  category: 'AB' },
        { label: 'Impact pathway belgesi',           required: true,  category: 'AB' },
        { label: 'Gender Equality Plan',             required: true,  category: 'AB' },
        { label: 'Data Management Plan',             required: true,  category: 'AB' },
        { label: 'Open Science Plan',                required: true,  category: 'AB' },
        { label: 'Ethics self-assessment',           required: true,  category: 'AB' },
      ],
      bap: [
        { label: 'BAP başvuru formu',                required: true,  category: 'BAP' },
        { label: 'Bütçe detay tablosu',              required: true,  category: 'BAP' },
        { label: 'Zaman çizelgesi',                  required: true,  category: 'BAP' },
      ],
      industry: [
        { label: 'Sanayi ortak sözleşmesi',          required: true,  category: 'Sanayi' },
        { label: 'Fikri mülkiyet paylaşımı',         required: true,  category: 'Sanayi' },
        { label: 'Gizlilik anlaşması (NDA)',         required: true,  category: 'Sanayi' },
      ],
    };

    return [...common, ...(typeSpecific[type] || [])];
  }

  // ── INTERNAL HELPERS ──────────────────────────────────────────────────

  /** OpenAlex search wrapper — free-text query */
  private async searchOpenAlexByQuery(query: string, limit: number): Promise<OpenAlexWork[]> {
    if (!query || query.length < 3) return [];
    try {
      const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${Math.min(limit, 200)}&sort=cited_by_count:desc`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': `mku-tto/1.0 (mailto:${process.env.OPENALEX_MAILTO || process.env.CROSSREF_MAILTO || 'noreply@example.com'})`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data?.results || []).map((w: any) => this.mapWork(w)).filter(Boolean);
    } catch (e: any) {
      this.logger.warn(`OpenAlex search failed: ${e.message}`);
      return [];
    }
  }

  private mapWork(w: any): OpenAlexWork | null {
    if (!w?.id || !w.title) return null;
    return {
      id: w.id,
      doi: w.doi ? String(w.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : undefined,
      title: w.title,
      publicationYear: w.publication_year,
      publicationDate: w.publication_date,
      type: w.type,
      citedBy: w.cited_by_count || 0,
      openAccess: w.open_access ? { isOa: !!w.open_access.is_oa, oaStatus: w.open_access.oa_status } : undefined,
      venue: w.primary_location?.source ? {
        displayName: w.primary_location.source.display_name,
        issn: w.primary_location.source.issn,
        publisher: w.primary_location.source.host_organization_name,
      } : undefined,
      authors: (w.authorships || []).map((a: any) => ({
        id: a.author?.id,
        displayName: a.author?.display_name || '',
        orcid: a.author?.orcid,
        institution: a.institutions?.[0]?.display_name,
      })),
      concepts: (w.concepts || []).map((c: any) => ({
        displayName: c.display_name, level: c.level, score: c.score,
      })),
      sdgs: (w.sustainable_development_goals || []).map((s: any) => ({
        displayName: s.display_name, id: s.id, score: s.score,
      })),
      fwci: w.fwci,
    };
  }
}
