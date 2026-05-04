import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { User } from '../database/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  application: ['active', 'cancelled'],
  active:      ['completed', 'suspended', 'cancelled'],
  suspended:   ['active', 'cancelled'],
  completed:   [],
  cancelled:   [],
  pending:     ['active', 'application', 'cancelled'],
};

const STATUS_LABELS: Record<string, string> = {
  application: 'Başvuru Sürecinde', active: 'Aktif', completed: 'Tamamlandı',
  suspended: 'Askıya Alındı', cancelled: 'İptal Edildi', pending: 'Başvuru Sürecinde',
};

// FIX #2: Beyaz liste - normal kullanıcının düzenleyebildiği alanlar
const ALLOWED_UPDATE_FIELDS = [
  'title','description','type','status','faculty','department','budget','fundingSource',
  'startDate','endDate','projectText','ipStatus','ipType','ipRegistrationNo','ipDate','ipNotes',
  'aiComplianceScore','aiComplianceResult',
];

// Yalnızca etik kurul / admin / rektör rolleri bu alanları değiştirebilir
const ETHICS_ONLY_FIELDS = [
  'ethicsRequired','ethicsApproved','ethicsCommittee','ethicsApprovalNo','ethicsApprovalDate',
];

function isEthicsAuthority(roleName?: string): boolean {
  const r = (roleName || '').toLowerCase();
  return r === 'süper admin' || r.includes('etik') || r.includes('rekt') || r.includes('dekan');
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(ProjectMember) private memberRepo: Repository<ProjectMember>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notificationsService: NotificationsService,
    private auditService: AuditService,
  ) {}

  private logSwallowed(context: string, err: unknown) {
    this.logger.warn(`[${context}] ${(err as any)?.message || err}`);
  }

  async findAll(query: any, currentUser: any) {
    const { search, type, faculty, department, status, sdg, budgetMin, budgetMax, dateFrom, dateTo, ownership, fundingSource, page = 1, limit = 20, sortBy = 'createdAt', sortDir = 'DESC' } = query || {};
    const qb = this.projectRepo.createQueryBuilder('project')
      .leftJoinAndSelect('project.owner', 'owner')
      .leftJoinAndSelect('owner.role', 'ownerRole')
      .leftJoinAndSelect('project.members', 'members')
      .leftJoinAndSelect('members.user', 'memberUser');

    const user = await this.userRepo.findOne({ where: { id: currentUser.userId }, relations: ['role'] });
    if (!user) throw new ForbiddenException('Kullanıcı bulunamadı');
    const roleName = user.role?.name;

    if (roleName === 'Akademisyen') {
      qb.andWhere('(project.ownerId = :uid OR members.userId = :uid)', { uid: currentUser.userId });
    } else if (roleName === 'Araştırma Görevlisi') {
      qb.andWhere('members.userId = :uid', { uid: currentUser.userId });
    } else if (roleName === 'Bölüm Başkanı') {
      if (!user.department) return { data: [], total: 0, page: +page, limit: +limit, totalPages: 0 };
      qb.andWhere('project.department = :dept', { dept: user.department });
    } else if (roleName === 'Dekan') {
      if (!user.faculty) return { data: [], total: 0, page: +page, limit: +limit, totalPages: 0 };
      qb.andWhere('project.faculty = :fac', { fac: user.faculty });
    }

    if (search) qb.andWhere('project.title ILIKE :s', { s: '%' + search + '%' });
    if (type) qb.andWhere('project.type = :type', { type });
    if (faculty) qb.andWhere('project.faculty = :faculty', { faculty });
    if (department) qb.andWhere('project.department = :department', { department });
    if (status) {
      if (status === 'application' || status === 'pending') {
        qb.andWhere('project.status IN (:...statuses)', { statuses: ['application', 'pending'] });
      } else {
        qb.andWhere('project.status = :status', { status });
      }
    }
    // ownership filtresi - "benim sahibim olduğum" / "üyesi olduğum" kısıtlaması
    // (Rol bazlı otomatik kısıtlamanın üstüne eklenir, daraltır)
    if (ownership === 'owned') {
      qb.andWhere('project.ownerId = :ownUid', { ownUid: currentUser.userId });
    } else if (ownership === 'member') {
      qb.andWhere('members.userId = :memUid AND project.ownerId != :memUid', { memUid: currentUser.userId });
    } else if (ownership === 'participating') {
      qb.andWhere('(project.ownerId = :partUid OR members.userId = :partUid)', { partUid: currentUser.userId });
    }

    if (budgetMin) qb.andWhere('project.budget >= :bmin', { bmin: +budgetMin });
    if (budgetMax) qb.andWhere('project.budget <= :bmax', { bmax: +budgetMax });
    if (dateFrom) qb.andWhere('project.startDate >= :df', { df: dateFrom });
    if (dateTo) qb.andWhere('project.startDate <= :dt', { dt: dateTo });
    if (sdg) qb.andWhere('project.sdgGoalsJson ILIKE :sdg', { sdg: '%' + sdg + '%' });

    // Fon kaynagi filtresi - drilldown'dan gelir.
    // - "Belirtilmemis" özel deger: fundingSource bos veya null projeleri verir
    // - Birlesik isim ("Rektörlük/BAP" gibi) varsa ayrı parçaları icin partial match
    // - Tek isim ("TÜBİTAK") icin partial match (case insensitive)
    if (fundingSource !== undefined && fundingSource !== '') {
      if (fundingSource === 'Belirtilmemiş' || fundingSource === 'Belirtilmemis') {
        qb.andWhere(`(project.fundingSource IS NULL OR project.fundingSource = '' OR TRIM(project.fundingSource) = '')`);
      } else {
        // Birlesik isimlerin parcalarini ayri OR ile dene + tam ismi de
        const parts = String(fundingSource).split(/[\/,]/).map(s => s.trim()).filter(Boolean);
        const conditions: string[] = [];
        const params: Record<string, string> = {};
        parts.forEach((p, i) => {
          conditions.push(`LOWER(project.fundingSource) LIKE :fs${i}`);
          params[`fs${i}`] = '%' + p.toLowerCase() + '%';
        });
        // Ayrica tam ismin tamamen icermesini de dene
        conditions.push(`LOWER(project.fundingSource) = LOWER(:fsExact)`);
        params['fsExact'] = String(fundingSource);
        qb.andWhere('(' + conditions.join(' OR ') + ')', params);
      }
    }

    // Beyaz listeli sort - SQL injection riski yok
    const ALLOWED_SORT: Record<string, string> = {
      createdAt: 'project.createdAt',
      title: 'project.title',
      budget: 'project.budget',
      startDate: 'project.startDate',
      endDate: 'project.endDate',
      status: 'project.status',
    };
    const sortColumn = ALLOWED_SORT[sortBy] || 'project.createdAt';
    const sortDirection = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortColumn, sortDirection as 'ASC' | 'DESC');
    if (sortColumn !== 'project.createdAt') qb.addOrderBy('project.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb.skip((+page - 1) * +limit).take(+limit).getMany();
    const unique = Array.from(new Map(data.map(p => [p.id, p])).values());

    // Etik review status'ünü topluca çek (N+1 önleme)
    const ids = unique.map(p => p.id);
    const reviewMap: Record<string, string> = {};
    if (ids.length > 0) {
      const reviews = await this.projectRepo.manager.query(
        `SELECT "projectId", "status" FROM "ethics_reviews" WHERE "projectId" = ANY($1::uuid[])`,
        [ids],
      ).catch(() => [] as any[]);
      for (const r of reviews) reviewMap[r.projectId] = r.status;
    }

    return {
      data: unique.map(p => {
        const serialized = this.serialize(p);
        serialized.ethicsReviewStatus = reviewMap[p.id] || null;
        return serialized;
      }),
      total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit),
    };
  }

  // Sanal alanlari (getter/setter) JSON ciktisina ekler
  private serialize(p: Project): any {
    const obj: any = { ...p };
    obj.tags = p.tags;
    obj.keywords = p.keywords;
    obj.sdgGoals = p.sdgGoals;
    obj.dynamicFields = p.dynamicFields;
    obj.intelligenceReport = p.intelligenceReport;
    return obj;
  }

  async findOne(id: string) {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['owner', 'owner.role', 'members', 'members.user', 'members.user.role', 'documents', 'documents.uploadedBy', 'reports', 'reports.author', 'partners'],
    });
    if (!project) throw new NotFoundException('Proje bulunamadi');
    return this.serialize(project);
  }

  async findByUser(userId: string) {
    const owned = await this.projectRepo.find({
      where: { ownerId: userId },
      relations: ['owner', 'members'],
      order: { createdAt: 'DESC' },
    });
    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ['project', 'project.owner'],
    });
    const memberProjects = memberships
      .filter(m => m.project && m.project.ownerId !== userId)
      .map(m => ({ ...m.project, memberRole: m.role }));
    return { owned, member: memberProjects };
  }

  async create(dto: any, ownerId: string) {
    const proj = new Project();
    proj.title = dto.title;
    proj.description = dto.description || null;
    proj.type = dto.type || 'other';
    proj.status = dto.status || 'application';
    proj.faculty = dto.faculty || null;
    proj.department = dto.department || null;
    proj.budget = dto.budget ? +dto.budget : null;
    proj.fundingSource = dto.fundingSource || null;
    proj.startDate = dto.startDate || null;
    proj.endDate = dto.endDate || null;
    proj.ownerId = ownerId;
    proj.tags = Array.isArray(dto.tags) ? dto.tags : [];
    proj.keywords = Array.isArray(dto.keywords) ? dto.keywords : [];
    proj.sdgGoals = Array.isArray(dto.sdgGoals) ? dto.sdgGoals : [];
    proj.dynamicFields = dto.dynamicFields || {};

    const extraFields = ['projectText','ipStatus','ipType','ipRegistrationNo','ipDate','ipNotes',
      'ethicsRequired','ethicsApproved','ethicsCommittee','ethicsApprovalNo','ethicsApprovalDate',
      'aiComplianceScore','aiComplianceResult'];
    for (const f of extraFields) {
      if (dto[f] !== undefined) (proj as any)[f] = dto[f];
    }

    // Proje Zekasi raporu (oluşturma anında hesaplanmış olabilir)
    if (dto.intelligenceReport && typeof dto.intelligenceReport === 'object') {
      proj.intelligenceReport = dto.intelligenceReport;
      proj.intelligenceReportAt = new Date();
    }

    const saved = await this.projectRepo.save(proj);
    await this.auditService.log({
      entityType: 'project', entityId: saved.id, entityTitle: saved.title,
      action: 'created', userId: ownerId,
    }).catch(e => this.logSwallowed('audit:create', e));
    return this.serialize(saved);
  }

  async update(id: string, dto: any, currentUser: any) {
    // KRİTİK: Gerçek entity'yi çek (serialize değil) - aksi halde setter'lar çalışmaz,
    // sdgGoals / tags / keywords JSON alanlarına yazılamaz.
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!project) throw new NotFoundException('Proje bulunamadi');

    const user = await this.userRepo.findOne({ where: { id: currentUser.userId }, relations: ['role'] });
    const isAdmin = user?.role?.name === 'Süper Admin';
    const canSetEthics = isEthicsAuthority(user?.role?.name);

    if (!isAdmin && project.ownerId !== currentUser.userId) {
      throw new ForbiddenException('Bu projeyi duzenleme yetkiniz yok');
    }

    // Beyaz liste - genel alanlar
    const safeDto: Record<string, any> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (dto[field] !== undefined) safeDto[field] = dto[field];
    }
    // Etik alanları sadece yetkili rollere aç
    if (canSetEthics) {
      for (const field of ETHICS_ONLY_FIELDS) {
        if (dto[field] !== undefined) safeDto[field] = dto[field];
      }
      if (safeDto.ethicsRequired !== undefined) safeDto.ethicsRequired = safeDto.ethicsRequired === true || safeDto.ethicsRequired === 'true' || safeDto.ethicsRequired === 1;
      if (safeDto.ethicsApproved !== undefined) safeDto.ethicsApproved = safeDto.ethicsApproved === true || safeDto.ethicsApproved === 'true' || safeDto.ethicsApproved === 1;
    }

    // Degisen alanlari tespit et
    const TRACK = ['title','description','status','type','faculty','department','budget',
      'fundingSource','startDate','endDate','projectText','ipStatus','ipType','ipRegistrationNo',
      'ethicsRequired','ethicsApproved'];
    const changes: Record<string, { from: any; to: any }> = {};
    for (const field of TRACK) {
      if (safeDto[field] !== undefined && String(safeDto[field]) !== String((project as any)[field])) {
        changes[field] = { from: (project as any)[field], to: safeDto[field] };
      }
    }

    const oldStatus = project.status;
    const oldIpStatus = (project as any).ipStatus;
    const oldEthicsApproved = !!(project as any).ethicsApproved;

    // Durum gecis denetimi - admin bypass edebilir
    if (safeDto.status && safeDto.status !== project.status) {
      if (!isAdmin) {
        const allowed = STATUS_TRANSITIONS[project.status] || [];
        if (!allowed.includes(safeDto.status)) {
          throw new BadRequestException(
            '"' + (STATUS_LABELS[project.status] || project.status) + '" durumundan "' + (STATUS_LABELS[safeDto.status] || safeDto.status) + '" durumuna gecis yapilamaz.'
          );
        }
      }
    }

    // Getter/setter alanlar ayri yonet
    if (dto.tags !== undefined) project.tags = Array.isArray(dto.tags) ? dto.tags : [];
    if (dto.keywords !== undefined) project.keywords = Array.isArray(dto.keywords) ? dto.keywords : [];
    if (dto.sdgGoals !== undefined) project.sdgGoals = Array.isArray(dto.sdgGoals) ? dto.sdgGoals : [];
    if (dto.dynamicFields !== undefined) project.dynamicFields = dto.dynamicFields;

    // FIX #2: Object.assign yerine beyaz liste
    for (const [key, val] of Object.entries(safeDto)) {
      (project as any)[key] = val;
    }

    const saved = await this.projectRepo.save(project);

    // Audit log
    if (Object.keys(changes).length > 0) {
      await this.auditService.log({
        entityType: 'project', entityId: id, entityTitle: project.title,
        action: changes.status ? 'status_changed' : 'updated',
        userId: currentUser.userId, detail: changes,
      }).catch(e => this.logSwallowed('audit:update', e));
    }

    // FIX #19: Durum degisikliginde degisikligi yapan kisi haric bildiri
    if (safeDto.status && safeDto.status !== oldStatus) {
      await this.notifyStatusChange(project, safeDto.status, currentUser.userId).catch(e => this.logSwallowed('notify:statusChange', e));
      await this.notifyRectors({
        title: 'Proje Durumu: ' + (STATUS_LABELS[safeDto.status] || safeDto.status),
        message: project.title + (project.owner ? ' - ' + project.owner.firstName + ' ' + project.owner.lastName : ''),
        link: '/projects/' + id,
        type: safeDto.status === 'completed' ? 'success' : 'info',
      });
    }

    // Fikri mulkiyet bildirimi
    if (safeDto.ipStatus && safeDto.ipStatus !== oldIpStatus && safeDto.ipStatus !== 'none') {
      const IP_TR: Record<string, string> = { pending: 'Basvuru Yapildi', registered: 'Tescil Edildi', published: 'Yayimlandi' };
      await this.notifyRectors({
        title: 'Fikri Mulkiyet: ' + (IP_TR[safeDto.ipStatus] || safeDto.ipStatus),
        message: project.title,
        link: '/projects/' + id,
        type: 'info',
      });
    }

    // FIX #8: Boolean karsilastirma duzeltildi
    if (safeDto.ethicsApproved === true && !oldEthicsApproved) {
      await this.notifyRectors({
        title: 'Etik Kurul Onayi Alindi',
        message: project.title,
        link: '/projects/' + id,
        type: 'success',
      });
    }

    return this.serialize(saved);
  }

  // FIX #13: Rekfor yoksa admin'e bildirim, hata loglanir
  private async notifyRectors(notif: { title: string; message: string; link: string; type: string }) {
    try {
      const rectors = await this.userRepo.createQueryBuilder('u')
        .innerJoin('u.role', 'r')
        .where("LOWER(r.name) LIKE '%rekt%' OR LOWER(r.name) LIKE '%dekan%'")
        .getMany();
      const targets = rectors.length > 0 ? rectors : await this.userRepo.createQueryBuilder('u')
        .innerJoin('u.role', 'r')
        .where("r.name = 'Süper Admin'")
        .getMany();
      for (const t of targets) {
        await this.notificationsService.create({ userId: t.id, ...notif }).catch(e => this.logSwallowed('notify:rector', e));
      }
    } catch (e) {
      this.logSwallowed('notify:rector:lookup', e);
    }
  }

  // FIX #19: changedByUserId eklendi
  private async notifyStatusChange(project: Project, newStatus: string, changedByUserId: string) {
    const members = await this.memberRepo.find({ where: { projectId: project.id } });
    const recipients = [project.ownerId, ...members.map(m => m.userId)]
      .filter((v, i, a) => a.indexOf(v) === i)
      .filter(uid => uid !== changedByUserId);
    for (const uid of recipients) {
      await this.notificationsService.create({
        userId: uid,
        title: 'Proje Durumu Guncellendi',
        message: '"' + project.title + '" projesinin durumu "' + (STATUS_LABELS[newStatus] || newStatus) + '" olarak guncellendi.',
        type: newStatus === 'active' ? 'success' : newStatus === 'cancelled' ? 'error' : 'info',
        link: '/projects/' + project.id,
      }).catch(e => this.logSwallowed('notify:statusChange:item', e));
    }
  }

  async remove(id: string, currentUser?: any) {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Proje bulunamadi');

    // Yetki: Süper Admin veya projenin sahibi
    if (currentUser) {
      const user = await this.userRepo.findOne({ where: { id: currentUser.userId }, relations: ['role'] });
      const isAdmin = user?.role?.name === 'Süper Admin';
      if (!isAdmin && project.ownerId !== currentUser.userId) {
        throw new ForbiddenException('Bu projeyi silme yetkiniz yok - sadece proje sahibi veya Süper Admin silebilir');
      }
    }

    // Audit log kayıtlarını temizle (orphan önlemek için)
    await this.auditService.deleteByEntity('project', id).catch(e => this.logSwallowed('audit:deleteByEntity', e));
    await this.projectRepo.remove(project);
    return { deleted: true, id };
  }

  async addMember(projectId: string, dto: { userId: string; role?: string; canUpload?: boolean }, addedBy?: any) {
    // Yetki: Süper Admin veya projenin sahibi üye ekleyebilir
    if (addedBy?.userId) {
      await this.assertProjectOwnerOrAdmin(projectId, addedBy);
    }
    // Race condition önleme: tek transaction içinde find + upsert
    const saved = await this.memberRepo.manager.transaction(async manager => {
      const repo = manager.getRepository(ProjectMember);
      const existing = await repo.findOne({ where: { projectId, userId: dto.userId } });
      if (existing) {
        existing.role = dto.role || existing.role;
        if (dto.canUpload !== undefined) (existing as any).canUpload = dto.canUpload ? 1 : 0;
        return repo.save(existing);
      }
      const member = new ProjectMember();
      member.projectId = projectId;
      member.userId = dto.userId;
      member.role = dto.role || 'researcher';
      (member as any).canUpload = dto.canUpload ? 1 : 0;
      return repo.save(member);
    });

    try {
      const project = await this.projectRepo.findOne({ where: { id: projectId } });
      if (project) {
        const ROLE_LABELS: Record<string, string> = {
          researcher: 'arastirmaci', scholarship: 'bursiyer', advisor: 'daniman',
          coordinator: 'koordinator', assistant: 'asistan',
        };
        await this.auditService.log({
          entityType: 'project', entityId: projectId, entityTitle: project.title,
          action: 'member_added', detail: { userId: dto.userId, role: dto.role },
        }).catch(e => this.logSwallowed('audit:member_added', e));
        await this.notificationsService.create({
          userId: dto.userId,
          title: 'Projeye Eklendiniz',
          message: '"' + project.title + '" projesine ' + (ROLE_LABELS[dto.role || 'researcher'] || dto.role) + ' olarak eklendiniz.',
          type: 'success',
          link: '/projects/' + projectId,
        }).catch(e => this.logSwallowed('notify:member_added', e));
      }
    } catch (e) {
      this.logSwallowed('addMember:postSave', e);
    }
    return saved;
  }

  async updateMember(projectId: string, userId: string, dto: { role?: string; canUpload?: boolean }, currentUser?: any) {
    if (currentUser?.userId) {
      await this.assertProjectOwnerOrAdmin(projectId, currentUser);
    }
    const member = await this.memberRepo.findOne({ where: { projectId, userId } });
    if (!member) throw new NotFoundException('Uye bulunamadi');
    if (dto.role !== undefined) member.role = dto.role;
    if (dto.canUpload !== undefined) (member as any).canUpload = dto.canUpload ? 1 : 0;
    return this.memberRepo.save(member);
  }

  async removeMember(projectId: string, userId: string, currentUser?: any) {
    if (currentUser?.userId) {
      await this.assertProjectOwnerOrAdmin(projectId, currentUser);
    }
    const member = await this.memberRepo.findOne({ where: { projectId, userId } });
    if (!member) throw new NotFoundException('Uye bulunamadi');
    return this.memberRepo.remove(member);
  }

  /**
   * Yetki kontrolü - yalnızca proje sahibi veya Süper Admin proje üzerinde
   * yönetim işlemi (üye ekle/sil, sil) yapabilir.
   */
  private async assertProjectOwnerOrAdmin(projectId: string, currentUser: any): Promise<void> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proje bulunamadi');
    const user = await this.userRepo.findOne({ where: { id: currentUser.userId }, relations: ['role'] });
    const isAdmin = user?.role?.name === 'Süper Admin';
    if (!isAdmin && project.ownerId !== currentUser.userId) {
      throw new ForbiddenException('Bu işlem için proje sahibi veya Süper Admin olmalısınız');
    }
  }

  async findSimilarByTitle(title: string, description?: string, excludeId?: string) {
    if (!title || title.length < 4) return [];
    const all = await this.projectRepo.find({ relations: ['owner'] });
    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const descWords = (description || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);

    const score = (p: Project): number => {
      if (excludeId && p.id === excludeId) return -1;
      let s = 0;
      const tgtTitle = p.title.toLowerCase();
      const tgtDesc = (p.description || '').toLowerCase();
      if (tgtTitle === title.toLowerCase()) s += 100;
      const tgtTitleWords = tgtTitle.split(/\s+/).filter(w => w.length > 2);
      const titleCommon = titleWords.filter(w => tgtTitleWords.includes(w)).length;
      s += Math.min(titleCommon * 15, 60);
      const descCommon = descWords.filter(w => tgtDesc.includes(w) || tgtTitle.includes(w)).length;
      s += Math.min(descCommon * 5, 20);
      return s;
    };

    return all
      .map(p => ({ project: p, score: score(p) }))
      .filter(x => x.score >= 15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => ({ ...x.project, similarityScore: x.score }));
  }

  // FIX #18: budget > 0 filtresi, doğru format
  async getBudgetStats(type?: string, faculty?: string) {
    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        'COUNT(*) as "count"',
        'AVG(p.budget) as "avg"',
        'MIN(p.budget) as "min"',
        'MAX(p.budget) as "max"',
      ])
      .where('p.budget IS NOT NULL AND p.budget > 0');
    if (type) qb.andWhere('p.type = :type', { type });
    if (faculty) qb.andWhere('p.faculty = :faculty', { faculty });
    const raw = await qb.getRawOne();
    return {
      min: raw?.min ? Math.round(+raw.min) : null,
      avg: raw?.avg ? Math.round(+raw.avg) : null,
      max: raw?.max ? Math.round(+raw.max) : null,
      count: raw?.count ? +raw.count : 0,
    };
  }

  async findSimilar(projectId: string) {
    const source = await this.findOne(projectId);
    const all = await this.projectRepo.find({ where: {}, relations: ['owner'] });

    const score = (p: Project): number => {
      if (p.id === projectId) return -1;
      let s = 0;
      if (p.type === source.type) s += 30;
      if (p.faculty && p.faculty === source.faculty) s += 20;
      const srcTags = [...source.tags, ...source.keywords].map(t => t.toLowerCase());
      const tgtTags = [...p.tags, ...p.keywords].map(t => t.toLowerCase());
      s += Math.min(srcTags.filter(t => tgtTags.includes(t)).length * 10, 40);
      s += Math.min(source.sdgGoals.filter(g => p.sdgGoals.includes(g)).length * 5, 20);
      const srcWords = source.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const tgtWords = p.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      s += Math.min(srcWords.filter(w => tgtWords.includes(w)).length * 8, 24);
      return s;
    };

    return all
      .map(p => ({ project: p, score: score(p) }))
      .filter(x => x.score >= 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => ({ ...x.project, similarityScore: x.score }));
  }

  async estimateBudget(params: { type: string; faculty?: string; durationMonths?: number }) {
    const { type, faculty, durationMonths } = params;
    const qb = this.projectRepo.createQueryBuilder('p').where('p.budget IS NOT NULL AND p.budget > 0');
    if (type) qb.andWhere('p.type = :type', { type });
    const projects = await qb.getMany();
    if (projects.length === 0) return { estimate: null, confidence: 0, sampleSize: 0 };

    const budgets = projects.map(p => p.budget || 0).sort((a, b) => a - b);
    const avg = budgets.reduce((s, b) => s + b, 0) / budgets.length;
    const mid = Math.floor(budgets.length / 2);
    const median = budgets.length % 2 === 0
      ? (budgets[mid - 1] + budgets[mid]) / 2
      : budgets[mid];
    let estimate = median;

    if (durationMonths) {
      const withDuration = projects.filter(p => p.startDate && p.endDate);
      if (withDuration.length > 0) {
        const avgDuration = withDuration.reduce((s, p) => {
          return s + (new Date(p.endDate!).getTime() - new Date(p.startDate!).getTime()) / (1000 * 60 * 60 * 24 * 30);
        }, 0) / withDuration.length;
        if (avgDuration > 0) estimate = median * (durationMonths / avgDuration);
      }
    }

    const facultyAvg = faculty
      ? (() => { const fp = projects.filter(p => p.faculty === faculty); return fp.length ? fp.reduce((s, p) => s + (p.budget || 0), 0) / fp.length : null; })()
      : null;

    return {
      estimate: Math.round(estimate), median: Math.round(median), avg: Math.round(avg),
      min: Math.round(budgets[0]), max: Math.round(budgets[budgets.length - 1]),
      p25: Math.round(budgets[Math.floor(budgets.length * 0.25)]),
      p75: Math.round(budgets[Math.floor(budgets.length * 0.75)]),
      facultyAvg: facultyAvg ? Math.round(facultyAvg) : null,
      confidence: Math.min(Math.round((projects.length / 10) * 100), 95),
      sampleSize: projects.length, typeLabel: type,
    };
  }

  async getStats() {
    const [total, active, completed] = await Promise.all([
      this.projectRepo.count(),
      this.projectRepo.count({ where: { status: 'active' } }),
      this.projectRepo.count({ where: { status: 'completed' } }),
    ]);
    const application = await this.projectRepo.createQueryBuilder('p')
      .where('p.status IN (:...s)', { s: ['application', 'pending'] }).getCount();
    const byType = await this.projectRepo.createQueryBuilder('p').select('p.type as type, COUNT(*) as count').groupBy('p.type').getRawMany();
    const byFaculty = await this.projectRepo.createQueryBuilder('p').select('p.faculty as faculty, COUNT(*) as count').where('p.faculty IS NOT NULL').groupBy('p.faculty').getRawMany();
    const byYear = await this.projectRepo.createQueryBuilder('p').select('EXTRACT(YEAR FROM p."startDate"::date)::text as year, COUNT(*) as count').where('p."startDate" IS NOT NULL').groupBy('year').orderBy('year', 'ASC').getRawMany();
    return { total, active, completed, application, byType, byFaculty, byYear };
  }
}
