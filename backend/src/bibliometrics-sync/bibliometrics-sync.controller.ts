import { Controller, Post, Get, Param, UseGuards, Request, ForbiddenException, Query, NotFoundException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BibliometricsSyncService } from './bibliometrics-sync.service';
import { WosService } from '../integrations/wos.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';

const ADMIN_ROLES = ['Süper Admin', 'Admin', 'Rektör'];

@SkipThrottle()
@Controller('bibliometrics-sync')
@UseGuards(JwtAuthGuard)
export class BibliometricsSyncController {
  constructor(
    private svc: BibliometricsSyncService,
    private wos: WosService,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  /**
   * Debug: WoS'tan bir kullanıcının raw response'unu döner.
   * Mapping sorunlarını çözmek için - admin tek kullanımlık.
   */
  @Get('debug-wos/:userId')
  async debugWos(@Param('userId') userId: string, @Request() req: any) {
    if (req.user.userId !== userId && !ADMIN_ROLES.includes(req.user.roleName)) {
      throw new ForbiddenException('Başka kullanıcıyı debug edemezsiniz');
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    const identifier = user.wosResearcherId || user.orcidId;
    if (!identifier) {
      return { error: 'Kullanıcıda wosResearcherId veya ORCID yok' };
    }
    return this.wos.debugRawResponse(identifier);
  }

  /**
   * Kullanıcı kendi profilini senkronluyor → izinli.
   * Başka kullanıcı için → sadece admin.
   */
  @Post('user/:id')
  syncUser(@Param('id') id: string, @Request() req: any) {
    if (req.user.userId !== id && !ADMIN_ROLES.includes(req.user.roleName)) {
      throw new ForbiddenException('Başka kullanıcıyı senkronlayamazsınız');
    }
    return this.svc.syncUser(id);
  }

  /**
   * Admin: tüm aktif kullanıcıları toplu senkronla (cron uyumlu).
   */
  @Post('all')
  syncAll(@Request() req: any) {
    if (!ADMIN_ROLES.includes(req.user.roleName)) {
      throw new ForbiddenException('Bu işlem admin yetkisi gerektirir');
    }
    return this.svc.syncAll();
  }
}
