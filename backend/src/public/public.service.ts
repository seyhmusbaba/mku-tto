import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { Project } from '../database/entities/project.entity';
import { Publication } from '../database/entities/publication.entity';
import { ProjectPartner } from '../database/entities/project-partner.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { SystemSetting } from '../database/entities/system-setting.entity';
import { OpenAlexService } from '../integrations/openalex.service';
import { ScopusService } from '../scopus/scopus.service';

/**
 * Türkçe karakterleri ASCII'ye çeviren ve URL-safe bir slug üretir.
 */
function toSlug(first: string, last: string): string {
  const tr: Record<string, string> = {
    'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'I': 'i',
    'İ': 'i', 'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u',
  };
  const norm = (s: string) =>
    (s || '').split('').map(c => tr[c] ?? c).join('')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '')
      .replace(/^-+|-+$/g, '');
  return `${norm(first)}.${norm(last)}`.replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '');
}

/**
 * Vitrin (public) portal servisi — anonim ziyaretçilere açık.
 * Hassas veri asla döndürülmez (e-posta, telefon, bütçe, notlar).
 */
@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(User)           private userRepo: Repository<User>,
    @InjectRepository(Project)        private projectRepo: Repository<Project>,
    @InjectRepository(Publication)    private pubRepo: Repository<Publication>,
    @InjectRepository(ProjectPartner) private partnerRepo: Repository<ProjectPartner>,
    @InjectRepository(ProjectMember)  private memberRepo: Repository<ProjectMember>,
    @InjectRepository(SystemSetting)  private settingRepo: Repository<SystemSetting>,
    private openAlex: OpenAlexService,
    private scopus: ScopusService,
  ) {}

  // ── Kurumsal meta ─────────────────────────────────────────
  async getInstitution() {
    const siteName = await this.settingRepo.findOne({ where: { key: 'site_name' } });
    const instName = await this.settingRepo.findOne({ where: { key: 'institution_name' } });
    const logo = await this.settingRepo.findOne({ where: { key: 'logo_url' } });
    return {
      siteName: siteName?.value || 'Hatay Mustafa Kemal Üniversitesi',
      institutionName: instName?.value || siteName?.value || 'Hatay Mustafa Kemal Üniversitesi',
      logoUrl: logo?.value || '',
    };
  }

  // ── Kurumsal istatistikler ────────────────────────────────
  /**
   * Doğru/temiz istatistikler. Çift-saymayı önler.
   * - Araştırmacı = public+active kullanıcı sayısı
   * - Yayın toplamı = kullanıcıların Scopus docCount + WoS docCount'unun max'ı ile
   *   manuel yayın sayılarından büyük olan kullanılır (çakışma riski minimize)
   *   Aslında basitçe Scopus toplamını alıyoruz çünkü en kapsamlı
   * - Atıf toplamı = Scopus toplam atıf
   * - Proje = aktif proje sayısı
   */
  async getStats() {
    // Researcher count
    const researcherCount = await this.userRepo.count({
      where: { isActive: true as any, isPublic: true },
    });

    // Projects
    const [activeProjectCount, publicProjectCount] = await Promise.all([
      this.projectRepo.count({ where: { status: 'active' } }),
      this.projectRepo.count({ where: { isPublic: true } }),
    ]);

    // Kurumsal bibliyometrik toplamlar — SUM yerine en kapsamlı kaynak
    // (Scopus) toplamını baz alıyoruz. WoS paralel bir sayım, manuel
    // yayınlar küçük bir ek. Çift sayma olmasın diye max mantığı değil
    // doğrudan Scopus toplamını gösteriyoruz.
    const scopusAgg = await this.userRepo
      .createQueryBuilder('u')
      .where('u.isPublic = true')
      .andWhere('u.isActive = true')
      .select('COALESCE(SUM(u."scopusDocCount"), 0)', 'docs')
      .addSelect('COALESCE(SUM(u."scopusCitedBy"), 0)', 'cites')
      .addSelect('COALESCE(MAX(u."scopusHIndex"), 0)', 'hmax')
      .getRawOne();

    const wosAgg = await this.userRepo
      .createQueryBuilder('u')
      .where('u.isPublic = true')
      .andWhere('u.isActive = true')
      .select('COALESCE(SUM(u."wosDocCount"), 0)', 'docs')
      .addSelect('COALESCE(SUM(u."wosCitedBy"), 0)', 'cites')
      .getRawOne();

    const manualPubCount = await this.pubRepo.count();

    const scopusDocs = +(scopusAgg?.docs || 0);
    const wosDocs = +(wosAgg?.docs || 0);
    const scopusCites = +(scopusAgg?.cites || 0);
    const wosCites = +(wosAgg?.cites || 0);

    // Yayın — en kapsamlı sayı (Scopus genelde en geniş kapsayan)
    const totalPublications = Math.max(scopusDocs, wosDocs, manualPubCount);
    // Atıf — Scopus öncelikli, WoS fallback
    const totalCitations = Math.max(scopusCites, wosCites);

    return {
      researchers: researcherCount,
      publications: totalPublications,
      citations: totalCitations,
      projects: activeProjectCount,
      publicProjects: publicProjectCount,
      maxHIndex: +(scopusAgg?.hmax || 0),
      // Kaynak detayı — UI isterse gösterir
      sources: {
        scopusPublications: scopusDocs,
        scopusCitations: scopusCites,
        wosPublications: wosDocs,
        wosCitations: wosCites,
        manualPublications: manualPubCount,
      },
      hasData: researcherCount > 0,
    };
  }

  // ── Fakülte dağılımı ──────────────────────────────────────
  async getFaculties() {
    const rows = await this.userRepo
      .createQueryBuilder('u')
      .select('u.faculty', 'faculty')
      .addSelect('COUNT(*)', 'count')
      .where('u.isPublic = true')
      .andWhere('u.isActive = true')
      .andWhere('u.faculty IS NOT NULL')
      .andWhere('u.faculty != \'\'')
      .groupBy('u.faculty')
      .orderBy('count', 'DESC')
      .getRawMany();
    return rows.map(r => ({ faculty: r.faculty, count: +r.count }));
  }

  // ── Son aktiviteler ───────────────────────────────────────
  async getRecent() {
    const [recentUsers, recentPubs, recentProjects] = await Promise.all([
      this.userRepo.find({
        where: { isPublic: true, isActive: true as any },
        order: { updatedAt: 'DESC' },
        take: 8,
      }),
      this.pubRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.projectRepo.find({
        where: { isPublic: true },
        order: { createdAt: 'DESC' },
        take: 6,
      }),
    ]);

    return {
      recentResearchers: recentUsers.map(u => this.stripUser(u)),
      recentPublications: recentPubs.map(p => ({
        id: p.id, title: p.title, authors: p.authors, journal: p.journal,
        year: p.year, doi: p.doi, type: p.type, quartile: p.quartile,
        citations: p.citations,
      })),
      recentProjects: recentProjects.map(p => ({
        id: p.id, title: p.title, type: p.type, status: p.status,
        faculty: p.faculty, startDate: p.startDate, endDate: p.endDate,
      })),
    };
  }

  // ── Araştırmacı listesi ───────────────────────────────────
  async listResearchers(q: {
    search?: string;
    faculty?: string;
    department?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const qb = this.userRepo.createQueryBuilder('u')
      .where('u.isPublic = true')
      .andWhere('u.isActive = true');

    if (q.search) {
      qb.andWhere('(u."firstName" ILIKE :s OR u."lastName" ILIKE :s OR u."expertiseArea" ILIKE :s)', { s: `%${q.search}%` });
    }
    if (q.faculty) qb.andWhere('u.faculty = :f', { f: q.faculty });
    if (q.department) qb.andWhere('u.department = :d', { d: q.department });

    const limit = Math.min(Math.max(+(q.limit || 24), 1), 100);
    const page = Math.max(+(q.page || 1), 1);
    qb.orderBy('u."lastName"', 'ASC').addOrderBy('u."firstName"', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map(u => this.stripUser(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Profil detayı ─────────────────────────────────────────
  async getProfile(slugOrId: string) {
    const user = await this.resolveUser(slugOrId);
    if (!user.publicSlug) await this.ensureSlug(user);
    return this.stripUserDetailed(user);
  }

  /**
   * Profile yayınları — 3 kaynağı birleştir ve deduplicate et:
   *  1. Manuel yayınlar (user_publications)
   *  2. OpenAlex (ORCID ile)
   *  3. Scopus (scopusAuthorId ile)
   *
   * Proje görünürlüğünden bağımsız — araştırmacının yayınları profilinde
   * her zaman görünmeli.
   */
  async getProfilePublications(slugOrId: string) {
    const user = await this.resolveUser(slugOrId);

    // 1) Manuel yayınlar
    const manual = await this.pubRepo.find({
      where: { userId: user.id },
      order: { year: 'DESC', createdAt: 'DESC' },
    });

    // 2) OpenAlex (paralelde, hata olursa boş liste)
    const oaWorks = user.orcidId
      ? await this.openAlex.getAuthorByOrcid(user.orcidId)
          .then(a => a?.id ? this.openAlex.getAuthorWorks(a.id, 100) : [])
          .catch(() => [])
      : [];

    // 3) Scopus
    const scopusPubs = user.scopusAuthorId
      ? await this.scopus.getAuthorPublications(user.scopusAuthorId, 50).catch(() => [])
      : [];

    // Normalize — hepsini aynı şekle getir
    type NormPub = {
      source: 'manual' | 'openalex' | 'scopus';
      key: string;              // dedup anahtarı (DOI veya title+year)
      id: string;
      title: string;
      authors?: string;
      journal?: string;
      year?: number;
      doi?: string;
      url?: string;
      type?: string;
      citations?: number;
      quartile?: string;
      isOpenAccess?: boolean;
      isFeatured?: boolean;
    };

    const all: NormPub[] = [];
    for (const p of manual) {
      all.push({
        source: 'manual',
        key: p.doi ? `doi:${p.doi.toLowerCase()}` : `t:${(p.title || '').toLowerCase().trim()}|${p.year}`,
        id: p.id,
        title: p.title,
        authors: p.authors,
        journal: p.journal,
        year: p.year,
        doi: p.doi,
        url: p.url,
        type: p.type,
        citations: p.citations,
        quartile: p.quartile,
        isOpenAccess: p.isOpenAccess,
        isFeatured: p.isFeatured,
      });
    }
    for (const w of oaWorks) {
      const authors = (w.authors || []).map(a => a.displayName).filter(Boolean).join(', ');
      all.push({
        source: 'openalex',
        key: w.doi ? `doi:${w.doi.toLowerCase()}` : `t:${(w.title || '').toLowerCase().trim()}|${w.publicationYear}`,
        id: w.id,
        title: w.title,
        authors: authors || undefined,
        journal: w.venue?.displayName,
        year: w.publicationYear,
        doi: w.doi,
        url: w.openAccess?.oaUrl,
        type: w.type,
        citations: w.citedBy,
        isOpenAccess: w.openAccess?.isOa,
      });
    }
    for (const s of scopusPubs) {
      const year = s.year ? +s.year : undefined;
      all.push({
        source: 'scopus',
        key: s.doi ? `doi:${String(s.doi).toLowerCase()}` : `t:${(s.title || '').toLowerCase().trim()}|${year}`,
        id: s.scopusId || `scopus-${s.title}`,
        title: s.title,
        journal: s.journal,
        year,
        doi: s.doi,
        citations: s.citedBy,
      });
    }

    // Deduplicate — aynı key için en zengin kaydı tut (manuel > openalex > scopus)
    const priority: Record<string, number> = { manual: 3, openalex: 2, scopus: 1 };
    const merged = new Map<string, NormPub>();
    for (const p of all) {
      const existing = merged.get(p.key);
      if (!existing || priority[p.source] > priority[existing.source]) {
        // Yeni kayıt daha iyi — ama eskisinin boş olmayan alanlarını koru
        if (existing) {
          merged.set(p.key, {
            ...existing,
            ...p,
            authors: p.authors || existing.authors,
            journal: p.journal || existing.journal,
            year: p.year || existing.year,
            doi: p.doi || existing.doi,
            url: p.url || existing.url,
            citations: Math.max(p.citations || 0, existing.citations || 0) || undefined,
            isOpenAccess: p.isOpenAccess || existing.isOpenAccess,
            isFeatured: existing.isFeatured || p.isFeatured,
          });
        } else {
          merged.set(p.key, p);
        }
      } else if (existing) {
        // Eski daha iyi ama yeniden eksik alanları tamamla
        existing.authors = existing.authors || p.authors;
        existing.journal = existing.journal || p.journal;
        existing.year = existing.year || p.year;
        existing.doi = existing.doi || p.doi;
        existing.citations = Math.max(existing.citations || 0, p.citations || 0) || undefined;
      }
    }

    const result = Array.from(merged.values());
    // Sırala: featured > yıl (yeniden eskiye) > atıf
    result.sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
      return (b.citations || 0) - (a.citations || 0);
    });

    // Dış dünyaya source alanını çıkarmadan döndür
    return result.map(({ source, key, ...rest }) => rest);
  }

  // ── Profil — kamuya açık projeler ─────────────────────────
  async getProfileProjects(slugOrId: string) {
    const user = await this.resolveUser(slugOrId);
    const owned = await this.projectRepo.find({
      where: { ownerId: user.id, isPublic: true },
      order: { startDate: 'DESC' },
    });
    const memberRecs = await this.memberRepo.find({ where: { userId: user.id }, relations: ['project'] });
    const memberProjs = memberRecs.map(m => m.project).filter(p => p && (p as any).isPublic);

    const map = new Map<string, Project>();
    for (const p of [...owned, ...memberProjs]) if (p && !map.has(p.id)) map.set(p.id, p);

    return Array.from(map.values()).map(p => ({
      id: p.id,
      title: p.title,
      type: p.type,
      status: p.status,
      faculty: p.faculty,
      department: p.department,
      startDate: p.startDate,
      endDate: p.endDate,
      fundingSource: p.fundingSource,
      description: p.description ? p.description.slice(0, 500) : null,
    }));
  }

  // ── Profil — ortaklıklar / co-author grafiği ──────────────
  async getProfileCollaborations(slugOrId: string) {
    const user = await this.resolveUser(slugOrId);

    // Co-author (proje takım arkadaşları) — public/private fark etmez
    // ama ortaklıklar sadece user'ın sahip olduğu projelerden
    const allProjects = await this.projectRepo.find({ where: { ownerId: user.id } });
    const projectIds = allProjects.map(p => p.id);

    let organizations: any[] = [];
    let coResearchers: any[] = [];

    if (projectIds.length > 0) {
      const partners = await this.partnerRepo
        .createQueryBuilder('p')
        .where('p.projectId IN (:...ids)', { ids: projectIds })
        .getMany();
      const orgMap = new Map<string, { name: string; count: number; sectors: Set<string> }>();
      for (const p of partners) {
        const key = p.name.trim().toLowerCase();
        const cur = orgMap.get(key) || { name: p.name, count: 0, sectors: new Set<string>() };
        cur.count++;
        if ((p as any).sector) cur.sectors.add((p as any).sector);
        orgMap.set(key, cur);
      }
      organizations = Array.from(orgMap.values())
        .map(o => ({ name: o.name, projectCount: o.count, sectors: Array.from(o.sectors) }))
        .sort((a, b) => b.projectCount - a.projectCount)
        .slice(0, 30);

      const members = await this.memberRepo
        .createQueryBuilder('m')
        .leftJoin('m.user', 'user')
        .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.title', 'user.faculty', 'user.avatar', 'user.publicSlug', 'user.isPublic'])
        .where('m.projectId IN (:...ids)', { ids: projectIds })
        .andWhere('m.userId != :uid', { uid: user.id })
        .getMany();

      const coMap = new Map<string, any>();
      for (const m of members) {
        const u = (m as any).user;
        if (!u || !u.isPublic) continue;
        const cur = coMap.get(u.id) || {
          id: u.id, firstName: u.firstName, lastName: u.lastName,
          title: u.title, faculty: u.faculty, avatar: u.avatar,
          slug: u.publicSlug || '',
          count: 0,
        };
        cur.count++;
        coMap.set(u.id, cur);
      }
      coResearchers = Array.from(coMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    }

    return { organizations, coResearchers };
  }

  // ──────────────────────────────────────────────────────────
  //  Yardımcılar
  // ──────────────────────────────────────────────────────────

  private async resolveUser(slugOrId: string): Promise<User> {
    let user = await this.userRepo.findOne({ where: { publicSlug: slugOrId, isPublic: true } });
    if (!user && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(slugOrId)) {
      user = await this.userRepo.findOne({ where: { id: slugOrId, isPublic: true } });
    }
    if (!user) throw new NotFoundException('Araştırmacı bulunamadı');
    return user;
  }

  private stripUser(u: User) {
    return {
      id: u.id,
      slug: u.publicSlug || toSlug(u.firstName, u.lastName),
      firstName: u.firstName,
      lastName: u.lastName,
      title: u.title,
      faculty: u.faculty,
      department: u.department,
      avatar: u.avatar,
      expertiseArea: u.expertiseArea,
      scopusHIndex: u.scopusHIndex,
      scopusCitedBy: u.scopusCitedBy,
      scopusDocCount: u.scopusDocCount,
    };
  }

  private stripUserDetailed(u: User) {
    return {
      id: u.id,
      slug: u.publicSlug || toSlug(u.firstName, u.lastName),
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: `${u.title ? u.title + ' ' : ''}${u.firstName} ${u.lastName}`.trim(),
      title: u.title,
      faculty: u.faculty,
      department: u.department,
      avatar: u.avatar,
      bio: u.bio,
      expertiseArea: u.expertiseArea,
      orcidId: u.orcidId,
      googleScholarId: u.googleScholarId,
      researchGateUrl: u.researchGateUrl,
      academiaUrl: u.academiaUrl,
      scopusAuthorId: u.scopusAuthorId,
      wosResearcherId: u.wosResearcherId,
      scopusHIndex: u.scopusHIndex,
      scopusCitedBy: u.scopusCitedBy,
      scopusDocCount: u.scopusDocCount,
      scopusLastSync: u.scopusLastSync,
      wosHIndex: u.wosHIndex,
      wosCitedBy: u.wosCitedBy,
      wosDocCount: u.wosDocCount,
      memberSince: u.createdAt,
    };
  }

  private async ensureSlug(user: User) {
    let base = toSlug(user.firstName, user.lastName);
    if (!base || base === '.') base = user.id.slice(0, 8);
    let candidate = base;
    let i = 1;
    while (true) {
      const existing = await this.userRepo.findOne({ where: { publicSlug: candidate } });
      if (!existing || existing.id === user.id) break;
      i++;
      candidate = `${base}-${i}`;
    }
    user.publicSlug = candidate;
    await this.userRepo.save(user);
  }

  async backfillSlugs() {
    const users = await this.userRepo.find();
    let count = 0;
    for (const u of users) {
      if (!u.publicSlug) {
        await this.ensureSlug(u);
        count++;
      }
    }
    return { updated: count, total: users.length };
  }
}
