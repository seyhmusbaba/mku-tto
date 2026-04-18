import { Controller, Get, Post, Query, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { ScopusService } from './scopus.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { Project } from '../database/entities/project.entity';
import { ProjectMember } from '../database/entities/project-member.entity';

@SkipThrottle()
@Controller('scopus')
export class ScopusController {
  constructor(
    private readonly scopus: ScopusService,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(ProjectMember) private memberRepo: Repository<ProjectMember>,
  ) {}

  // ── GUARD GEREKTİRMEYEN ───────────────────────────────────────
  // Tarayıcıdan direkt /api/scopus/test ile test edilebilir
  @Get('test')
  async test() {
    if (!this.scopus.isConfigured()) {
      return { ok: false, error: 'SCOPUS_API_KEY tanımlı değil' };
    }
    try {
      const url = `https://api.elsevier.com/content/search/scopus?query=TITLE(artificial+intelligence)&count=1&field=dc:title,citedby-count`;
      const res = await fetch(url, {
        headers: {
          'X-ELS-APIKey': process.env.SCOPUS_API_KEY || '',
          'Accept': 'application/json',
          ...(process.env.SCOPUS_INST_TOKEN ? { 'X-ELS-Insttoken': process.env.SCOPUS_INST_TOKEN } : {}),
        },
        signal: AbortSignal.timeout(10000),
      });
      const status = res.status;
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          ok: false,
          httpStatus: status,
          error: (body as any)?.['service-error']?.status?.statusText || 'API hatası',
          raw: body,
        };
      }

      const entry = (body as any)?.['search-results']?.['entry']?.[0];
      return {
        ok: true,
        httpStatus: status,
        tokenUsed: !!process.env.SCOPUS_INST_TOKEN,
        sampleResult: entry ? {
          title: entry['dc:title'],
          citedBy: entry['citedby-count'],
        } : null,
        message: 'Scopus API bağlantısı başarılı ✅',
      };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Bağlantı hatası' };
    }
  }


  // Debug: kendi profilini ve Scopus verisini göster — PUBLIC (geçici test)
  // /api/scopus/debug?userId=USER_ID_BURAYA
  @Get('debug')
  async debug(@Query('userId') userId?: string) {
    if (!userId) {
      return { error: 'userId parametresi gerekli', example: '/api/scopus/debug?userId=UUID' };
    }
    const steps: any[] = [];

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return { fail: 'Kullanıcı bulunamadı', userId };
    steps.push({ step: 1, ok: true, info: `Kullanıcı: ${user.email}` });

    const scopusId = (user as any)?.scopusAuthorId;
    if (!scopusId) return { fail: 'scopusAuthorId DB\'de yok', steps };
    steps.push({ step: 2, ok: true, info: `Scopus ID: ${scopusId}` });

    const apiKey = process.env.SCOPUS_API_KEY || '';
    if (!apiKey) return { fail: 'SCOPUS_API_KEY env yok', steps };
    steps.push({ step: 3, ok: true, info: `API key mevcut` });

    let profile: any = null;
    let profileError = '';
    try {
      this.scopus.clearCache(`author:${scopusId}`);
      profile = await this.scopus.getAuthorProfile(scopusId);
      if (!profile) profileError = 'null döndü';
    } catch (e: any) { profileError = e?.message || 'exception'; }

    if (!profile) return { fail: 'getAuthorProfile başarısız: ' + profileError, steps };
    steps.push({ step: 4, ok: true, info: `h=${profile.hIndex}, atıf=${profile.citedByCount}, yayın=${profile.documentCount}` });

    try {
      await this.userRepo.update(userId, {
        scopusHIndex:   profile.hIndex,
        scopusCitedBy:  profile.citedByCount,
        scopusDocCount: profile.documentCount,
        scopusSubjects: JSON.stringify(profile.subjectAreas || []),
        scopusLastSync: new Date().toISOString(),
      } as any);
      steps.push({ step: 5, ok: true, info: 'DB güncellendi' });
    } catch (e: any) { return { fail: 'DB yazma hatası: ' + e?.message, steps }; }

    const updated = await this.userRepo.findOne({ where: { id: userId } });
    steps.push({ step: 6, ok: true, info: `DB doğrulama: hIndex=${(updated as any)?.scopusHIndex}` });

    return { success: true, steps, profile };
  }
  @UseGuards(JwtAuthGuard)
  @Get('status')
  status() {
    return { configured: this.scopus.isConfigured() };
  }

  // ── 1. ARAŞTIRMACI PROFİLİ ────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('author/:authorId')
  getAuthorProfile(@Param('authorId') authorId: string) {
    return this.scopus.getAuthorProfile(authorId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('author/:authorId/publications')
  getAuthorPublications(
    @Param('authorId') authorId: string,
    @Query('limit') limit?: string,
  ) {
    return this.scopus.getAuthorPublications(authorId, limit ? +limit : 20);
  }

  // Giriş yapan kullanıcının kendi Scopus profilini güncelle
  @UseGuards(JwtAuthGuard)
  @Post('sync-my-profile')
  async syncMyProfile(@Request() req: any) {
    const user = await this.userRepo.findOne({ where: { id: req.user.userId } });
    if (!user || !(user as any).scopusAuthorId) {
      return { error: 'Scopus Author ID bulunamadı. Profilinizden ekleyin.' };
    }

    const authorId = (user as any).scopusAuthorId;

    // Önbelleği temizle — her senkronizasyonda taze veri çek
    this.scopus.clearCache(`author:${authorId}`);

    const profile = await this.scopus.getAuthorProfile(authorId);
    if (!profile) {
      return { error: 'Scopus verisi alınamadı. Author ID doğru mu? API erişimi var mı?' };
    }

    await this.userRepo.update(user.id, {
      scopusHIndex:   profile.hIndex,
      scopusCitedBy:  profile.citedByCount,
      scopusDocCount: profile.documentCount,
      scopusSubjects: JSON.stringify(profile.subjectAreas || []),
      scopusLastSync: new Date().toISOString(),
    } as any);

    return { success: true, profile };
  }

  // ── 2. PROJE — YAYIN EŞLEŞTİRME ──────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('project/:projectId/related-publications')
  async getProjectRelatedPublications(@Param('projectId') projectId: string) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['owner', 'members', 'members.user'],
    });
    if (!project) return { error: 'Proje bulunamadı' };

    // Proje ekibindeki Scopus ID'lerini topla
    const authorIds: string[] = [];
    if ((project.owner as any)?.scopusAuthorId) authorIds.push((project.owner as any).scopusAuthorId);
    (project.members || []).forEach(m => {
      if ((m.user as any)?.scopusAuthorId) authorIds.push((m.user as any).scopusAuthorId);
    });

    const keywords = [
      ...(project.keywords || []),
      ...(project.tags || []),
    ];

    const pubs = await this.scopus.findRelatedPublications({
      title: project.title,
      keywords,
      authorScopusIds: authorIds,
      limit: 15,
    });

    return { publications: pubs, authorCount: authorIds.length };
  }

  // Yayını projeye bağla (project_publications JSON alanına yaz)
  @UseGuards(JwtAuthGuard)
  @Post('project/:projectId/link-publication')
  async linkPublication(
    @Param('projectId') projectId: string,
    @Body() dto: { scopusId: string; title: string; year: string; journal: string; doi?: string; citedBy?: number },
    @Request() req: any,
  ) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) return { error: 'Proje bulunamadı' };

    const existing: any[] = JSON.parse((project as any).linkedPublicationsJson || '[]');
    const alreadyLinked = existing.some((p: any) => p.scopusId === dto.scopusId);
    if (alreadyLinked) return { error: 'Bu yayın zaten bağlı' };

    existing.push({ ...dto, linkedAt: new Date().toISOString(), linkedBy: req.user.userId });
    await this.projectRepo.update(projectId, { linkedPublicationsJson: JSON.stringify(existing) } as any);
    return { success: true, linked: existing };
  }

  // Projeye bağlı yayınları getir
  @UseGuards(JwtAuthGuard)
  @Get('project/:projectId/linked-publications')
  async getLinkedPublications(@Param('projectId') projectId: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) return [];
    try {
      return JSON.parse((project as any).linkedPublicationsJson || '[]');
    } catch { return []; }
  }

  // Yayın bağlantısını kaldır
  @UseGuards(JwtAuthGuard)
  @Post('project/:projectId/unlink-publication')
  async unlinkPublication(
    @Param('projectId') projectId: string,
    @Body() dto: { scopusId: string },
  ) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) return { error: 'Proje bulunamadı' };
    const existing: any[] = JSON.parse((project as any).linkedPublicationsJson || '[]');
    const filtered = existing.filter((p: any) => p.scopusId !== dto.scopusId);
    await this.projectRepo.update(projectId, { linkedPublicationsJson: JSON.stringify(filtered) } as any);
    return { success: true, linked: filtered };
  }

  // ── 3. BENZER ÇALIŞMA TESPİTİ ────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('similar-research')
  async findSimilarResearch(
    @Body() dto: { title: string; description?: string; keywords?: string[] },
  ) {
    return this.scopus.findSimilarResearch(dto);
  }

  // ── 4. HİBE UYGUNLUK ANALİZİ ─────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('funding-match')
  async getFundingMatch(
    @Body() dto: { keywords: string[]; projectType?: string; title?: string },
  ) {
    if (!dto.keywords?.length && !dto.title) return { subjectAreas: [], recommendations: [] };

    const keywords = dto.keywords?.length ? dto.keywords : dto.title ? dto.title.split(' ').filter(w => w.length > 4) : [];
    const subjectAreas = await this.scopus.getSubjectAreaMatch(keywords, dto.projectType);

    // Alan kodlarına göre fon kaynağı önerileri
    const recommendations = buildFundingRecommendations(subjectAreas.map(a => a.code), dto.projectType);
    return { subjectAreas, recommendations };
  }

  // ── 5. FAKÜLTE / BÖLÜM ANALİTİĞİ ────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('faculty-metrics')
  async getFacultyMetrics(@Query('faculty') faculty?: string, @Query('department') department?: string) {
    const where: any = {};
    if (faculty) where.faculty = faculty;
    if (department) where.department = department;

    const users = await this.userRepo.find({ where });
    const scopusIds = users.map(u => (u as any).scopusAuthorId).filter(Boolean);

    if (!scopusIds.length) {
      return { totalCitations: 0, totalDocuments: 0, avgHIndex: 0, topSubjects: [], authorCount: 0, noScopusIds: true };
    }

    const metrics = await this.scopus.getFacultyMetrics(scopusIds);
    return { ...metrics, faculty, department };
  }
}

