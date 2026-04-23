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
 * karar destek paneli için backend.
 */

export interface TargetJournal {
  title: string;
  issn: string;
  sjrQuartile?: string;
  sjrScore?: number;
  hIndex?: number;
  country?: string;
  publisher?: string;
  fitScore?: number;    // 0-100, konu uyum skoru
  coverage?: number;    // benzer yayınların kaçı burada
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
  matchScore?: number;      // 0-100, konu uyumu
  publicationCount?: number;
  hIndex?: number;
  institution?: string;
  orcid?: string;
}

export interface ProjectChecklistItem {
  label: string;
  required: boolean;
  category: string;
}

export interface IntelligenceSynthesis {
  originalityScore: number;     // 0-100, ne kadar özgün
  competitionScore: number;     // 0-100, rekabet yoğunluğu (düşük = az rakip)
  fitScore: number;             // 0-100, yüksek kaliteli hedef dergi uyumu
  successProbability: number;   // 0-100, benzer projelerin başarı oranı
  overallScore: number;         // composite (avg)
  narrative: string;            // AI-üretilmiş 1-2 paragraf özet
  highlights: string[];         // 3-5 madde güçlü yön
  risks: string[];              // 2-4 madde dikkat edilmesi gerekenler
  recommendations: string[];    // 3 somut öneri
  source: 'ai' | 'rule-based';
}

