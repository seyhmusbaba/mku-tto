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

  // ═══ 5. POTANSİYEL EKİP (DÜZELTİLDİ — full-text, tüm keywords) ═══════
  async getPotentialCollaborators(keywords: string[], currentFaculty?: string): Promise<PotentialCollaborator[]> {
    const results: PotentialCollaborator[] = [];
    if (keywords.length === 0) return results;

    // İç: bio + expertiseArea + project keywords üzerinden multi-keyword OR arama
    try {
      const qb = this.userRepo.createQueryBuilder('u')
        .leftJoinAndSelect('u.role', 'role')
        .where('u.isActive = true');

      // Her keyword için ILIKE clause — tüm kelimeler üzerinden OR
      const kwOrClauses: string[] = [];
      const params: Record<string, any> = {};
      keywords.slice(0, 6).forEach((kw, i) => {
        kwOrClauses.push(
          `u."expertiseArea" ILIKE :kw${i} OR u.bio ILIKE :kw${i} OR CONCAT(u."firstName", ' ', u."lastName") ILIKE :kw${i}`
        );
        params[`kw${i}`] = `%${kw}%`;
      });
      if (kwOrClauses.length > 0) {
        qb.andWhere('(' + kwOrClauses.join(' OR ') + ')', params);
      }

      const internal = await qb.take(10).getMany();

      // Match score: kaç keyword eşleşiyor
      for (const u of internal) {
        const haystack = ((u as any).expertiseArea || '') + ' ' + ((u as any).bio || '');
        const matches = keywords.filter(k => haystack.toLowerCase().includes(k.toLowerCase())).length;
        const matchScore = keywords.length > 0 ? Math.round((matches / keywords.length) * 100) : 0;
        if (matchScore === 0 && internal.length > 0) continue; // sadece name match — atla
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
      // MatchScore'a göre sırala
      results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
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

  // ═══ 7. BAŞARI TAHMİNİ ═════════════════════════════════════════════
  async getSuccessEstimate(type: string, budget?: number, durationMonths?: number): Promise<{
    sampleSize: number;
    avgCompletionRate: number;
    avgPublications: number;
    avgCitations: number;
    budgetPercentile?: number;
  }> {
    try {
      const qb = this.projectRepo.createQueryBuilder('p');
      if (type) qb.where('p.type = :type', { type });

      const projects = await qb.getMany();
      if (projects.length === 0) {
        return { sampleSize: 0, avgCompletionRate: 0, avgPublications: 0, avgCitations: 0 };
      }

      const completed = projects.filter(p => p.status === 'completed').length;
      const decided = projects.filter(p => ['completed', 'cancelled'].includes(p.status)).length;
      const completionRate = decided > 0 ? (completed / decided) * 100 : 0;

      let budgetPercentile;
      if (budget) {
        const budgets = projects.map(p => p.budget || 0).filter(b => b > 0).sort((a, b) => a - b);
        const lower = budgets.filter(b => b < budget).length;
        budgetPercentile = budgets.length > 0 ? Math.round((lower / budgets.length) * 100) : undefined;
      }

      return {
        sampleSize: projects.length,
        avgCompletionRate: Math.round(completionRate),
        avgPublications: 0,
        avgCitations: 0,
        budgetPercentile,
      };
    } catch (e: any) {
      this.logger.warn(`Success estimate failed: ${e.message}`);
      return { sampleSize: 0, avgCompletionRate: 0, avgPublications: 0, avgCitations: 0 };
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

    // Rule-based fallback — her zaman çalışır
    const ruleBased = () => {
      const highlights: string[] = [];
      const risks: string[] = [];
      const recommendations: string[] = [];

      if (ctx.scores.originalityScore >= 70) highlights.push(`Özgünlük yüksek — dünyada sadece ${ctx.similar.total} benzer çalışma`);
      if (ctx.journals.length > 0) {
        const q1 = ctx.journals.filter((j: any) => j.sjrQuartile === 'Q1').length;
        if (q1 > 0) highlights.push(`${q1} Q1 hedef dergi tanımlandı`);
      }
      if (ctx.eu.total > 0) highlights.push(`${ctx.eu.total} benzer AB projesi var — konsorsiyum fırsatı`);
      if (ctx.sdg.length >= 2) highlights.push(`${ctx.sdg.length} farklı SDG'ye katkı`);

      if (ctx.scores.competitionScore < 50) risks.push('Yüksek rekabet — bu konuda çok sayıda önceki çalışma var');
      if (ctx.patents.trCount + ctx.patents.epCount > 10) risks.push(`Prior art riski: ${ctx.patents.trCount + ctx.patents.epCount} mevcut patent tespit edildi`);
      if (ctx.scores.successProbability < 50) risks.push('Benzer türdeki projelerin tamamlanma oranı düşük');

      if (ctx.eu.avgBudget > 0) recommendations.push(`Benzer AB projelerinin ortalama bütçesi €${Math.round(ctx.eu.avgBudget).toLocaleString()} — başvuru bütçenizi buna göre planlayın`);
      if (ctx.journals[0]) recommendations.push(`En uyumlu hedef dergi: "${ctx.journals[0].title}" (fit: ${ctx.journals[0].fitScore}/100)`);
      recommendations.push('Proje metninizi en çok atıf alan 3 çalışmayla karşılaştırıp farklılaşan katkınızı netleştirin');

      const narrative =
        `Bu proje özgünlük açısından ${ctx.scores.originalityScore >= 70 ? 'güçlü' : ctx.scores.originalityScore >= 50 ? 'orta' : 'zayıf'} (%${ctx.scores.originalityScore}), ` +
        `rekabet yoğunluğu ${ctx.scores.competitionScore >= 70 ? 'düşük — fırsat' : ctx.scores.competitionScore >= 50 ? 'orta' : 'yüksek'} (%${ctx.scores.competitionScore}). ` +
        `Yayın stratejisi uyumu %${ctx.scores.fitScore}, ` +
        `geçmiş verilerle başarı olasılığı %${ctx.scores.successProbability}. ` +
        (ctx.similar.total > 0 ? `Dünyada ${ctx.similar.total} benzer yayın var; ` : 'Konuda emsal literatür sınırlı; ') +
        (ctx.eu.total > 0 ? `${ctx.eu.total} AB projesi aynı alanı kapsıyor.` : 'henüz büyük AB fonu almamış nadir bir alan.');

      return { narrative, highlights: highlights.slice(0, 5), risks: risks.slice(0, 4), recommendations: recommendations.slice(0, 4), source: 'rule-based' as const };
    };

    if (!apiKey) return ruleBased();

    // AI-powered narrative
    try {
      const prompt = `Sen bir akademik proje danışmanısın. Aşağıdaki verilere dayanarak bir akademik proje için
kısa yönetici özet yaz (Türkçe, 2 paragraf), ardından 3-5 güçlü yön, 2-4 risk ve 3 somut öneri listele.

PROJE:
Başlık: ${ctx.title}
Açıklama: ${ctx.description || '(yok)'}
Anahtar kelimeler: ${ctx.keywords.join(', ')}
Tür: ${ctx.type || '-'}
Bütçe: ${ctx.budget || '-'}

VERİ:
- Dünya literatüründe ${ctx.similar.total} benzer yayın (ort. ${ctx.similar.avgCitations} atıf)
- AB'de ${ctx.eu.total} benzer proje, ort. bütçe €${Math.round(ctx.eu.avgBudget).toLocaleString()}
- EPO'da ${ctx.patents.trCount} TR + ${ctx.patents.epCount} AB patent
- ${ctx.journals.length} aday dergi, ${ctx.journals.filter((j: any) => j.sjrQuartile === 'Q1').length} Q1
- MKÜ'de benzer projede %${ctx.success.avgCompletionRate} tamamlanma (n=${ctx.success.sampleSize})
- ${ctx.sdg.length} SDG'ye katkı

SKORLAR:
Özgünlük: %${ctx.scores.originalityScore}
Rekabet (düşük=fırsat): %${ctx.scores.competitionScore}
Dergi uyumu: %${ctx.scores.fitScore}
Başarı olasılığı: %${ctx.scores.successProbability}

YALNIZCA JSON döndür, başka hiçbir şey yazma:
{
  "narrative": "2 paragraf Türkçe yönetici özet",
  "highlights": ["5 madde güçlü yön"],
  "risks": ["3 madde risk"],
  "recommendations": ["3 somut öneri"]
}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
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

  // ═══ 13. COLLABORATION NETWORK (co-author graph) ═════════════════════════
  async getCollaborationNetwork(userId: string): Promise<{
    center: { name: string; orcid?: string };
    nodes: Array<{ id: string; name: string; weight: number; institution?: string; orcid?: string }>;
    edges: Array<{ source: string; target: string; weight: number }>;
  }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return { center: { name: '' }, nodes: [], edges: [] };

    const centerName = `${user.firstName} ${user.lastName}`.trim();
    const center = { name: centerName, orcid: user.orcidId };

    try {
      // ORCID üzerinden OpenAlex'ten author ID bul
      if (!user.orcidId) return { center, nodes: [], edges: [] };
      const author = await this.openalex.getAuthorByOrcid(user.orcidId);
      if (!author) return { center, nodes: [], edges: [] };

      // Author'ın yayınlarını çek
      const works = await this.openalex.getAuthorWorks(author.id, 100);

      // Co-author sayacı
      const coauthors = new Map<string, { name: string; count: number; institution?: string; orcid?: string }>();
      for (const w of works) {
        for (const a of w.authors || []) {
          if (!a.displayName) continue;
          if (a.displayName.toLowerCase() === centerName.toLowerCase()) continue;
          if (a.orcid && a.orcid === user.orcidId) continue;
          const key = a.displayName.toLowerCase();
          const cur = coauthors.get(key) || { name: a.displayName, count: 0, institution: a.institution, orcid: a.orcid };
          cur.count++;
          if (a.institution && !cur.institution) cur.institution = a.institution;
          if (a.orcid && !cur.orcid) cur.orcid = a.orcid;
          coauthors.set(key, cur);
        }
      }

      // Top 20 co-author
      const sorted = Array.from(coauthors.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      const nodes = sorted.map((c, i) => ({
        id: `n${i}`,
        name: c.name,
        weight: c.count,
        institution: c.institution,
        orcid: c.orcid,
      }));

      const edges = nodes.map(n => ({ source: 'center', target: n.id, weight: n.weight }));

      return { center, nodes, edges };
    } catch (e: any) {
      this.logger.warn(`Collaboration network failed: ${e.message}`);
      return { center, nodes: [], edges: [] };
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