// Konu alanlarına + proje türüne göre fon kaynağı önerileri
function buildFundingRecommendations(areaCodes: string[], projectType?: string): any[] {
  const recs: any[] = [];

  const areaMap: Record<string, string[]> = {
    COMP: ['TÜBİTAK 1001', 'TÜBİTAK 1501', 'Horizon Europe — ICT', 'ITEA'],
    ENGI: ['TÜBİTAK 1001', 'TÜBİTAK 1507', 'EUREKA', 'Horizon Europe — EIC'],
    MEDI: ['TÜBİTAK 1001', 'SAĞLIK BAKANLIĞI ArGe', 'Horizon Europe — Health'],
    AGRI: ['TÜBİTAK 1001', 'TAGEM', 'Horizon Europe — Agrifood'],
    ENVI: ['TÜBİTAK 1001', 'ÇEVRE BAKANLIĞI', 'Horizon Europe — Climate'],
    ENER: ['TÜBİTAK 1001', 'YEGM', 'Horizon Europe — Energy'],
    SOCI: ['TÜBİTAK 1001', 'YÖK Teşvik Fonu', 'Horizon Europe — Societies'],
    MATH: ['TÜBİTAK 1001', 'MSRT', 'ERC Starting Grant'],
  };

  const seen = new Set<string>();
  areaCodes.forEach(code => {
    (areaMap[code] || []).forEach(fund => {
      if (!seen.has(fund)) {
        seen.add(fund);
        recs.push({ name: fund, area: code, areaLabel: AREA_LABELS[code] || code, relevance: 'Yüksek' });
      }
    });
  });

  // Proje türüne göre ek öneriler
  if (projectType === 'industry' && !seen.has('TÜBİTAK 1507')) {
    recs.unshift({ name: 'TÜBİTAK 1507', area: 'industry', areaLabel: 'Sanayi', relevance: 'Çok Yüksek' });
  }
  if (projectType === 'eu' && !seen.has('Horizon Europe')) {
    recs.unshift({ name: 'Horizon Europe', area: 'eu', areaLabel: 'AB', relevance: 'Çok Yüksek' });
  }

  return recs.slice(0, 8);
}

const AREA_LABELS: Record<string, string> = {
  COMP: 'Bilgisayar Bilimi', ENGI: 'Mühendislik', MEDI: 'Tıp',
  AGRI: 'Tarım', ENVI: 'Çevre', ENER: 'Enerji', SOCI: 'Sosyal Bilimler', MATH: 'Matematik',
};
