import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { ProjectReport } from '../database/entities/project-report.entity';
import { SystemSetting } from '../database/entities/system-setting.entity';

// Global erişim rolleri — tüm sistemin analizine erişir
const GLOBAL_ROLES = ['Süper Admin', 'Rektör'];

type AnalyticsScope =
  | { kind: 'global' }
  | { kind: 'faculty'; faculty: string }
  | { kind: 'department'; department: string }
  | { kind: 'user'; userId: string };

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(ProjectReport) private reportRepo: Repository<ProjectReport>,
    @InjectRepository(SystemSetting) private settingRepo: Repository<SystemSetting>,
  ) {}

  // Rol + DB ayarından scope'u çözer
  private async resolveScope(userId: string, roleName: string): Promise<AnalyticsScope> {
    const r = (roleName || '');
    if (GLOBAL_ROLES.includes(r) || r.toLowerCase().includes('rekt')) {
      return { kind: 'global' };
    }
    // Ayarlarda global yetki verilmiş mi?
    try {
      const setting = await this.settingRepo.findOne({ where: { key: 'analytics_full_access_roles' } });
      if (setting?.value) {
        const roles = JSON.parse(setting.value) as string[];
        if (roles.includes(r)) return { kind: 'global' };
      }
    } catch {}
    // Dekan → kendi fakültesi, Bölüm Başkanı → kendi bölümü
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (r === 'Dekan' && user?.faculty) return { kind: 'faculty', faculty: user.faculty };
    if (r === 'Bölüm Başkanı' && user?.department) return { kind: 'department', department: user.department };
    return { kind: 'user', userId };
  }

  private applyScope<T>(qb: SelectQueryBuilder<T>, alias: string, scope: AnalyticsScope): SelectQueryBuilder<T> {
    if (scope.kind === 'faculty') qb.andWhere(`${alias}.faculty = :scopeFaculty`, { scopeFaculty: scope.faculty });
    if (scope.kind === 'department') qb.andWhere(`${alias}.department = :scopeDepartment`, { scopeDepartment: scope.department });
    return qb;
  }

  // Geriye uyumluluk — eski signature kullanan yerler kalırsa false döner
  private async hasFullAccess(roleName: string): Promise<boolean> {
    if (GLOBAL_ROLES.includes(roleName)) return true;
    try {
      const setting = await this.settingRepo.findOne({ where: { key: 'analytics_full_access_roles' } });
      if (setting?.value) {
        const roles = JSON.parse(setting.value) as string[];
        return roles.includes(roleName);
      }
    } catch {}
    return false;
  }

  // Kullanıcının erişebildiği proje ID'leri
  private async getUserProjectIds(userId: string): Promise<string[]> {
    const owned = await this.projectRepo.createQueryBuilder('p')
      .select('p.id')
      .where('p."ownerId" = :userId', { userId })
      .getRawMany();
    const membered = await this.projectRepo.createQueryBuilder('p')
      .innerJoin('project_members', 'pm', 'pm."projectId" = p.id')
      .select('p.id')
      .where('pm."userId" = :userId', { userId })
      .getRawMany();
    const ids = [...new Set([...owned.map(r => r.p_id), ...membered.map(r => r.p_id)])];
    return ids;
  }

  async getOverview(q: { year?: string; faculty?: string; type?: string; from?: string; to?: string }, userId: string, roleName: string) {
    const scope = await this.resolveScope(userId, roleName);
    const qb = this.projectRepo.createQueryBuilder('p');

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return { total: 0, byStatus: [], totalBudget: 0, activeBudget: 0, successRate: 0, avgBudget: 0, restricted: true, scope: scope.kind };
      qb.where('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }

    if (q.year) qb.andWhere(`p."startDate" IS NOT NULL AND SUBSTRING(p."startDate", 1, 4) = :year`, { year: q.year });
    if (q.from) qb.andWhere(`p."startDate" IS NOT NULL AND p."startDate" >= :from`, { from: q.from });
    if (q.to) qb.andWhere(`p."startDate" IS NOT NULL AND p."startDate" <= :to`, { to: q.to });
    if (q.faculty) qb.andWhere('p.faculty = :faculty', { faculty: q.faculty });
    if (q.type) qb.andWhere('p.type = :type', { type: q.type });

    const projects = await qb.getMany();
    const total = projects.length;

    // Sadece gerçekten bulunan statüleri döndür — 0 olanları gizle (hayalet durumları önler)
    const statusCounts: Record<string, number> = {};
    for (const p of projects) {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    }
    const STATUS_ORDER = ['application','pending','active','completed','suspended','cancelled'];
    const byStatus = STATUS_ORDER
      .filter(s => statusCounts[s] > 0)
      .map(s => ({ status: s, count: statusCounts[s] }));

    const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
    const activeBudget = projects.filter(p => p.status === 'active').reduce((s, p) => s + (p.budget || 0), 0);
    // Başarı oranı: sonucu belli olan projeler (tamamlandı + iptal) üzerinden
    const completed = projects.filter(p => p.status === 'completed').length;
    const active = projects.filter(p => p.status === 'active').length;
    const cancelled = projects.filter(p => p.status === 'cancelled').length;
    const pending = projects.filter(p => ['application','pending'].includes(p.status)).length;
    const suspended = projects.filter(p => p.status === 'suspended').length;
    const decided = completed + cancelled;
    const successRate = decided > 0 ? Math.round((completed / decided) * 100) : 0;
    const avgBudget = total > 0 ? Math.round(totalBudget / total) : 0;

    // Proje türüne göre dağılım
    const typeCounts: Record<string, number> = {};
    for (const p of projects) {
      const t = p.type || 'other';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    const byType = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total, byStatus, byType, totalBudget, activeBudget, successRate, avgBudget,
      // Durum bazlı sayılar — frontend'in doğrudan kullanabileceği isimler
      activeProjects: active,
      completedProjects: completed,
      cancelledProjects: cancelled,
      pendingProjects: pending,
      suspendedProjects: suspended,
      completed, decided,
      restricted: scope.kind !== 'global',
      scope: scope.kind,
      scopeValue: scope.kind === 'faculty' ? scope.faculty : scope.kind === 'department' ? scope.department : null,
    };
  }

  async getFacultyPerformance(userId: string, roleName: string) {
    const scope = await this.resolveScope(userId, roleName);
    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        'p.faculty as faculty',
        'COUNT(*) as total',
        `SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed`,
        `SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active`,
        `SUM(CASE WHEN p.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled`,
        'AVG(p.budget) as "avgBudget"',
        'SUM(p.budget) as "totalBudget"',
      ])
      .where('p.faculty IS NOT NULL');

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.andWhere('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }

    const raw = await qb.groupBy('p.faculty').orderBy('total', 'DESC').getRawMany();
    return raw.map(r => {
      const decided = (+r.completed) + (+r.cancelled);
      return {
        faculty: r.faculty, total: +r.total, completed: +r.completed, active: +r.active,
        cancelled: +r.cancelled,
        successRate: decided > 0 ? Math.round((+r.completed / decided) * 100) : 0,
        avgBudget: Math.round(+r.avgBudget || 0), totalBudget: Math.round(+r.totalBudget || 0),
      };
    });
  }

  async getResearcherProductivity(q: { limit?: string }, userId: string, roleName: string) {
    const scope = await this.resolveScope(userId, roleName);
    const limit = parseInt(q.limit || '10');

    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        'p."ownerId" as "ownerId"',
        'COUNT(*) as total',
        `SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed`,
        `SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active`,
        'SUM(p.budget) as "totalBudget"',
      ])
      .where('p."ownerId" IS NOT NULL');

    if (scope.kind === 'user') {
      qb.andWhere('p."ownerId" = :userId', { userId });
    } else {
      this.applyScope(qb, 'p', scope);
    }

    const raw = await qb.groupBy('p."ownerId"').orderBy('total', 'DESC').limit(limit).getRawMany();
    const userIds = raw.map(r => r.ownerId);
    if (!userIds.length) return [];
    const users = await this.userRepo.findByIds(userIds);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    return raw.map(r => {
      const u = userMap[r.ownerId];
      return {
        userId: r.ownerId,
        name: u ? `${u.title || ''} ${u.firstName} ${u.lastName}`.trim() : 'Bilinmiyor',
        faculty: u?.faculty || '—', department: u?.department || '—',
        total: +r.total, completed: +r.completed, active: +r.active,
        totalBudget: Math.round(+r.totalBudget || 0),
        score: +r.total * 10 + +r.completed * 15,
      };
    });
  }

  async getFundingSuccess(userId: string, roleName: string) {
    const scope = await this.resolveScope(userId, roleName);
    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        'p.type as type',
        'COUNT(*) as total',
        `SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed`,
        `SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active`,
        `SUM(CASE WHEN p.status IN ('application','pending') THEN 1 ELSE 0 END) as pending`,
        `SUM(CASE WHEN p.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled`,
        'AVG(p.budget) as "avgBudget"',
        'SUM(p.budget) as "totalBudget"',
      ]);

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.where('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }

    const raw = await qb.groupBy('p.type').orderBy('total', 'DESC').getRawMany();
    return raw.map(r => {
      const decided = (+r.completed) + (+r.cancelled);
      return {
        type: r.type, total: +r.total, completed: +r.completed, active: +r.active,
        pending: +r.pending, cancelled: +r.cancelled,
        successRate: decided > 0 ? Math.round((+r.completed / decided) * 100) : 0,
        avgBudget: Math.round(+r.avgBudget || 0), totalBudget: Math.round(+r.totalBudget || 0),
      };
    });
  }

  async getBudgetUtilization(userId: string, roleName: string) {
    const scope = await this.resolveScope(userId, roleName);
    const qb = this.reportRepo.createQueryBuilder('r')
      .innerJoin('r.project', 'p')
      .select([
        'p.id as "projectId"', 'p.title as title', 'p.budget as budget',
        'p.faculty as faculty', 'p.type as type', 'p.status as status',
        'MAX(r."progressPercent") as progress',
      ])
      .where('r.type = :type', { type: 'financial' });

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.andWhere('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }

    return qb.groupBy('p.id, p.title, p.budget, p.faculty, p.type, p.status').getRawMany();
  }

  async getTimeline(q: { from?: string; to?: string }, userId: string, roleName: string) {
    const scope = await this.resolveScope(userId, roleName);
    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        `SUBSTRING(p."startDate", 1, 7) as month`,
        'COUNT(*) as count',
        'SUM(p.budget) as budget',
      ])
      .where('p."startDate" IS NOT NULL');

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.andWhere('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }

    return qb.groupBy(`SUBSTRING(p."startDate", 1, 7)`).orderBy('month', 'ASC').getRawMany();
  }

  async getExportData(q: any, userId: string, roleName: string) {
    const scope = await this.resolveScope(userId, roleName);
    const qb = this.projectRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.owner', 'owner')
      .leftJoinAndSelect('p.members', 'members')
      .leftJoinAndSelect('p.reports', 'reports')
      .orderBy('p.createdAt', 'DESC');

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.where('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }

    const projects = await qb.getMany();
    return projects.map(p => ({
      id: p.id, title: p.title, status: p.status, type: p.type,
      faculty: p.faculty, department: p.department, budget: p.budget,
      fundingSource: p.fundingSource, startDate: p.startDate, endDate: p.endDate,
      owner: p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : '—',
      ownerEmail: p.owner?.email || '—',
      memberCount: p.members?.length || 0, reportCount: p.reports?.length || 0,
      latestProgress: p.reports?.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.progressPercent || 0,
      tags: p.tags?.join(', ') || '', createdAt: p.createdAt,
    }));
  }
}
