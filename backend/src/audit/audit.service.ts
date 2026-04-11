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

  // FIX #14: Belirli bir entity'nin tum audit kayitlarini sil
  async deleteByEntity(entityType: string, entityId: string) {
    await this.repo.delete({ entityType, entityId });
  }
}
