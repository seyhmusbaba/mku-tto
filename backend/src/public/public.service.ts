import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { Project } from '../database/entities/project.entity';
import { Publication } from '../database/entities/publication.entity';
import { ProjectPartner } from '../database/entities/project-partner.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { SystemSetting } from '../database/entities/system-setting.entity';

/**
 * Türkçe karakterleri ASCII'ye çeviren ve URL-safe bir slug üretir.
 * "Ebru Polat" → "ebru.polat"
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
 * Vitrin/kamuya açık portal servisi — authentication gerektirmeyen
 * uç noktalar için. AVESİS benzeri ziyaretçi deneyimi sunar.
 *
 * Güvenlik: Bu servisin döndürdüğü veriler ASLA hassas alan içermez
 * (e-posta, telefon, bütçe, iç notlar vs.). Sadece kurumsal olarak
 * açık paylaşılabilir meta veri döner.
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
  async getStats() {
    const [researcherCount, activeProjectCount, publicProjectCount, publicationCount] = await Promise.all([
      this.userRepo.count({ where: { isActive: true as any, isPublic: true } }),
      this.projectRepo.count({ where: { status: 'active' } }),
      this.projectRepo.count({ where: { isPublic: true } }),
      this.pubRepo.count(),
    ]);

    // Toplam atıf — yayınlardaki citations alanının toplamı
    const citationAgg = await this.pubRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.citations), 0)', 'total')
      .getRawOne();
    const totalCitations = +(citationAgg?.total || 0);

    // Scopus'tan beslenen kurumsal h-index toplamı (kullanıcı h-index'lerinin max'ı)
    const hAgg = await this.userRepo
      .createQueryBuilder('u')
      .select('COALESCE(MAX(u."scopusHIndex"), 0)', 'hi')
      .addSelect('COALESCE(SUM(u."scopusCitedBy"), 0)', 'scopusCites')
      .addSelect('COALESCE(SUM(u."scopusDocCount"), 0)', 'scopusDocs')
      .where('u.isPublic = true')
      .getRawOne();

    return {
      researchers: researcherCount,
      publications: publicationCount + +(hAgg?.scopusDocs || 0),
      publicationsManual: publicationCount,
      publicationsScopus: +(hAgg?.scopusDocs || 0),
      citations: totalCitations + +(hAgg?.scopusCites || 0),
      projects: activeProjectCount,
      publicProjects: publicProjectCount,
      maxHIndex: +(hAgg?.hi || 0),
      // Henüz veri yoksa dashboard'ta 0 göstermek yerine "—" göstersin
      hasData: researcherCount + publicationCount > 0,
    };
  }

  // ── Fakülte dağılımı ──────────────────────────────────────
  async getFaculties() {
    const rows = await this.userRepo
      .createQueryBuilder('u')
      .select('u.faculty', 'faculty')
      .addSelect('COUNT(*)', 'count')
      .where('u.isPublic = true')
      .andWhere('u.faculty IS NOT NULL')
      .andWhere('u.faculty != \'\'')
      .groupBy('u.faculty')
      .orderBy('count', 'DESC')
      .getRawMany();
    return rows.map(r => ({ faculty: r.faculty, count: +r.count }));
  }

  // ── Son aktiviteler (landing için) ────────────────────────
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
        id: p.id,
        title: p.title,
        authors: p.authors,
        journal: p.journal,
        year: p.year,
        doi: p.doi,
        type: p.type,
        quartile: p.quartile,
        citations: p.citations,
      })),
      recentProjects: recentProjects.map(p => ({
        id: p.id,
        title: p.title,
        type: p.type,
        status: p.status,
        faculty: p.faculty,
        startDate: p.startDate,
        endDate: p.endDate,
      })),
    };
  }

  // ── Araştırmacı listesi (sayfalı, aranabilir) ─────────────
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
    let user: User | null = null;

    // Önce slug ile ara
    user = await this.userRepo.findOne({ where: { publicSlug: slugOrId, isPublic: true } });
    if (!user) {
      // UUID ise id ile ara
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(slugOrId)) {
        user = await this.userRepo.findOne({ where: { id: slugOrId, isPublic: true } });
      }
    }
    if (!user) throw new NotFoundException('Araştırmacı profili bulunamadı');

    // Slug boşsa otomatik oluştur (geriye dönük uyumluluk)
    if (!user.publicSlug) {
      await this.ensureSlug(user);
    }

    return this.stripUserDetailed(user);
  }

  // ── Profil — yayınlar ─────────────────────────────────────
  async getProfilePublications(slugOrId: string) {
    const user = await this.resolveUser(slugOrId);
    const items = await this.pubRepo.find({
      where: { userId: user.id },
      order: { isFeatured: 'DESC', year: 'DESC', createdAt: 'DESC' },
    });
    return items.map(p => ({
      id: p.id, title: p.title, authors: p.authors, journal: p.journal,
      year: p.year, doi: p.doi, url: p.url, type: p.type,
      citations: p.citations, quartile: p.quartile,
      isOpenAccess: p.isOpenAccess, isFeatured: p.isFeatured,
    }));
  }

  // ── Profil — projeler (sadece public) ─────────────────────
  async getProfileProjects(slugOrId: string) {
    const user = await this.resolveUser(slugOrId);

    // Kullanıcının owner olduğu public projeler
    const owned = await this.projectRepo.find({
      where: { ownerId: user.id, isPublic: true },
      order: { startDate: 'DESC' },
    });

    // Kullanıcının member olduğu public projeler
    const memberRecs = await this.memberRepo.find({ where: { userId: user.id }, relations: ['project'] });
    const memberProjs = memberRecs
      .map(m => m.project)
      .filter(p => p && (p as any).isPublic);

    // Birleştir ve deduplicate
    const map = new Map<string, Project>();
    for (const p of [...owned, ...memberProjs]) {
      if (p && !map.has(p.id)) map.set(p.id, p);
    }

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

  // ── Profil — ortaklıklar / co-author grafik ──────────────
  async getProfileCollaborations(slugOrId: string) {
    const user = await this.resolveUser(slugOrId);

    // Proje ortakları (kurum partnerleri)
    const ownProjects = await this.projectRepo.find({ where: { ownerId: user.id, isPublic: true } });
    const projectIds = ownProjects.map(p => p.id);

    if (projectIds.length === 0) {
      return { organizations: [], coResearchers: [] };
    }

    // Kurumsal ortaklar
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
    const organizations = Array.from(orgMap.values())
      .map(o => ({ name: o.name, projectCount: o.count, sectors: Array.from(o.sectors) }))
      .sort((a, b) => b.projectCount - a.projectCount)
      .slice(0, 30);

    // Birlikte çalıştığı araştırmacılar
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
    const coResearchers = Array.from(coMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

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

  /** Özet card verisi — listeler için az alan. */
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

  /** Profil sayfası için — bio, harici linkler dahil, e-posta dahil DEĞİL. */
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
      // Akademik profil linkleri
      orcidId: u.orcidId,
      googleScholarId: u.googleScholarId,
      researchGateUrl: u.researchGateUrl,
      academiaUrl: u.academiaUrl,
      scopusAuthorId: u.scopusAuthorId,
      wosResearcherId: u.wosResearcherId,
      // Metrikler
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

  // Slug yoksa otomatik ata (benzersizlik kontrolü ile)
  private async ensureSlug(user: User) {
    let base = toSlug(user.firstName, user.lastName);
    if (!base || base === '.') base = user.id.slice(0, 8);
    let candidate = base;
    let i = 1;
    // Başkasınınki ile çakışıyorsa sayı ekle
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.userRepo.findOne({ where: { publicSlug: candidate } });
      if (!existing || existing.id === user.id) break;
      i++;
      candidate = `${base}-${i}`;
    }
    user.publicSlug = candidate;
    await this.userRepo.save(user);
  }

  // Admin kullanımı için — tüm slug'ları bir seferde doldur
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
