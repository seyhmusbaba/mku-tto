import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditLog } from '../database/entities/audit-log.entity';
import { Project } from '../database/entities/project.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { User } from '../database/entities/user.entity';

export type AuditAction =
  | 'created' | 'updated' | 'deleted'
  | 'status_changed' | 'member_added' | 'member_removed' | 'member_role_changed'
  | 'document_uploaded' | 'document_deleted'
  | 'report_added' | 'report_updated' | 'report_deleted'
  | 'partner_added' | 'partner_removed';

// Tum projelere erisimi olan roller
const GLOBAL_ROLES = ['Süper Admin', 'Rektör'];

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private repo: Repository<AuditLog>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(ProjectMember) private memberRepo: Repository<ProjectMember>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async log(params: {
    entityType: string;
    entityId: string;
    entityTitle: string;
    action: AuditAction;
    userId?: string;
    detail?: Record<string, any>;
  }) {
    try {
      const entry = this.repo.create({
        entityType: params.entityType,
        entityId: params.entityId,
        entityTitle: params.entityTitle,
        action: params.action,
        userId: params.userId,
        detail: params.detail ? JSON.stringify(params.detail) : null,
      });
      await this.repo.save(entry);
    } catch {} // audit log hiçbir zaman ana işlemi bozmasın
  }

  async getByEntity(entityType: string, entityId: string, limit = 50) {
    return this.repo.find({
      where: { entityType, entityId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getRecent(limit = 100) {
    return this.repo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Role-based feed: kullanicinin gorebilecegi son aktiviteler.
   *  - Super Admin / Rektor: tum sistem
   *  - Dekan: kendi fakultesindeki projelerin aktiviteleri
   *  - Bolum Baskani: kendi bolumundeki projelerin aktiviteleri
   *  - Diger (Akademisyen, vb): sadece kendi (sahip + uye) projeleri
   */
  async getFeed(userId: string, limit = 20) {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['role'] });
    if (!user) return { scope: 'none', items: [] };

    const roleName = user.role?.name || '';
    const isGlobal = GLOBAL_ROLES.includes(roleName);

    // Global rol: filtre yok
    if (isGlobal) {
      const items = await this.repo.find({
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: limit,
      });
      return { scope: 'global', roleName, items };
    }

    // Kullaniciya gorunecek proje ID'leri
    let projectIds: string[] = [];
    let scope: 'faculty' | 'department' | 'own' = 'own';

    if (roleName === 'Dekan' && user.faculty) {
      const projects = await this.projectRepo.find({
        where: { faculty: user.faculty },
        select: ['id'],
      });
      projectIds = projects.map(p => p.id);
      scope = 'faculty';
    } else if (roleName === 'Bölüm Başkanı' && user.department) {
      const projects = await this.projectRepo.find({
        where: { department: user.department },
        select: ['id'],
      });
      projectIds = projects.map(p => p.id);
      scope = 'department';
    } else {
      // Sadece kendi (sahip + uye)
      const owned = await this.projectRepo.find({ where: { ownerId: userId }, select: ['id'] });
      const memberships = await this.memberRepo.find({ where: { userId }, select: ['projectId'] });
      projectIds = Array.from(new Set([
        ...owned.map(p => p.id),
        ...memberships.map(m => m.projectId).filter(Boolean),
      ]));
      scope = 'own';
    }

    if (projectIds.length === 0) {
      return { scope, roleName, items: [] };
    }

    const items = await this.repo.find({
      where: { entityType: 'project', entityId: In(projectIds) },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return { scope, roleName, items };
  }

  /**
   * Admin audit log paneli için gelişmiş filtreleme.
   */
  async search(q: {
    userId?: string;
    entityType?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const qb = this.repo.createQueryBuilder('a').leftJoinAndSelect('a.user', 'user');
    if (q.userId)     qb.andWhere('a.userId = :u',   { u: q.userId });
    if (q.entityType) qb.andWhere('a.entityType = :e', { e: q.entityType });
    if (q.action)     qb.andWhere('a.action = :ac',  { ac: q.action });
    if (q.from)       qb.andWhere('a.createdAt >= :f', { f: q.from });
    if (q.to)         qb.andWhere('a.createdAt <= :t', { t: q.to });
    const limit = Math.min(+(q.limit || 50), 200);
    const page = Math.max(1, +(q.page || 1));
    qb.orderBy('a.createdAt', 'DESC').skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // FIX #14: Belirli bir entity'nin tum audit kayitlarini sil
  async deleteByEntity(entityType: string, entityId: string) {
    await this.repo.delete({ entityType, entityId });
  }
}
