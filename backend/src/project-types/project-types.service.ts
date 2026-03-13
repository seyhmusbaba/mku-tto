import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectType } from '../database/entities/project-type.entity';

@Injectable()
export class ProjectTypesService {
  constructor(@InjectRepository(ProjectType) private repo: Repository<ProjectType>) {}

  findAll() { return this.repo.find({ order: { sortOrder: 'ASC', label: 'ASC' } }); }
  findActive() { return this.repo.find({ where: { isActive: 1 as any }, order: { sortOrder: 'ASC', label: 'ASC' } }); }

  async create(dto: any) {
    const existing = await this.repo.findOne({ where: { key: dto.key } });
    if (existing) throw new ConflictException('Bu anahtar zaten mevcut');
    const t = new ProjectType();
    t.key = dto.key.toLowerCase().replace(/\s+/g,'_');
    t.label = dto.label;
    t.color = dto.color || '#1a3a6b';
    t.sortOrder = dto.sortOrder || 0;
    return this.repo.save(t);
  }

  async update(id: string, dto: any) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new Error('Bulunamadı');
    Object.assign(t, dto);
    return this.repo.save(t);
  }

  async remove(id: string) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new Error('Bulunamadı');
    if (t.isSystem) throw new Error('Sistem türleri silinemez');
    return this.repo.remove(t);
  }

  async seed() {
    const defaults = [
      { key:'tubitak', label:'TÜBİTAK', color:'#1d4ed8', isSystem:1 },
      { key:'bap', label:'BAP', color:'#7c3aed', isSystem:1 },
      { key:'eu', label:'AB Projesi', color:'#d97706', isSystem:1 },
      { key:'industry', label:'Sanayi Projesi', color:'#ea580c', isSystem:1 },
      { key:'other', label:'Diğer', color:'#64748b', isSystem:1 },
    ];
    for (const d of defaults) {
      const ex = await this.repo.findOne({ where: { key: d.key } });
      if (!ex) {
        const t = new ProjectType();
        Object.assign(t, d);
        await this.repo.save(t);
      }
    }
  }
}
