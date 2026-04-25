import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    if (!req.user) return false;

    // JWT payload'ında rol adı varsa önce onu kontrol et - DB sorgusu tasarrufu
    if (req.user.roleName && roles.includes(req.user.roleName)) return true;

    try {
      const user = await this.userRepo.findOne({ where: { id: req.user.userId }, relations: ['role'] });
      if (!user?.role) return false;
      return roles.includes(user.role.name);
    } catch (err) {
      this.logger.error('RolesGuard veritabanı hatası', err as any);
      return false;
    }
  }
}
