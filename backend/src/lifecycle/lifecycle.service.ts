import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMilestone, ProjectDeliverable, ProjectRisk } from '../database/entities/project-lifecycle.entities';

@Injectable()
export class LifecycleService {
  constructor(
    @InjectRepository(ProjectMilestone) private msRepo: Repository<ProjectMilestone>,
    @InjectRepository(ProjectDeliverable) private delRepo: Repository<ProjectDeliverable>,
    @InjectRepository(ProjectRisk) private riskRepo: Repository<ProjectRisk>,
  ) {}

  // ── Milestones ────────────────────────────────────────────
  listMilestones(projectId: string) {
    return this.msRepo.find({
      where: { projectId },
      order: { orderIndex: 'ASC', dueDate: 'ASC' },
    });
  }

  createMilestone(projectId: string, dto: any) {
    const m = this.msRepo.create({ ...dto, projectId });
    return this.msRepo.save(m);
  }

  async updateMilestone(id: string, dto: any) {
    const m = await this.msRepo.findOne({ where: { id } });
    if (!m) throw new NotFoundException();
    Object.assign(m, dto);
    // Eğer status completed yapıldı ama completedAt yoksa bugünü ata
    if (dto.status === 'completed' && !m.completedAt) {
      m.completedAt = new Date().toISOString().slice(0, 10);
    }
    return this.msRepo.save(m);
  }

  async deleteMilestone(id: string) {
    await this.msRepo.delete(id);
    return { deleted: true };
  }

  // ── Deliverables ─────────────────────────────────────────
  listDeliverables(projectId: string) {
    return this.delRepo.find({
      where: { projectId },
      order: { dueDate: 'ASC', createdAt: 'DESC' },
    });
  }

  createDeliverable(projectId: string, dto: any) {
    const d = this.delRepo.create({ ...dto, projectId });
    return this.delRepo.save(d);
  }

  async updateDeliverable(id: string, dto: any) {
    const d = await this.delRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException();
    Object.assign(d, dto);
    if (dto.status === 'submitted' && !d.deliveredAt) {
      d.deliveredAt = new Date().toISOString().slice(0, 10);
    }
    return this.delRepo.save(d);
  }

  async deleteDeliverable(id: string) {
    await this.delRepo.delete(id);
    return { deleted: true };
  }

  // ── Risks ────────────────────────────────────────────────
  listRisks(projectId: string) {
    return this.riskRepo.find({
      where: { projectId },
      order: { status: 'ASC', createdAt: 'DESC' },
    });
  }

  createRisk(projectId: string, dto: any) {
    const r = this.riskRepo.create({ ...dto, projectId });
    return this.riskRepo.save(r);
  }

  async updateRisk(id: string, dto: any) {
    const r = await this.riskRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException();
    Object.assign(r, dto);
    return this.riskRepo.save(r);
  }

  async deleteRisk(id: string) {
    await this.riskRepo.delete(id);
    return { deleted: true };
  }

  // ── Özet ─────────────────────────────────────────────────
  async getSummary(projectId: string) {
    const [ms, dels, risks] = await Promise.all([
      this.listMilestones(projectId),
      this.listDeliverables(projectId),
      this.listRisks(projectId),
    ]);
    return {
      milestones: {
        total: ms.length,
        completed: ms.filter(m => m.status === 'completed').length,
        inProgress: ms.filter(m => m.status === 'in_progress').length,
        delayed: ms.filter(m => m.status === 'delayed').length,
      },
      deliverables: {
        total: dels.length,
        accepted: dels.filter(d => d.status === 'accepted').length,
        submitted: dels.filter(d => d.status === 'submitted').length,
        pending: dels.filter(d => d.status === 'pending').length,
      },
      risks: {
        total: risks.length,
        open: risks.filter(r => r.status === 'open').length,
        high: risks.filter(r => r.probability === 'high' && r.impact === 'high' && r.status !== 'closed').length,
      },
    };
  }
}
