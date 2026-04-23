import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectPartner } from '../database/entities/project-partner.entity';

@Injectable()
export class PartnersService {
  constructor(@InjectRepository(ProjectPartner) private repo: Repository<ProjectPartner>) {}

  findByProject(projectId: string) {
    return this.repo.find({ where: { projectId }, order: { createdAt: 'ASC' } });
  }

  async create(projectId: string, dto: any) {
    const p = new ProjectPartner();
    Object.assign(p, { projectId, ...dto });
    return this.repo.save(p);
  }

  async update(id: string, dto: any) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    Object.assign(p, dto);
    return this.repo.save(p);
  }

  async remove(id: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    return this.repo.remove(p);
  }

  // ── Kurumsal görünüm ────────────────────────────────────────
  /**
   * Tüm partnerler + kurum bazlı agregasyon (aynı kurum birden fazla projede olabilir).
   */
  async listAll(q: { tier?: string; type?: string; active?: string } = {}) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoin('p.project', 'project')
      .addSelect(['project.id', 'project.title']);
    if (q.tier) qb.andWhere('p.tier = :t', { t: q.tier });
    if (q.type) qb.andWhere('p.type = :ty', { ty: q.type });
    if (q.active === 'true') qb.andWhere('p.isActive = true');
    qb.orderBy('p.createdAt', 'DESC');
    const rows = await qb.getMany();
    return rows.map(p => ({ ...p, projectTitle: (p as any).project?.title }));
  }

  /**
   * Aynı kurum adında (name eşleşmesi) tüm projelerdeki partner kayıtlarını
   * birleştir — portföy görünümü için.
   */
  async listByOrganization() {
    const all = await this.repo.find({ order: { createdAt: 'DESC' } });
    const map = new Map<string, {
      name: string;
      type?: string;
      country?: string;
      sector?: string;
      tier?: string;
      size?: string;
      website?: string;
      projectCount: number;
      totalContractValue: number;
      totalContribution: number;
      activeContracts: number;
      projectIds: string[];
      lastContactDate?: string;
    }>();
    for (const p of all) {
      const key = p.name.trim().toLowerCase();
      const cur = map.get(key) || {
        name: p.name.trim(), type: p.type, country: p.country, sector: p.sector,
        tier: p.tier, size: p.size, website: p.website,
        projectCount: 0, totalContractValue: 0, totalContribution: 0, activeContracts: 0,
        projectIds: [], lastContactDate: undefined,
      };
      cur.projectCount++;
      cur.totalContractValue += Number(p.contractValue || 0);
      cur.totalContribution += Number(p.contributionBudget || 0);
      if (p.isActive) cur.activeContracts++;
      cur.projectIds.push(p.projectId);
      if (p.lastContactDate && (!cur.lastContactDate || p.lastContactDate > cur.lastContactDate)) {
        cur.lastContactDate = p.lastContactDate;
      }
      // İlk bulunanla doldur — en yakın/en güncel özellik
      if (!cur.tier && p.tier) cur.tier = p.tier;
      if (!cur.sector && p.sector) cur.sector = p.sector;
      if (!cur.size && p.size) cur.size = p.size;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.projectCount - a.projectCount);
  }

  /**
   * 30 gün içinde sözleşme yenilenmesi gereken partnerlar — dashboard uyarı için.
   */
  async contractsExpiring(days = 30) {
    const all = await this.repo.createQueryBuilder('p')
      .leftJoin('p.project', 'project')
      .addSelect(['project.id', 'project.title'])
      .where('p.isActive = true')
      .getMany();
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const result: any[] = [];
    for (const p of all) {
      if (!p.contractEndDate) continue;
      const d = new Date(p.contractEndDate);
      if (isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff <= days) {
        result.push({ ...p, projectTitle: (p as any).project?.title, daysLeft: diff });
      }
    }
    return result.sort((a, b) => a.daysLeft - b.daysLeft);
  }
}
