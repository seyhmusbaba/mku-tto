import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { User } from '../database/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

// Durum geçiş makinesi
const STATUS_TRANSITIONS: Record<string, string[]> = {
  application: ['active', 'cancelled'],
  active:      ['completed', 'suspended', 'cancelled'],
  suspended:   ['active', 'cancelled'],
  completed:   [],          // terminal
  cancelled:   [],          // terminal
  pending:     ['active', 'application', 'cancelled'], // eski kayıtlar için
};

const STATUS_LABELS: Record<string, string> = {
  application: 'Başvuru Sürecinde', active: 'Aktif', completed: 'Tamamlandı',
  suspended: 'Askıya Alındı', cancelled: 'İptal Edildi', pending: 'Başvuru Sürecinde',
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(ProjectMember) private memberRepo: Repository<ProjectMember>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notificationsService: NotificationsService,
    private auditService: AuditService,
  ) {}

  async findAll(query: any, currentUser: any) {
    const { search, type, faculty, department, status, sdg, budgetMin, budgetMax, dateFrom, dateTo, page = 1, limit = 20 } = query || {};
    const qb = this.projectRepo.createQueryBuilder('project')
      .leftJoinAndSelect('project.owner', 'owner')
      .leftJoinAndSelect('owner.role', 'ownerRole')
      .leftJoinAndSelect('project.members', 'members')
      .leftJoinAndSelect('members.user', 'memberUser');

    const user = await this.userRepo.findOne({ where: { id: currentUser.userId }, relations: ['role'] });
    const roleName = user?.role?.name;

    if (roleName === 'Akademisyen') {
      qb.andWhere('(project.ownerId = :uid OR members.userId = :uid)', { uid: currentUser.userId });
    } else if (roleName === 'Araştırma Görevlisi') {
      qb.andWhere('members.userId = :uid', { uid: currentUser.userId });
    } else if (roleName === 'Bölüm Başkanı') {
      qb.andWhere('project.department = :dept', { dept: user.department });
    } else if (roleName === 'Dekan') {
      qb.andWhere('project.faculty = :fac', { fac: user.faculty });
    }

    if (search) qb.andWhere('project.title ILIKE :s', { s: `%${search}%` });
    if (type) qb.andWhere('project.type = :type', { type });
    if (faculty) qb.andWhere('project.faculty = :faculty', { faculty });
    if (department) qb.andWhere('project.department = :department', { department });
    if (status) {
      // application ve pending aynı şey
      if (status === 'application' || status === 'pending') {
        qb.andWhere('project.status IN (:...statuses)', { statuses: ['application', 'pending'] });
      } else {
        qb.andWhere('project.status = :status', { status });
      }
    }
    if (budgetMin) qb.andWhere('project.budget >= :bmin', { bmin: +budgetMin });
    if (budgetMax) qb.andWhere('project.budget <= :bmax', { bmax: +budgetMax });
    if (dateFrom) qb.andWhere('project.startDate >= :df', { df: dateFrom });
    if (dateTo) qb.andWhere('project.startDate <= :dt', { dt: dateTo });
    if (sdg) qb.andWhere('project.sdgGoalsJson ILIKE :sdg', { sdg: `%${sdg}%` });

    qb.orderBy('project.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb.skip((+page - 1) * +limit).take(+limit).getMany();
    // deduplicate by id (join may cause duplicates)
    const unique = Array.from(new Map(data.map(p => [p.id, p])).values());
    return { data: unique, total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) };
  }

  async findOne(id: string) {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['owner', 'owner.role', 'members', 'members.user', 'members.user.role', 'documents', 'documents.uploadedBy', 'reports', 'reports.author'],
    });
    if (!project) throw new NotFoundException('Proje bulunamadı');
    return project;
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
    // Yeni alanlar
    const extra = ['projectText','ipStatus','ipType','ipRegistrationNo','ipDate','ipNotes','ethicsRequired','ethicsApproved','ethicsCommittee','ethicsApprovalNo','ethicsApprovalDate','aiComplianceScore','aiComplianceResult'];
    for (const f of extra) { if (dto[f] !== undefined) (proj as any)[f] = dto[f]; }
    const saved = await this.projectRepo.save(proj);
    await this.auditService.log({ entityType: 'project', entityId: saved.id, entityTitle: saved.title, action: 'created', userId: ownerId });
    return saved;
  }

  async update(id: string, dto: any, currentUser: any) {
    const project = await this.findOne(id);
    const user = await this.userRepo.findOne({ where: { id: currentUser.userId }, relations: ['role'] });
    if (user?.role?.name !== 'Süper Admin' && project.ownerId !== currentUser.userId) {
      throw new ForbiddenException('Bu projeyi düzenleme yetkiniz yok');
    }

    // ── Değişen alanları tespit et (audit log) ────────────
    const TRACK = ['title','description','status','type','faculty','department','budget','fundingSource','startDate','endDate','projectText','ipStatus','ipType','ipRegistrationNo','ethicsRequired','ethicsApproved'];
    const changes: Record<string, { from: any; to: any }> = {};
    for (const field of TRACK) {
      if (dto[field] !== undefined && String(dto[field]) !== String((project as any)[field])) {
        changes[field] = { from: (project as any)[field], to: dto[field] };
      }
    }

    const oldStatus = project.status;
    const oldIpStatus = (project as any).ipStatus;

    // Durum geçiş denetimi
    if (dto.status && dto.status !== project.status) {
      const allowed = STATUS_TRANSITIONS[project.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(`"${STATUS_LABELS[project.status]}" durumundan "${STATUS_LABELS[dto.status] || dto.status}" durumuna geçiş yapılamaz.`);
      }
    }

    if (dto.tags !== undefined) { project.tags = Array.isArray(dto.tags) ? dto.tags : []; delete dto.tags; }
    if (dto.keywords !== undefined) { project.keywords = Array.isArray(dto.keywords) ? dto.keywords : []; delete dto.keywords; }
    if (dto.sdgGoals !== undefined) { project.sdgGoals = Array.isArray(dto.sdgGoals) ? dto.sdgGoals : []; delete dto.sdgGoals; }
    if (dto.dynamicFields !== undefined) { project.dynamicFields = dto.dynamicFields; delete dto.dynamicFields; }
    Object.assign(project, dto);
    const saved = await this.projectRepo.save(project);

    // ── Audit log ─────────────────────────────────────────
    if (Object.keys(changes).length > 0) {
      await this.auditService.log({
        entityType: 'project', entityId: id, entityTitle: project.title,
        action: changes.status ? 'status_changed' : 'updated',
        userId: currentUser.userId, detail: changes,
      }).catch(() => {});
    }

    // ── Durum değişikliği bildirimleri ─────────────────────
    if (dto.status && dto.status !== oldStatus) {
      await this.notifyStatusChange(project, dto.status, () => {}).catch(() => {});
      await this.notifyRectors({
        title: '📋 Proje Durumu: ' + (STATUS_LABELS[dto.status] || dto.status),
        message: project.title + (project.owner ? ' — ' + project.owner.firstName + ' ' + project.owner.lastName : ''),
        link: '/projects/' + id,
        type: dto.status === 'completed' ? 'success' : 'info',
      });
    }

    // ── Fikri mülkiyet değişikliği ─────────────────────────
    if (dto.ipStatus && dto.ipStatus !== oldIpStatus && dto.ipStatus !== 'none') {
      const IP_TR: Record<string,string> = { pending:'Başvuru Yapıldı', registered:'Tescil Edildi', published:'Yayımlandı' };
      await this.notifyRectors({
        title: '⚖️ Fikri Mülkiyet: ' + (IP_TR[dto.ipStatus] || dto.ipStatus),
        message: project.title,
        link: '/projects/' + id,
        type: 'info',
      });
    }

    // ── Etik kurul onayı ──────────────────────────────────
    if (dto.ethicsApproved === true && !(project as any).ethicsApproved) {
      await this.notifyRectors({
        title: '🔬 Etik Kurul Onayı Alındı',
        message: project.title,
        link: '/projects/' + id,
        type: 'success',
      });
    }

    return saved;
  }

  private async notifyRectors(notif: { title: string; message: string; link: string; type: string }) {
    try {
      const rectors = await this.userRepo.createQueryBuilder('u')
        .innerJoin('u.role', 'r')
        .where("LOWER(r.name) LIKE '%rekt%' OR LOWER(r.name) LIKE '%dekan%'")
        .getMany();
      for (const r of rectors) {
        await this.notificationsService.create({ userId: r.id, ...notif }).catch(() => {});
      }
    } catch {}
  }

  private async notifyStatusChange(project: Project, newStatus: string, _: any) {
    const members = await this.memberRepo.find({ where: { projectId: project.id } });
    const recipients = [project.ownerId, ...members.map(m => m.userId)].filter((v, i, a) => a.indexOf(v) === i);
    for (const uid of recipients) {
      await this.notificationsService.create({
        userId: uid,
        title: 'Proje Durumu Güncellendi',
        message: `"${project.title}" projesinin durumu "${STATUS_LABELS[newStatus]}" olarak güncellendi.`,
        type: newStatus === 'active' ? 'success' : newStatus === 'cancelled' ? 'error' : 'info',
        link: `/projects/${project.id}`,
      }).catch(() => {});
    }
  }

  async remove(id: string) {
    const project = await this.findOne(id);
    return this.projectRepo.remove(project);
  }

  async addMember(projectId: string, dto: { userId: string; role?: string; canUpload?: boolean }, addedBy?: any) {
    const existing = await this.memberRepo.findOne({ where: { projectId, userId: dto.userId } });
    if (existing) {
      existing.role = dto.role || existing.role;
      (existing as any).canUpload = dto.canUpload ? 1 : existing.canUpload;
      return this.memberRepo.save(existing);
    }
    const member = new ProjectMember();
    member.projectId = projectId;
    member.userId = dto.userId;
    member.role = dto.role || 'researcher';
    (member as any).canUpload = dto.canUpload ? 1 : 0;
    const saved = await this.memberRepo.save(member);
    try {
      const project = await this.projectRepo.findOne({ where: { id: projectId } });
      if (project) {
        const ROLE_LABELS: Record<string, string> = {
          researcher: 'araştırmacı', scholarship: 'bursiyer', advisor: 'danışman',
          coordinator: 'koordinatör', assistant: 'asistan',
        };
        await this.auditService.log({ entityType: 'project', entityId: projectId, entityTitle: project.title, action: 'member_added', detail: { userId: dto.userId, role: dto.role } });
        await this.notificationsService.create({
          userId: dto.userId,
          title: 'Projeye Eklendiniz',
          message: `"${project.title}" projesine ${ROLE_LABELS[dto.role || 'researcher'] || dto.role} olarak eklendiniz.`,
          type: 'success',
          link: `/projects/${projectId}`,
        });
      }
    } catch {}
    return saved;
  }

  async updateMember(projectId: string, userId: string, dto: { role?: string; canUpload?: boolean }) {
    const member = await this.memberRepo.findOne({ where: { projectId, userId } });
    if (!member) throw new NotFoundException('Üye bulunamadı');
    if (dto.role !== undefined) member.role = dto.role;
    if (dto.canUpload !== undefined) (member as any).canUpload = dto.canUpload ? 1 : 0;
    return this.memberRepo.save(member);
  }

  async removeMember(projectId: string, userId: string) {
    const member = await this.memberRepo.findOne({ where: { projectId, userId } });
    if (!member) throw new NotFoundException('Üye bulunamadı');
    return this.memberRepo.remove(member);
  }

  // ── Benzer proje dedektörü ─────────────────────────────────────────────────

  // Title/description ile benzer proje ara (yeni proje oluştururken)
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
      // Tam başlık eşleşmesi
      if (tgtTitle === title.toLowerCase()) s += 100;
      // Başlık kelime örtüşmesi
      const tgtTitleWords = tgtTitle.split(/\s+/).filter(w => w.length > 2);
      const titleCommon = titleWords.filter(w => tgtTitleWords.includes(w)).length;
      s += Math.min(titleCommon * 15, 60);
      // Açıklama örtüşmesi
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

  // Budget stats for estimator component
  async getBudgetStats(type?: string, faculty?: string) {
    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        'p.type as type', 'p.faculty as faculty',
        'COUNT(*) as "projectCount"',
        'AVG(p.budget) as "avgBudget"',
        'MIN(p.budget) as "minBudget"',
        'MAX(p.budget) as "maxBudget"',
        '(AVG(EXTRACT(YEAR FROM p."endDate"::date) - EXTRACT(YEAR FROM p."startDate"::date)))::float as "avgDurationYears"',
      ])
      .where('p.budget IS NOT NULL AND p.budget > 0 AND p."startDate" IS NOT NULL AND p."endDate" IS NOT NULL');
    if (type) qb.andWhere('p.type = :type', { type });
    if (faculty) qb.andWhere('p.faculty = :faculty', { faculty });
    const stats = await qb.groupBy('p.type, p.faculty').getRawMany();
    return stats;
  }

  async findSimilar(projectId: string) {
    const source = await this.findOne(projectId);
    const all = await this.projectRepo.find({
      where: {},
      relations: ['owner'],
      select: ['id', 'title', 'type', 'faculty', 'status', 'budget', 'tagsJson', 'keywordsJson', 'sdgGoalsJson', 'ownerId', 'createdAt'] as any,
    });

    const score = (p: Project): number => {
      if (p.id === projectId) return -1;
      let s = 0;
      if (p.type === source.type) s += 30;
      if (p.faculty && p.faculty === source.faculty) s += 20;
      const srcTags = [...source.tags, ...source.keywords].map(t => t.toLowerCase());
      const tgtTags = [...p.tags, ...p.keywords].map(t => t.toLowerCase());
      const common = srcTags.filter(t => tgtTags.includes(t)).length;
      s += Math.min(common * 10, 40);
      const srcSdg = source.sdgGoals;
      const tgtSdg = p.sdgGoals;
      const sdgCommon = srcSdg.filter(g => tgtSdg.includes(g)).length;
      s += Math.min(sdgCommon * 5, 20);
      // Title word overlap
      const srcWords = source.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const tgtWords = p.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const wordCommon = srcWords.filter(w => tgtWords.includes(w)).length;
      s += Math.min(wordCommon * 8, 24);
      return s;
    };

    return all
      .map(p => ({ project: p, score: score(p) }))
      .filter(x => x.score >= 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => ({ ...x.project, similarityScore: x.score }));
  }

  // ── Bütçe tahmin motoru ────────────────────────────────────────────────────
  async estimateBudget(params: { type: string; faculty?: string; durationMonths?: number }) {
    const { type, faculty, durationMonths } = params;
    const qb = this.projectRepo.createQueryBuilder('p')
      .where('p.budget IS NOT NULL AND p.budget > 0');
    if (type) qb.andWhere('p.type = :type', { type });

    const projects = await qb.getMany();
    if (projects.length === 0) return { estimate: null, confidence: 0, sampleSize: 0 };

    const budgets = projects.map(p => p.budget || 0).sort((a, b) => a - b);
    const avg = budgets.reduce((s, b) => s + b, 0) / budgets.length;
    const median = budgets[Math.floor(budgets.length / 2)];
    const min = budgets[0];
    const max = budgets[budgets.length - 1];
    const p25 = budgets[Math.floor(budgets.length * 0.25)];
    const p75 = budgets[Math.floor(budgets.length * 0.75)];

    // Duration adjustment
    let estimate = median;
    if (durationMonths) {
      // Calculate avg duration for comparison
      const withDuration = projects.filter(p => p.startDate && p.endDate);
      if (withDuration.length > 0) {
        const avgDuration = withDuration.reduce((s, p) => {
          const d = (new Date(p.endDate!).getTime() - new Date(p.startDate!).getTime()) / (1000 * 60 * 60 * 24 * 30);
          return s + d;
        }, 0) / withDuration.length;
        if (avgDuration > 0) estimate = median * (durationMonths / avgDuration);
      }
    }

    // Faculty projects for comparison
    let facultyAvg: number | null = null;
    if (faculty) {
      const facProjects = projects.filter(p => p.faculty === faculty);
      if (facProjects.length > 0) {
        facultyAvg = facProjects.reduce((s, p) => s + (p.budget || 0), 0) / facProjects.length;
      }
    }

    const confidence = Math.min(Math.round((projects.length / 10) * 100), 95);

    return {
      estimate: Math.round(estimate),
      median: Math.round(median),
      avg: Math.round(avg),
      min: Math.round(min),
      max: Math.round(max),
      p25: Math.round(p25),
      p75: Math.round(p75),
      facultyAvg: facultyAvg ? Math.round(facultyAvg) : null,
      confidence,
      sampleSize: projects.length,
      typeLabel: type,
    };
  }

  // ── İstatistikler ──────────────────────────────────────────────────────────
  async getStats() {
    const [total, active, completed] = await Promise.all([
      this.projectRepo.count(),
      this.projectRepo.count({ where: { status: 'active' } }),
      this.projectRepo.count({ where: { status: 'completed' } }),
    ]);
    // application + pending
    const applicationQb = this.projectRepo.createQueryBuilder('p')
      .where('p.status IN (:...s)', { s: ['application', 'pending'] });
    const application = await applicationQb.getCount();
    const byType = await this.projectRepo.createQueryBuilder('p').select('p.type as type, COUNT(*) as count').groupBy('p.type').getRawMany();
    const byFaculty = await this.projectRepo.createQueryBuilder('p').select('p.faculty as faculty, COUNT(*) as count').where('p.faculty IS NOT NULL').groupBy('p.faculty').getRawMany();
    const byYear = await this.projectRepo.createQueryBuilder('p').select('EXTRACT(YEAR FROM p."startDate"::date)::text as year, COUNT(*) as count').where('p."startDate" IS NOT NULL').groupBy('year').orderBy('year', 'ASC').getRawMany();
    return { total, active, completed, application, byType, byFaculty, byYear };
  }
}