export interface FundingSimulation {
  sampleSize: number;
  estimatedSuccessProbability: number;   // 0-100
  budgetPercentile?: number;
  durationPercentile?: number;
  analogs: Array<{
    id: string; title: string; status: string; budget?: number;
    startDate?: string; endDate?: string; reasoning: string;
  }>;
  recommendedBudgetRange?: { min: number; max: number; median: number };
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
   * Strateji:
   *  - OpenAlex'ten benzer yayınları çek (daha fazla)
   *  - Her dergi kaç kez geçiyor → coverage score
   *  - SCImago'dan kalite ekle → combined fit score
   *  - fitScore = coverage% × quartile_weight × 100
   */
  async getTargetJournals(keywords: string[], title?: string, limit = 10): Promise<TargetJournal[]> {
    if (keywords.length === 0 && !title) return [];

    try {
      const query = [title, ...keywords].filter(Boolean).join(' ').slice(0, 250);
      const works = await this.searchOpenAlexByQuery(query, 100);

      const venueMap = new Map<string, { title: string; issn?: string; count: number; citations: number }>();
      for (const w of works) {
        const issn = w.venue?.issn?.[0];
        const name = w.venue?.displayName;
        if (!name) continue;
        const key = issn || name.toLowerCase();
        const cur = venueMap.get(key) || { title: name, issn, count: 0, citations: 0 };
        cur.count++;
        cur.citations += w.citedBy || 0;
        venueMap.set(key, cur);
      }

      const quartileWeight: Record<string, number> = { Q1: 1.0, Q2: 0.75, Q3: 0.5, Q4: 0.25 };
      const totalWorks = works.length;

      const results: TargetJournal[] = [];
      for (const v of venueMap.values()) {
        let quality;
        if (v.issn) quality = await this.scimago.getQualityByIssn(v.issn);
        if (!quality && v.title) quality = await this.scimago.findByTitle(v.title);

        const coverage = totalWorks > 0 ? (v.count / totalWorks) * 100 : 0;
        const qw = quality?.sjrQuartile ? quartileWeight[quality.sjrQuartile] : 0.5;
        const fitScore = Math.round(coverage * 3 * qw + (quality?.sjr ? Math.min(quality.sjr * 10, 30) : 0));

        results.push({
          title: v.title,
          issn: v.issn || '',
          sjrQuartile: quality?.sjrQuartile,
          sjrScore: quality?.sjr,
          hIndex: quality?.hIndex,
          country: quality?.country,
          publisher: quality?.publisher,
          fitScore: Math.min(100, fitScore),
          coverage: Math.round(coverage),
        });
      }

      const quartileOrder: Record<string, number> = { Q1: 4, Q2: 3, Q3: 2, Q4: 1 };
      return results
        .sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0)
          || (quartileOrder[b.sjrQuartile || ''] || 0) - (quartileOrder[a.sjrQuartile || ''] || 0))
        .slice(0, limit);
    } catch (e: any) {
      this.logger.warn(`Target journals failed: ${e.message}`);
      return [];
    }
  }

  // ═══ 2. AB FIRSATLARI ════════════════════════════════════════════════
  async getEuOpportunities(keywords: string[]): Promise<{ total: number; items: EuOpportunity[]; countries: Record<string, number>; frameworks: Record<string, number>; avgBudget: number }> {
    const query = keywords.filter(k => k.length > 3).slice(0, 5).join(' ');
    if (!query) return { total: 0, items: [], countries: {}, frameworks: {}, avgBudget: 0 };

    try {
      const projects = await this.cordis.searchProjects(query, 50);
      const countries: Record<string, number> = {};
      const frameworks: Record<string, number> = {};
      let totalBudget = 0;
      let budgetCount = 0;
      for (const p of projects) {
        frameworks[p.framework] = (frameworks[p.framework] || 0) + 1;
        for (const pt of p.partners || []) {
          if (pt.country) countries[pt.country] = (countries[pt.country] || 0) + 1;
        }
        if (p.ecMaxContribution) {
          totalBudget += p.ecMaxContribution;
          budgetCount++;
        }
      }
      return {
        total: projects.length,
        items: projects.slice(0, 10).map(p => ({
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
        frameworks,
        avgBudget: budgetCount > 0 ? Math.round(totalBudget / budgetCount) : 0,
      };
    } catch (e: any) {
      this.logger.warn(`EU opportunities failed: ${e.message}`);
      return { total: 0, items: [], countries: {}, frameworks: {}, avgBudget: 0 };
    }
  }

  // ═══ 3. KÜRESEL BENZERLİK ═══════════════════════════════════════════
  async getGlobalSimilar(title: string, description?: string, limit = 8): Promise<{ total: number; items: SimilarWork[]; avgCitations: number; peakYear?: number }> {
    const query = [title, description].filter(Boolean).join(' ').slice(0, 250);
    if (query.length < 10) return { total: 0, items: [], avgCitations: 0 };

    try {
      const works = await this.searchOpenAlexByQuery(query, 100);
      const yearMap: Record<number, number> = {};
      let totalCitations = 0;
      for (const w of works) {
        if (w.publicationYear) yearMap[w.publicationYear] = (yearMap[w.publicationYear] || 0) + 1;
        totalCitations += w.citedBy || 0;
      }
      const peakYear = Object.entries(yearMap).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0];

      const items = [...works]
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

      return {
        total: works.length,
        items,
        avgCitations: works.length > 0 ? Math.round(totalCitations / works.length) : 0,
        peakYear: peakYear ? +peakYear : undefined,
      };
    } catch (e: any) {
      this.logger.warn(`Global similar failed: ${e.message}`);
      return { total: 0, items: [], avgCitations: 0 };
    }
  }

  // ═══ 4. PATENT MANZARASI (DÜZELTİLDİ — keyword-in-text) ═══════════════
  async getPatentLandscape(keywords: string[]): Promise<{ trCount: number; epCount: number; configured: boolean; samples: any[] }> {
    if (keywords.length === 0) return { trCount: 0, epCount: 0, configured: false, samples: [] };
    if (!this.patent.isConfigured()) {
      return { trCount: 0, epCount: 0, configured: false, samples: [] };
    }

    try {
      // İlk 2 en anlamlı anahtar kelimeyi birleştir — AND ile arar EPO
      const query = keywords.slice(0, 2).join(' AND ');
      const [trResults, epResults] = await Promise.all([
        this.patent.searchByKeyword(query, 'TR', 15),
        this.patent.searchByKeyword(query, 'EP', 15),
      ]);
      return {
        trCount: trResults.length,
        epCount: epResults.length,
        configured: true,
        samples: [...trResults.slice(0, 3), ...epResults.slice(0, 2)],
      };
    } catch (e: any) {
      this.logger.warn(`Patent landscape failed: ${e.message}`);
      return { trCount: 0, epCount: 0, configured: true, samples: [] };
    }
  }

  // ═══ 5. POTANSİYEL EKİP ═══════════════════════════════════════════
  async getPotentialCollaborators(keywords: string[], currentFaculty?: string): Promise<PotentialCollaborator[]> {
    const results: PotentialCollaborator[] = [];
    if (keywords.length === 0) return results;

    // İç: expertiseArea + bio + KENDİ PROJELERİNİN tags/keywords/title üzerinden
    try {
      const kwLower = keywords.slice(0, 6).map(k => k.toLowerCase());

      // 1) Direct match: expertiseArea/bio
      const directUsers = await this.userRepo.createQueryBuilder('u')
        .where('u.isActive = true')
        .andWhere(kwLower.map((_, i) => `(u."expertiseArea" ILIKE :kw${i} OR u.bio ILIKE :kw${i})`).join(' OR '),
          Object.fromEntries(kwLower.map((kw, i) => [`kw${i}`, `%${kw}%`])))
        .take(15)
        .getMany();

      // 2) Project-based match: kullanıcının ownerId olduğu projelerin tags/keywords/title'da geçen
      const projectMatchUsers = await this.userRepo.createQueryBuilder('u')
        .innerJoin('projects', 'p', 'p."ownerId" = u.id')
        .where('u.isActive = true')
        .andWhere(kwLower.map((_, i) =>
          `(p.title ILIKE :kw${i} OR p.description ILIKE :kw${i} OR p."tagsJson" ILIKE :kw${i} OR p."keywordsJson" ILIKE :kw${i})`
        ).join(' OR '),
          Object.fromEntries(kwLower.map((kw, i) => [`kw${i}`, `%${kw}%`])))
        .groupBy('u.id')
        .take(15)
        .getMany();

      // Union + dedupe
      const seen = new Set<string>();
      const allUsers = [...directUsers, ...projectMatchUsers].filter(u => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      });

      for (const u of allUsers) {
        const haystack = [
          (u as any).expertiseArea || '',
          (u as any).bio || '',
        ].join(' ').toLowerCase();
        const matches = kwLower.filter(k => haystack.includes(k)).length;
        // Project match bonus
        const inProjectMatch = projectMatchUsers.some(pu => pu.id === u.id);
        const directMatch = directUsers.some(du => du.id === u.id);
        const matchScore = Math.max(
          kwLower.length > 0 ? Math.round((matches / kwLower.length) * 100) : 0,
          inProjectMatch ? 60 : 0,
          directMatch ? 40 : 0,
        );
        if (matchScore === 0) continue;
        results.push({
          name: `${u.title || ''} ${u.firstName} ${u.lastName}`.trim(),
          source: 'internal',
          userId: u.id,
          faculty: u.faculty,
          orcid: u.orcidId,
          matchScore,
          publicationCount: (u as any).scopusDocCount || 0,
          hIndex: (u as any).scopusHIndex,
        });
      }
      results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      results.splice(8);  // max 8 iç
    } catch (e: any) {
      this.logger.warn(`Internal team suggestions failed: ${e.message}`);
    }

    // Dış: OpenAlex concepts + keyword kombinasyonu
    try {
      const query = keywords.slice(0, 4).join(' ');
      const works = await this.searchOpenAlexByQuery(query, 50);
      const authorCounts = new Map<string, { name: string; institution?: string; orcid?: string; count: number; totalCitations: number }>();
      for (const w of works) {
        for (const a of w.authors || []) {
          if (!a.displayName) continue;
          const key = a.displayName.toLowerCase();
          const cur = authorCounts.get(key) || { name: a.displayName, institution: a.institution, orcid: a.orcid, count: 0, totalCitations: 0 };
          cur.count++;
          cur.totalCitations += w.citedBy || 0;
          if (a.institution && !cur.institution) cur.institution = a.institution;
          if (a.orcid && !cur.orcid) cur.orcid = a.orcid;
          authorCounts.set(key, cur);
        }
      }
      const topExternal = Array.from(authorCounts.values())
        .sort((a, b) => b.count - a.count || b.totalCitations - a.totalCitations)
        .slice(0, 8);
      const maxCount = topExternal[0]?.count || 1;
      for (const a of topExternal) {
        results.push({
          name: a.name,
          source: 'external',
          institution: a.institution,
          orcid: a.orcid,
          publicationCount: a.count,
          matchScore: Math.round((a.count / maxCount) * 100),
        });
      }
    } catch (e: any) {
      this.logger.warn(`External collaborator suggestions failed: ${e.message}`);
    }

    return results;
  }

  // ═══ 6. SDG EMSAL REFERANSLARI ══════════════════════════════════════
  async getSdgEvidence(title: string, description?: string): Promise<Array<{ sdgId: string; sdgName: string; projectCount: number; exampleTitles: string[] }>> {
    const query = [title, description].filter(Boolean).join(' ').slice(0, 200);
    if (query.length < 10) return [];

    try {
      const works = await this.searchOpenAlexByQuery(query, 30);
      const sdgMap = new Map<string, { name: string; count: number; titles: string[] }>();
      for (const w of works) {
        for (const s of w.sdgs || []) {
          if (s.score < 0.3) continue;
          const cur = sdgMap.get(s.id) || { name: s.displayName, count: 0, titles: [] };
          cur.count++;
          if (cur.titles.length < 3) cur.titles.push(w.title);
          sdgMap.set(s.id, cur);
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

  // ═══ 7. BAŞARI TAHMİNİ (fallback genişletmeli) ═══════════════════════
  async getSuccessEstimate(type: string, budget?: number, durationMonths?: number): Promise<{
    sampleSize: number;
    avgCompletionRate: number;
    avgPublications: number;
    avgCitations: number;
    budgetPercentile?: number;
    scope: 'type-specific' | 'all-projects' | 'empty';
    note?: string;
  }> {
    try {
      let projects: Project[] = [];
      let scope: 'type-specific' | 'all-projects' | 'empty' = 'empty';

      if (type) {
        const typed = await this.projectRepo.createQueryBuilder('p')
          .where('p.type = :type', { type }).getMany();
        if (typed.length >= 3) {
          projects = typed;
          scope = 'type-specific';
        }
      }

      // Tür-özel veri yetersizse TÜM projelere genişlet
      if (projects.length === 0) {
        projects = await this.projectRepo.find();
        scope = projects.length > 0 ? 'all-projects' : 'empty';
      }

      if (projects.length === 0) {
        return { sampleSize: 0, avgCompletionRate: 0, avgPublications: 0, avgCitations: 0, scope: 'empty', note: 'Sistemde henüz kayıtlı proje yok' };
      }

      const completed = projects.filter(p => p.status === 'completed').length;
      const decided = projects.filter(p => ['completed', 'cancelled'].includes(p.status)).length;
      const completionRate = decided > 0 ? (completed / decided) * 100 : 60;

      let budgetPercentile;
      if (budget) {
        const budgets = projects.map(p => p.budget || 0).filter(b => b > 0).sort((a, b) => a - b);
        const lower = budgets.filter(b => b < budget).length;
        budgetPercentile = budgets.length > 0 ? Math.round((lower / budgets.length) * 100) : undefined;
      }

      const note = scope === 'all-projects'
        ? `Bu türe özel veri yetersiz; tüm proje havuzundan hesaplandı (n=${projects.length})`
        : undefined;

      return {
        sampleSize: projects.length,
        avgCompletionRate: Math.round(completionRate),
        avgPublications: 0,
        avgCitations: 0,
        budgetPercentile,
        scope,
        note,
      };
    } catch (e: any) {
      this.logger.warn(`Success estimate failed: ${e.message}`);
      return { sampleSize: 0, avgCompletionRate: 0, avgPublications: 0, avgCitations: 0, scope: 'empty' };
    }
  }

  // ═══ 8. ULUSAL BENCHMARK (DÜZELTİLDİ — native OpenAIRE filter) ═══════
  async getTurkeyBenchmark(keywords: string[]): Promise<{ total: number; topInstitutions: Array<{ name: string; count: number }> }> {
    const query = keywords.filter(k => k.length > 3).slice(0, 3).join(' ');
    if (!query) return { total: 0, topInstitutions: [] };

    try {
      // CordisService.searchProjects native keyword param kullanıyor —
      // sonra TR partnerlarını filtrele.
      const matched = await this.cordis.searchProjects(query, 50);

      const instCount = new Map<string, number>();
      for (const p of matched) {
        // Sadece Türk ortakları ve Türk koordinatörleri sayalım
        const names = [
          p.coordinator?.country === 'TR' ? p.coordinator.name : null,
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

  // ═══ 9. KONSEPT OTOMATİK ETİKETLEME ═══════════════════════════════════
  async getConcepts(title: string, description?: string): Promise<Array<{ name: string; level: number; score: number }>> {
    const query = [title, description].filter(Boolean).join(' ').slice(0, 200);
    if (query.length < 10) return [];

    try {
      const works = await this.searchOpenAlexByQuery(query, 15);
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
        .slice(0, 15);
    } catch (e: any) {
      this.logger.warn(`Concepts failed: ${e.message}`);
      return [];
    }
  }

  // ═══ 10. BAŞVURU KONTROL LİSTESİ ══════════════════════════════════════
  getChecklist(type: string): ProjectChecklistItem[] {
    const common: ProjectChecklistItem[] = [
      { label: 'Proje başlığı ve özeti',           required: true,  category: 'Temel' },
      { label: 'Ekip CV\'leri (PDF)',               required: true,  category: 'Temel' },
      { label: 'Bütçe tablosu',                     required: true,  category: 'Finansal' },
      { label: 'Referans listesi',                  required: true,  category: 'Akademik' },
      { label: 'SDG hedefleri',                     required: false, category: 'Etki' },
    ];

    const typeSpecific: Record<string, ProjectChecklistItem[]> = {
      tubitak: [
        { label: 'TÜBİTAK ARBİS güncel CV',         required: true,  category: 'TÜBİTAK' },
        { label: 'Türkçe ve İngilizce özet',        required: true,  category: 'TÜBİTAK' },
        { label: 'Çalışma paketleri ve iş planı',   required: true,  category: 'TÜBİTAK' },
        { label: 'Risk analizi',                    required: true,  category: 'TÜBİTAK' },
        { label: 'Etik kurul belgesi (gerekiyorsa)',required: false, category: 'TÜBİTAK' },
      ],
      eu: [
        { label: 'Konsorsiyum anlaşması',           required: true,  category: 'AB' },
        { label: 'Impact pathway belgesi',          required: true,  category: 'AB' },
        { label: 'Gender Equality Plan',            required: true,  category: 'AB' },
        { label: 'Data Management Plan',            required: true,  category: 'AB' },
        { label: 'Open Science Plan',               required: true,  category: 'AB' },
        { label: 'Ethics self-assessment',          required: true,  category: 'AB' },
      ],
      bap: [
        { label: 'BAP başvuru formu',               required: true,  category: 'BAP' },
        { label: 'Bütçe detay tablosu',             required: true,  category: 'BAP' },
        { label: 'Zaman çizelgesi',                 required: true,  category: 'BAP' },
      ],
      industry: [
        { label: 'Sanayi ortak sözleşmesi',         required: true,  category: 'Sanayi' },
        { label: 'Fikri mülkiyet paylaşımı',        required: true,  category: 'Sanayi' },
        { label: 'Gizlilik anlaşması (NDA)',        required: true,  category: 'Sanayi' },
      ],
    };

    return [...common, ...(typeSpecific[type] || [])];
  }

  // ═══ 11. AI SYNTHESIS — her şeyi birleştir, öneri üret ═══════════════════
  async getSynthesis(
    title: string,
    description: string | undefined,
    keywords: string[],
    type: string | undefined,
    budget: number | undefined,
    faculty?: string,
  ): Promise<IntelligenceSynthesis> {
    // Tüm verileri paralel topla
    const [similar, eu, patents, journals, success, sdg] = await Promise.all([
      this.getGlobalSimilar(title, description, 5).catch(() => ({ total: 0, items: [], avgCitations: 0 })),
      this.getEuOpportunities(keywords).catch(() => ({ total: 0, items: [], countries: {}, frameworks: {}, avgBudget: 0 })),
      this.getPatentLandscape(keywords).catch(() => ({ trCount: 0, epCount: 0, configured: false, samples: [] })),
      this.getTargetJournals(keywords, title, 5).catch(() => []),
      this.getSuccessEstimate(type || '', budget).catch(() => ({ sampleSize: 0, avgCompletionRate: 0, avgPublications: 0, avgCitations: 0 })),
      this.getSdgEvidence(title, description).catch(() => []),
    ]);

    // Kompozit skorları hesapla
    // Originality: benzer yayın az → özgünlük yüksek
    const originalityScore = similar.total === 0 ? 80
      : similar.total < 10 ? 85
      : similar.total < 50 ? 70
      : similar.total < 150 ? 55
      : 35;

    // Competition: AB projesi + patent sayısı düşük → rekabet düşük → yüksek skor
    const totalCompetitors = eu.total + patents.trCount + patents.epCount;
    const competitionScore = totalCompetitors === 0 ? 85
      : totalCompetitors < 5 ? 75
      : totalCompetitors < 20 ? 60
      : totalCompetitors < 50 ? 45
      : 30;

    // Fit: Q1 dergi sayısı yüksek → uyum yüksek
    const q1Count = journals.filter(j => j.sjrQuartile === 'Q1').length;
    const qAnyCount = journals.filter(j => j.sjrQuartile).length;
    const fitScore = qAnyCount === 0 ? 50 : Math.round((q1Count / qAnyCount) * 70 + 30);

    // Success: MKÜ geçmiş tamamlanma oranı
    const successProbability = success.sampleSize > 0 ? success.avgCompletionRate : 60;

    const overallScore = Math.round((originalityScore + competitionScore + fitScore + successProbability) / 4);

    // AI narrative — Anthropic API varsa AI, yoksa rule-based
    const synthesis = await this.generateSynthesisNarrative({
      title, description, keywords, type, budget,
      similar, eu, patents, journals, success, sdg,
      scores: { originalityScore, competitionScore, fitScore, successProbability, overallScore },
    });

    return {
      originalityScore,
      competitionScore,
      fitScore,
      successProbability,
      overallScore,
      ...synthesis,
    };
  }

  private async generateSynthesisNarrative(ctx: any): Promise<{ narrative: string; highlights: string[]; risks: string[]; recommendations: string[]; source: 'ai' | 'rule-based' }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    // Rule-based fallback — daha analitik, somut veri referanslı
    const ruleBased = () => {
      const highlights: string[] = [];
      const risks: string[] = [];
      const recommendations: string[] = [];

      // Highlights — somut veri ile
      if (ctx.similar.total > 0 && ctx.similar.total < 30) {
        highlights.push(`Az işlenmiş niş alan — dünyada yalnızca ${ctx.similar.total} emsal yayın var (ortalama ${ctx.similar.avgCitations} atıf)`);
      } else if (ctx.similar.total > 100) {
        highlights.push(`Olgun araştırma alanı — ${ctx.similar.total} yayın, ortalama ${ctx.similar.avgCitations} atıf; referans literatürü zengin`);
      }
      if (ctx.journals.length > 0 && ctx.journals[0]) {
        const top = ctx.journals[0];
        const q1count = ctx.journals.filter((j: any) => j.sjrQuartile === 'Q1').length;
        if (q1count > 0) highlights.push(`${q1count} Q1 hedef dergi eşleşti — en uygun: "${top.title}"${top.sjrScore ? ` (SJR ${top.sjrScore})` : ''}`);
        else if (top.title) highlights.push(`Potansiyel hedef dergi: "${top.title}"`);
      }
      if (ctx.eu.total > 0) {
        const sampleAcro = ctx.eu.items?.[0]?.acronym;
        highlights.push(`${ctx.eu.total} benzer AB projesi tespit edildi${sampleAcro ? ` (örn. ${sampleAcro})` : ''} — ortalama AB katkısı €${Math.round(ctx.eu.avgBudget).toLocaleString()}`);
      }
      if (ctx.sdg.length >= 2) {
        const topSdgs = ctx.sdg.slice(0, 2).map((s: any) => s.sdgName).join(' ve ');
        highlights.push(`Öne çıkan SDG katkısı: ${topSdgs}`);
      }
      if (ctx.scores.successProbability >= 70 && ctx.success.sampleSize > 0) {
        highlights.push(`MKÜ'de benzer ${ctx.success.sampleSize} projenin %${ctx.scores.successProbability}'i başarıyla tamamlanmış`);
      }

      // Risks — spesifik
      if (ctx.similar.total > 150) {
        risks.push(`Yüksek rekabet yoğunluğu — ${ctx.similar.total} yayınla doymuş bir alan, farklılaşan katkı netleştirilmeli`);
      }
      if (ctx.patents.trCount + ctx.patents.epCount > 10) {
        risks.push(`Prior art riski yüksek: EPO'da ${ctx.patents.trCount} TR + ${ctx.patents.epCount} AB patent tespit edildi — IP planı önceden gerekli`);
      }
      if (ctx.scores.successProbability < 50 && ctx.success.sampleSize > 3) {
        risks.push(`Dikkat: MKÜ'de benzer ${ctx.success.sampleSize} projenin tamamlanma oranı %${ctx.scores.successProbability} — iyi bir proje yönetim planı kritik`);
      }
      if (ctx.journals.length > 0 && ctx.journals.filter((j: any) => j.sjrQuartile).length === 0) {
        risks.push('Dergi kalite verisi eksik — SCImago yüklü değil, hedef dergi stratejisi manuel doğrulanmalı');
      }
      if (ctx.eu.total === 0 && ctx.keywords.length > 0) {
        risks.push('Bu konuda AB fonlu proje yok — AB başvurusu risk taşır, ulusal kaynaklara yönelin');
      }

      // Recommendations — aksiyon odaklı, somut
      if (ctx.similar.items && ctx.similar.items[0]) {
        const top = ctx.similar.items[0];
        recommendations.push(`En çok atıf alan "${top.title}" (${top.year}, ${top.citedBy} atıf) çalışmasını inceleyip farklılaşan katkınızı önerinin girişinde belirtin`);
      }
      if (ctx.journals[0] && ctx.journals[0].title) {
        recommendations.push(`Yayın stratejisi: önceliğinizi "${ctx.journals[0].title}" dergisine verin; alternatif olarak ${ctx.journals.slice(1, 3).map((j: any) => `"${j.title}"`).join(' ve ') || 'diğer aday dergiler'}`);
      }
      if (ctx.eu.avgBudget > 0 && ctx.budget) {
        const diff = ctx.eu.avgBudget - ctx.budget;
        if (Math.abs(diff) > ctx.eu.avgBudget * 0.5) {
          recommendations.push(`Bütçeniz ${ctx.budget.toLocaleString()} ₺ — benzer AB projeleri €${Math.round(ctx.eu.avgBudget).toLocaleString()}; orana göre uygun mu yeniden değerlendirin`);
        }
      }
      if (ctx.eu.countries && Object.keys(ctx.eu.countries).length > 0) {
        const topCountries = Object.entries(ctx.eu.countries).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3).map((c: any) => c[0]);
        recommendations.push(`En aktif AB partner ülkeleri: ${topCountries.join(', ')} — konsorsiyum kurarken bu ülkelerden kurumlarla iletişime geçin`);
      }
      if (ctx.sdg.length === 0) {
        recommendations.push('OpenAlex SDG eşleşmesi yapılamadı — proje metninde SDG ile ilgili terimler kullanarak küresel etki çerçevesi ekleyin');
      }

      // Narrative — somut veri çağrısıyla
      const originalityLabel = ctx.scores.originalityScore >= 70 ? 'güçlü özgünlük' : ctx.scores.originalityScore >= 50 ? 'orta özgünlük' : 'yüksek rekabet';
      const compLabel = ctx.scores.competitionScore >= 70 ? 'az sayıda rakip' : ctx.scores.competitionScore >= 50 ? 'orta düzey rekabet' : 'yoğun rekabet';

      const narrative =
        `Proje ${originalityLabel} (%${ctx.scores.originalityScore}) ve ${compLabel} (%${ctx.scores.competitionScore}) profili sergiliyor. ` +
        (ctx.similar.total > 0
          ? `OpenAlex'te ${ctx.similar.total} benzer yayın — ortalama ${ctx.similar.avgCitations} atıf, zirve yılı ${ctx.similar.peakYear || 'belirsiz'}. `
          : 'Dünya literatüründe neredeyse hiç emsal yok; bu bir fırsat veya niş seçimin sonucu olabilir. ') +
        (ctx.eu.total > 0
          ? `AB'de ${ctx.eu.total} emsal proje finanse edilmiş (ortalama €${Math.round(ctx.eu.avgBudget).toLocaleString()}); `
          : 'AB fonu açısından bakir alan; ') +
        (ctx.patents.configured && (ctx.patents.trCount + ctx.patents.epCount) > 0
          ? `patent manzarasında ${ctx.patents.trCount} TR + ${ctx.patents.epCount} AB kaydı prior art olarak dikkate alınmalı. `
          : 'patent rekabeti tespit edilmedi. ') +
        `MKÜ içi ${ctx.success.sampleSize} emsal projeden çıkarılan başarı olasılığı %${ctx.scores.successProbability}.`;

      return {
        narrative,
        highlights: highlights.slice(0, 5),
        risks: risks.slice(0, 4),
        recommendations: recommendations.slice(0, 4),
        source: 'rule-based' as const,
      };
    };

    if (!apiKey) return ruleBased();

    // AI-powered narrative — somut veri referanslı
    try {
      // Gerçek referans veriler — prompt'ta tırnak içinde geçsin
      const topSimilar = (ctx.similar.items || []).slice(0, 3).map((w: any) =>
        `"${w.title}" (${w.year || '?'}, ${w.citedBy} atıf${w.journal ? `, ${w.journal}` : ''})`
      ).join('\n    ');
      const topJournals = (ctx.journals || []).slice(0, 4).map((j: any) =>
        `"${j.title}"${j.sjrQuartile ? ` [${j.sjrQuartile}]` : ''}${j.sjrScore ? ` SJR ${j.sjrScore}` : ''}`
      ).join(', ');
      const topEuProjects = (ctx.eu.items || []).slice(0, 3).map((p: any) =>
        `${p.acronym || p.id} (${p.framework}, €${Math.round(p.ecMaxContribution || 0).toLocaleString()})`
      ).join(', ');
      const sdgNames = (ctx.sdg || []).slice(0, 3).map((s: any) => s.sdgName).join(', ');
      const topCountries = ctx.eu.countries ? Object.entries(ctx.eu.countries).sort((a: any, b: any) => b[1] - a[1]).slice(0, 4).map((c: any) => c[0]).join(', ') : '';

      const prompt = `Sen bir akademik proje danışmanısın — MKÜ TTO (Mustafa Kemal Üniversitesi Teknoloji Transfer Ofisi) için çalışıyorsun.
Kullanıcının yazdığı proje için KİŞİSELLEŞMİŞ, SOMUT VERİYE dayanan bir analiz üret.

PROJE BİLGİLERİ:
- Başlık: ${ctx.title}
- Açıklama: ${ctx.description || '(Açıklama henüz girilmemiş)'}
- Anahtar kelimeler: ${ctx.keywords.join(', ') || '(yok)'}
- Tür: ${ctx.type || '-'}
- Bütçe: ${ctx.budget ? ctx.budget.toLocaleString() + ' ₺' : '-'}

YAPTIĞIMIZ ARAMADAN GERÇEK VERİLER:

KÜRESEL LİTERATÜR:
- Toplam ${ctx.similar.total} benzer yayın, ortalama ${ctx.similar.avgCitations} atıf, zirve yılı ${ctx.similar.peakYear || 'belirsiz'}
- En çok atıf alan 3:
    ${topSimilar || '(Yeterli veri yok)'}

HEDEF DERGİLER (SCImago + OpenAlex eşleşmesi):
- ${ctx.journals.length} aday dergi tanımlandı
- ${ctx.journals.filter((j: any) => j.sjrQuartile === 'Q1').length} Q1, ${ctx.journals.filter((j: any) => j.sjrQuartile === 'Q2').length} Q2
- Top 4: ${topJournals || '(bulunamadı)'}

AB FON MANZARASI (OpenAIRE):
- Bu konuda ${ctx.eu.total} AB fonlu proje, ortalama AB katkısı €${Math.round(ctx.eu.avgBudget).toLocaleString()}
- En aktif partner ülkeler: ${topCountries || 'veri yok'}
- Örnek projeler: ${topEuProjects || '(bulunamadı)'}

PATENT MANZARASI (EPO):
- ${ctx.patents.configured ? `TR: ${ctx.patents.trCount}, AB: ${ctx.patents.epCount} patent` : 'EPO bağlantısı kurulmamış'}

MKÜ İÇİ İSTATİSTİKLER:
- Benzer türde ${ctx.success.sampleSize} emsal proje
- Tamamlanma oranı: %${ctx.success.avgCompletionRate}
- ${ctx.success.budgetPercentile !== undefined ? `Girilen bütçe emsallerin %${ctx.success.budgetPercentile}'inden yüksek` : ''}

SDG KATKISI:
- ${ctx.sdg.length} SDG'ye katkı tespit edildi
- En baskın: ${sdgNames || '(yok)'}

KOMPOZİT SKORLAR:
- Özgünlük: %${ctx.scores.originalityScore}
- Rekabet (düşük=fırsat): %${ctx.scores.competitionScore}
- Dergi uyumu: %${ctx.scores.fitScore}
- Başarı olasılığı: %${ctx.scores.successProbability}
- Genel skor: %${ctx.scores.overallScore}

SENDEN İSTENENLER:

1. NARRATIVE: 2 paragraflık TÜRKÇE yönetici özeti yaz. Genellemelerden kaçın — YUKARIDAKİ SOMUT VERİLERE atıf yap:
   - Gerçek dergi isimlerini tırnak içinde ver
   - Gerçek AB proje akronimlerini kullan
   - Sayıları yuvarlamadan yaz (%73 tamamlanma gibi)
   - Bu proje için SPESİFİK olan şeyleri söyle

2. HIGHLIGHTS (3-5 madde): Bu projenin güçlü yönleri — yukarıdaki verilerle desteklenmiş.
3. RISKS (2-4 madde): Dikkat edilmesi gerekenler — rakamsal gerekçelerle.
4. RECOMMENDATIONS (3 somut öneri): AKSİYON ODAKLI — "X dergisine gönder", "Y ülkesinden partner ara", "Z yayını referans al" gibi.

SADECE JSON döndür, başka hiçbir şey yazma:
{
  "narrative": "İki paragraflık analiz",
  "highlights": ["Somut veri referanslı güçlü yön 1", "..."],
  "risks": ["Rakam referanslı risk 1", "..."],
  "recommendations": ["Aksiyon önerisi 1", "..."]
}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) return ruleBased();
      const data = await res.json();
      const text = data?.content?.[0]?.text || '';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      return {
        narrative: parsed.narrative || '',
        highlights: parsed.highlights || [],
        risks: parsed.risks || [],
        recommendations: parsed.recommendations || [],
        source: 'ai' as const,
      };
    } catch (e: any) {
      this.logger.warn(`AI synthesis failed, falling back to rule-based: ${e.message}`);
      return ruleBased();
    }
  }

  // ═══ 12. FUNDING SIMULATOR ═══════════════════════════════════════════
  async getFundingSimulation(
    type: string,
    budget?: number,
    durationMonths?: number,
    faculty?: string,
  ): Promise<FundingSimulation> {
    try {
      const qb = this.projectRepo.createQueryBuilder('p');
      if (type) qb.where('p.type = :type', { type });
      if (faculty) qb.andWhere('p.faculty = :faculty', { faculty });
      const projects = await qb.getMany();

      if (projects.length === 0) {
        return {
          sampleSize: 0,
          estimatedSuccessProbability: 50,
          analogs: [],
        };
      }

      // Bütçe istatistikleri
      const budgets = projects.map(p => p.budget || 0).filter(b => b > 0).sort((a, b) => a - b);
      const median = budgets.length > 0 ? budgets[Math.floor(budgets.length / 2)] : 0;
      const p25 = budgets.length > 0 ? budgets[Math.floor(budgets.length * 0.25)] : 0;
      const p75 = budgets.length > 0 ? budgets[Math.floor(budgets.length * 0.75)] : 0;

      // Analog projeler — en yakın 3 bütçeli
      let analogs: any[] = [];
      if (budget) {
        const sorted = [...projects].sort((a, b) =>
          Math.abs((a.budget || 0) - budget) - Math.abs((b.budget || 0) - budget)
        );
        analogs = sorted.slice(0, 3).map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          budget: p.budget,
          startDate: p.startDate,
          endDate: p.endDate,
          reasoning: `Bütçe farkı: ${Math.abs((p.budget || 0) - budget).toLocaleString()}`,
        }));
      } else {
        analogs = projects.slice(-3).map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          budget: p.budget,
          startDate: p.startDate,
          endDate: p.endDate,
          reasoning: 'En yakın tarihli emsal',
        }));
      }

      // Başarı olasılığı — aynı tür + benzer bütçedeki projelerin completion oranı
      let targetProjects = projects;
      if (budget) {
        // Bütçenin ±%50'si içinde olan projeleri al
        const low = budget * 0.5;
        const high = budget * 1.5;
        const budgetMatched = projects.filter(p => p.budget && p.budget >= low && p.budget <= high);
        if (budgetMatched.length >= 3) targetProjects = budgetMatched;
      }
      const completed = targetProjects.filter(p => p.status === 'completed').length;
      const decided = targetProjects.filter(p => ['completed', 'cancelled'].includes(p.status)).length;
      const estimatedSuccess = decided > 0 ? Math.round((completed / decided) * 100) : 60;

      // Percentile hesapları
      let budgetPercentile;
      if (budget && budgets.length > 0) {
        const lower = budgets.filter(b => b < budget).length;
        budgetPercentile = Math.round((lower / budgets.length) * 100);
      }

      return {
        sampleSize: projects.length,
        estimatedSuccessProbability: estimatedSuccess,
        budgetPercentile,
        analogs,
        recommendedBudgetRange: budgets.length > 0 ? { min: p25, median, max: p75 } : undefined,
      };
    } catch (e: any) {
      this.logger.warn(`Funding simulator failed: ${e.message}`);
      return { sampleSize: 0, estimatedSuccessProbability: 50, analogs: [] };
    }
  }

  // ═══ 13. COLLABORATION NETWORK — konu bazlı, mevcut vs potansiyel ════════
  /**
   * Yeni yaklaşım: "geçmiş ortakları göster" değil, "proje konusunda aktif
   * dünya araştırmacılarını göster, içlerinden senin eski ortakların vurgulu".
   * Yeni proje yazımı için ileriye dönük değer verir.
   */
  async getCollaborationNetwork(userId: string, keywords: string[] = [], title?: string): Promise<{
    center: { label: string; type: 'topic' | 'user' };
    nodes: Array<{
      id: string;
      name: string;
      weight: number;
      institution?: string;
      country?: string;
      orcid?: string;
      type: 'existing-coauthor' | 'topic-expert' | 'both';
      pubCount?: number;
    }>;
    edges: Array<{ source: string; target: string; weight: number; kind: 'personal' | 'topic' }>;
    stats: { existingCount: number; topicExpertCount: number; commonCount: number };
  }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    // Merkez — eğer konu verilmişse konu node'u, yoksa kullanıcı
    const topicQuery = [title, ...keywords].filter(Boolean).join(' ').slice(0, 200);
    const hasTopic = topicQuery.length > 10;

    const center = hasTopic
      ? { label: keywords.slice(0, 3).join(' · ') || 'Proje Konusu', type: 'topic' as const }
      : { label: user ? `${user.firstName} ${user.lastName}`.trim() : 'Sen', type: 'user' as const };

    try {
      // 1) Kullanıcının mevcut ortakları (ORCID varsa)
      const existingCoauthors = new Map<string, { name: string; count: number; institution?: string; orcid?: string; country?: string }>();
      if (user?.orcidId) {
        const author = await this.openalex.getAuthorByOrcid(user.orcidId).catch(() => null);
        if (author) {
          const works = await this.openalex.getAuthorWorks(author.id, 100).catch(() => []);
          for (const w of works) {
            for (const a of w.authors || []) {
              if (!a.displayName) continue;
              if (a.orcid && a.orcid === user.orcidId) continue;
              const key = a.displayName.toLowerCase();
              const cur = existingCoauthors.get(key) || { name: a.displayName, count: 0, institution: a.institution, orcid: a.orcid };
              cur.count++;
              if (a.institution && !cur.institution) cur.institution = a.institution;
              if (a.orcid && !cur.orcid) cur.orcid = a.orcid;
              existingCoauthors.set(key, cur);
            }
          }
        }
      }

      // 2) Konu uzmanları — OpenAlex'ten topic search + top authors
      const topicExperts = new Map<string, { name: string; count: number; institution?: string; orcid?: string; country?: string; totalCitations: number }>();
      if (hasTopic) {
        const works = await this.searchOpenAlexByQuery(topicQuery, 60);
        for (const w of works) {
          for (const a of w.authors || []) {
            if (!a.displayName) continue;
            const key = a.displayName.toLowerCase();
            const cur = topicExperts.get(key) || { name: a.displayName, count: 0, institution: a.institution, orcid: a.orcid, totalCitations: 0 };
            cur.count++;
            cur.totalCitations += w.citedBy || 0;
            if (a.institution && !cur.institution) cur.institution = a.institution;
            if (a.orcid && !cur.orcid) cur.orcid = a.orcid;
            topicExperts.set(key, cur);
          }
        }
      }

      // 3) Birleştir — her yazar için tip belirle
      const allKeys = new Set([...existingCoauthors.keys(), ...topicExperts.keys()]);
      const nodeList: any[] = [];
      for (const key of allKeys) {
        const ex = existingCoauthors.get(key);
        const te = topicExperts.get(key);
        if (!ex && !te) continue;

        let type: 'existing-coauthor' | 'topic-expert' | 'both';
        let weight: number;

        if (ex && te) {
          type = 'both';
          weight = ex.count + te.count;  // ekstra ağırlık — hem tanıdık hem alanında
        } else if (ex) {
          type = 'existing-coauthor';
          weight = ex.count;
        } else {
          type = 'topic-expert';
          weight = te!.count;
        }

        const src = ex || te!;
        nodeList.push({
          name: src.name,
          weight,
          type,
          institution: src.institution,
          orcid: src.orcid,
          pubCount: te?.count || ex?.count || 0,
          // 'both' önce, topic-expert sonra, existing en son (new opportunities öne çıkar)
          sortKey: (type === 'both' ? 0 : type === 'topic-expert' ? 1 : 2) * 1000 - weight,
        });
      }

      // En iyi 20 — 'both' > 'topic-expert' > 'existing'
      nodeList.sort((a, b) => a.sortKey - b.sortKey);
      const top = nodeList.slice(0, 20);

      const nodes = top.map((n, i) => ({
        id: `n${i}`,
        name: n.name,
        weight: n.weight,
        institution: n.institution,
        orcid: n.orcid,
        type: n.type,
        pubCount: n.pubCount,
      }));

      // Kenarlar — hepsi merkeze bağlı, tip ayrımı renklerle
      const edges = nodes.map(n => ({
        source: 'center',
        target: n.id,
        weight: n.weight,
        kind: (n.type === 'existing-coauthor' || n.type === 'both') ? 'personal' as const : 'topic' as const,
      }));

      return {
        center,
        nodes,
        edges,
        stats: {
          existingCount: nodes.filter(n => n.type === 'existing-coauthor').length,
          topicExpertCount: nodes.filter(n => n.type === 'topic-expert').length,
          commonCount: nodes.filter(n => n.type === 'both').length,
        },
      };
    } catch (e: any) {
      this.logger.warn(`Collaboration network failed: ${e.message}`);
      return { center, nodes: [], edges: [], stats: { existingCount: 0, topicExpertCount: 0, commonCount: 0 } };
    }
  }

  // ── INTERNAL HELPERS ──────────────────────────────────────────────────

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
        orcid: a.author?.orcid ? String(a.author.orcid).replace(/^https?:\/\/orcid\.org\//, '') : undefined,
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
