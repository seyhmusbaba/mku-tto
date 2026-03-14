import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { ProjectReport } from '../database/entities/project-report.entity';
import { SystemSetting } from '../database/entities/system-setting.entity';

// Tüm analitikleri görebilecek roller (DB'den de okunur)
const DEFAULT_FULL_ACCESS_ROLES = ['Süper Admin', 'Dekan', 'Bölüm Başkanı'];

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(ProjectReport) private reportRepo: Repository<ProjectReport>,
    @InjectRepository(SystemSetting) private settingRepo: Repository<SystemSetting>,
  ) {}

  // Tam erişim var mı? — Süper Admin + sistem ayarlarında yetkilendirilen roller
  private async hasFullAccess(roleName: string): Promise<boolean> {
    if (DEFAULT_FULL_ACCESS_ROLES.includes(roleName)) return true;
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

  async getOverview(q: { year?: string; faculty?: string; type?: string }, userId: string, roleName: string) {
    const fullAccess = await this.hasFullAccess(roleName);
    const qb = this.projectRepo.createQueryBuilder('p');
    if (!fullAccess) {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return { total: 0, byStatus: [], totalBudget: 0, activeBudget: 0, successRate: 0, avgBudget: 0, restricted: true };
      qb.where('p.id IN (:...ids)', { ids });
    }
    if (q.year) qb.andWhere(`p."startDate" IS NOT NULL AND SUBSTRING(p."startDate", 1, 4) = :year`, { year: q.year });
    if (q.faculty) qb.andWhere('p.faculty = :faculty', { faculty: q.faculty });
    if (q.type) qb.andWhere('p.type = :type', { type: q.type });

    const projects = await qb.getMany();
    const total = projects.length;
    const byStatus = ['application','pending','active','completed','suspended','cancelled'].map(s => ({
      status: s, count: projects.filter(p => p.status === s).length
    }));
    const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
    const activeBudget = projects.filter(p => p.status === 'active').reduce((s, p) => s + (p.budget || 0), 0);
    const successRate = total > 0 ? Math.round((projects.filter(p => p.status === 'completed').length / total) * 100) : 0;
    const avgBudget = total > 0 ? Math.round(totalBudget / total) : 0;
    return { total, byStatus, totalBudget, activeBudget, successRate, avgBudget, restricted: !fullAccess };
  }

  async getFacultyPerformance(userId: string, roleName: string) {
    const fullAccess = await this.hasFullAccess(roleName);
    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        'p.faculty as faculty',
        'COUNT(*) as total',
        `SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed`,
        `SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active`,
        'AVG(p.budget) as "avgBudget"',
        'SUM(p.budget) as "totalBudget"',
      ])
      .where('p.faculty IS NOT NULL');

    if (!fullAccess) {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.andWhere('p.id IN (:...ids)', { ids });
    }

    const raw = await qb.groupBy('p.faculty').orderBy('total', 'DESC').getRawMany();
    return raw.map(r => ({
      faculty: r.faculty, total: +r.total, completed: +r.completed, active: +r.active,
      successRate: +r.total > 0 ? Math.round((+r.completed / +r.total) * 100) : 0,
      avgBudget: Math.round(+r.avgBudget || 0), totalBudget: Math.round(+r.totalBudget || 0),
    }));
  }

  async getResearcherProductivity(q: { limit?: string }, userId: string, roleName: string) {
    const fullAccess = await this.hasFullAccess(roleName);
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

    if (!fullAccess) {
      // Kendi projelerini göster
      qb.andWhere('p."ownerId" = :userId', { userId });
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
    const fullAccess = await this.hasFullAccess(roleName);
    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        'p.type as type',
        'COUNT(*) as total',
        `SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed`,
        `SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active`,
        `SUM(CASE WHEN p.status IN ('application','pending') THEN 1 ELSE 0 END) as pending`,
        'AVG(p.budget) as "avgBudget"',
        'SUM(p.budget) as "totalBudget"',
      ]);

    if (!fullAccess) {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.where('p.id IN (:...ids)', { ids });
    }

    const raw = await qb.groupBy('p.type').orderBy('total', 'DESC').getRawMany();
    return raw.map(r => ({
      type: r.type, total: +r.total, completed: +r.completed, active: +r.active, pending: +r.pending,
      successRate: +r.total > 0 ? Math.round((+r.completed / +r.total) * 100) : 0,
      avgBudget: Math.round(+r.avgBudget || 0), totalBudget: Math.round(+r.totalBudget || 0),
    }));
  }

  async getBudgetUtilization(userId: string, roleName: string) {
    const fullAccess = await this.hasFullAccess(roleName);
    const qb = this.reportRepo.createQueryBuilder('r')
      .innerJoin('r.project', 'p')
      .select([
        'p.id as "projectId"', 'p.title as title', 'p.budget as budget',
        'p.faculty as faculty', 'p.type as type', 'p.status as status',
        'MAX(r."progressPercent") as progress',
      ])
      .where('r.type = :type', { type: 'financial' });

    if (!fullAccess) {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.andWhere('p.id IN (:...ids)', { ids });
    }

    return qb.groupBy('p.id, p.title, p.budget, p.faculty, p.type, p.status').getRawMany();
  }

  async getTimeline(q: { from?: string; to?: string }, userId: string, roleName: string) {
    const fullAccess = await this.hasFullAccess(roleName);
    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        `SUBSTRING(p."startDate", 1, 7) as month`,
        'COUNT(*) as count',
        'SUM(p.budget) as budget',
      ])
      .where('p."startDate" IS NOT NULL');

    if (!fullAccess) {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.andWhere('p.id IN (:...ids)', { ids });
    }

    return qb.groupBy(`SUBSTRING(p."startDate", 1, 7)`).orderBy('month', 'ASC').getRawMany();
  }

  async getExportData(q: any, userId: string, roleName: string) {
    const fullAccess = await this.hasFullAccess(roleName);
    const qb = this.projectRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.owner', 'owner')
      .leftJoinAndSelect('p.members', 'members')
      .leftJoinAndSelect('p.reports', 'reports')
      .orderBy('p.createdAt', 'DESC');

    if (!fullAccess) {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.where('p.id IN (:...ids)', { ids });
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
