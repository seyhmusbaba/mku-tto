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
}
