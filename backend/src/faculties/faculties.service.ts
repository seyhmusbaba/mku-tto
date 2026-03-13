import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faculty } from '../database/entities/faculty.entity';

@Injectable()
export class FacultiesService {
  constructor(@InjectRepository(Faculty) private repo: Repository<Faculty>) {}

  findAll() { return this.repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } }); }
  findActive() { return this.repo.find({ where: { isActive: 1 as any }, order: { sortOrder: 'ASC', name: 'ASC' } }); }

  async create(dto: any) {
    const f = new Faculty();
    f.name = dto.name; f.shortName = dto.shortName||null; f.color = dto.color||'#1a3a6b'; f.sortOrder = dto.sortOrder||0;
    return this.repo.save(f);
  }

  async update(id: string, dto: any) {
    const f = await this.repo.findOne({ where: { id } });
    if (!f) throw new Error('Bulunamadı');
    Object.assign(f, dto);
    return this.repo.save(f);
  }

  async remove(id: string) {
    const f = await this.repo.findOne({ where: { id } });
    if (!f) throw new Error('Bulunamadı');
    return this.repo.remove(f);
  }

  async seed() {
    const defaults = ['Mühendislik Fakültesi','Fen-Edebiyat Fakültesi','İktisadi ve İdari Bilimler Fakültesi','Tıp Fakültesi','Eğitim Fakültesi','Güzel Sanatlar, Tasarım ve Mimarlık Fakültesi','Su Ürünleri Fakültesi','Ziraat Fakültesi','Teknoloji Fakültesi','TTO'];
    for (const name of defaults) {
      const ex = await this.repo.findOne({ where: { name } });
      if (!ex) { const f = new Faculty(); f.name = name; f.color = '#1a3a6b'; await this.repo.save(f); }
    }
  }
}
