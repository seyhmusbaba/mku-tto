import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../database/entities/audit-log.entity';

export type AuditAction =
  | 'created' | 'updated' | 'deleted'
  | 'status_changed' | 'member_added' | 'member_removed' | 'member_role_changed'
  | 'document_uploaded' | 'document_deleted'
  | 'report_added' | 'report_updated' | 'report_deleted'
  | 'partner_added' | 'partner_removed';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private repo: Repository<AuditLog>) {}

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
