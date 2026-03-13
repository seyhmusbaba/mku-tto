import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportType } from '../database/entities/report-type.entity';

@Injectable()
export class ReportTypesService {
  constructor(@InjectRepository(ReportType) private repo: Repository<ReportType>) {}

  findAll() { return this.repo.find({ order: { sortOrder: 'ASC', label: 'ASC' } }); }
  findActive() { return this.repo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } }); }

  async create(dto: any) {
    const t = new ReportType();
    t.key = dto.key || dto.label.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
    t.label = dto.label;
    t.description = dto.description || null;
    t.color = dto.color || '#1a3a6b';
    t.showProgress = dto.showProgress !== undefined ? (dto.showProgress ? 1 : 0) : 1;
    t.sortOrder = dto.sortOrder || 0;
    return this.repo.save(t);
  }

  async update(id: string, dto: any) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new Error('Bulunamadı');
    if (dto.label !== undefined) t.label = dto.label;
    if (dto.description !== undefined) t.description = dto.description;
    if (dto.color !== undefined) t.color = dto.color;
    if (dto.showProgress !== undefined) t.showProgress = dto.showProgress ? 1 : 0;
    if (dto.isActive !== undefined) t.isActive = !!dto.isActive;
    if (dto.sortOrder !== undefined) t.sortOrder = dto.sortOrder;
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
      { key:'progress',  label:'İlerleme Raporu', color:'#1a3a6b', showProgress:1, isSystem:true, description:'Genel proje ilerlemesini belgeler', sortOrder:0 },
      { key:'milestone', label:'Kilometre Taşı',  color:'#c8a45a', showProgress:1, isSystem:true, description:'Önemli proje dönüm noktaları',   sortOrder:1 },
      { key:'financial', label:'Finansal Rapor',  color:'#059669', showProgress:0, isSystem:true, description:'Bütçe ve harcama durumu',          sortOrder:2 },
      { key:'technical', label:'Teknik Rapor',    color:'#7c3aed', showProgress:0, isSystem:true, description:'Teknik çalışmalar ve bulgular',    sortOrder:3 },
      { key:'risk',      label:'Risk Raporu',     color:'#dc2626', showProgress:0, isSystem:true, description:'Proje riskleri ve önlemleri',       sortOrder:4 },
      { key:'final',     label:'Final Rapor',     color:'#0891b2', showProgress:1, isSystem:true, description:'Proje kapanış ve sonuç raporu',     sortOrder:5 },
    ];
    for (const d of defaults) {
      const ex = await this.repo.findOne({ where: { key: d.key } });
      if (!ex) {
        const t = new ReportType();
        Object.assign(t, d);
        t.isActive = true;
        await this.repo.save(t);
      }
    }
  }
}
