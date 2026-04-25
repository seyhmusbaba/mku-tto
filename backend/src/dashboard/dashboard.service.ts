import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { ProjectMember } from '../database/entities/project-member.entity';

export type DashboardScope =
  | { kind: 'global' }
  | { kind: 'faculty'; faculty: string }
  | { kind: 'department'; department: string };

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(ProjectMember) private memberRepo: Repository<ProjectMember>,
  ) {}

  private applyScope<T>(qb: SelectQueryBuilder<T>, alias: string, scope: DashboardScope): SelectQueryBuilder<T> {
    if (scope.kind === 'faculty') qb.andWhere(`${alias}.faculty = :scopeFaculty`, { scopeFaculty: scope.faculty });
    if (scope.kind === 'department') qb.andWhere(`${alias}.department = :scopeDepartment`, { scopeDepartment: scope.department });
    return qb;
  }

  // Yönetici dashboard - scope'a göre filtrelenir (global/fakülte/bölüm)
  async getStats(scope: DashboardScope = { kind: 'global' }) {
    const baseQb = () => this.applyScope(this.projectRepo.createQueryBuilder('p'), 'p', scope);

    const [
      totalProjects, activeProjects, completedProjects,
      pendingProjects, suspendedProjects, cancelledProjects
    ] = await Promise.all([
      baseQb().getCount(),
      baseQb().andWhere('p.status = :s', { s: 'active' }).getCount(),
      baseQb().andWhere('p.status = :s', { s: 'completed' }).getCount(),
      baseQb().andWhere("p.status IN ('application','pending')").getCount(),
      baseQb().andWhere('p.status = :s', { s: 'suspended' }).getCount(),
      baseQb().andWhere('p.status = :s', { s: 'cancelled' }).getCount(),
    ]);

    // Kullanıcı sayısı sadece global scope'ta anlamlı
    const totalUsers = scope.kind === 'global'
      ? await this.userRepo.count({ where: { isActive: true as any } })
      : 0;

    const byType = await baseQb().select('p.type as type, COUNT(*) as count').groupBy('p.type').getRawMany();
    const byFaculty = scope.kind === 'global'
      ? await baseQb().select('p.faculty as faculty, COUNT(*) as count').andWhere('p.faculty IS NOT NULL').groupBy('p.faculty').orderBy('count', 'DESC').getRawMany()
      : [];
    const byYear = await baseQb()
      .select(`EXTRACT(YEAR FROM p."startDate"::date)::text as year, COUNT(*) as count`)
      .andWhere('p."startDate" IS NOT NULL')
      .groupBy('year')
      .orderBy('year', 'ASC')
      .getRawMany();
    const byStatus = await baseQb().select('p.status as status, COUNT(*) as count').groupBy('p.status').getRawMany();
    const budgetResult = await baseQb().select('SUM(p.budget) as total, AVG(p.budget) as avg, MAX(p.budget) as max').andWhere('p.budget IS NOT NULL').getRawOne();

    const recentProjectsQb = this.applyScope(
      this.projectRepo.createQueryBuilder('p')
        .leftJoinAndSelect('p.owner', 'owner')
        .leftJoinAndSelect('owner.role', 'ownerRole'),
      'p', scope,
    );
    const recentProjects = await recentProjectsQb.orderBy('p.createdAt', 'DESC').take(8).getMany();

    // En yüksek bütçeli - ayrı sorgu (scope filtreli)
    const topBudget = await this.applyScope(
      this.projectRepo.createQueryBuilder('p').leftJoinAndSelect('p.owner', 'owner'),
      'p', scope,
    )
      .andWhere('p.budget IS NOT NULL AND p.budget > 0')
      .orderBy('p.budget', 'DESC')
      .take(5)
      .getMany();

    const today = new Date().toISOString().split('T')[0];
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const endingSoon = await this.applyScope(this.projectRepo.createQueryBuilder('p'), 'p', scope)
      .andWhere("p.status = 'active'")
      .andWhere("p.endDate >= :today AND p.endDate <= :in30", { today, in30 })
      .getCount();

    return {
      scope: scope.kind,
      scopeValue: scope.kind === 'faculty' ? scope.faculty : scope.kind === 'department' ? scope.department : null,
      totalProjects, activeProjects, completedProjects, pendingProjects,
      suspendedProjects, cancelledProjects, totalUsers, endingSoon,
      byType, byFaculty, byYear, byStatus,
      budget: { total: +budgetResult?.total || 0, avg: +budgetResult?.avg || 0, max: +budgetResult?.max || 0 },
      recentProjects,
      topBudget,
      isPersonal: false,
    };
  }

  // Kullanıcı rolüne göre uygun scope'u döndürür
  async resolveScopeForUser(userId: string, roleName: string): Promise<DashboardScope | null> {
    const r = (roleName || '');
    if (r === 'Süper Admin' || r.toLowerCase().includes('rektör') || r.toLowerCase().includes('rektor')) {
      return { kind: 'global' };
    }
    if (r === 'Dekan') {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user?.faculty) return null;
      return { kind: 'faculty', faculty: user.faculty };
    }
    if (r === 'Bölüm Başkanı') {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user?.department) return null;
      return { kind: 'department', department: user.department };
    }
    return null;
  }

  // Kişisel istatistikler - normal kullanıcılar için
  async getPersonalStats(userId: string) {
    // Kullanıcının yürütücü veya üye olduğu projelerin ID'leri
    const ownedProjects = await this.projectRepo.find({ where: { ownerId: userId }, select: ['id'] });
    const memberships   = await this.memberRepo.find({ where: { userId }, select: ['projectId'] });

    const projectIds = [...new Set([
      ...ownedProjects.map(p => p.id),
      ...memberships.map(m => m.projectId),
    ])];

    if (projectIds.length === 0) {
      return {
        totalProjects: 0, activeProjects: 0, completedProjects: 0,
        pendingProjects: 0, ownedCount: 0, memberCount: 0,
        byStatus: [], byType: [], recentProjects: [],
        budget: { total: 0, avg: 0 },
        isPersonal: true,
      };
    }

    const projects = await this.projectRepo.find({
      where: { id: In(projectIds) },
      relations: ['owner'],
      order: { createdAt: 'DESC' },
    });

    const ownedCount  = ownedProjects.length;
    const memberCount = [...new Set(memberships.map(m => m.projectId))].filter(id => !ownedProjects.map(p=>p.id).includes(id)).length;

    const countByStatus = (status: string) => projects.filter(p => p.status === status).length;

    const byStatus = [
      { status:'application', count: countByStatus('application') + countByStatus('pending') },
      { status:'active',      count: countByStatus('active') },
      { status:'completed',   count: countByStatus('completed') },
      { status:'suspended',   count: countByStatus('suspended') },
      { status:'cancelled',   count: countByStatus('cancelled') },
    ].filter(s => s.count > 0);

    const typeMap: Record<string, number> = {};
    projects.forEach(p => { typeMap[p.type] = (typeMap[p.type]||0) + 1; });
    const byType = Object.entries(typeMap).map(([type,count]) => ({ type, count }));

    const budgetProjects = projects.filter(p => p.budget);
    const totalBudget = budgetProjects.reduce((s,p) => s+(p.budget||0), 0);

    // Kişisel: 30 gün içinde biten aktif projeler
    const today = Date.now();
    const in30 = today + 30 * 86400000;
    const endingSoon = projects.filter(p => {
      if (p.status !== 'active' || !p.endDate) return false;
      const t = new Date(p.endDate).getTime();
      return t >= today && t <= in30;
    }).length;

    return {
      totalProjects: projects.length,
      activeProjects: countByStatus('active'),
      completedProjects: countByStatus('completed'),
      pendingProjects: countByStatus('pending') + countByStatus('application'),
      ownedCount,
      memberCount,
      endingSoon,
      byStatus,
      byType,
      recentProjects: projects.slice(0, 6),
      budget: { total: totalBudget, avg: budgetProjects.length ? Math.round(totalBudget/budgetProjects.length) : 0 },
      isPersonal: true,
    };
  }
}
