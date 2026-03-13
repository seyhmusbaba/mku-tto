import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DynamicProjectField } from '../database/entities/dynamic-project-field.entity';

@Injectable()
export class DynamicFieldsService {
  constructor(@InjectRepository(DynamicProjectField) private fieldRepo: Repository<DynamicProjectField>) {}

  findAll() { return this.fieldRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } }); }
  findAllAdmin() { return this.fieldRepo.find({ order: { sortOrder: 'ASC' } }); }

  async create(dto: any) {
    const field = new DynamicProjectField();
    field.name = dto.name;
    field.key = dto.key;
    field.label = dto.label || dto.name;
    field.type = dto.type || 'text';
    field.required = dto.required ? 1 : 0;
    field.isActive = true;
    field.sortOrder = dto.sortOrder || 0;
    if (dto.options) field.options = dto.options;
    return this.fieldRepo.save(field);
  }

  async update(id: string, dto: any) {
    const field = await this.fieldRepo.findOne({ where: { id } });
    if (!field) throw new NotFoundException('Alan bulunamadı');
    if (dto.options) { field.options = dto.options; delete dto.options; }
    Object.assign(field, dto);
    return this.fieldRepo.save(field);
  }

  async remove(id: string) {
    const field = await this.fieldRepo.findOne({ where: { id } });
    if (!field) throw new NotFoundException('Alan bulunamadı');
    return this.fieldRepo.remove(field);
  }
}
