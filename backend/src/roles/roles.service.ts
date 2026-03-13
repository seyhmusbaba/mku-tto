import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from '../database/entities/role.entity';
import { Permission } from '../database/entities/permission.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
  ) {}

  findAll() { return this.roleRepo.find({ relations: ['permissions'] }); }
  findAllPermissions() { return this.permRepo.find(); }

  async findOne(id: string) {
    const role = await this.roleRepo.findOne({ where: { id }, relations: ['permissions'] });
    if (!role) throw new NotFoundException('Rol bulunamadı');
    return role;
  }

  async create(dto: any) {
    const perms = dto.permissionIds?.length ? await this.permRepo.find({ where: { id: In(dto.permissionIds) } }) : [];
    const role = this.roleRepo.create({ name: dto.name, description: dto.description, permissions: perms });
    return this.roleRepo.save(role);
  }

  async update(id: string, dto: any) {
    const role = await this.findOne(id);
    if (dto.name) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.permissionIds) role.permissions = dto.permissionIds.length ? await this.permRepo.find({ where: { id: In(dto.permissionIds) } }) : [];
    return this.roleRepo.save(role);
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.isSystem) throw new Error('Sistem rolleri silinemez');
    return this.roleRepo.remove(role);
  }
}
