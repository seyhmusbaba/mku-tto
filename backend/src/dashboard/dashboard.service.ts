import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { ProjectMember } from '../database/entities/project-member.entity';

const ADMIN_ROLES = ['Süper Admin'];

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(ProjectMember) private memberRepo: Repository<ProjectMember>,
  ) {}

  // TÜM projeler — sadece admin/yönetici rolüne
  async getStats() {
    const [
      totalProjects, activeProjects, completedProjects,
      pendingProjects, suspendedProjects, cancelledProjects, totalUsers
    ] = await Promise.all([
      this.projectRepo.count(),
      this.projectRepo.count({ where: { status: 'active' } }),
      this.projectRepo.count({ where: { status: 'completed' } }),
      this.projectRepo.createQueryBuilder('p').where("p.status IN ('application','pending')").getCount(),
      this.projectRepo.count({ where: { status: 'suspended' } }),
      this.projectRepo.count({ where: { status: 'cancelled' } }),
      this.userRepo.count({ where: { isActive: 1 as any } }),
    ]);

    const byType     = await this.projectRepo.createQueryBuilder('p').select('p.type as type, COUNT(*) as count').groupBy('p.type').getRawMany();
    const byFaculty  = await this.projectRepo.createQueryBuilder('p').select('p.faculty as faculty, COUNT(*) as count').where('p.faculty IS NOT NULL').groupBy('p.faculty').orderBy('count','DESC').getRawMany();
    const byYear     = await this.projectRepo.createQueryBuilder('p').select('SUBSTR(p.startDate, 1, 4) as year, COUNT(*) as count').where('p.startDate IS NOT NULL').groupBy('year').orderBy('year','ASC').getRawMany();
    const byStatus   = await this.projectRepo.createQueryBuilder('p').select('p.status as status, COUNT(*) as count').groupBy('p.status').getRawMany();
    const budgetResult = await this.projectRepo.createQueryBuilder('p').select('SUM(p.budget) as total, AVG(p.budget) as avg, MAX(p.budget) as max').where('p.budget IS NOT NULL').getRawOne();
    const recentProjects = await this.projectRepo.find({ relations: ['owner', 'owner.role'], order: { createdAt: 'DESC' }, take: 8 });

    const today = new Date().toISOString().split('T')[0];
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const endingSoon = await this.projectRepo.createQueryBuilder('p')
      .where("p.status = 'active'")
      .andWhere("p.endDate >= :today AND p.endDate <= :in30", { today, in30 })
      .getCount();

    return {
      totalProjects, activeProjects, completedProjects, pendingProjects,
      suspendedProjects, cancelledProjects, totalUsers, endingSoon,
      byType, byFaculty, byYear, byStatus,
      budget: { total: +budgetResult?.total||0, avg: +budgetResult?.avg||0, max: +budgetResult?.max||0 },
      recentProjects,
      isPersonal: false,
    };
  }

  // Kişisel istatistikler — normal kullanıcılar için
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

    return {
      totalProjects: projects.length,
      activeProjects: countByStatus('active'),
      completedProjects: countByStatus('completed'),
      pendingProjects: countByStatus('pending') + countByStatus('application'),
      ownedCount,
      memberCount,
      byStatus,
      byType,
      recentProjects: projects.slice(0, 6),
      budget: { total: totalBudget, avg: budgetProjects.length ? Math.round(totalBudget/budgetProjects.length) : 0 },
      isPersonal: true,
    };
  }
}
